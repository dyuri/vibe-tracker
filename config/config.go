package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"vibe-tracker/constants"
)

// AppConfig holds all application configuration
type AppConfig struct {
	// Server configuration
	Port string
	Host string

	// Database configuration
	Automigrate bool

	// Pagination settings
	DefaultPage    int
	DefaultPerPage int
	MaxPerPage     int

	// Security configuration
	Security SecurityConfig

	// Health check configuration
	Health HealthConfig
}

// SecurityConfig holds security-related configuration
type SecurityConfig struct {
	// Rate limiting
	EnableRateLimiting bool
	RateLimitStrict    bool // Stricter limits for production

	// Request security
	MaxRequestSize    int64
	RequestTimeout    time.Duration
	EnableRequestLogs bool

	// Authentication security
	EnableBruteForceProtection bool
	FailedLoginThreshold       int
	AccountLockoutDuration     time.Duration

	// CORS configuration
	CORSAllowedOrigins []string
	CORSAllowAll       bool

	// Security headers
	EnableSecurityHeaders bool
	HSTSEnabled           bool
	CSPEnabled            bool

	// 404 Attack Protection
	Enable404Protection   bool
	Max404PerMinute       int
	Max404PerHour         int
	IP404BlockDuration    time.Duration
	NotFound404LogEnabled bool
	Whitelisted404IPs     []string
}

// HealthConfig holds health check configuration
type HealthConfig struct {
	// Health check enablement
	Enabled         bool
	DetailedEnabled bool

	// Health check timeouts
	DBTimeout       time.Duration
	CacheTTL        time.Duration
	MaxResponseTime time.Duration

	// Access control
	AllowedIPs []string
}

// NewAppConfig creates a new configuration instance with values from environment variables
func NewAppConfig() *AppConfig {
	isProd := isProductionMode()

	return &AppConfig{
		Port:           getEnvOrDefault(constants.EnvPort, constants.DefaultPort),
		Host:           getEnvOrDefault(constants.EnvHost, constants.DefaultHost),
		Automigrate:    getBoolEnvOrDefault(constants.EnvAutomigrate, true),
		DefaultPage:    constants.DefaultPage,
		DefaultPerPage: constants.DefaultPerPage,
		MaxPerPage:     constants.MaxPerPageLimit,
		Security:       newSecurityConfig(isProd),
		Health:         newHealthConfig(isProd),
	}
}

// newSecurityConfig creates security configuration based on environment
func newSecurityConfig(isProduction bool) SecurityConfig {
	corsOrigins := []string{}
	if originsEnv := os.Getenv("CORS_ALLOWED_ORIGINS"); originsEnv != "" {
		corsOrigins = strings.Split(originsEnv, ",")
	}

	whitelisted404IPs := []string{}
	if ipsEnv := os.Getenv("WHITELISTED_404_IPS"); ipsEnv != "" {
		whitelisted404IPs = strings.Split(ipsEnv, ",")
	}

	return SecurityConfig{
		EnableRateLimiting: getBoolEnvOrDefault("ENABLE_RATE_LIMITING", true),
		RateLimitStrict:    isProduction,

		MaxRequestSize:    getInt64EnvOrDefault("MAX_REQUEST_SIZE", constants.MaxFileUploadSize),
		RequestTimeout:    getDurationEnvOrDefault("REQUEST_TIMEOUT", time.Duration(constants.RequestTimeout)*time.Second),
		EnableRequestLogs: getBoolEnvOrDefault("ENABLE_REQUEST_LOGS", !isProduction),

		EnableBruteForceProtection: getBoolEnvOrDefault("ENABLE_BRUTE_FORCE_PROTECTION", true),
		FailedLoginThreshold:       getIntEnvOrDefault("FAILED_LOGIN_THRESHOLD", constants.MaxFailedLoginAttempts),
		AccountLockoutDuration:     getDurationEnvOrDefault("ACCOUNT_LOCKOUT_DURATION", constants.LoginLockoutDuration),

		CORSAllowedOrigins: corsOrigins,
		CORSAllowAll:       getBoolEnvOrDefault("CORS_ALLOW_ALL", !isProduction),

		EnableSecurityHeaders: getBoolEnvOrDefault("ENABLE_SECURITY_HEADERS", true),
		HSTSEnabled:           getBoolEnvOrDefault("HSTS_ENABLED", isProduction),
		CSPEnabled:            getBoolEnvOrDefault("CSP_ENABLED", true),

		Enable404Protection:   getBoolEnvOrDefault("ENABLE_404_PROTECTION", true),
		Max404PerMinute:       getIntEnvOrDefault("MAX_404_PER_MINUTE", 10),
		Max404PerHour:         getIntEnvOrDefault("MAX_404_PER_HOUR", 100),
		IP404BlockDuration:    getDurationEnvOrDefault("IP_404_BLOCK_DURATION", time.Hour),
		NotFound404LogEnabled: getBoolEnvOrDefault("ENABLE_404_LOGS", !isProduction),
		Whitelisted404IPs:     whitelisted404IPs,
	}
}

// newHealthConfig creates health check configuration based on environment
func newHealthConfig(isProduction bool) HealthConfig {
	allowedIPs := []string{}
	if ipsEnv := os.Getenv(constants.EnvHealthAllowedIPs); ipsEnv != "" {
		allowedIPs = strings.Split(ipsEnv, ",")
	}

	return HealthConfig{
		Enabled:         getBoolEnvOrDefault(constants.EnvHealthEnabled, constants.DefaultHealthEnabled),
		DetailedEnabled: getBoolEnvOrDefault(constants.EnvHealthDetailedEnabled, !isProduction), // false in production by default

		DBTimeout:       getDurationEnvOrDefault(constants.EnvHealthDBTimeout, constants.DefaultHealthDBTimeout),
		CacheTTL:        getDurationEnvOrDefault(constants.EnvHealthCacheTTL, constants.DefaultHealthCacheTTL),
		MaxResponseTime: getDurationEnvOrDefault(constants.EnvHealthMaxResponseTime, constants.DefaultHealthMaxResponseTime),

		AllowedIPs: allowedIPs,
	}
}

// GetServerAddress returns the full server address
func (c *AppConfig) GetServerAddress() string {
	return c.Host + ":" + c.Port
}

// IsProductionMode returns true if running in production mode
func (c *AppConfig) IsProductionMode() bool {
	return isProductionMode()
}

// IsDevelopmentMode returns true if running in development mode
func (c *AppConfig) IsDevelopmentMode() bool {
	return !c.IsProductionMode()
}

// isProductionMode checks environment for production mode
func isProductionMode() bool {
	env := strings.ToLower(os.Getenv("GO_ENV"))
	return env == "production" || env == "prod"
}

// Helper functions

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getBoolEnvOrDefault returns boolean environment variable value or default if not set/invalid
func getBoolEnvOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		// PocketBase uses "false" to disable automigrate, anything else enables it
		if strings.ToLower(value) == "false" {
			return false
		}
		return true
	}
	return defaultValue
}

// getIntEnvOrDefault returns integer environment variable value or default if not set/invalid
func getIntEnvOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getInt64EnvOrDefault returns int64 environment variable value or default if not set/invalid
func getInt64EnvOrDefault(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getDurationEnvOrDefault returns duration environment variable value or default if not set/invalid
func getDurationEnvOrDefault(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
