package middleware

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/apis"
	"golang.org/x/time/rate"

	"vibe-tracker/utils"
)

// RateLimitType defines different types of rate limits
type RateLimitType int

const (
	AuthEndpoints RateLimitType = iota
	TrackingEndpoints
	SessionEndpoints
	PublicEndpoints
	DocsEndpoints
)

// RateLimitConfig defines rate limit configuration for different endpoint types
type RateLimitConfig struct {
	RequestsPerMinute int
	BurstSize         int
}

// RateLimiter holds rate limiters for different clients
type RateLimiter struct {
	mu       sync.RWMutex
	limiters map[string]*rate.Limiter
	config   RateLimitConfig
	
	// Cleanup ticker to remove stale entries
	cleanupTicker *time.Ticker
	done          chan bool
}

// RateLimitMiddleware provides rate limiting functionality
type RateLimitMiddleware struct {
	authLimiter    *RateLimiter
	trackLimiter   *RateLimiter
	sessionLimiter *RateLimiter
	publicLimiter  *RateLimiter
	docsLimiter    *RateLimiter
}

// NewRateLimitMiddleware creates a new rate limiting middleware
func NewRateLimitMiddleware() *RateLimitMiddleware {
	configs := map[RateLimitType]RateLimitConfig{
		AuthEndpoints:     {RequestsPerMinute: 5, BurstSize: 2},    // Strict for auth
		TrackingEndpoints: {RequestsPerMinute: 60, BurstSize: 10},  // High for tracking
		SessionEndpoints:  {RequestsPerMinute: 30, BurstSize: 5},   // Moderate for sessions
		PublicEndpoints:   {RequestsPerMinute: 100, BurstSize: 20}, // Generous for public
		DocsEndpoints:     {RequestsPerMinute: 10, BurstSize: 3},   // Low for docs
	}

	return &RateLimitMiddleware{
		authLimiter:    newRateLimiter(configs[AuthEndpoints]),
		trackLimiter:   newRateLimiter(configs[TrackingEndpoints]),
		sessionLimiter: newRateLimiter(configs[SessionEndpoints]),
		publicLimiter:  newRateLimiter(configs[PublicEndpoints]),
		docsLimiter:    newRateLimiter(configs[DocsEndpoints]),
	}
}

// newRateLimiter creates a new rate limiter with cleanup
func newRateLimiter(config RateLimitConfig) *RateLimiter {
	rl := &RateLimiter{
		limiters:      make(map[string]*rate.Limiter),
		config:        config,
		cleanupTicker: time.NewTicker(time.Minute * 10), // Cleanup every 10 minutes
		done:          make(chan bool),
	}

	// Start cleanup goroutine
	go rl.cleanup()
	
	return rl
}

// cleanup removes stale rate limiters to prevent memory leaks
func (rl *RateLimiter) cleanup() {
	for {
		select {
		case <-rl.cleanupTicker.C:
			rl.mu.Lock()
			// Remove limiters that haven't been used recently
			for key, limiter := range rl.limiters {
				// If limiter allows more than its burst capacity, it's been idle
				if limiter.TokensAt(time.Now()) >= float64(rl.config.BurstSize) {
					delete(rl.limiters, key)
				}
			}
			rl.mu.Unlock()
		case <-rl.done:
			rl.cleanupTicker.Stop()
			return
		}
	}
}

// Stop stops the cleanup goroutine
func (rl *RateLimiter) Stop() {
	close(rl.done)
}

// getLimiter gets or creates a rate limiter for a specific client
func (rl *RateLimiter) getLimiter(clientID string) *rate.Limiter {
	rl.mu.RLock()
	limiter, exists := rl.limiters[clientID]
	rl.mu.RUnlock()

	if exists {
		return limiter
	}

	// Create new limiter
	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Double-check after acquiring write lock
	if limiter, exists := rl.limiters[clientID]; exists {
		return limiter
	}

	// Convert requests per minute to requests per second
	rps := rate.Limit(float64(rl.config.RequestsPerMinute) / 60.0)
	limiter = rate.NewLimiter(rps, rl.config.BurstSize)
	rl.limiters[clientID] = limiter

	return limiter
}

// allow checks if a request should be allowed
func (rl *RateLimiter) allow(clientID string) bool {
	limiter := rl.getLimiter(clientID)
	return limiter.Allow()
}

// getClientID extracts client identifier from request
func (m *RateLimitMiddleware) getClientID(c echo.Context, useUserID bool) string {
	// For authenticated endpoints, use user ID if available and requested
	if useUserID {
		if record, exists := GetAuthUser(c); exists {
			return fmt.Sprintf("user:%s", record.Id)
		}
	}

	// Fall back to IP address
	ip := m.getClientIP(c)
	return fmt.Sprintf("ip:%s", ip)
}

// getClientIP extracts client IP from request
func (m *RateLimitMiddleware) getClientIP(c echo.Context) string {
	// Check X-Forwarded-For header (for reverse proxies)
	if xff := c.Request().Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the chain
		if ip := net.ParseIP(xff); ip != nil {
			return ip.String()
		}
	}

	// Check X-Real-IP header
	if xri := c.Request().Header.Get("X-Real-IP"); xri != "" {
		if ip := net.ParseIP(xri); ip != nil {
			return ip.String()
		}
	}

	// Fall back to remote address
	ip, _, err := net.SplitHostPort(c.Request().RemoteAddr)
	if err != nil {
		return c.Request().RemoteAddr
	}
	return ip
}

// rateLimitError creates a standardized rate limit error response
func (m *RateLimitMiddleware) rateLimitError(c echo.Context, clientID string, limitType string) error {
	ip := m.getClientIP(c)
	
	// Log the rate limit violation
	utils.LogRateLimitViolation(ip, c.Request().URL.Path, 0)

	return apis.NewBadRequestError("Rate limit exceeded. Please try again later.", map[string]any{
		"error_type": "rate_limit_exceeded",
		"retry_after": "60s",
	})
}

// AuthEndpoints creates rate limiting middleware for authentication endpoints
func (m *RateLimitMiddleware) AuthEndpoints() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			clientID := m.getClientID(c, false) // Use IP for auth endpoints
			
			if !m.authLimiter.allow(clientID) {
				return m.rateLimitError(c, clientID, "auth")
			}
			
			return next(c)
		}
	}
}

// TrackingEndpoints creates rate limiting middleware for location tracking endpoints
func (m *RateLimitMiddleware) TrackingEndpoints() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			clientID := m.getClientID(c, true) // Use user ID for tracking endpoints
			
			if !m.trackLimiter.allow(clientID) {
				return m.rateLimitError(c, clientID, "tracking")
			}
			
			return next(c)
		}
	}
}

// SessionEndpoints creates rate limiting middleware for session management endpoints
func (m *RateLimitMiddleware) SessionEndpoints() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			clientID := m.getClientID(c, true) // Use user ID for session endpoints
			
			if !m.sessionLimiter.allow(clientID) {
				return m.rateLimitError(c, clientID, "session")
			}
			
			return next(c)
		}
	}
}

// PublicEndpoints creates rate limiting middleware for public endpoints
func (m *RateLimitMiddleware) PublicEndpoints() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			clientID := m.getClientID(c, false) // Use IP for public endpoints
			
			if !m.publicLimiter.allow(clientID) {
				return m.rateLimitError(c, clientID, "public")
			}
			
			return next(c)
		}
	}
}

// DocsEndpoints creates rate limiting middleware for documentation endpoints
func (m *RateLimitMiddleware) DocsEndpoints() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			clientID := m.getClientID(c, false) // Use IP for docs endpoints
			
			if !m.docsLimiter.allow(clientID) {
				return m.rateLimitError(c, clientID, "docs")
			}
			
			return next(c)
		}
	}
}

// Cleanup stops all cleanup goroutines (call this on application shutdown)
func (m *RateLimitMiddleware) Cleanup() {
	m.authLimiter.Stop()
	m.trackLimiter.Stop()
	m.sessionLimiter.Stop()
	m.publicLimiter.Stop()
	m.docsLimiter.Stop()
}