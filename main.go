package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/daos"
	"github.com/pocketbase/pocketbase/forms"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tokens"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"

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

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		e.Router.GET("/api/location/:username", func(c echo.Context) error {
			username := c.PathParam("username")
			user, err := findUserByUsername(app.Dao(), username)
			if err != nil {
				return apis.NewNotFoundError("User not found", err)
			}

			filter := "user = {:user}"
			params := dbx.Params{"user": user.Id}

			session := c.QueryParam("session")
			if session != "" {
				filter += " && session = {:session}"
				params["session"] = session
			}

			records, _ := app.Dao().FindRecordsByFilter(
				"locations",
				filter,
				"-created",
				1,
				0,
				params,
			)

			if len(records) == 0 {
				log.Printf("No locations found for user %s\n", user.Id)
				return apis.NewNotFoundError("No location found for this user", nil)
			}

			latestRecord := records[0]

			// Construct GeoJSON response
			timestamp := latestRecord.GetDateTime("timestamp").Time()
			
			// Get session metadata if available
			sessionName := latestRecord.GetString("session")
			sessionTitle := sessionName // fallback to session name
			if sessionName != "" {
				if sessionRecord, err := findSessionByNameAndUser(app.Dao(), sessionName, user.Id); err == nil && sessionRecord != nil {
					if title := sessionRecord.GetString("title"); title != "" {
						sessionTitle = title
					}
				}
			}
			
			response := map[string]any{
				"type": "Feature",
				"geometry": map[string]any{
					"type": "Point",
					"coordinates": []float64{
						latestRecord.GetFloat("longitude"),
						latestRecord.GetFloat("latitude"),
						latestRecord.GetFloat("altitude"),
					},
				},
				"properties": map[string]any{
					"timestamp":     timestamp.Unix(),
					"speed":         latestRecord.GetFloat("speed"),
					"heart_rate":    latestRecord.GetFloat("heart_rate"),
					"session":       sessionName,
					"session_title": sessionTitle,
					"username":      user.Username(),
					"user_id":       user.Id,
					"avatar":        user.GetString("avatar"),
				},
				"when": map[string]any{
					"start": timestamp.Format(time.RFC3339),
					"type":  "Instant",
				},
			}

			return c.JSON(http.StatusOK, response)
		})

		e.Router.GET("/api/session/:username/:session", func(c echo.Context) error {
			username := c.PathParam("username")
			session := c.PathParam("session")

			user, err := findUserByUsername(app.Dao(), username)
			if err != nil {
				return apis.NewNotFoundError("User not found", err)
			}

			if session == "_latest" {
				// Find the most recently created session for this user
				latestSessions, err := app.Dao().FindRecordsByFilter(
					"sessions",
					"user = {:user}",
					"-created",
					1,
					0,
					dbx.Params{"user": user.Id},
				)
				if err != nil || len(latestSessions) == 0 {
					return apis.NewNotFoundError("No sessions found for this user", err)
				}
				session = latestSessions[0].GetString("name")
			}

			// Get session metadata if available
			sessionTitle := session // fallback to session name
			if session != "" {
				if sessionRecord, err := findSessionByNameAndUser(app.Dao(), session, user.Id); err == nil && sessionRecord != nil {
					if title := sessionRecord.GetString("title"); title != "" {
						sessionTitle = title
					}
				}
			}

			// Build filter and params
			filter := "user = {:user} && session = {:session}"
			params := dbx.Params{"user": user.Id, "session": session}

			// Add since parameter if provided for delta tracking
			since := c.QueryParam("since")
			if since != "" {
				if sinceTimestamp, err := strconv.ParseInt(since, 10, 64); err == nil {
					sinceTime := time.Unix(sinceTimestamp, 0)
					sinceDateTime, _ := types.ParseDateTime(sinceTime)
					filter += " && timestamp > {:since}"
					params["since"] = sinceDateTime
				}
			}

			records, err := app.Dao().FindRecordsByFilter(
				"locations",
				filter,
				"timestamp", // Order by timestamp to ensure correct LineString order
				0,           // No limit
				0,           // No offset
				params,
			)

			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to fetch session data", err)
			}

			if len(records) == 0 {
				return apis.NewNotFoundError("No locations found for this session", nil)
			}

			features := make([]interface{}, len(records))
			for i, record := range records {
				pointCoordinates := []float64{
					record.GetFloat("longitude"),
					record.GetFloat("latitude"),
					record.GetFloat("altitude"),
				}
				pointProperties := map[string]interface{}{
					"timestamp":     record.GetDateTime("timestamp").Time().Unix(),
					"speed":         record.GetFloat("speed"),
					"heart_rate":    record.GetFloat("heart_rate"),
					"session":       record.GetString("session"),
					"session_title": sessionTitle,
				}

				// Add username and avatar only for the latest point (last in array)
				if i == len(records)-1 {
					pointProperties["username"] = user.Username()
					pointProperties["user_id"] = user.Id
					pointProperties["avatar"] = user.GetString("avatar")
				}

				pointFeature := map[string]interface{}{
					"type": "Feature",
					"geometry": map[string]interface{}{
						"type":        "Point",
						"coordinates": pointCoordinates,
					},
					"properties": pointProperties,
				}
				features[i] = pointFeature
			}

			featureCollection := map[string]interface{}{
				"type":     "FeatureCollection",
				"features": features,
			}

			return c.JSON(http.StatusOK, featureCollection)
		})

		// Session management endpoints
		e.Router.GET("/api/sessions/:username", func(c echo.Context) error {
			username := c.PathParam("username")
			user, err := findUserByUsername(app.Dao(), username)
			if err != nil {
				return apis.NewNotFoundError("User not found", err)
			}

			// Parse pagination parameters
			page := 1
			perPage := 20
			if pageStr := c.QueryParam("page"); pageStr != "" {
				if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
					page = p
				}
			}
			if perPageStr := c.QueryParam("perPage"); perPageStr != "" {
				if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 && pp <= 100 {
					perPage = pp
				}
			}

			// Get sessions with pagination
			sessions, err := app.Dao().FindRecordsByFilter(
				"sessions",
				"user = {:user}",
				"-created", // Order by newest first
				perPage,
				(page-1)*perPage,
				dbx.Params{"user": user.Id},
			)

			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to fetch sessions", err)
			}

			// Count total sessions for pagination
			var totalSessions int64
			err = app.Dao().DB().Select("count(*)").From("sessions").Where(dbx.HashExp{"user": user.Id}).Row(&totalSessions)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to count sessions", err)
			}

			// Format response
			sessionList := make([]map[string]any, len(sessions))
			for i, session := range sessions {
				sessionList[i] = map[string]any{
					"id":          session.Id,
					"name":        session.GetString("name"),
					"title":       session.GetString("title"),
					"description": session.GetString("description"),
					"public":      session.GetBool("public"),
					"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
					"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
				}
			}

			totalPages := (int(totalSessions) + perPage - 1) / perPage

			return c.JSON(http.StatusOK, map[string]any{
				"sessions":    sessionList,
				"page":        page,
				"perPage":     perPage,
				"totalItems":  totalSessions,
				"totalPages":  totalPages,
			})
		})

		e.Router.GET("/api/sessions/:username/:name", func(c echo.Context) error {
			username := c.PathParam("username")
			sessionName := c.PathParam("name")

			user, err := findUserByUsername(app.Dao(), username)
			if err != nil {
				return apis.NewNotFoundError("User not found", err)
			}

			session, err := findSessionByNameAndUser(app.Dao(), sessionName, user.Id)
			if err != nil {
				return apis.NewNotFoundError("Session not found", err)
			}

			return c.JSON(http.StatusOK, map[string]any{
				"id":          session.Id,
				"name":        session.GetString("name"),
				"title":       session.GetString("title"),
				"description": session.GetString("description"),
				"public":      session.GetBool("public"),
				"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
				"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
			})
		})

		e.Router.POST("/api/sessions", func(c echo.Context) error {
			record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if record == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				Name        string `json:"name"`
				Title       string `json:"title"`
				Description string `json:"description"`
				Public      bool   `json:"public"`
			}{}

			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request data", err)
			}

			if data.Name == "" {
				return apis.NewBadRequestError("Session name is required", nil)
			}

			// Check if session with this name already exists for the user
			existingSession, _ := findSessionByNameAndUser(app.Dao(), data.Name, record.Id)
			if existingSession != nil {
				return apis.NewBadRequestError("Session with this name already exists", nil)
			}

			// Create new session
			sessionsCollection, err := app.Dao().FindCollectionByNameOrId("sessions")
			if err != nil {
				return apis.NewNotFoundError("sessions collection not found", err)
			}

			session := models.NewRecord(sessionsCollection)
			session.Set("name", data.Name)
			session.Set("user", record.Id)
			session.Set("title", data.Title)
			session.Set("description", data.Description)
			session.Set("public", data.Public)

			if err := app.Dao().SaveRecord(session); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to create session", err)
			}

			return c.JSON(http.StatusCreated, map[string]any{
				"id":          session.Id,
				"name":        session.GetString("name"),
				"title":       session.GetString("title"),
				"description": session.GetString("description"),
				"public":      session.GetBool("public"),
				"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
				"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
			})
		}, apis.RequireRecordAuth())

		e.Router.PUT("/api/sessions/:username/:name", func(c echo.Context) error {
			record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if record == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			username := c.PathParam("username")
			sessionName := c.PathParam("name")

			// Verify user matches authenticated user
			if record.Username() != username {
				return apis.NewForbiddenError("Cannot update another user's sessions", nil)
			}

			session, err := findSessionByNameAndUser(app.Dao(), sessionName, record.Id)
			if err != nil {
				return apis.NewNotFoundError("Session not found", err)
			}

			data := struct {
				Title       string `json:"title"`
				Description string `json:"description"`
				Public      bool   `json:"public"`
			}{}

			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request data", err)
			}

			// Update session
			session.Set("title", data.Title)
			session.Set("description", data.Description)
			session.Set("public", data.Public)

			if err := app.Dao().SaveRecord(session); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to update session", err)
			}

			return c.JSON(http.StatusOK, map[string]any{
				"id":          session.Id,
				"name":        session.GetString("name"),
				"title":       session.GetString("title"),
				"description": session.GetString("description"),
				"public":      session.GetBool("public"),
				"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
				"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
			})
		}, apis.RequireRecordAuth())

		e.Router.DELETE("/api/sessions/:username/:name", func(c echo.Context) error {
			record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if record == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			username := c.PathParam("username")
			sessionName := c.PathParam("name")

			// Verify user matches authenticated user
			if record.Username() != username {
				return apis.NewForbiddenError("Cannot delete another user's sessions", nil)
			}

			session, err := findSessionByNameAndUser(app.Dao(), sessionName, record.Id)
			if err != nil {
				return apis.NewNotFoundError("Session not found", err)
			}

			if err := app.Dao().DeleteRecord(session); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to delete session", err)
			}

			return c.JSON(http.StatusOK, map[string]any{
				"message": "Session deleted successfully",
			})
		}, apis.RequireRecordAuth())

		// Add JWT authentication endpoints
		e.Router.POST("/api/login", func(c echo.Context) error {
			data := struct {
				Email    string `json:"email"`
				Password string `json:"password"`
			}{}

			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request data", err)
			}

			// Find user by email
			record, err := app.Dao().FindAuthRecordByEmail("users", data.Email)
			if err != nil {
				return apis.NewUnauthorizedError("Invalid credentials", err)
			}

			// Validate password
			if !record.ValidatePassword(data.Password) {
				return apis.NewUnauthorizedError("Invalid credentials", nil)
			}

			// Generate auth token
			token, err := tokens.NewRecordAuthToken(app, record)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to generate token", err)
			}

			return c.JSON(http.StatusOK, map[string]any{
				"token": token,
				"user": map[string]any{
					"id":       record.Id,
					"username": record.Username(),
					"email":    record.Email(),
					"avatar":   record.GetString("avatar"),
				},
			})
		})

		e.Router.POST("/api/auth/refresh", func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				return apis.NewUnauthorizedError("Missing or invalid token", nil)
			}

			token := authHeader[7:]

			// Verify and parse the existing token
			record, err := getAuthRecordFromToken(app, token)
			if err != nil {
				return apis.NewUnauthorizedError("Invalid or expired token", err)
			}

			// Generate new token
			newToken, err := tokens.NewRecordAuthToken(app, record)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to generate new token", err)
			}

			return c.JSON(http.StatusOK, map[string]any{
				"token": newToken,
				"user": map[string]any{
					"id":       record.Id,
					"username": record.Username(),
					"email":    record.Email(),
					"avatar":   record.GetString("avatar"),
				},
			})
		})

		e.Router.GET("/api/me", func(c echo.Context) error {
			info, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if info == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			return c.JSON(http.StatusOK, map[string]any{
				"id":       info.Id,
				"username": info.Username(),
				"email":    info.Email(),
				"avatar":   info.GetString("avatar"),
				"token":    info.GetString("token"),
			})
		}, apis.RequireRecordAuth())

		e.Router.PUT("/api/profile", func(c echo.Context) error {
			record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if record == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				Username    string `json:"username"`
				Email       string `json:"email"`
				Password    string `json:"password"`
				OldPassword string `json:"oldPassword"`
			}{}

			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request data", err)
			}

			// Update username if provided
			if data.Username != "" && data.Username != record.Username() {
				record.SetUsername(data.Username)
			}

			// Update email if provided
			if data.Email != "" && data.Email != record.Email() {
				record.SetEmail(data.Email)
			}

			// Update password if provided
			if data.Password != "" {
				if data.OldPassword == "" {
					return apis.NewBadRequestError("Old password required to set new password", nil)
				}
				if !record.ValidatePassword(data.OldPassword) {
					return apis.NewBadRequestError("Invalid old password", nil)
				}
				record.SetPassword(data.Password)
			}

			if err := app.Dao().SaveRecord(record); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to update profile", err)
			}

			return c.JSON(http.StatusOK, map[string]any{
				"id":       record.Id,
				"username": record.Username(),
				"email":    record.Email(),
				"avatar":   record.GetString("avatar"),
				"token":    record.GetString("token"),
			})
		}, apis.RequireRecordAuth())

		e.Router.POST("/api/profile/avatar", func(c echo.Context) error {
			record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if record == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			// Use PocketBase forms to handle file upload properly
			form := forms.NewRecordUpsert(app, record)

			// Load the multipart form data
			if err := form.LoadRequest(c.Request(), ""); err != nil {
				return apis.NewBadRequestError("Failed to parse form data", err)
			}

			// Submit the form (this will handle file upload automatically)
			if err := form.Submit(); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to save avatar", err)
			}

			// Return updated user data
			return c.JSON(http.StatusOK, map[string]any{
				"id":       record.Id,
				"username": record.Username(),
				"email":    record.Email(),
				"avatar":   record.GetString("avatar"),
				"token":    record.GetString("token"),
			})
		}, apis.RequireRecordAuth())

		e.Router.PUT("/api/profile/regenerate-token", func(c echo.Context) error {
			record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if record == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			// Generate new custom token
			newToken := security.RandomString(12)
			record.Set("token", newToken)

			if err := app.Dao().SaveRecord(record); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to regenerate token", err)
			}

			return c.JSON(http.StatusOK, map[string]any{
				"id":       record.Id,
				"username": record.Username(),
				"email":    record.Email(),
				"avatar":   record.GetString("avatar"),
				"token":    newToken,
			})
		}, apis.RequireRecordAuth())

		e.Router.GET("/api/track", func(c echo.Context) error {
			user, err := authenticateTrackRequest(c, app)
			if err != nil {
				return apis.NewUnauthorizedError("Invalid authentication", err)
			}

			collection, err := app.Dao().FindCollectionByNameOrId("locations")
			if err != nil {
				return apis.NewNotFoundError("locations collection not found", err)
			}

			record := models.NewRecord(collection)
			record.Set("user", user.Id)
			record.Set("timestamp", types.NowDateTime())
			if c.QueryParam("timestamp") != "" {
				if ts, err := strconv.ParseInt(c.QueryParam("timestamp"), 10, 64); err == nil {
					timeStamp, _ := types.ParseDateTime(time.Unix(ts, 0))
					record.Set("timestamp", timeStamp)
				}
			}
			record.Set("latitude", c.QueryParam("latitude"))
			record.Set("longitude", c.QueryParam("longitude"))
			record.Set("altitude", c.QueryParam("altitude"))
			record.Set("speed", c.QueryParam("speed"))
			record.Set("heart_rate", c.QueryParam("heart_rate"))
			// Handle session - create if doesn't exist
			sessionName := c.QueryParam("session")
			record.Set("session", sessionName) // Keep backward compatibility
			
			if sessionName != "" {
				session, err := findOrCreateSession(app.Dao(), sessionName, user)
				if err != nil {
					log.Printf("Warning: Failed to create/find session %s for user %s: %v", sessionName, user.Id, err)
				} else if session != nil {
					record.Set("session_id", session.Id)
				}
			}

			if err := app.Dao().SaveRecord(record); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to save tracking data", err)
			}

			return c.JSON(http.StatusOK, record)
		})

		e.Router.POST("/api/track", func(c echo.Context) error {
			user, err := authenticateTrackRequest(c, app)
			if err != nil {
				return apis.NewUnauthorizedError("Invalid authentication", err)
			}

			var data struct {
				Type     string `json:"type"`
				Geometry struct {
					Type        string    `json:"type"`
					Coordinates []float64 `json:"coordinates"`
				} `json:"geometry"`
				Properties struct {
					Timestamp int64   `json:"timestamp"`
					Speed     float64 `json:"speed,omitempty"`
					HeartRate float64 `json:"heart_rate,omitempty"`
					Session   string  `json:"session,omitempty"`
				} `json:"properties"`
			}

			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Failed to parse request data", err)
			}

			collection, err := app.Dao().FindCollectionByNameOrId("locations")
			if err != nil {
				return apis.NewNotFoundError("locations collection not found", err)
			}

			record := models.NewRecord(collection)
			record.Set("user", user.Id)
			if data.Properties.Timestamp == 0 {
				record.Set("timestamp", types.NowDateTime())
			} else {
				timeStamp, _ := types.ParseDateTime(time.Unix(data.Properties.Timestamp, 0))
				record.Set("timestamp", timeStamp)
			}
			record.Set("longitude", data.Geometry.Coordinates[0])
			record.Set("latitude", data.Geometry.Coordinates[1])
			if len(data.Geometry.Coordinates) > 2 {
				record.Set("altitude", data.Geometry.Coordinates[2])
			}
			record.Set("speed", data.Properties.Speed)
			record.Set("heart_rate", data.Properties.HeartRate)
			// Handle session - create if doesn't exist
			sessionName := data.Properties.Session
			record.Set("session", sessionName) // Keep backward compatibility
			
			if sessionName != "" {
				session, err := findOrCreateSession(app.Dao(), sessionName, user)
				if err != nil {
					log.Printf("Warning: Failed to create/find session %s for user %s: %v", sessionName, user.Id, err)
				} else if session != nil {
					record.Set("session_id", session.Id)
				}
			}

			if err := app.Dao().SaveRecord(record); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to save tracking data", err)
			}

			return c.JSON(http.StatusOK, record)
		})

		return nil
	})

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
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

func authenticateTrackRequest(c echo.Context, app *pocketbase.PocketBase) (*models.Record, error) {
	// Try JWT first (Authorization: Bearer <jwt>)
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		// Use PocketBase's built-in middleware approach
		// Set the request header and use the APIs auth middleware
		token := authHeader[7:]

		// Try to get the auth record from the context (after middleware processing)
		if info := c.Get(apis.ContextAuthRecordKey); info != nil {
			if record, ok := info.(*models.Record); ok {
				return record, nil
			}
		}

		// If not available via context, try basic token verification
		if record, err := getAuthRecordFromToken(app, token); err == nil {
			return record, nil
		}
	}

	// Fallback to custom token (query param or header)
	customToken := c.QueryParam("token")
	if customToken == "" && !strings.HasPrefix(authHeader, "Bearer ") {
		customToken = authHeader
	}

	return findUserByToken(app.Dao(), customToken)
}

func getAuthRecordFromToken(app *pocketbase.PocketBase, token string) (*models.Record, error) {
	// Parse and verify the JWT token using PocketBase's method
	claims, err := security.ParseJWT(token, app.Settings().RecordAuthToken.Secret)
	if err != nil {
		return nil, err
	}

	// Get the record ID from claims
	recordId, ok := claims["id"].(string)
	if !ok {
		return nil, errors.New("invalid token: missing record id")
	}

	// Get the collection ID from claims
	collectionId, ok := claims["collectionId"].(string)
	if !ok {
		return nil, errors.New("invalid token: missing collection id")
	}

	// Find and return the record
	record, err := app.Dao().FindRecordById(collectionId, recordId)
	if err != nil {
		return nil, err
	}

	return record, nil
}

func findUserByToken(dao *daos.Dao, token string) (*models.Record, error) {
	if token == "" {
		return nil, errors.New("token is missing")
	}

	// remove the "Bearer " prefix if present
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	return dao.FindFirstRecordByFilter("users", "token = {:token}", dbx.Params{"token": token})
}

func findUserByUsername(dao *daos.Dao, username string) (*models.Record, error) {
	if username == "" {
		return nil, errors.New("username is missing")
	}
	return dao.FindFirstRecordByFilter("users", "username = {:username}", dbx.Params{"username": username})
}

func findSessionByNameAndUser(dao *daos.Dao, sessionName string, userId string) (*models.Record, error) {
	if sessionName == "" || userId == "" {
		return nil, errors.New("session name or user ID is missing")
	}
	return dao.FindFirstRecordByFilter("sessions", "name = {:name} && user = {:user}", 
		dbx.Params{"name": sessionName, "user": userId})
}

func findOrCreateSession(dao *daos.Dao, sessionName string, user *models.Record) (*models.Record, error) {
	if sessionName == "" {
		return nil, nil // No session requested
	}

	// Try to find existing session
	session, err := findSessionByNameAndUser(dao, sessionName, user.Id)
	if err == nil {
		return session, nil // Found existing session
	}

	// Create new session
	sessionsCollection, err := dao.FindCollectionByNameOrId("sessions")
	if err != nil {
		return nil, fmt.Errorf("sessions collection not found: %v", err)
	}

	session = models.NewRecord(sessionsCollection)
	session.Set("name", sessionName)
	session.Set("user", user.Id)
	session.Set("public", false)
	
	// Generate a nice title from the session name
	title := generateSessionTitle(sessionName)
	session.Set("title", title)
	session.Set("description", "")

	if err := dao.SaveRecord(session); err != nil {
		return nil, fmt.Errorf("failed to create session: %v", err)
	}

	return session, nil
}

func generateSessionTitle(sessionName string) string {
	if sessionName == "" {
		return "Untitled Session"
	}

	// Convert snake_case and kebab-case to Title Case
	words := strings.FieldsFunc(sessionName, func(c rune) bool {
		return c == '_' || c == '-'
	})

	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
		}
	}

	title := strings.Join(words, " ")
	if title == "" {
		return "Untitled Session"
	}

	return title
}
