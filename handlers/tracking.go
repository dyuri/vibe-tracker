package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tools/types"
	
	"vibe-tracker/constants"
	"vibe-tracker/middleware"
	appmodels "vibe-tracker/models"
	"vibe-tracker/services"
)

type TrackingHandler struct {
	app             *pocketbase.PocketBase
	locationService *services.LocationService
}

func NewTrackingHandler(app *pocketbase.PocketBase, locationService *services.LocationService) *TrackingHandler {
	return &TrackingHandler{
		app:             app,
		locationService: locationService,
	}
}

func (h *TrackingHandler) TrackLocationGET(c echo.Context) error {
	// Get authenticated user from middleware context
	user, exists := GetAuthUser(c)
	if !exists {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	// Get validated query parameters from middleware
	queryData := middleware.GetValidatedQuery(c)
	params, ok := queryData.(*appmodels.TrackingQueryParams)
	if !ok {
		return apis.NewBadRequestError("Invalid query parameters", nil)
	}

	collection, err := h.app.Dao().FindCollectionByNameOrId(constants.CollectionLocations)
	if err != nil {
		return apis.NewNotFoundError("locations collection not found", err)
	}

	record := models.NewRecord(collection)
	record.Set("user", user.Id)
	record.Set("timestamp", types.NowDateTime())
	if params.Timestamp != 0 {
		timeStamp, _ := types.ParseDateTime(time.Unix(params.Timestamp, 0))
		record.Set("timestamp", timeStamp)
	}
	record.Set("latitude", params.Latitude)
	record.Set("longitude", params.Longitude)
	if params.Altitude != nil {
		record.Set("altitude", *params.Altitude)
	}
	if params.Speed != nil {
		record.Set("speed", *params.Speed)
	}
	if params.HeartRate != nil {
		record.Set("heart_rate", *params.HeartRate)
	}
	// Handle session - create if doesn't exist
	sessionName := params.Session
	record.Set("session", sessionName) // Keep backward compatibility

	if sessionName != "" {
		session, err := findOrCreateSession(h.app.Dao(), sessionName, user)
		if err != nil {
			log.Printf("Warning: Failed to create/find session %s for user %s: %v", sessionName, user.Id, err)
		} else if session != nil {
			record.Set("session_id", session.Id)
		}
	}

	if err := h.app.Dao().SaveRecord(record); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to save tracking data", err)
	}

	return c.JSON(http.StatusOK, record)
}

func (h *TrackingHandler) TrackLocationPOST(c echo.Context) error {
	// Get authenticated user from middleware context
	user, exists := GetAuthUser(c)
	if !exists {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	// Get validated data from middleware
	jsonData := middleware.GetValidatedData(c)
	data, ok := jsonData.(*appmodels.LocationRequest)
	if !ok {
		return apis.NewBadRequestError("Invalid request data", nil)
	}

	collection, err := h.app.Dao().FindCollectionByNameOrId(constants.CollectionLocations)
	if err != nil {
		return apis.NewNotFoundError("locations collection not found", err)
	}

	record := models.NewRecord(collection)
	record.Set("user", user.Id)
	if data.Properties.Timestamp == constants.DefaultTimestamp {
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
	if data.Properties.Speed != nil {
		record.Set("speed", *data.Properties.Speed)
	}
	if data.Properties.HeartRate != nil {
		record.Set("heart_rate", *data.Properties.HeartRate)
	}
	// Handle session - create if doesn't exist
	sessionName := data.Properties.Session
	record.Set("session", sessionName) // Keep backward compatibility

	if sessionName != "" {
		session, err := findOrCreateSession(h.app.Dao(), sessionName, user)
		if err != nil {
			log.Printf("Warning: Failed to create/find session %s for user %s: %v", sessionName, user.Id, err)
		} else if session != nil {
			record.Set("session_id", session.Id)
		}
	}

	if err := h.app.Dao().SaveRecord(record); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to save tracking data", err)
	}

	return c.JSON(http.StatusOK, record)
}
