package main

import (
	"log"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"vibe-tracker/config"
	"vibe-tracker/constants"
	"vibe-tracker/handlers"
	"vibe-tracker/middleware"
	"vibe-tracker/models"
	"vibe-tracker/repositories"
	"vibe-tracker/services"
	_ "vibe-tracker/migrations"
)

func main() {
	app := pocketbase.New()

	// Load configuration
	cfg := config.NewAppConfig()

	// Register migration command
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: cfg.Automigrate,
	})

	// Initialize repositories
	userRepo := repositories.NewUserRepository(app)
	sessionRepo := repositories.NewSessionRepository(app)
	locationRepo := repositories.NewLocationRepository(app)

	// Initialize services
	authService := services.NewAuthService(app, userRepo)
	userService := services.NewUserService(userRepo)
	sessionService := services.NewSessionService(sessionRepo)
	locationService := services.NewLocationService(locationRepo, userRepo, sessionRepo, sessionService)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(app, authService)
	sessionHandler := handlers.NewSessionHandler(app, sessionService)
	trackingHandler := handlers.NewTrackingHandler(app, locationService)
	publicHandler := handlers.NewPublicHandler(app, locationService, userService)

	// Initialize middleware
	authMiddleware := middleware.NewAuthMiddleware(app)
	userMiddleware := middleware.NewUserMiddleware(app)
	errorHandler := middleware.NewErrorHandler()
	validationMiddleware := middleware.NewValidationMiddleware()

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Apply global middleware
		e.Router.Use(errorHandler.RecoveryMiddleware())
		e.Router.Use(errorHandler.SecurityHeaders())
		e.Router.Use(errorHandler.CORSMiddleware())

		// API routes group
		api := e.Router.Group(constants.APIPrefix)

		// Location endpoints - public but can have optional auth for additional features
		api.GET(constants.EndpointLocation, publicHandler.GetLocation, userMiddleware.LoadUserFromPath())
		api.GET(constants.EndpointPublicLocation, publicHandler.GetPublicLocations)
		api.GET("/session/:username/:session", publicHandler.GetSessionData, userMiddleware.LoadUserFromPath())

		// Session management endpoints
		api.GET("/sessions/:username", sessionHandler.ListSessions, userMiddleware.LoadUserFromPath())
		api.GET("/sessions/:username/:name", sessionHandler.GetSession, userMiddleware.LoadUserFromPath())
		api.POST("/sessions", sessionHandler.CreateSession, authMiddleware.RequireJWTAuth(), validationMiddleware.ValidateJSON(&models.CreateSessionRequest{}))
		api.PUT("/sessions/:username/:name", sessionHandler.UpdateSession, authMiddleware.RequireJWTAuth(), userMiddleware.RequireUserOwnership(), validationMiddleware.ValidateJSON(&models.UpdateSessionRequest{}))
		api.DELETE("/sessions/:username/:name", sessionHandler.DeleteSession, authMiddleware.RequireJWTAuth(), userMiddleware.RequireUserOwnership())

		// Authentication endpoints
		api.POST(constants.EndpointLogin, authHandler.Login, validationMiddleware.ValidateJSON(&models.LoginRequest{}))
		api.POST("/auth/refresh", authHandler.RefreshToken, validationMiddleware.ValidateJSON(&models.RefreshTokenRequest{}))
		api.GET("/me", authHandler.GetMe, authMiddleware.RequireJWTAuth())
		api.PUT("/profile", authHandler.UpdateProfile, authMiddleware.RequireJWTAuth(), validationMiddleware.ValidateJSON(&models.UpdateProfileRequest{}))
		api.POST("/profile/avatar", authHandler.UploadAvatar, authMiddleware.RequireJWTAuth())
		api.PUT("/profile/regenerate-token", authHandler.RegenerateToken, authMiddleware.RequireJWTAuth())

		// Tracking endpoints - support both JWT and custom token auth
		api.GET(constants.EndpointTrack, trackingHandler.TrackLocationGET, authMiddleware.RequireFlexibleAuth(), validationMiddleware.ValidateQueryParams(&models.TrackingQueryParams{}))
		api.POST(constants.EndpointTrack, trackingHandler.TrackLocationPOST, authMiddleware.RequireFlexibleAuth(), validationMiddleware.ValidateJSON(&models.LocationRequest{}))

		return nil
	})

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Static routes for frontend
		e.Router.GET("/u/:username", func(c echo.Context) error {
			return c.File("public/index.html")
		})

		e.Router.GET("/u/:username/s/:session", func(c echo.Context) error {
			return c.File("public/index.html")
		})

		e.Router.GET("/profile", func(c echo.Context) error {
			return c.File("public/profile.html")
		})

		e.Router.GET("/profile/sessions", func(c echo.Context) error {
			return c.File("public/sessions.html")
		})

		e.Router.Static("/", "public")
		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
