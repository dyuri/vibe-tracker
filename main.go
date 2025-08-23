// Vibe Tracker API
//
//	@title			Vibe Tracker API
//	@version		1.0
//	@description	A location tracking API built with Go/PocketBase backend
//	@contact.name	API Support
//	@contact.email	support@vibetracker.com
//	@license.name	MIT
//	@host			localhost:8090
//	@BasePath		/api
//	@schemes		http https
//
//	@securityDefinitions.apikey	BearerAuth
//	@in							header
//	@name						Authorization
//	@description				JWT Authorization header using the Bearer scheme. Example: "Authorization: Bearer {token}"
//
//	@securityDefinitions.apikey	TokenAuth
//	@in							query
//	@name						token
//	@description				Custom token for location tracking endpoints
package main

import (
	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"vibe-tracker/config"
	"vibe-tracker/constants"
	"vibe-tracker/container"
	_ "vibe-tracker/docs/api"
	_ "vibe-tracker/migrations"
	"vibe-tracker/models"
	"vibe-tracker/utils"
)

func main() {
	app := pocketbase.New()

	// Load configuration
	cfg := config.NewAppConfig()

	// Initialize structured logger
	utils.InitLogger(cfg)

	// Register migration command
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: cfg.Automigrate,
	})

	// Initialize dependency injection container
	di := container.NewContainer(app, cfg)

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Apply global middleware
		setupGlobalMiddleware(e.Router, di, cfg)

		// Setup API routes
		setupAPIRoutes(e.Router, di)

		// Setup documentation routes
		setupDocumentationRoutes(e.Router, di)

		// Setup health check routes
		setupHealthRoutes(e.Router, di, cfg)

		// Setup static routes
		setupStaticRoutes(e.Router)

		return nil
	})

	if err := app.Start(); err != nil {
		utils.LogError(err, "failed to start application").Msg("Application startup failed")
		panic(err)
	}
}

// setupGlobalMiddleware configures global middleware in the correct order
func setupGlobalMiddleware(router *echo.Echo, di *container.Container, cfg *config.AppConfig) {
	router.Use(di.ErrorHandler.RecoveryMiddleware())
	router.Use(di.ErrorHandler.SecurityHeaders(cfg.Security.HSTSEnabled, cfg.Security.CSPEnabled))
	router.Use(di.ErrorHandler.CORSMiddleware(cfg.Security.CORSAllowedOrigins, cfg.Security.CORSAllowAll))
	router.Use(di.InjectMiddleware())

	if di.SecurityMiddleware != nil {
		router.Use(di.SecurityMiddleware.RequestSizeLimit())
		router.Use(di.SecurityMiddleware.RequestTimeout())
		router.Use(di.SecurityMiddleware.UserAgentFilter())
		router.Use(di.SecurityMiddleware.FileUploadSecurity())
		if cfg.Security.EnableRequestLogs {
			router.Use(di.SecurityMiddleware.RequestLogging())
		}
	}
}

// setupAPIRoutes configures all API endpoints
func setupAPIRoutes(router *echo.Echo, di *container.Container) {
	api := router.Group(constants.APIPrefix)

	// Location endpoints
	var publicMiddleware []echo.MiddlewareFunc
	if di.RateLimitMiddleware != nil {
		publicMiddleware = append(publicMiddleware, di.RateLimitMiddleware.PublicEndpoints())
	}

	api.GET(constants.EndpointLocation, di.PublicHandler.GetLocation, append(publicMiddleware, di.UserMiddleware.LoadUserFromPath())...)
	api.GET(constants.EndpointPublicLocation, di.PublicHandler.GetPublicLocations, publicMiddleware...)
	api.GET("/session/:username/:session", di.PublicHandler.GetSessionData, append(publicMiddleware, di.UserMiddleware.LoadUserFromPath())...)

	// Session management endpoints
	var sessionMiddleware []echo.MiddlewareFunc
	if di.RateLimitMiddleware != nil {
		sessionMiddleware = append(sessionMiddleware, di.RateLimitMiddleware.SessionEndpoints())
	}

	api.GET("/sessions/:username", di.SessionHandler.ListSessions, append(sessionMiddleware, di.UserMiddleware.LoadUserFromPath())...)
	api.GET("/sessions/:username/:name", di.SessionHandler.GetSession, append(sessionMiddleware, di.UserMiddleware.LoadUserFromPath())...)
	api.POST("/sessions", di.SessionHandler.CreateSession, append(sessionMiddleware, di.AuthMiddleware.RequireJWTAuth(), di.ValidationMiddleware.ValidateJSON(&models.CreateSessionRequest{}))...)
	api.PUT("/sessions/:username/:name", di.SessionHandler.UpdateSession, append(sessionMiddleware, di.AuthMiddleware.RequireJWTAuth(), di.UserMiddleware.RequireUserOwnership(), di.ValidationMiddleware.ValidateJSON(&models.UpdateSessionRequest{}))...)
	api.DELETE("/sessions/:username/:name", di.SessionHandler.DeleteSession, append(sessionMiddleware, di.AuthMiddleware.RequireJWTAuth(), di.UserMiddleware.RequireUserOwnership())...)

	// Authentication endpoints
	var authMiddleware []echo.MiddlewareFunc
	if di.RateLimitMiddleware != nil {
		authMiddleware = append(authMiddleware, di.RateLimitMiddleware.AuthEndpoints())
	}
	if di.AuthSecurityMiddleware != nil {
		authMiddleware = append(authMiddleware, di.AuthSecurityMiddleware.BruteForceProtection())
	}

	api.POST(constants.EndpointLogin, di.AuthHandler.Login, append(authMiddleware, di.ValidationMiddleware.ValidateJSON(&models.LoginRequest{}))...)
	api.POST("/auth/refresh", di.AuthHandler.RefreshToken, append(authMiddleware, di.ValidationMiddleware.ValidateJSON(&models.RefreshTokenRequest{}))...)
	api.GET("/me", di.AuthHandler.GetMe, di.AuthMiddleware.RequireJWTAuth())
	api.PUT("/profile", di.AuthHandler.UpdateProfile, di.AuthMiddleware.RequireJWTAuth(), di.ValidationMiddleware.ValidateJSON(&models.UpdateProfileRequest{}))
	api.POST("/profile/avatar", di.AuthHandler.UploadAvatar, di.AuthMiddleware.RequireJWTAuth())
	api.PUT("/profile/regenerate-token", di.AuthHandler.RegenerateToken, di.AuthMiddleware.RequireJWTAuth())

	// Tracking endpoints
	var trackingMiddleware []echo.MiddlewareFunc
	if di.RateLimitMiddleware != nil {
		trackingMiddleware = append(trackingMiddleware, di.RateLimitMiddleware.TrackingEndpoints())
	}

	api.GET(constants.EndpointTrack, di.TrackingHandler.TrackLocationGET, append(trackingMiddleware, di.AuthMiddleware.RequireFlexibleAuth(), di.ValidationMiddleware.ValidateQueryParams(&models.TrackingQueryParams{}))...)
	api.POST(constants.EndpointTrack, di.TrackingHandler.TrackLocationPOST, append(trackingMiddleware, di.AuthMiddleware.RequireFlexibleAuth(), di.ValidationMiddleware.ValidateJSON(&models.LocationRequest{}))...)
}

// setupDocumentationRoutes configures API documentation endpoints
func setupDocumentationRoutes(router *echo.Echo, di *container.Container) {
	var docsMiddleware []echo.MiddlewareFunc
	if di.RateLimitMiddleware != nil {
		docsMiddleware = append(docsMiddleware, di.RateLimitMiddleware.DocsEndpoints())
	}

	router.GET("/swagger/json", di.DocsHandler.ServeSwaggerJSON, docsMiddleware...)
	router.GET("/swagger", di.DocsHandler.ServeSwaggerUI, docsMiddleware...)
}

// setupHealthRoutes configures health check endpoints
func setupHealthRoutes(router *echo.Echo, di *container.Container, cfg *config.AppConfig) {
	if cfg.Health.Enabled {
		router.GET(constants.HealthLivenessEndpoint, di.HealthHandler.GetLiveness)
		router.GET(constants.HealthReadinessEndpoint, di.HealthHandler.GetReadiness)
		if cfg.Health.DetailedEnabled {
			router.GET(constants.HealthEndpoint, di.HealthHandler.GetDetailedHealth)
		}
	}
}

// setupStaticRoutes configures frontend static file serving
func setupStaticRoutes(router *echo.Echo) {
	router.GET("/u/:username", func(c echo.Context) error {
		return c.File("public/index.html")
	})

	router.GET("/u/:username/s/:session", func(c echo.Context) error {
		return c.File("public/index.html")
	})

	router.GET("/profile", func(c echo.Context) error {
		return c.File("public/profile.html")
	})

	router.GET("/profile/sessions", func(c echo.Context) error {
		return c.File("public/sessions.html")
	})

	router.Static("/", "public")
}
