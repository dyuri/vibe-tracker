
package main

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/daos"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/types"
)

func main() {
	app := pocketbase.New()

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		e.Router.GET("/api/track", func(c echo.Context) error {
			collection, err := app.Dao().FindCollectionByNameOrId("locations")
			if err != nil {
				return apis.NewNotFoundError("locations collection not found", err)
			}

			record := models.NewRecord(collection)
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
			var data struct {
				Timestamp int64   `json:"timestamp"`
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
				Altitude  float64 `json:"altitude,omitempty"`
				Speed     float64 `json:"speed,omitempty"`
				HeartRate float64 `json:"heart_rate,omitempty"`
			}

			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Failed to parse request data", err)
			}

			collection, err := app.Dao().FindCollectionByNameOrId("locations")
			if err != nil {
				return apis.NewNotFoundError("locations collection not found", err)
			}

			record := models.NewRecord(collection)
			record.Set("timestamp", types.NowDateTime())
			record.Set("latitude", data.Latitude)
			record.Set("longitude", data.Longitude)
			record.Set("altitude", data.Altitude)
			record.Set("speed", data.Speed)
			record.Set("heart_rate", data.HeartRate)

			if err := app.Dao().SaveRecord(record); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Failed to save tracking data", err)
			}

			return c.JSON(http.StatusOK, record)
		})

		return nil
	})

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		ensureLocationsCollection(app.Dao())
		e.Router.Static("/", "public")
		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func ensureLocationsCollection(dao *daos.Dao) {
	collection, err := dao.FindCollectionByNameOrId("locations")
	if err == nil && collection != nil {
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
