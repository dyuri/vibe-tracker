package constants

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
	DefaultPage           = 1
	DefaultPerPage        = 20
	MaxPerPageLimit       = 100
	MinPerPageLimit       = 1
	
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