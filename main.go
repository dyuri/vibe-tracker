package main

import (
	"errors"
	"log"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/daos"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
)

func main() {
	app := pocketbase.New()

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
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
			record.Set("latitude", c.QueryParam("latitude"))
			record.Set("longitude", c.QueryParam("longitude"))
			record.Set("altitude", c.QueryParam("altitude"))
			record.Set("speed", c.QueryParam("speed"))
			record.Set("heart_rate", c.QueryParam("heart_rate"))

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
			record.Set("timestamp", types.NowDateTime())
			record.Set("longitude", data.Geometry.Coordinates[0])
			record.Set("latitude", data.Geometry.Coordinates[1])
			if len(data.Geometry.Coordinates) > 2 {
				record.Set("altitude", data.Geometry.Coordinates[2])
			}
			record.Set("speed", data.Properties.Speed)
			record.Set("heart_rate", data.Properties.HeartRate)

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

	return dao.FindFirstRecordByFilter("users", "token = {:token}", daos.Params{"token": token})
}

func ensureUsersCollection(dao *daos.Dao) {
	collection, err := dao.FindCollectionByNameOrId("users")
	if err == nil && collection != nil {
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
				Unique:   true,
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
	user := &models.Record{}
	user.RefreshId()
	user.Set("token", security.RandomString(12))
	if err := dao.SaveRecord(user); err != nil {
		log.Fatalf("Failed to create default user: %v", err)
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
				Type:     schema.FieldTypeRelation,
				Required: true,
				Options: &schema.RelationOptions{
					CollectionId: "users",
				},
			},
			&schema.SchemaField{
				Name:     "timestamp",
				Type:     schema.FieldTypeDate,
				Required: true,
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
		),
	}

	if err := dao.SaveCollection(newCollection); err != nil {
		log.Fatalf("Failed to create locations collection: %v", err)
	}
}