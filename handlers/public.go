package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tools/types"
)

type PublicHandler struct {
	app *pocketbase.PocketBase
}

func NewPublicHandler(app *pocketbase.PocketBase) *PublicHandler {
	return &PublicHandler{app: app}
}

func (h *PublicHandler) GetLocation(c echo.Context) error {
	username := c.PathParam("username")
	user, err := findUserByUsername(h.app.Dao(), username)
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

	records, _ := h.app.Dao().FindRecordsByFilter(
		"locations",
		filter,
		"-created",
		1,
		0,
		params,
	)

	if len(records) == 0 {
		return apis.NewNotFoundError("No location found for this user", nil)
	}

	latestRecord := records[0]

	// Construct GeoJSON response
	timestamp := latestRecord.GetDateTime("timestamp").Time()

	// Get session metadata if available
	sessionName := latestRecord.GetString("session")
	sessionTitle := sessionName // fallback to session name
	if sessionName != "" {
		if sessionRecord, err := findSessionByNameAndUser(h.app.Dao(), sessionName, user.Id); err == nil && sessionRecord != nil {
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
}

func (h *PublicHandler) GetPublicLocations(c echo.Context) error {
	// Get all users
	users, err := h.app.Dao().FindRecordsByFilter("users", "id != ''", "", 0, 0, nil)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to fetch users", err)
	}

	var features []interface{}

	// For each user, find their latest public session and location
	for _, user := range users {
		// Get latest public session for this user
		publicSessions, err := h.app.Dao().FindRecordsByFilter(
			"sessions",
			"user = {:user} && public = true",
			"-created", // Order by newest first
			1,          // Limit to 1
			0,
			dbx.Params{"user": user.Id},
		)

		if err != nil || len(publicSessions) == 0 {
			continue // Skip users with no public sessions
		}

		latestPublicSession := publicSessions[0]
		sessionName := latestPublicSession.GetString("name")

		// Get latest location for this session
		locations, err := h.app.Dao().FindRecordsByFilter(
			"locations",
			"user = {:user} && session = {:session}",
			"-timestamp", // Order by newest first
			1,            // Limit to 1
			0,
			dbx.Params{"user": user.Id, "session": sessionName},
		)

		if err != nil || len(locations) == 0 {
			continue // Skip sessions with no locations
		}

		latestLocation := locations[0]
		timestamp := latestLocation.GetDateTime("timestamp").Time()

		// Create GeoJSON feature for this user's latest location
		feature := map[string]interface{}{
			"type": "Feature",
			"geometry": map[string]interface{}{
				"type": "Point",
				"coordinates": []float64{
					latestLocation.GetFloat("longitude"),
					latestLocation.GetFloat("latitude"),
					latestLocation.GetFloat("altitude"),
				},
			},
			"properties": map[string]interface{}{
				"timestamp":     timestamp.Unix(),
				"speed":         latestLocation.GetFloat("speed"),
				"heart_rate":    latestLocation.GetFloat("heart_rate"),
				"session":       sessionName,
				"session_title": latestPublicSession.GetString("title"),
				"username":      user.Username(),
				"user_id":       user.Id,
				"avatar":        user.GetString("avatar"),
			},
		}

		features = append(features, feature)
	}

	// Return GeoJSON FeatureCollection
	response := map[string]interface{}{
		"type":     "FeatureCollection",
		"features": features,
	}

	return c.JSON(http.StatusOK, response)
}

func (h *PublicHandler) GetSessionData(c echo.Context) error {
	username := c.PathParam("username")
	session := c.PathParam("session")

	user, err := findUserByUsername(h.app.Dao(), username)
	if err != nil {
		return apis.NewNotFoundError("User not found", err)
	}

	if session == "_latest" {
		// Find the most recently created session for this user
		latestSessions, err := h.app.Dao().FindRecordsByFilter(
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
		if sessionRecord, err := findSessionByNameAndUser(h.app.Dao(), session, user.Id); err == nil && sessionRecord != nil {
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

	records, err := h.app.Dao().FindRecordsByFilter(
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
}
