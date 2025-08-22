package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/apis"

	"vibe-tracker/utils"
)

// LoginAttempt tracks failed login attempts
type LoginAttempt struct {
	Count       int
	LastAttempt time.Time
	LockedUntil time.Time
}

// AuthSecurityMiddleware provides authentication security features
type AuthSecurityMiddleware struct {
	mu                 sync.RWMutex
	failedAttempts     map[string]*LoginAttempt // key: IP or email
	maxFailedAttempts  int
	lockoutDuration    time.Duration
	cleanupTicker      *time.Ticker
	done               chan bool
	enableLogging      bool
}

// NewAuthSecurityMiddleware creates a new authentication security middleware
func NewAuthSecurityMiddleware(maxFailedAttempts int, lockoutDuration time.Duration, enableLogging bool) *AuthSecurityMiddleware {
	m := &AuthSecurityMiddleware{
		failedAttempts:    make(map[string]*LoginAttempt),
		maxFailedAttempts: maxFailedAttempts,
		lockoutDuration:   lockoutDuration,
		cleanupTicker:     time.NewTicker(time.Hour), // Cleanup every hour
		done:              make(chan bool),
		enableLogging:     enableLogging,
	}
	
	// Start cleanup goroutine
	go m.cleanup()
	
	return m
}

// cleanup removes old failed attempt records
func (m *AuthSecurityMiddleware) cleanup() {
	for {
		select {
		case <-m.cleanupTicker.C:
			m.mu.Lock()
			now := time.Now()
			for key, attempt := range m.failedAttempts {
				// Remove records older than 24 hours or that are no longer locked
				if now.Sub(attempt.LastAttempt) > 24*time.Hour || 
				   (attempt.Count < m.maxFailedAttempts && now.After(attempt.LockedUntil)) {
					delete(m.failedAttempts, key)
				}
			}
			m.mu.Unlock()
		case <-m.done:
			m.cleanupTicker.Stop()
			return
		}
	}
}

// Stop stops the cleanup goroutine
func (m *AuthSecurityMiddleware) Stop() {
	close(m.done)
}

// BruteForceProtection middleware to prevent brute force attacks on login
func (m *AuthSecurityMiddleware) BruteForceProtection() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get client identifier (IP address)
			clientIP := m.getClientIP(c)
			
			// Check if client is currently locked out
			if m.isLockedOut(clientIP) {
				if m.enableLogging {
					utils.LogSuspiciousRequest(clientIP, c.Request().Header.Get("User-Agent"), c.Request().URL.Path, "brute_force_blocked")
				}
				
				return apis.NewApiError(http.StatusTooManyRequests, "Too many failed login attempts. Please try again later.", map[string]any{
					"retry_after_minutes": int(m.lockoutDuration.Minutes()),
				})
			}
			
			// Execute the handler
			err := next(c)
			
			// Check if this was a failed login attempt
			if err != nil {
				// Check if it's an authentication error
				if apiErr, ok := err.(*apis.ApiError); ok {
					if apiErr.Code == 401 || apiErr.Code == 400 {
						// This was likely a failed login attempt
						m.recordFailedAttempt(clientIP)
						
						if m.enableLogging {
							attempts := m.getAttemptCount(clientIP)
							utils.LogBruteForceAttempt(clientIP, attempts, m.maxFailedAttempts)
						}
					}
				}
			} else {
				// Successful request - clear failed attempts for this client
				m.clearFailedAttempts(clientIP)
			}
			
			return err
		}
	}
}

// getClientIP extracts the client IP address
func (m *AuthSecurityMiddleware) getClientIP(c echo.Context) string {
	// Try X-Forwarded-For first (for reverse proxies)
	if xff := c.Request().Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	
	// Try X-Real-IP
	if xri := c.Request().Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	
	// Fall back to remote address
	return c.RealIP()
}

// isLockedOut checks if a client is currently locked out
func (m *AuthSecurityMiddleware) isLockedOut(clientID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	attempt, exists := m.failedAttempts[clientID]
	if !exists {
		return false
	}
	
	// Check if lockout period has expired
	if time.Now().After(attempt.LockedUntil) {
		return false
	}
	
	// Client is locked out if they've exceeded max attempts
	return attempt.Count >= m.maxFailedAttempts
}

// recordFailedAttempt records a failed login attempt
func (m *AuthSecurityMiddleware) recordFailedAttempt(clientID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	now := time.Now()
	
	attempt, exists := m.failedAttempts[clientID]
	if !exists {
		attempt = &LoginAttempt{}
		m.failedAttempts[clientID] = attempt
	}
	
	attempt.Count++
	attempt.LastAttempt = now
	
	// If max attempts reached, set lockout period
	if attempt.Count >= m.maxFailedAttempts {
		attempt.LockedUntil = now.Add(m.lockoutDuration)
		
		if m.enableLogging {
			utils.LogBruteForceBlocked(clientID, attempt.LockedUntil)
		}
	}
}

// clearFailedAttempts clears failed attempts for a client (after successful login)
func (m *AuthSecurityMiddleware) clearFailedAttempts(clientID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	if _, exists := m.failedAttempts[clientID]; exists {
		delete(m.failedAttempts, clientID)
	}
}

// getAttemptCount returns the current attempt count for a client
func (m *AuthSecurityMiddleware) getAttemptCount(clientID string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	if attempt, exists := m.failedAttempts[clientID]; exists {
		return attempt.Count
	}
	return 0
}

// GetFailedAttemptsStats returns statistics about failed attempts (for monitoring)
func (m *AuthSecurityMiddleware) GetFailedAttemptsStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	totalClients := len(m.failedAttempts)
	lockedClients := 0
	now := time.Now()
	
	for _, attempt := range m.failedAttempts {
		if attempt.Count >= m.maxFailedAttempts && now.Before(attempt.LockedUntil) {
			lockedClients++
		}
	}
	
	return map[string]interface{}{
		"total_clients_with_failures": totalClients,
		"currently_locked_clients":    lockedClients,
		"max_failed_attempts":         m.maxFailedAttempts,
		"lockout_duration_minutes":    int(m.lockoutDuration.Minutes()),
	}
}

// SessionSecurity provides session-related security features
func (m *AuthSecurityMiddleware) SessionSecurity() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Add session security headers
			c.Response().Header().Set("X-Session-Timeout", "1440") // 24 hours in minutes
			
			// Check for session hijacking indicators
			userAgent := c.Request().Header.Get("User-Agent")
			clientIP := m.getClientIP(c)
			
			// Store initial session info in context for comparison
			c.Set("session_user_agent", userAgent)
			c.Set("session_client_ip", clientIP)
			
			return next(c)
		}
	}
}

// TokenBlacklist manages blacklisted JWT tokens
type TokenBlacklist struct {
	mu              sync.RWMutex
	blacklistedJTIs map[string]time.Time // jti -> expiration time
	cleanupTicker   *time.Ticker
	done            chan bool
}

// NewTokenBlacklist creates a new token blacklist
func NewTokenBlacklist() *TokenBlacklist {
	tb := &TokenBlacklist{
		blacklistedJTIs: make(map[string]time.Time),
		cleanupTicker:   time.NewTicker(time.Hour), // Cleanup every hour
		done:            make(chan bool),
	}
	
	go tb.cleanup()
	
	return tb
}

// cleanup removes expired blacklisted tokens
func (tb *TokenBlacklist) cleanup() {
	for {
		select {
		case <-tb.cleanupTicker.C:
			tb.mu.Lock()
			now := time.Now()
			for jti, expTime := range tb.blacklistedJTIs {
				if now.After(expTime) {
					delete(tb.blacklistedJTIs, jti)
				}
			}
			tb.mu.Unlock()
		case <-tb.done:
			tb.cleanupTicker.Stop()
			return
		}
	}
}

// Stop stops the cleanup goroutine
func (tb *TokenBlacklist) Stop() {
	close(tb.done)
}

// BlacklistToken adds a token to the blacklist
func (tb *TokenBlacklist) BlacklistToken(jti string, expiration time.Time) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.blacklistedJTIs[jti] = expiration
}

// IsBlacklisted checks if a token is blacklisted
func (tb *TokenBlacklist) IsBlacklisted(jti string) bool {
	tb.mu.RLock()
	defer tb.mu.RUnlock()
	
	expTime, exists := tb.blacklistedJTIs[jti]
	if !exists {
		return false
	}
	
	// Check if blacklist entry has expired
	if time.Now().After(expTime) {
		// Clean up expired entry
		go func() {
			tb.mu.Lock()
			delete(tb.blacklistedJTIs, jti)
			tb.mu.Unlock()
		}()
		return false
	}
	
	return true
}

// TokenSecurityMiddleware provides JWT token security features
func (tb *TokenBlacklist) TokenSecurityMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// This middleware would need to be integrated with JWT parsing
			// to check JTI (JWT ID) against the blacklist
			// For now, we'll add it to the request context for use by auth middleware
			c.Set("token_blacklist", tb)
			
			return next(c)
		}
	}
}