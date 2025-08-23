package handlers

import (
	"net"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"

	"vibe-tracker/config"
	"vibe-tracker/services"
	"vibe-tracker/utils"
)

// HealthHandler handles health check requests
type HealthHandler struct {
	app           *pocketbase.PocketBase
	healthService *services.HealthService
	config        *config.HealthConfig
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(app *pocketbase.PocketBase, healthService *services.HealthService, healthConfig *config.HealthConfig) *HealthHandler {
	return &HealthHandler{
		app:           app,
		healthService: healthService,
		config:        healthConfig,
	}
}

// GetLiveness handles liveness check requests
// @Summary Get application liveness status
// @Description Returns basic liveness information indicating the application is running
// @Tags Health
// @Accept json
// @Produce json
// @Success 200 {object} models.LivenessResponse "Application is alive"
// @Failure 503 {object} utils.ErrorResponse "Service unavailable"
// @Router /health/live [get]
func (h *HealthHandler) GetLiveness(c echo.Context) error {
	if !h.config.Enabled {
		return apis.NewNotFoundError("Health checks disabled", nil)
	}

	response := h.healthService.GetLiveness()
	return c.JSON(200, response)
}

// GetReadiness handles readiness check requests
// @Summary Get application readiness status
// @Description Returns readiness information indicating the application is ready to serve traffic
// @Tags Health
// @Accept json
// @Produce json
// @Success 200 {object} models.ReadinessResponse "Application is ready"
// @Failure 503 {object} models.ReadinessResponse "Application is not ready"
// @Router /health/ready [get]
func (h *HealthHandler) GetReadiness(c echo.Context) error {
	if !h.config.Enabled {
		return apis.NewNotFoundError("Health checks disabled", nil)
	}

	response := h.healthService.GetReadiness()

	// Return 503 if not healthy
	statusCode := 200
	if response.Status != "healthy" {
		statusCode = 503
	}

	return c.JSON(statusCode, response)
}

// GetDetailedHealth handles detailed health check requests
// @Summary Get detailed application health status
// @Description Returns comprehensive health information including component status and metrics
// @Tags Health
// @Accept json
// @Produce json
// @Success 200 {object} models.DetailedHealthResponse "Detailed health information"
// @Failure 403 {object} utils.ErrorResponse "Access denied"
// @Failure 503 {object} models.DetailedHealthResponse "Application has health issues"
// @Router /health [get]
func (h *HealthHandler) GetDetailedHealth(c echo.Context) error {
	if !h.config.Enabled {
		return apis.NewNotFoundError("Health checks disabled", nil)
	}

	if !h.config.DetailedEnabled {
		return apis.NewForbiddenError("Detailed health checks disabled", nil)
	}

	// Check IP restrictions if configured
	if len(h.config.AllowedIPs) > 0 {
		clientIP := h.getClientIP(c)
		if !h.isIPAllowed(clientIP) {
			utils.LogUnauthorizedAccess(clientIP, c.Request().URL.Path, "", "health_check_ip_restricted")
			return apis.NewForbiddenError("Access denied", nil)
		}
	}

	response := h.healthService.GetDetailedHealth()

	// Return 503 if not healthy
	statusCode := 200
	if response.Status != "healthy" {
		statusCode = 503
	}

	return c.JSON(statusCode, response)
}

// getClientIP extracts the client IP address
func (h *HealthHandler) getClientIP(c echo.Context) string {
	// Try X-Forwarded-For first (for reverse proxies)
	if xff := c.Request().Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP if there are multiple
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Try X-Real-IP
	if xri := c.Request().Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to remote address
	return c.RealIP()
}

// isIPAllowed checks if the client IP is in the allowed list
func (h *HealthHandler) isIPAllowed(clientIP string) bool {
	if len(h.config.AllowedIPs) == 0 {
		return true // No restrictions
	}

	for _, allowedIP := range h.config.AllowedIPs {
		allowedIP = strings.TrimSpace(allowedIP)

		// Check for wildcard
		if allowedIP == "*" {
			return true
		}

		// Check for exact match
		if clientIP == allowedIP {
			return true
		}

		// Check for CIDR match
		if h.isIPInCIDR(clientIP, allowedIP) {
			return true
		}
	}

	return false
}

// isIPInCIDR checks if an IP is within a CIDR range
func (h *HealthHandler) isIPInCIDR(ip, cidr string) bool {
	// Only check if the allowed IP looks like a CIDR
	if !strings.Contains(cidr, "/") {
		return false
	}

	_, network, err := net.ParseCIDR(cidr)
	if err != nil {
		return false
	}

	clientIP := net.ParseIP(ip)
	if clientIP == nil {
		return false
	}

	return network.Contains(clientIP)
}
