package main

import (
	"log"
	"os"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"vibe-tracker/handlers"
	_ "vibe-tracker/migrations"
)

func main() {
	app := pocketbase.New()

	// Enable automigrate for development and production
	automigrate := os.Getenv("PB_AUTOMIGRATE") != "false"

	// Register migration command
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: automigrate,
	})

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(app)
	sessionHandler := handlers.NewSessionHandler(app)
	trackingHandler := handlers.NewTrackingHandler(app)
	publicHandler := handlers.NewPublicHandler(app)

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Location endpoints
		e.Router.GET("/api/location/:username", publicHandler.GetLocation)
		e.Router.GET("/api/public-locations", publicHandler.GetPublicLocations)
		e.Router.GET("/api/session/:username/:session", publicHandler.GetSessionData)

		// Session management endpoints
		e.Router.GET("/api/sessions/:username", sessionHandler.ListSessions)
		e.Router.GET("/api/sessions/:username/:name", sessionHandler.GetSession)
		e.Router.POST("/api/sessions", sessionHandler.CreateSession, apis.RequireRecordAuth())
		e.Router.PUT("/api/sessions/:username/:name", sessionHandler.UpdateSession, apis.RequireRecordAuth())
		e.Router.DELETE("/api/sessions/:username/:name", sessionHandler.DeleteSession, apis.RequireRecordAuth())

		// Add JWT authentication endpoints
		e.Router.POST("/api/login", authHandler.Login)
		e.Router.POST("/api/auth/refresh", authHandler.RefreshToken)
		e.Router.GET("/api/me", authHandler.GetMe, apis.RequireRecordAuth())
		e.Router.PUT("/api/profile", authHandler.UpdateProfile, apis.RequireRecordAuth())
		e.Router.POST("/api/profile/avatar", authHandler.UploadAvatar, apis.RequireRecordAuth())
		e.Router.PUT("/api/profile/regenerate-token", authHandler.RegenerateToken, apis.RequireRecordAuth())

		// Tracking endpoints
		e.Router.GET("/api/track", trackingHandler.TrackLocationGET)
		e.Router.POST("/api/track", trackingHandler.TrackLocationPOST)

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
