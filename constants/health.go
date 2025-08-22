package constants

import "time"

// Health check endpoint paths
const (
	HealthEndpoint          = "/health"
	HealthLivenessEndpoint  = "/health/live"
	HealthReadinessEndpoint = "/health/ready"
)

// Health check configuration defaults
const (
	// Default timeouts
	DefaultHealthDBTimeout       = 5 * time.Second
	DefaultHealthCacheTTL        = 30 * time.Second
	DefaultHealthMaxResponseTime = 2 * time.Second

	// Environment variable names for health configuration
	EnvHealthEnabled         = "HEALTH_ENABLED"
	EnvHealthDetailedEnabled = "HEALTH_DETAILED_ENABLED"
	EnvHealthDBTimeout       = "HEALTH_DB_TIMEOUT"
	EnvHealthCacheTTL        = "HEALTH_CACHE_TTL"
	EnvHealthMaxResponseTime = "HEALTH_MAX_RESPONSE_TIME"
	EnvHealthAllowedIPs      = "HEALTH_ALLOWED_IPS"

	// Default values
	DefaultHealthEnabled         = true
	DefaultHealthDetailedEnabled = true // false in production

	// Application version (can be overridden at build time)
	AppVersion = "1.0.0"

	// Memory usage thresholds (percentages)
	MemoryWarningThreshold   = 80.0
	MemoryUnhealthyThreshold = 95.0

	// Goroutine count thresholds
	GoroutineWarningThreshold   = 100
	GoroutineUnhealthyThreshold = 500
)
