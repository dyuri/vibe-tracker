package services

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"

	"vibe-tracker/constants"
	"vibe-tracker/models"
	"vibe-tracker/repositories"
)

// HealthService provides health check functionality
type HealthService struct {
	app             *pocketbase.PocketBase
	userRepo        repositories.UserRepository
	sessionRepo     repositories.SessionRepository
	locationRepo    repositories.LocationRepository
	authService     *AuthService
	userService     *UserService
	sessionService  *SessionService
	locationService *LocationService
	startTime       time.Time
	healthCache     *models.SystemHealth
	healthCacheMux  sync.RWMutex
	lastHealthCheck time.Time
	cacheTTL        time.Duration
	dbTimeout       time.Duration
}

// NewHealthService creates a new health service
func NewHealthService(
	app *pocketbase.PocketBase,
	userRepo repositories.UserRepository,
	sessionRepo repositories.SessionRepository,
	locationRepo repositories.LocationRepository,
	authService *AuthService,
	userService *UserService,
	sessionService *SessionService,
	locationService *LocationService,
	cacheTTL time.Duration,
	dbTimeout time.Duration,
) *HealthService {
	return &HealthService{
		app:             app,
		userRepo:        userRepo,
		sessionRepo:     sessionRepo,
		locationRepo:    locationRepo,
		authService:     authService,
		userService:     userService,
		sessionService:  sessionService,
		locationService: locationService,
		startTime:       time.Now(),
		cacheTTL:        cacheTTL,
		dbTimeout:       dbTimeout,
	}
}

// GetLiveness returns basic liveness information
func (s *HealthService) GetLiveness() *models.LivenessResponse {
	return &models.LivenessResponse{
		Status:    models.HealthStatusHealthy,
		Timestamp: time.Now(),
		Uptime:    s.getUptime(),
	}
}

// GetReadiness returns readiness information
func (s *HealthService) GetReadiness() *models.ReadinessResponse {
	checks := make(map[string]models.HealthStatus)

	// Check database connectivity
	dbHealth := s.checkDatabaseHealth()
	checks["database"] = dbHealth.Status

	// Check services (basic validation)
	if s.validateServices() {
		checks["services"] = models.HealthStatusHealthy
	} else {
		checks["services"] = models.HealthStatusUnhealthy
	}

	// Check configuration
	checks["configuration"] = models.HealthStatusHealthy // Always healthy if we got this far

	// Determine overall status
	overallStatus := models.HealthStatusHealthy
	for _, status := range checks {
		if status == models.HealthStatusUnhealthy {
			overallStatus = models.HealthStatusUnhealthy
			break
		} else if status == models.HealthStatusWarning && overallStatus == models.HealthStatusHealthy {
			overallStatus = models.HealthStatusWarning
		}
	}

	return &models.ReadinessResponse{
		Status:    overallStatus,
		Checks:    checks,
		Timestamp: time.Now(),
	}
}

// GetDetailedHealth returns comprehensive health information
func (s *HealthService) GetDetailedHealth() *models.DetailedHealthResponse {
	// Check cache first
	s.healthCacheMux.RLock()
	if s.healthCache != nil && time.Since(s.lastHealthCheck) < s.cacheTTL {
		cached := s.buildDetailedResponse(s.healthCache)
		s.healthCacheMux.RUnlock()
		return cached
	}
	s.healthCacheMux.RUnlock()

	// Perform fresh health check
	health := s.performFullHealthCheck()

	// Update cache
	s.healthCacheMux.Lock()
	s.healthCache = health
	s.lastHealthCheck = time.Now()
	s.healthCacheMux.Unlock()

	return s.buildDetailedResponse(health)
}

// performFullHealthCheck performs comprehensive health checks
func (s *HealthService) performFullHealthCheck() *models.SystemHealth {
	health := &models.SystemHealth{
		StartTime: s.startTime,
	}

	// Database health check
	health.Database = s.checkDatabaseHealth()

	// Services health check
	health.Services = s.checkServicesHealth()

	// Resources health check
	health.Resources = s.checkResourcesHealth()

	// Determine overall health
	health.Overall = models.HealthStatusHealthy

	if health.Database.Status == models.HealthStatusUnhealthy {
		health.Overall = models.HealthStatusUnhealthy
	} else if health.Database.Status == models.HealthStatusWarning && health.Overall == models.HealthStatusHealthy {
		health.Overall = models.HealthStatusWarning
	}

	// Check for warning conditions in resources
	if health.Resources != nil {
		goroutines := runtime.NumGoroutine()
		if goroutines > constants.GoroutineUnhealthyThreshold {
			health.Overall = models.HealthStatusUnhealthy
		} else if goroutines > constants.GoroutineWarningThreshold && health.Overall == models.HealthStatusHealthy {
			health.Overall = models.HealthStatusWarning
		}
	}

	return health
}

// checkDatabaseHealth checks database connectivity and performance
func (s *HealthService) checkDatabaseHealth() *models.ComponentHealth {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), s.dbTimeout)
	defer cancel()

	componentHealth := &models.ComponentHealth{
		LastChecked: start,
	}

	// Try to perform a simple database operation
	done := make(chan error, 1)
	go func() {
		// Simple query to check database connectivity
		// We'll try to find the collection as a lightweight operation
		_, err := s.app.Dao().FindCollectionByNameOrId(constants.CollectionUsers)
		if err != nil {
			done <- err
			return
		}

		done <- nil
	}()

	select {
	case err := <-done:
		duration := time.Since(start)
		componentHealth.ResponseTime = duration.String()

		if err != nil {
			componentHealth.Status = models.HealthStatusUnhealthy
			componentHealth.Error = err.Error()
		} else if duration > s.dbTimeout/2 {
			// Warning if response time is more than half the timeout
			componentHealth.Status = models.HealthStatusWarning
		} else {
			componentHealth.Status = models.HealthStatusHealthy
		}
	case <-ctx.Done():
		componentHealth.Status = models.HealthStatusUnhealthy
		componentHealth.Error = "database check timeout"
		componentHealth.ResponseTime = s.dbTimeout.String()
	}

	return componentHealth
}

// checkServicesHealth validates that all services are available
func (s *HealthService) checkServicesHealth() *models.ServiceHealth {
	return &models.ServiceHealth{
		AuthService:     s.checkServiceHealth("auth", s.authService),
		SessionService:  s.checkServiceHealth("session", s.sessionService),
		LocationService: s.checkServiceHealth("location", s.locationService),
		UserService:     s.checkServiceHealth("user", s.userService),
	}
}

// checkServiceHealth validates a specific service
func (s *HealthService) checkServiceHealth(serviceName string, service interface{}) models.HealthStatus {
	if service == nil {
		return models.HealthStatusUnhealthy
	}
	return models.HealthStatusHealthy
}

// checkResourcesHealth monitors system resources
func (s *HealthService) checkResourcesHealth() *models.ResourceHealth {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Calculate memory usage
	memUsageMB := float64(m.Alloc) / 1024 / 1024

	goroutines := runtime.NumGoroutine()

	return &models.ResourceHealth{
		MemoryUsage:     fmt.Sprintf("%.1fMB", memUsageMB),
		Goroutines:      goroutines,
		FileDescriptors: "N/A", // Would need platform-specific code
		DiskSpace:       "N/A", // Would need filesystem check
	}
}

// validateServices performs basic validation of service availability
func (s *HealthService) validateServices() bool {
	return s.authService != nil &&
		s.userService != nil &&
		s.sessionService != nil &&
		s.locationService != nil
}

// buildDetailedResponse constructs the detailed health response
func (s *HealthService) buildDetailedResponse(health *models.SystemHealth) *models.DetailedHealthResponse {
	checks := make(map[string]*models.ComponentHealth)
	checks["database"] = health.Database

	return &models.DetailedHealthResponse{
		Status:    health.Overall,
		Version:   constants.AppVersion,
		Uptime:    s.getUptime(),
		Timestamp: time.Now(),
		Checks:    checks,
		Services:  health.Services,
		Resources: health.Resources,
	}
}

// getUptime calculates and formats the application uptime
func (s *HealthService) getUptime() string {
	uptime := time.Since(s.startTime)
	return uptime.Round(time.Second).String()
}

// InvalidateCache clears the health check cache
func (s *HealthService) InvalidateCache() {
	s.healthCacheMux.Lock()
	defer s.healthCacheMux.Unlock()
	s.healthCache = nil
	s.lastHealthCheck = time.Time{}
}
