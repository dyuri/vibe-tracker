package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/forms"
	"github.com/pocketbase/pocketbase/models"

	"vibe-tracker/constants"
	"vibe-tracker/middleware"
	appmodels "vibe-tracker/models"
	"vibe-tracker/utils"
)

type WaypointHandler struct {
	app *pocketbase.PocketBase
}

func NewWaypointHandler(app *pocketbase.PocketBase) *WaypointHandler {
	return &WaypointHandler{
		app: app,
	}
}

// ListWaypoints lists waypoints for a user or session
//
//	@Summary		List waypoints
//	@Description	Returns a paginated list of waypoints for the specified user or session
//	@Tags			Waypoints
//	@Produce		json
//	@Param			username	path		string	true	"Username"
//	@Param			session		query		string	false	"Session name filter"
//	@Param			type		query		string	false	"Waypoint type filter"
//	@Param			page		query		int		false	"Page number (default: 1)"
//	@Param			per_page	query		int		false	"Items per page (default: 20, max: 100)"
//	@Success		200			{object}	models.SuccessResponse	"Waypoints retrieved successfully"
//	@Failure		404			{object}	models.ErrorResponse	"User not found"
//	@Router			/waypoints/{username} [get]
func (h *WaypointHandler) ListWaypoints(c echo.Context) error {
	// Get user from middleware context
	user, exists := GetRequestUser(c)
	if !exists {
		return apis.NewNotFoundError("User not found", nil)
	}

	// Check if user has access to this data
	authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	isOwner := authRecord != nil && authRecord.Id == user.Id

	// Parse pagination parameters
	page := constants.DefaultPage
	perPage := constants.DefaultPerPage
	if pageStr := c.QueryParam("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if perPageStr := c.QueryParam("perPage"); perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 && pp <= constants.MaxPerPageLimit {
			perPage = pp
		}
	}

	// Build filter
	filter := ""
	params := dbx.Params{}

	// Session filter
	if sessionName := c.QueryParam("session"); sessionName != "" {
		// Find the session first
		session, err := findSessionByNameAndUser(h.app.Dao(), sessionName, user.Id)
		if err != nil {
			return apis.NewNotFoundError("Session not found", err)
		}

		// Check if user has access to this session
		if !session.GetBool("public") && !isOwner {
			return apis.NewForbiddenError("Access denied", nil)
		}

		filter = "session_id = {:session_id}"
		params["session_id"] = session.Id
	} else {
		// List waypoints from all user's sessions
		if isOwner {
			filter = "session_id.user = {:user}"
		} else {
			filter = "session_id.user = {:user} && session_id.public = true"
		}
		params["user"] = user.Id
	}

	// Type filter
	if waypointType := c.QueryParam("type"); waypointType != "" {
		if filter != "" {
			filter += " && type = {:type}"
		} else {
			filter = "type = {:type}"
		}
		params["type"] = waypointType
	}

	// Get waypoints with pagination
	waypoints, err := h.app.Dao().FindRecordsByFilter(
		"waypoints",
		filter,
		"-created", // Order by newest first
		perPage,
		(page-1)*perPage,
		params,
	)

	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to fetch waypoints", err)
	}

	// Count total waypoints for pagination
	totalWaypoints, err := h.app.Dao().FindRecordsByFilter("waypoints", filter, "", 0, 0, params)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to count waypoints", err)
	}

	// Format response
	waypointList := make([]map[string]any, len(waypoints))
	for i, waypoint := range waypoints {
		waypointData := h.formatWaypointResponse(waypoint)
		waypointList[i] = waypointData
	}

	totalPages := (len(totalWaypoints) + perPage - 1) / perPage
	paginationMeta := appmodels.PaginationMeta{
		Page:       page,
		PerPage:    perPage,
		TotalItems: int64(len(totalWaypoints)),
		TotalPages: totalPages,
	}

	return utils.SendPaginated(c, http.StatusOK, waypointList, paginationMeta, "")
}

// ListWaypointsBySession lists waypoints for a specific session by session ID
//
//	@Summary		List waypoints by session
//	@Description	Returns waypoints for the specified session ID
//	@Tags			Waypoints
//	@Produce		json
//	@Param			sessionId	path		string	true	"Session ID"
//	@Param			type		query		string	false	"Waypoint type filter"
//	@Param			page		query		int		false	"Page number (default: 1)"
//	@Param			per_page	query		int		false	"Items per page (default: 20, max: 100)"
//	@Success		200			{object}	models.SuccessResponse	"Waypoints retrieved successfully"
//	@Failure		404			{object}	models.ErrorResponse	"Session not found"
//	@Router			/waypoints/by-session/{sessionId} [get]
func (h *WaypointHandler) ListWaypointsBySession(c echo.Context) error {
	sessionID := c.PathParam("sessionId")

	// Find the session to verify it exists and check access
	session, err := h.app.Dao().FindRecordById("sessions", sessionID)
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	// Check if user has access to this session
	authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	isOwner := authRecord != nil && authRecord.Id == session.GetString("user")

	if !session.GetBool("public") && !isOwner {
		return apis.NewForbiddenError("Access denied", nil)
	}

	// Parse pagination parameters
	page := constants.DefaultPage
	perPage := constants.DefaultPerPage
	if pageStr := c.QueryParam("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if perPageStr := c.QueryParam("perPage"); perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 && pp <= constants.MaxPerPageLimit {
			perPage = pp
		}
	}

	// Build filter
	filter := "session_id = {:session_id}"
	params := dbx.Params{"session_id": sessionID}

	// Type filter
	if waypointType := c.QueryParam("type"); waypointType != "" {
		filter += " && type = {:type}"
		params["type"] = waypointType
	}

	// Get waypoints with pagination
	waypoints, err := h.app.Dao().FindRecordsByFilter(
		"waypoints",
		filter,
		"-created", // Order by newest first
		perPage,
		(page-1)*perPage,
		params,
	)

	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to fetch waypoints", err)
	}

	// Format response as GeoJSON FeatureCollection to match frontend expectations
	features := make([]map[string]any, len(waypoints))
	for i, waypoint := range waypoints {
		features[i] = map[string]any{
			"type": "Feature",
			"id":   waypoint.Id,
			"geometry": map[string]any{
				"type": "Point",
				"coordinates": []float64{
					waypoint.GetFloat("longitude"),
					waypoint.GetFloat("latitude"),
				},
			},
			"properties": map[string]any{
				"id":                  waypoint.Id,
				"name":                waypoint.GetString("name"),
				"type":                waypoint.GetString("type"),
				"description":         waypoint.GetString("description"),
				"session_id":          waypoint.GetString("session_id"),
				"source":              waypoint.GetString("source"),
				"position_confidence": waypoint.GetString("position_confidence"),
				"created":             waypoint.GetDateTime("created").Time().Format(time.RFC3339),
				"updated":             waypoint.GetDateTime("updated").Time().Format(time.RFC3339),
			},
		}

		// Add optional fields
		if altitude := waypoint.GetFloat("altitude"); altitude != 0 {
			features[i]["properties"].(map[string]any)["altitude"] = altitude
		}

		if photo := waypoint.GetString("photo"); photo != "" {
			features[i]["properties"].(map[string]any)["photo"] = photo
		}
	}

	// Return GeoJSON FeatureCollection format to match frontend expectations
	response := map[string]any{
		"type":     "FeatureCollection",
		"features": features,
	}

	return utils.SendSuccess(c, http.StatusOK, response, "")
}

// GetWaypoint retrieves a specific waypoint
//
//	@Summary		Get waypoint
//	@Description	Returns a specific waypoint by ID
//	@Tags			Waypoints
//	@Produce		json
//	@Param			id	path		string	true	"Waypoint ID"
//	@Success		200	{object}	models.SuccessResponse	"Waypoint retrieved successfully"
//	@Failure		404	{object}	models.ErrorResponse	"Waypoint not found"
//	@Router			/waypoints/{id} [get]
func (h *WaypointHandler) GetWaypoint(c echo.Context) error {
	waypointID := c.PathParam("id")

	waypoint, err := h.app.Dao().FindRecordById("waypoints", waypointID)
	if err != nil {
		return apis.NewNotFoundError("Waypoint not found", err)
	}

	// Check if user has access to this waypoint
	session, err := h.app.Dao().FindRecordById("sessions", waypoint.GetString("session_id"))
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	isOwner := authRecord != nil && authRecord.Id == session.GetString("user")

	if !session.GetBool("public") && !isOwner {
		return apis.NewForbiddenError("Access denied", nil)
	}

	waypointData := h.formatWaypointResponse(waypoint)
	return utils.SendSuccess(c, http.StatusOK, waypointData, "")
}

// CreateWaypoint creates a new waypoint
//
//	@Summary		Create waypoint
//	@Description	Creates a new waypoint for a session
//	@Tags			Waypoints
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			request	body		models.CreateWaypointRequest	true	"Waypoint data"
//	@Success		201		{object}	models.SuccessResponse			"Waypoint created successfully"
//	@Failure		400		{object}	models.ErrorResponse			"Invalid request"
//	@Failure		401		{object}	models.ErrorResponse			"Authentication required"
//	@Failure		403		{object}	models.ErrorResponse			"Forbidden"
//	@Router			/waypoints [post]
func (h *WaypointHandler) CreateWaypoint(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	// Get validated data from middleware
	validatedData := middleware.GetValidatedData(c)
	data, ok := validatedData.(*appmodels.CreateWaypointRequest)
	if !ok {
		return apis.NewBadRequestError("Invalid request data", nil)
	}

	// Verify user owns the session
	session, err := h.app.Dao().FindRecordById("sessions", data.SessionID)
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	if session.GetString("user") != record.Id {
		return apis.NewForbiddenError("Cannot create waypoints for another user's session", nil)
	}

	// Create waypoint
	collection, err := h.app.Dao().FindCollectionByNameOrId("waypoints")
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Waypoints collection not found", err)
	}

	waypoint := models.NewRecord(collection)
	waypoint.Set("session_id", data.SessionID)
	waypoint.Set("name", data.Name)
	waypoint.Set("type", data.Type)
	waypoint.Set("description", data.Description)
	waypoint.Set("latitude", data.Latitude)
	waypoint.Set("longitude", data.Longitude)
	waypoint.Set("source", data.Source)
	waypoint.Set("position_confidence", data.PositionConfidence)

	if data.Altitude != nil {
		waypoint.Set("altitude", *data.Altitude)
	}

	if err := h.app.Dao().SaveRecord(waypoint); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to create waypoint", err)
	}

	// Format as GeoJSON Feature to match frontend expectations
	waypointFeature := map[string]any{
		"type": "Feature",
		"id":   waypoint.Id,
		"geometry": map[string]any{
			"type": "Point",
			"coordinates": []float64{
				waypoint.GetFloat("longitude"),
				waypoint.GetFloat("latitude"),
			},
		},
		"properties": map[string]any{
			"id":                  waypoint.Id,
			"name":                waypoint.GetString("name"),
			"type":                waypoint.GetString("type"),
			"description":         waypoint.GetString("description"),
			"session_id":          waypoint.GetString("session_id"),
			"source":              waypoint.GetString("source"),
			"position_confidence": waypoint.GetString("position_confidence"),
			"created":             waypoint.GetDateTime("created").Time().Format(time.RFC3339),
			"updated":             waypoint.GetDateTime("updated").Time().Format(time.RFC3339),
		},
	}

	// Add optional fields
	if altitude := waypoint.GetFloat("altitude"); altitude != 0 {
		waypointFeature["properties"].(map[string]any)["altitude"] = altitude
	}

	if photo := waypoint.GetString("photo"); photo != "" {
		waypointFeature["properties"].(map[string]any)["photo"] = photo
	}

	return utils.SendSuccess(c, http.StatusCreated, waypointFeature, "Waypoint created successfully")
}

// UpdateWaypoint updates an existing waypoint
//
//	@Summary		Update waypoint
//	@Description	Updates an existing waypoint
//	@Tags			Waypoints
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Waypoint ID"
//	@Param			request	body		models.UpdateWaypointRequest	true	"Updated waypoint data"
//	@Success		200		{object}	models.SuccessResponse			"Waypoint updated successfully"
//	@Failure		400		{object}	models.ErrorResponse			"Invalid request"
//	@Failure		401		{object}	models.ErrorResponse			"Authentication required"
//	@Failure		403		{object}	models.ErrorResponse			"Forbidden"
//	@Failure		404		{object}	models.ErrorResponse			"Waypoint not found"
//	@Router			/waypoints/{id} [put]
func (h *WaypointHandler) UpdateWaypoint(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	waypointID := c.PathParam("id")

	waypoint, err := h.app.Dao().FindRecordById("waypoints", waypointID)
	if err != nil {
		return apis.NewNotFoundError("Waypoint not found", err)
	}

	// Verify user owns the session
	session, err := h.app.Dao().FindRecordById("sessions", waypoint.GetString("session_id"))
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	if session.GetString("user") != record.Id {
		return apis.NewForbiddenError("Cannot update another user's waypoints", nil)
	}

	// Get validated data from middleware
	validatedData := middleware.GetValidatedData(c)
	data, ok := validatedData.(*appmodels.UpdateWaypointRequest)
	if !ok {
		return apis.NewBadRequestError("Invalid request data", nil)
	}

	// Update waypoint fields
	if data.Name != "" {
		waypoint.Set("name", data.Name)
	}
	if data.Type != "" {
		waypoint.Set("type", data.Type)
	}
	if data.Description != "" {
		waypoint.Set("description", data.Description)
	}
	if data.Latitude != nil {
		waypoint.Set("latitude", *data.Latitude)
	}
	if data.Longitude != nil {
		waypoint.Set("longitude", *data.Longitude)
	}
	if data.Altitude != nil {
		waypoint.Set("altitude", *data.Altitude)
	}

	if err := h.app.Dao().SaveRecord(waypoint); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to update waypoint", err)
	}

	// Format as GeoJSON Feature to match frontend expectations
	waypointFeature := map[string]any{
		"type": "Feature",
		"id":   waypoint.Id,
		"geometry": map[string]any{
			"type": "Point",
			"coordinates": []float64{
				waypoint.GetFloat("longitude"),
				waypoint.GetFloat("latitude"),
			},
		},
		"properties": map[string]any{
			"id":                  waypoint.Id,
			"name":                waypoint.GetString("name"),
			"type":                waypoint.GetString("type"),
			"description":         waypoint.GetString("description"),
			"session_id":          waypoint.GetString("session_id"),
			"source":              waypoint.GetString("source"),
			"position_confidence": waypoint.GetString("position_confidence"),
			"created":             waypoint.GetDateTime("created").Time().Format(time.RFC3339),
			"updated":             waypoint.GetDateTime("updated").Time().Format(time.RFC3339),
		},
	}

	// Add optional fields
	if altitude := waypoint.GetFloat("altitude"); altitude != 0 {
		waypointFeature["properties"].(map[string]any)["altitude"] = altitude
	}

	if photo := waypoint.GetString("photo"); photo != "" {
		waypointFeature["properties"].(map[string]any)["photo"] = photo
	}

	return utils.SendSuccess(c, http.StatusOK, waypointFeature, "Waypoint updated successfully")
}

// DeleteWaypoint deletes an existing waypoint
//
//	@Summary		Delete waypoint
//	@Description	Deletes an existing waypoint
//	@Tags			Waypoints
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Waypoint ID"
//	@Success		200	{object}	models.SuccessResponse	"Waypoint deleted successfully"
//	@Failure		401	{object}	models.ErrorResponse	"Authentication required"
//	@Failure		403	{object}	models.ErrorResponse	"Forbidden"
//	@Failure		404	{object}	models.ErrorResponse	"Waypoint not found"
//	@Router			/waypoints/{id} [delete]
func (h *WaypointHandler) DeleteWaypoint(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	waypointID := c.PathParam("id")

	waypoint, err := h.app.Dao().FindRecordById("waypoints", waypointID)
	if err != nil {
		return apis.NewNotFoundError("Waypoint not found", err)
	}

	// Verify user owns the session
	session, err := h.app.Dao().FindRecordById("sessions", waypoint.GetString("session_id"))
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	if session.GetString("user") != record.Id {
		return apis.NewForbiddenError("Cannot delete another user's waypoints", nil)
	}

	if err := h.app.Dao().DeleteRecord(waypoint); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to delete waypoint", err)
	}

	return utils.SendSuccess(c, http.StatusOK, nil, "Waypoint deleted successfully")
}

// UploadPhotoWaypoint uploads a photo and creates a waypoint with intelligent positioning
//
//	@Summary		Upload photo waypoint
//	@Description	Uploads a photo and creates a waypoint with GPS data from EXIF or intelligent fallback positioning
//	@Tags			Waypoints
//	@Accept			multipart/form-data
//	@Produce		json
//	@Security		BearerAuth
//	@Param			session_id	formData	string	true	"Session ID"
//	@Param			name		formData	string	false	"Waypoint name (optional, will be generated if not provided)"
//	@Param			type		formData	string	false	"Waypoint type (default: generic)"
//	@Param			description	formData	string	false	"Waypoint description (optional)"
//	@Param			photo		formData	file	true	"Photo file to upload"
//	@Success		201			{object}	models.SuccessResponse	"Photo waypoint created successfully"
//	@Failure		400			{object}	models.ErrorResponse	"Invalid request or file"
//	@Failure		401			{object}	models.ErrorResponse	"Authentication required"
//	@Failure		403			{object}	models.ErrorResponse	"Forbidden"
//	@Router			/waypoints/photo [post]
func (h *WaypointHandler) UploadPhotoWaypoint(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	// Get form parameters
	sessionID := c.FormValue("session_id")
	if sessionID == "" {
		return apis.NewBadRequestError("session_id is required", nil)
	}

	// Verify user owns the session
	session, err := h.app.Dao().FindRecordById("sessions", sessionID)
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	if session.GetString("user") != record.Id {
		return apis.NewForbiddenError("Cannot create waypoints for another user's session", nil)
	}

	// Get the uploaded photo
	file, fileHeader, err := c.Request().FormFile("photo")
	if err != nil {
		return apis.NewBadRequestError("No photo file provided", err)
	}
	defer file.Close()

	// Validate file type
	if !utils.IsValidImageFormat(fileHeader.Filename, fileHeader.Header.Get("Content-Type")) {
		return apis.NewBadRequestError("Invalid image format. Supported formats: JPEG, TIFF", nil)
	}

	// Extract EXIF data
	exifData, err := utils.ExtractEXIFData(file)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to extract EXIF data", err)
	}

	// Reset file reader for EXIF extraction (will be re-read by form handler)
	file.Seek(0, 0)

	// Determine position and confidence
	var latitude, longitude, altitude *float64
	var positionConfidence string

	if exifData.HasGPS && exifData.Latitude != nil && exifData.Longitude != nil {
		// Use GPS coordinates from EXIF
		latitude = exifData.Latitude
		longitude = exifData.Longitude
		altitude = exifData.Altitude
		positionConfidence = "gps"
	} else {
		// Use intelligent fallback positioning
		lat, lon, alt, confidence, err := h.getFallbackPosition(sessionID, exifData.Timestamp, record.Id)
		if err != nil {
			return apis.NewApiError(http.StatusInternalServerError,
				fmt.Sprintf("No GPS data in photo and fallback positioning failed: %v", err), err)
		}
		latitude = lat
		longitude = lon
		altitude = alt
		positionConfidence = confidence
	}

	// Generate waypoint name if not provided
	name := c.FormValue("name")
	if name == "" {
		if exifData.Timestamp != nil {
			name = fmt.Sprintf("Photo %s", exifData.Timestamp.Format("15:04"))
		} else {
			name = fmt.Sprintf("Photo %s", time.Now().Format("15:04"))
		}
	}

	// Get waypoint type, default to generic
	waypointType := c.FormValue("type")
	if waypointType == "" {
		waypointType = "generic"
	}

	description := c.FormValue("description")

	// Create waypoint using PocketBase form handling for proper file association
	collection, err := h.app.Dao().FindCollectionByNameOrId("waypoints")
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Waypoints collection not found", err)
	}

	waypoint := models.NewRecord(collection)

	// Pre-set fields that are not in the form
	waypoint.Set("session_id", sessionID)
	waypoint.Set("name", name)
	waypoint.Set("type", waypointType)
	waypoint.Set("description", description)
	waypoint.Set("latitude", *latitude)
	waypoint.Set("longitude", *longitude)
	waypoint.Set("source", "photo")
	waypoint.Set("position_confidence", positionConfidence)

	if altitude != nil {
		waypoint.Set("altitude", *altitude)
	}

	// Use PocketBase forms to handle the file upload properly
	form := forms.NewRecordUpsert(h.app, waypoint)

	// Load the multipart form data (this will handle the photo file)
	if err := form.LoadRequest(c.Request(), ""); err != nil {
		return apis.NewBadRequestError("Failed to parse form data", err)
	}

	// Submit the form (this will save the record and handle file upload)
	if err := form.Submit(); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to create waypoint", err)
	}

	waypointData := h.formatWaypointResponse(waypoint)

	response := map[string]interface{}{
		"waypoint": waypointData,
		"exif_info": map[string]interface{}{
			"has_gps":         exifData.HasGPS,
			"has_timestamp":   exifData.Timestamp != nil,
			"camera_make":     exifData.Make,
			"camera_model":    exifData.Model,
			"position_source": positionConfidence,
		},
	}

	return utils.SendSuccess(c, http.StatusCreated, response, "Photo waypoint created successfully")
}

// getFallbackPosition implements the intelligent positioning fallback logic
func (h *WaypointHandler) getFallbackPosition(sessionID string, photoTimestamp *time.Time, userID string) (*float64, *float64, *float64, string, error) {
	// Priority 1: Time-based proximity matching with tracked locations
	if photoTimestamp != nil {
		if lat, lon, alt, err := h.findTimeMatchedLocation(sessionID, *photoTimestamp); err == nil {
			return lat, lon, alt, "time_matched", nil
		}
	}

	// Priority 2: End of tracked locations for current session
	if lat, lon, alt, err := h.findLastTrackedLocation(sessionID); err == nil {
		return lat, lon, alt, "tracked", nil
	}

	// Priority 3: End of GPX track for current session
	if lat, lon, alt, err := h.findLastGPXTrackPoint(sessionID); err == nil {
		return lat, lon, alt, "gpx_track", nil
	}

	// Priority 4: Last known location from user's history
	if lat, lon, alt, err := h.findLastKnownUserLocation(userID); err == nil {
		return lat, lon, alt, "last_known", nil
	}

	// Priority 5: Manual placement (return error to indicate manual placement needed)
	return nil, nil, nil, "manual", fmt.Errorf("no fallback position available, manual placement required")
}

// findTimeMatchedLocation finds the closest tracked location by timestamp
func (h *WaypointHandler) findTimeMatchedLocation(sessionID string, photoTime time.Time) (*float64, *float64, *float64, error) {
	// Look for locations within 30 minutes of the photo timestamp
	timeWindow := 30 * time.Minute
	startTime := photoTime.Add(-timeWindow)
	endTime := photoTime.Add(timeWindow)

	locations, err := h.app.Dao().FindRecordsByFilter(
		"locations",
		"session = {:session} && timestamp >= {:start_time} && timestamp <= {:end_time}",
		"timestamp ASC",
		10, 0, // Get up to 10 closest locations
		dbx.Params{
			"session":    sessionID,
			"start_time": startTime.Unix(),
			"end_time":   endTime.Unix(),
		},
	)

	if err != nil || len(locations) == 0 {
		return nil, nil, nil, fmt.Errorf("no locations found within time window")
	}

	// Find the location with the smallest time difference
	var closestLocation *models.Record
	var minTimeDiff time.Duration = timeWindow + 1 // Initialize with a value larger than window

	for _, location := range locations {
		locationTime := location.GetDateTime("timestamp").Time()
		timeDiff := photoTime.Sub(locationTime)
		if timeDiff < 0 {
			timeDiff = -timeDiff
		}

		if timeDiff < minTimeDiff {
			minTimeDiff = timeDiff
			closestLocation = location
		}
	}

	if closestLocation == nil {
		return nil, nil, nil, fmt.Errorf("no suitable time-matched location found")
	}

	lat := closestLocation.GetFloat("latitude")
	lon := closestLocation.GetFloat("longitude")
	var alt *float64
	if altitude := closestLocation.GetFloat("altitude"); altitude != 0 {
		alt = &altitude
	}

	return &lat, &lon, alt, nil
}

// findLastTrackedLocation finds the last tracked location for a session
func (h *WaypointHandler) findLastTrackedLocation(sessionID string) (*float64, *float64, *float64, error) {
	locations, err := h.app.Dao().FindRecordsByFilter(
		"locations",
		"session = {:session}",
		"-timestamp", // Order by newest first
		1, 0,         // Get only the last location
		dbx.Params{"session": sessionID},
	)

	if err != nil || len(locations) == 0 {
		return nil, nil, nil, fmt.Errorf("no tracked locations found for session")
	}

	location := locations[0]
	lat := location.GetFloat("latitude")
	lon := location.GetFloat("longitude")
	var alt *float64
	if altitude := location.GetFloat("altitude"); altitude != 0 {
		alt = &altitude
	}

	return &lat, &lon, alt, nil
}

// findLastGPXTrackPoint finds the last point in the GPX track for a session
func (h *WaypointHandler) findLastGPXTrackPoint(sessionID string) (*float64, *float64, *float64, error) {
	trackPoints, err := h.app.Dao().FindRecordsByFilter(
		"gpx_tracks",
		"session_id = {:session_id}",
		"-sequence", // Order by highest sequence (last point) first
		1, 0,        // Get only the last point
		dbx.Params{"session_id": sessionID},
	)

	if err != nil || len(trackPoints) == 0 {
		return nil, nil, nil, fmt.Errorf("no GPX track points found for session")
	}

	point := trackPoints[0]
	lat := point.GetFloat("latitude")
	lon := point.GetFloat("longitude")
	var alt *float64
	if altitude := point.GetFloat("altitude"); altitude != 0 {
		alt = &altitude
	}

	return &lat, &lon, alt, nil
}

// findLastKnownUserLocation finds the most recent location from any of the user's sessions
func (h *WaypointHandler) findLastKnownUserLocation(userID string) (*float64, *float64, *float64, error) {
	// Find the most recent location from any session belonging to this user
	locations, err := h.app.Dao().FindRecordsByFilter(
		"locations",
		"user = {:user}",
		"-timestamp", // Order by newest first
		1, 0,         // Get only the last location
		dbx.Params{"user": userID},
	)

	if err != nil || len(locations) == 0 {
		return nil, nil, nil, fmt.Errorf("no previous locations found for user")
	}

	location := locations[0]
	lat := location.GetFloat("latitude")
	lon := location.GetFloat("longitude")
	var alt *float64
	if altitude := location.GetFloat("altitude"); altitude != 0 {
		alt = &altitude
	}

	return &lat, &lon, alt, nil
}

// formatWaypointResponse formats a waypoint record for API response
func (h *WaypointHandler) formatWaypointResponse(waypoint *models.Record) map[string]any {
	data := map[string]any{
		"id":                  waypoint.Id,
		"name":                waypoint.GetString("name"),
		"type":                waypoint.GetString("type"),
		"description":         waypoint.GetString("description"),
		"latitude":            waypoint.GetFloat("latitude"),
		"longitude":           waypoint.GetFloat("longitude"),
		"session_id":          waypoint.GetString("session_id"),
		"source":              waypoint.GetString("source"),
		"position_confidence": waypoint.GetString("position_confidence"),
		"created":             waypoint.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":             waypoint.GetDateTime("updated").Time().Format(time.RFC3339),
	}

	// Add optional fields
	if altitude := waypoint.GetFloat("altitude"); altitude != 0 {
		data["altitude"] = altitude
	}

	if photo := waypoint.GetString("photo"); photo != "" {
		data["photo"] = photo
	}

	return data
}
