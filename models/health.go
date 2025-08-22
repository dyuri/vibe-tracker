package models

import "time"

// HealthStatus represents the health status of a component
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusWarning   HealthStatus = "warning"
)

// LivenessResponse represents the response for liveness check
type LivenessResponse struct {
	Status    HealthStatus `json:"status"`
	Timestamp time.Time    `json:"timestamp"`
	Uptime    string       `json:"uptime"`
}

// ReadinessResponse represents the response for readiness check
type ReadinessResponse struct {
	Status    HealthStatus            `json:"status"`
	Checks    map[string]HealthStatus `json:"checks"`
	Timestamp time.Time               `json:"timestamp"`
}

// ComponentHealth represents the health status of an individual component
type ComponentHealth struct {
	Status       HealthStatus `json:"status"`
	ResponseTime string       `json:"response_time,omitempty"`
	LastChecked  time.Time    `json:"last_checked"`
	Error        string       `json:"error,omitempty"`
}

// ServiceHealth represents the health status of application services
type ServiceHealth struct {
	AuthService     HealthStatus `json:"auth_service"`
	SessionService  HealthStatus `json:"session_service"`
	LocationService HealthStatus `json:"location_service"`
	UserService     HealthStatus `json:"user_service"`
}

// ResourceHealth represents system resource health
type ResourceHealth struct {
	MemoryUsage     string `json:"memory_usage"`
	Goroutines      int    `json:"goroutines"`
	FileDescriptors string `json:"file_descriptors"`
	DiskSpace       string `json:"disk_space,omitempty"`
}

// DetailedHealthResponse represents the comprehensive health check response
type DetailedHealthResponse struct {
	Status    HealthStatus                `json:"status"`
	Version   string                      `json:"version"`
	Uptime    string                      `json:"uptime"`
	Timestamp time.Time                   `json:"timestamp"`
	Checks    map[string]*ComponentHealth `json:"checks"`
	Services  *ServiceHealth              `json:"services,omitempty"`
	Resources *ResourceHealth             `json:"resources,omitempty"`
}

// SystemHealth aggregates all health information
type SystemHealth struct {
	Overall   HealthStatus
	Database  *ComponentHealth
	Services  *ServiceHealth
	Resources *ResourceHealth
	StartTime time.Time
}
