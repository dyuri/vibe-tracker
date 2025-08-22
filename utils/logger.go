package utils

import (
	"io"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// AppConfigProvider defines the methods of config.AppConfig that InitLogger uses
type AppConfigProvider interface {
	IsDevelopmentMode() bool
}

var Logger zerolog.Logger

// InitLogger initializes the global structured logger
func InitLogger(cfg AppConfigProvider, outputWriter ...io.Writer) {
	var output io.Writer

	if len(outputWriter) > 0 && outputWriter[0] != nil {
		output = outputWriter[0] // Always use provided writer if available
	} else {
		// Original logic for development/production mode
		if cfg.IsDevelopmentMode() {
			output = zerolog.ConsoleWriter{
				Out:        os.Stdout,
				TimeFormat: time.RFC3339,
			}
		} else {
			output = os.Stdout // Default to JSON output for production
		}
	}

	// Set global log level
	var level zerolog.Level
	if cfg.IsDevelopmentMode() {
		level = zerolog.DebugLevel
	} else {
		level = zerolog.InfoLevel
	}

	// Initialize logger
	Logger = zerolog.New(output).
		Level(level).
		With().
		Timestamp().
		Caller().
		Logger()

	// Set as global logger
	log.Logger = Logger

	// Log initialization
	Logger.Info().
		Str("level", level.String()).
		Bool("development", cfg.IsDevelopmentMode()).
		Msg("Logger initialized")
}

// GetLogger returns the global logger instance
func GetLogger() zerolog.Logger {
	return Logger
}

// LogError logs an error with context
func LogError(err error, msg string) *zerolog.Event {
	return Logger.Error().Err(err).Str("context", msg)
}

// LogInfo logs an info message
func LogInfo() *zerolog.Event {
	return Logger.Info()
}

// LogDebug logs a debug message
func LogDebug() *zerolog.Event {
	return Logger.Debug()
}

// LogWarn logs a warning message
func LogWarn() *zerolog.Event {
	return Logger.Warn()
}

// RequestLogger creates a logger for HTTP requests
func RequestLogger(method, path, userID string) *zerolog.Event {
	return Logger.Info().
		Str("method", method).
		Str("path", path).
		Str("user_id", userID)
}

// Security Event Logging Functions

// LogSecurityEvent logs security-related events with standardized fields
func LogSecurityEvent(eventType, message string) *zerolog.Event {
	return Logger.Warn().
		Str("event_type", "security").
		Str("security_event", eventType).
		Str("message", message)
}

// LogRateLimitViolation logs rate limit violations
func LogRateLimitViolation(clientIP, endpoint string, limit int) {
	Logger.Warn().
		Str("event_type", "security").
		Str("security_event", "rate_limit_exceeded").
		Str("client_ip", clientIP).
		Str("endpoint", endpoint).
		Int("limit", limit).
		Msg("Rate limit exceeded")
}

// LogBruteForceAttempt logs brute force protection events
func LogBruteForceAttempt(clientIP string, attemptCount, maxAttempts int) {
	Logger.Warn().
		Str("event_type", "security").
		Str("security_event", "brute_force_attempt").
		Str("client_ip", clientIP).
		Int("attempt_count", attemptCount).
		Int("max_attempts", maxAttempts).
		Msg("Failed login attempt recorded")
}

// LogBruteForceBlocked logs when a client is blocked due to brute force protection
func LogBruteForceBlocked(clientIP string, lockedUntil time.Time) {
	Logger.Error().
		Str("event_type", "security").
		Str("security_event", "brute_force_blocked").
		Str("client_ip", clientIP).
		Time("locked_until", lockedUntil).
		Msg("Client locked out due to brute force protection")
}

// LogSuspiciousRequest logs suspicious request patterns
func LogSuspiciousRequest(clientIP, userAgent, path, reason string) {
	Logger.Error().
		Str("event_type", "security").
		Str("security_event", "suspicious_request").
		Str("client_ip", clientIP).
		Str("user_agent", userAgent).
		Str("path", path).
		Str("reason", reason).
		Msg("Suspicious request detected")
}

// LogSecurityViolation logs general security violations
func LogSecurityViolation(clientIP, violationType, details string) {
	Logger.Error().
		Str("event_type", "security").
		Str("security_event", "security_violation").
		Str("client_ip", clientIP).
		Str("violation_type", violationType).
		Str("details", details).
		Msg("Security violation detected")
}

// LogAuthenticationFailure logs authentication failures with context
func LogAuthenticationFailure(clientIP, username, reason string) {
	Logger.Warn().
		Str("event_type", "security").
		Str("security_event", "auth_failure").
		Str("client_ip", clientIP).
		Str("username", username).
		Str("reason", reason).
		Msg("Authentication failure")
}

// LogUnauthorizedAccess logs unauthorized access attempts
func LogUnauthorizedAccess(clientIP, path, userID, reason string) {
	Logger.Warn().
		Str("event_type", "security").
		Str("security_event", "unauthorized_access").
		Str("client_ip", clientIP).
		Str("path", path).
		Str("user_id", userID).
		Str("reason", reason).
		Msg("Unauthorized access attempt")
}

// LogFileUploadViolation logs file upload security violations
func LogFileUploadViolation(clientIP, filename, violationType string) {
	Logger.Error().
		Str("event_type", "security").
		Str("security_event", "file_upload_violation").
		Str("client_ip", clientIP).
		Str("filename", filename).
		Str("violation_type", violationType).
		Msg("File upload security violation")
}
