package middleware

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/apis"

	"vibe-tracker/utils"
)

// NotFoundAttempt tracks 404 attempts from an IP
type NotFoundAttempt struct {
	Count     int
	FirstSeen time.Time
	LastSeen  time.Time
}

// BlockedIP represents a blocked IP address
type BlockedIP struct {
	IP        string
	BlockedAt time.Time
	Reason    string
	Until     time.Time
}

// NotFoundProtectionConfig defines configuration for 404 protection
type NotFoundProtectionConfig struct {
	Enabled               bool
	Max404PerMinute       int
	Max404PerHour         int
	BlockDuration         time.Duration
	CleanupInterval       time.Duration
	WhitelistedIPs        []string
	LogBlocked            bool
	LogSuspiciousPatterns bool
}

// NotFoundProtection provides protection against 404 scanning attacks
type NotFoundProtection struct {
	mu            sync.RWMutex
	attempts      map[string]*NotFoundAttempt
	blocked       map[string]*BlockedIP
	config        NotFoundProtectionConfig
	whitelistMap  map[string]bool
	cleanupTicker *time.Ticker
	done          chan bool
}

// NewNotFoundProtection creates a new 404 protection middleware
func NewNotFoundProtection(config NotFoundProtectionConfig) *NotFoundProtection {
	if config.CleanupInterval == 0 {
		config.CleanupInterval = 5 * time.Minute
	}

	nfp := &NotFoundProtection{
		attempts:      make(map[string]*NotFoundAttempt),
		blocked:       make(map[string]*BlockedIP),
		config:        config,
		whitelistMap:  make(map[string]bool),
		cleanupTicker: time.NewTicker(config.CleanupInterval),
		done:          make(chan bool),
	}

	// Build whitelist map for faster lookups
	for _, ip := range config.WhitelistedIPs {
		nfp.whitelistMap[ip] = true
	}

	// Start cleanup goroutine
	go nfp.cleanup()

	return nfp
}

// Middleware returns the Echo middleware function
func (nfp *NotFoundProtection) Middleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !nfp.config.Enabled {
				return next(c)
			}

			clientIP := nfp.getClientIP(c)

			// Check if IP is blocked
			if nfp.isBlocked(clientIP) {
				if nfp.config.LogBlocked {
					utils.LogWarn().
						Str("ip", clientIP).
						Str("path", c.Request().URL.Path).
						Str("user_agent", c.Request().UserAgent()).
						Msg("Blocked IP access attempt")
				}
				return apis.NewForbiddenError("Access denied", nil)
			}

			// Call next handler
			err := next(c)

			// Check if response is 404
			if c.Response().Status == 404 {
				nfp.recordNotFoundAttempt(clientIP, c)
			}

			return err
		}
	}
}

// getClientIP extracts the real client IP
func (nfp *NotFoundProtection) getClientIP(c echo.Context) string {
	// Check X-Forwarded-For header first
	if xForwardedFor := c.Request().Header.Get("X-Forwarded-For"); xForwardedFor != "" {
		// Take the first IP in the chain
		if ip := net.ParseIP(xForwardedFor); ip != nil {
			return ip.String()
		}
	}

	// Check X-Real-IP header
	if xRealIP := c.Request().Header.Get("X-Real-IP"); xRealIP != "" {
		if ip := net.ParseIP(xRealIP); ip != nil {
			return ip.String()
		}
	}

	// Fall back to remote address
	host, _, err := net.SplitHostPort(c.Request().RemoteAddr)
	if err != nil {
		return c.Request().RemoteAddr
	}
	return host
}

// recordNotFoundAttempt records a 404 attempt and checks for blocking conditions
func (nfp *NotFoundProtection) recordNotFoundAttempt(ip string, c echo.Context) {
	// Skip whitelisted IPs
	if nfp.whitelistMap[ip] {
		return
	}

	nfp.mu.Lock()
	defer nfp.mu.Unlock()

	now := time.Now()

	// Get or create attempt record
	attempt, exists := nfp.attempts[ip]
	if !exists {
		attempt = &NotFoundAttempt{
			Count:     0,
			FirstSeen: now,
			LastSeen:  now,
		}
		nfp.attempts[ip] = attempt
	}

	// Update attempt record
	attempt.Count++
	attempt.LastSeen = now

	// Log suspicious activity if enabled
	if nfp.config.LogSuspiciousPatterns {
		utils.LogInfo().
			Str("ip", ip).
			Str("path", c.Request().URL.Path).
			Str("user_agent", c.Request().UserAgent()).
			Int("total_attempts", attempt.Count).
			Msg("404 attempt from IP")
	}

	// Check if IP should be blocked
	shouldBlock := false
	blockReason := ""

	// Check per-minute limit
	if nfp.config.Max404PerMinute > 0 {
		minuteAgo := now.Add(-time.Minute)
		if attempt.LastSeen.After(minuteAgo) && attempt.Count >= nfp.config.Max404PerMinute {
			shouldBlock = true
			blockReason = fmt.Sprintf("exceeded %d 404s per minute", nfp.config.Max404PerMinute)
		}
	}

	// Check per-hour limit
	if nfp.config.Max404PerHour > 0 && !shouldBlock {
		hourAgo := now.Add(-time.Hour)
		if attempt.FirstSeen.After(hourAgo) && attempt.Count >= nfp.config.Max404PerHour {
			shouldBlock = true
			blockReason = fmt.Sprintf("exceeded %d 404s per hour", nfp.config.Max404PerHour)
		}
	}

	// Block the IP if needed
	if shouldBlock {
		nfp.blockIP(ip, blockReason, now)
	}
}

// blockIP adds an IP to the blocked list
func (nfp *NotFoundProtection) blockIP(ip, reason string, blockedAt time.Time) {
	until := blockedAt.Add(nfp.config.BlockDuration)

	nfp.blocked[ip] = &BlockedIP{
		IP:        ip,
		BlockedAt: blockedAt,
		Reason:    reason,
		Until:     until,
	}

	// Log the block
	utils.LogWarn().
		Str("ip", ip).
		Str("reason", reason).
		Time("blocked_until", until).
		Msg("IP blocked for excessive 404 requests")

	// Remove from attempts as it's now blocked
	delete(nfp.attempts, ip)
}

// isBlocked checks if an IP is currently blocked
func (nfp *NotFoundProtection) isBlocked(ip string) bool {
	nfp.mu.RLock()
	defer nfp.mu.RUnlock()

	blocked, exists := nfp.blocked[ip]
	if !exists {
		return false
	}

	// Check if block has expired
	if time.Now().After(blocked.Until) {
		// Note: We'll clean this up in the cleanup goroutine
		// to avoid write lock here
		return false
	}

	return true
}

// cleanup removes expired blocks and old attempt records
func (nfp *NotFoundProtection) cleanup() {
	for {
		select {
		case <-nfp.cleanupTicker.C:
			nfp.performCleanup()
		case <-nfp.done:
			return
		}
	}
}

// performCleanup removes expired entries
func (nfp *NotFoundProtection) performCleanup() {
	nfp.mu.Lock()
	defer nfp.mu.Unlock()

	now := time.Now()

	// Clean up expired blocks
	for ip, blocked := range nfp.blocked {
		if now.After(blocked.Until) {
			delete(nfp.blocked, ip)
		}
	}

	// Clean up old attempt records (older than 2 hours)
	cutoff := now.Add(-2 * time.Hour)
	for ip, attempt := range nfp.attempts {
		if attempt.LastSeen.Before(cutoff) {
			delete(nfp.attempts, ip)
		}
	}
}

// GetStats returns current statistics
func (nfp *NotFoundProtection) GetStats() map[string]interface{} {
	nfp.mu.RLock()
	defer nfp.mu.RUnlock()

	return map[string]interface{}{
		"total_attempts": len(nfp.attempts),
		"blocked_ips":    len(nfp.blocked),
		"enabled":        nfp.config.Enabled,
	}
}

// Stop stops the cleanup goroutine
func (nfp *NotFoundProtection) Stop() {
	nfp.cleanupTicker.Stop()
	close(nfp.done)
}
