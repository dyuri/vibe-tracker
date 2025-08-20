package handlers

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tools/types"
)

type TrackingHandler struct {
	app *pocketbase.PocketBase
}

func NewTrackingHandler(app *pocketbase.PocketBase) *TrackingHandler {
	return &TrackingHandler{app: app}
}

func (h *TrackingHandler) TrackLocationGET(c echo.Context) error {
	// Get authenticated user from middleware context
	user, exists := GetAuthUser(c)
	if !exists {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	collection, err := h.app.Dao().FindCollectionByNameOrId("locations")
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

	collection, err := h.app.Dao().FindCollectionByNameOrId("locations")
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
