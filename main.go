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
	"vibe-tracker/models"
	"vibe-tracker/utils"
	_ "vibe-tracker/migrations"
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
		e.Router.Use(di.ErrorHandler.RecoveryMiddleware())
		e.Router.Use(di.ErrorHandler.SecurityHeaders())
		e.Router.Use(di.ErrorHandler.CORSMiddleware())
		e.Router.Use(di.InjectMiddleware()) // Inject DI container into context

		// API routes group
		api := e.Router.Group(constants.APIPrefix)

		// Location endpoints - public but can have optional auth for additional features
		api.GET(constants.EndpointLocation, di.PublicHandler.GetLocation, di.UserMiddleware.LoadUserFromPath())
		api.GET(constants.EndpointPublicLocation, di.PublicHandler.GetPublicLocations)
		api.GET("/session/:username/:session", di.PublicHandler.GetSessionData, di.UserMiddleware.LoadUserFromPath())

		// Session management endpoints
		api.GET("/sessions/:username", di.SessionHandler.ListSessions, di.UserMiddleware.LoadUserFromPath())
		api.GET("/sessions/:username/:name", di.SessionHandler.GetSession, di.UserMiddleware.LoadUserFromPath())
		api.POST("/sessions", di.SessionHandler.CreateSession, di.AuthMiddleware.RequireJWTAuth(), di.ValidationMiddleware.ValidateJSON(&models.CreateSessionRequest{}))
		api.PUT("/sessions/:username/:name", di.SessionHandler.UpdateSession, di.AuthMiddleware.RequireJWTAuth(), di.UserMiddleware.RequireUserOwnership(), di.ValidationMiddleware.ValidateJSON(&models.UpdateSessionRequest{}))
		api.DELETE("/sessions/:username/:name", di.SessionHandler.DeleteSession, di.AuthMiddleware.RequireJWTAuth(), di.UserMiddleware.RequireUserOwnership())

		// Authentication endpoints
		api.POST(constants.EndpointLogin, di.AuthHandler.Login, di.ValidationMiddleware.ValidateJSON(&models.LoginRequest{}))
		api.POST("/auth/refresh", di.AuthHandler.RefreshToken, di.ValidationMiddleware.ValidateJSON(&models.RefreshTokenRequest{}))
		api.GET("/me", di.AuthHandler.GetMe, di.AuthMiddleware.RequireJWTAuth())
		api.PUT("/profile", di.AuthHandler.UpdateProfile, di.AuthMiddleware.RequireJWTAuth(), di.ValidationMiddleware.ValidateJSON(&models.UpdateProfileRequest{}))
		api.POST("/profile/avatar", di.AuthHandler.UploadAvatar, di.AuthMiddleware.RequireJWTAuth())
		api.PUT("/profile/regenerate-token", di.AuthHandler.RegenerateToken, di.AuthMiddleware.RequireJWTAuth())

		// Tracking endpoints - support both JWT and custom token auth
		api.GET(constants.EndpointTrack, di.TrackingHandler.TrackLocationGET, di.AuthMiddleware.RequireFlexibleAuth(), di.ValidationMiddleware.ValidateQueryParams(&models.TrackingQueryParams{}))
		api.POST(constants.EndpointTrack, di.TrackingHandler.TrackLocationPOST, di.AuthMiddleware.RequireFlexibleAuth(), di.ValidationMiddleware.ValidateJSON(&models.LocationRequest{}))

		return nil
	})

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// API Documentation endpoints
		e.Router.GET("/swagger/json", di.DocsHandler.ServeSwaggerJSON)
		e.Router.GET("/swagger", di.DocsHandler.ServeSwaggerUI)

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
		utils.LogError(err, "failed to start application").Msg("Application startup failed")
		panic(err)
	}
}
