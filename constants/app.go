package constants

import "time"

// Application-wide constants
const (
	// Default server configuration
	DefaultPort = "8090"
	DefaultHost = "0.0.0.0"

	// Collection names in PocketBase
	CollectionUsers     = "users"
	CollectionSessions  = "sessions"
	CollectionLocations = "locations"
)

// API Pagination constants
const (
	// Default pagination values
	DefaultPage     = 1
	DefaultPerPage  = 20
	MaxPerPageLimit = 100
	MinPerPageLimit = 1

	// Location query limits
	PublicLocationsLimit = 50
)

// Environment variables
const (
	EnvAutomigrate = "PB_AUTOMIGRATE"
	EnvPort        = "PORT"
	EnvHost        = "HOST"
)

// API paths and endpoints
const (
	APIPrefix = "/api"

	// Auth endpoints
	EndpointLogin = "/login"

	// Location endpoints
	EndpointLocation       = "/location/:username"
	EndpointPublicLocation = "/public-locations"
	EndpointTrack          = "/track"

	// Session endpoints
	EndpointSessions = "/sessions"
)

// Default values for location tracking
const (
	DefaultAltitude  = 0.0
	DefaultSpeed     = 0.0
	DefaultTimestamp = 0
)

// Security and Rate Limiting constants
const (
	// Rate limiting - requests per minute
	AuthRateLimit     = 5   // Strict for authentication
	TrackingRateLimit = 60  // High for location tracking
	SessionRateLimit  = 30  // Moderate for sessions
	PublicRateLimit   = 100 // Generous for public endpoints
	DocsRateLimit     = 10  // Low for documentation

	// Rate limiting burst sizes
	AuthBurstSize     = 2
	TrackingBurstSize = 10
	SessionBurstSize  = 5
	PublicBurstSize   = 20
	DocsBurstSize     = 3

	// Request size limits (in bytes)
	MaxJSONRequestSize = 1024 * 1024      // 1MB for JSON requests
	MaxFileUploadSize  = 10 * 1024 * 1024 // 10MB for file uploads
	MaxFormRequestSize = 2 * 1024 * 1024  // 2MB for form data

	// Security timeouts (in seconds)
	RequestTimeout = 30  // General request timeout
	AuthTimeout    = 10  // Authentication request timeout
	UploadTimeout  = 300 // File upload timeout (5 minutes)

	// Authentication security
	MaxFailedLoginAttempts = 5                  // Failed attempts before lockout
	LoginLockoutDuration   = 15 * time.Minute   // Account lockout duration
	JWTTokenExpiry         = 24 * time.Hour     // JWT token validity
	RefreshTokenExpiry     = 7 * 24 * time.Hour // Refresh token validity

	// Security headers
	HSTSMaxAge    = 31536000 // 1 year in seconds
	CSPDefaultSrc = "'self'"
	CSPScriptSrc  = "'self' 'unsafe-inline' https://unpkg.com"
	CSPStyleSrc   = "'self' 'unsafe-inline' https://unpkg.com"
	CSPImgSrc     = "'self' data: blob: http: https:"
	CSPConnectSrc = "'self'"
	CSPFontSrc    = "'self' https://unpkg.com"
)
