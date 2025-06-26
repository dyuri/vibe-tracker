package main

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/daos"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/pocketbase/dbx"
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
					"type":        "Point",
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
					"type": "Instant",
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

			coordinates := make([][]float64, len(records))
			for i, record := range records {
				coordinates[i] = []float64{
					record.GetFloat("longitude"),
					record.GetFloat("latitude"),
					record.GetFloat("altitude"),
				}
			}

			// Get properties from the first record for the LineString properties
			firstRecord := records[0]
			properties := map[string]interface{}{
				"session": firstRecord.GetString("session"),
				"start_time": firstRecord.GetDateTime("timestamp").Time().Unix(),
				"end_time": records[len(records)-1].GetDateTime("timestamp").Time().Unix(),
			}

			geoJSON := map[string]interface{}{
				"type": "Feature",
				"geometry": map[string]interface{}{
					"type":        "LineString",
					"coordinates": coordinates,
				},
				"properties": properties,
			}

			return c.JSON(http.StatusOK, geoJSON)
		})

		e.Router.GET("/api/track", func(c echo.Context) error {
			token := c.QueryParam("token")
			user, err := findUserByToken(app.Dao(), token)
			if err != nil {
				return apis.NewUnauthorizedError("Invalid token", err)
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
			token := c.Request().Header.Get("Authorization")
			user, err := findUserByToken(app.Dao(), token)
			if err != nil {
				return apis.NewUnauthorizedError("Invalid token", err)
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
		ensureUsersCollection(app.Dao())
		ensureLocationsCollection(app.Dao())
		e.Router.Static("/", "public")
		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
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
		// TODO check if token field exists, extend if not
		return // collection already exists
	}

	// TODO ?
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
				Name: "session",
				Type: schema.FieldTypeText,
				Required: false,
			},
		),
	}

	if err := dao.SaveCollection(newCollection); err != nil {
		log.Fatalf("Failed to create locations collection: %v", err)
	}
}
