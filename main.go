package main

import (
	"errors"
	"log"
	"net/http"
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
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tokens"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
)

func main() {
	app := pocketbase.New()

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
					"timestamp":  timestamp.Unix(),
					"speed":      latestRecord.GetFloat("speed"),
					"heart_rate": latestRecord.GetFloat("heart_rate"),
					"session":    latestRecord.GetString("session"),
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
				latestRecords, err := app.Dao().FindRecordsByFilter(
					"locations",
					"user = {:user}",
					"-created",
					1,
					0,
					dbx.Params{"user": user.Id},
				)
				if err != nil || len(latestRecords) == 0 {
					return apis.NewNotFoundError("No location data found for this user", err)
				}
				session = latestRecords[0].GetString("session")
			}

			records, err := app.Dao().FindRecordsByFilter(
				"locations",
				"user = {:user} && session = {:session}",
				"timestamp", // Order by timestamp to ensure correct LineString order
				0,           // No limit
				0,           // No offset
				dbx.Params{"user": user.Id, "session": session},
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
					"timestamp":  record.GetDateTime("timestamp").Time().Unix(),
					"speed":      record.GetFloat("speed"),
					"heart_rate": record.GetFloat("heart_rate"),
					"session":    record.GetString("session"),
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
			record.Set("session", c.QueryParam("session"))

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
			record.Set("session", data.Properties.Session)

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

		ensureUsersCollection(app.Dao())
		ensureLocationsCollection(app.Dao())
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

func ensureUsersCollection(dao *daos.Dao) {
	collection, err := dao.FindCollectionByNameOrId("users")
	if err == nil && collection != nil {
		modified := false

		if collection.Schema.GetFieldByName("token") == nil {
			// token field is missing, add it
			tokenField := &schema.SchemaField{
				Name:     "token",
				Type:     schema.FieldTypeText,
				Required: true,
				Options: &schema.TextOptions{
					Min:     types.Pointer(8),
					Max:     types.Pointer(16),
					Pattern: "^[a-zA-Z0-9]+$",
				},
			}
			collection.Schema.AddField(tokenField)
			modified = true
		}

		if collection.Schema.GetFieldByName("avatar") == nil {
			// avatar field is missing, add it
			avatarField := &schema.SchemaField{
				Name:     "avatar",
				Type:     schema.FieldTypeFile,
				Required: false,
				Options: &schema.FileOptions{
					MaxSelect: 1,
					MaxSize:   5242880, // 5MB in bytes
					MimeTypes: []string{
						"image/jpeg",
						"image/png",
						"image/svg+xml",
						"image/gif",
						"image/webp",
					},
				},
			}
			collection.Schema.AddField(avatarField)
			modified = true
		}

		if modified {
			if err := dao.SaveCollection(collection); err != nil {
				log.Fatalf("Failed to update users collection: %v", err)
			}
		}
		return // collection already exists
	}

	usersCollection := &models.Collection{
		Name:       "users",
		Type:       models.CollectionTypeAuth,
		ListRule:   nil,
		ViewRule:   nil,
		CreateRule: nil,
		UpdateRule: nil,
		DeleteRule: nil,
		Schema: schema.NewSchema(
			&schema.SchemaField{
				Name:     "token",
				Type:     schema.FieldTypeText,
				Required: true,
				Options: &schema.TextOptions{
					Min:     types.Pointer(8),
					Max:     types.Pointer(16),
					Pattern: "^[a-zA-Z0-9]+$",
				},
			},
			&schema.SchemaField{
				Name:     "avatar",
				Type:     schema.FieldTypeFile,
				Required: false,
				Options: &schema.FileOptions{
					MaxSelect: 1,
					MaxSize:   5242880, // 5MB in bytes
					MimeTypes: []string{
						"image/jpeg",
						"image/png",
						"image/svg+xml",
						"image/gif",
						"image/webp",
					},
				},
			},
		),
	}

	if err := dao.SaveCollection(usersCollection); err != nil {
		log.Fatalf("Failed to create users collection: %v", err)
	}

	// create a default user
	user, err := dao.FindAuthRecordByEmail("users", "default")
	if err != nil || user == nil {
		user := &models.Record{}
		user.RefreshId()
		user.SetUsername("default")
		user.Set("token", security.RandomString(12))
		if err := dao.SaveRecord(user); err != nil {
			log.Fatalf("Failed to create default user: %v", err)
		}
	}
}

func ensureLocationsCollection(dao *daos.Dao) {
	collection, err := dao.FindCollectionByNameOrId("locations")
	if err == nil && collection != nil {
		// TODO: check for user field
		return // collection already exists
	}

	newCollection := &models.Collection{
		Name:       "locations",
		Type:       models.CollectionTypeBase,
		ListRule:   nil,
		ViewRule:   nil,
		CreateRule: nil,
		UpdateRule: nil,
		DeleteRule: nil,
		Schema: schema.NewSchema(
			&schema.SchemaField{
				Name:     "user",
				Type:     schema.FieldTypeText,
				Required: true,
			},
			&schema.SchemaField{
				Name:     "timestamp",
				Type:     schema.FieldTypeDate,
				Required: false,
			},
			&schema.SchemaField{
				Name:     "latitude",
				Type:     schema.FieldTypeNumber,
				Required: true,
			},
			&schema.SchemaField{
				Name:     "longitude",
				Type:     schema.FieldTypeNumber,
				Required: true,
			},
			&schema.SchemaField{
				Name: "altitude",
				Type: schema.FieldTypeNumber,
			},
			&schema.SchemaField{
				Name: "speed",
				Type: schema.FieldTypeNumber,
			},
			&schema.SchemaField{
				Name: "heart_rate",
				Type: schema.FieldTypeNumber,
			},
			&schema.SchemaField{
				Name:     "session",
				Type:     schema.FieldTypeText,
				Required: false,
			},
		),
	}

	if err := dao.SaveCollection(newCollection); err != nil {
		log.Fatalf("Failed to create locations collection: %v", err)
	}
}
