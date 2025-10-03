package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/models"

	"vibe-tracker/constants"
	"vibe-tracker/middleware"
	appmodels "vibe-tracker/models"
	"vibe-tracker/services"
	"vibe-tracker/utils"
)

type SessionHandler struct {
	app            *pocketbase.PocketBase
	sessionService *services.SessionService
}

func NewSessionHandler(app *pocketbase.PocketBase, sessionService *services.SessionService) *SessionHandler {
	return &SessionHandler{
		app:            app,
		sessionService: sessionService,
	}
}

// ListSessions lists all sessions for a user
//
//	@Summary		List user sessions
//	@Description	Returns a paginated list of sessions for the specified user
//	@Tags			Sessions
//	@Produce		json
//	@Param			username	path		string	true	"Username"
//	@Param			page		query		int		false	"Page number (default: 1)"
//	@Param			per_page	query		int		false	"Items per page (default: 20, max: 100)"
//	@Success		200			{object}	models.SuccessResponse	"Sessions retrieved successfully"
//	@Failure		404			{object}	models.ErrorResponse		"User not found"
//	@Router			/sessions/{username} [get]
func (h *SessionHandler) ListSessions(c echo.Context) error {
	// Get user from middleware context
	user, exists := GetRequestUser(c)
	if !exists {
		return apis.NewNotFoundError("User not found", nil)
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

	// Get sessions with pagination
	sessions, err := h.app.Dao().FindRecordsByFilter(
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
	err = h.app.Dao().DB().Select("count(*)").From("sessions").Where(dbx.HashExp{"user": user.Id}).Row(&totalSessions)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to count sessions", err)
	}

	// Format response
	sessionList := make([]map[string]any, len(sessions))
	for i, session := range sessions {
		sessionList[i] = map[string]any{
			"id":                session.Id,
			"name":              session.GetString("name"),
			"title":             session.GetString("title"),
			"description":       session.GetString("description"),
			"public":            session.GetBool("public"),
			"created":           session.GetDateTime("created").Time().Format(time.RFC3339),
			"updated":           session.GetDateTime("updated").Time().Format(time.RFC3339),
			"gpx_track":         session.GetString("gpx_track"),
			"track_name":        session.GetString("track_name"),
			"track_description": session.GetString("track_description"),
		}
	}

	totalPages := (int(totalSessions) + perPage - 1) / perPage

	paginationMeta := appmodels.PaginationMeta{
		Page:       page,
		PerPage:    perPage,
		TotalItems: totalSessions,
		TotalPages: totalPages,
	}

	return utils.SendPaginated(c, http.StatusOK, sessionList, paginationMeta, "")
}

// GetSession retrieves a specific session for a user
//
//	@Summary		Get user session
//	@Description	Returns a specific session by username and session name
//	@Tags			Sessions
//	@Produce		json
//	@Param			username	path		string	true	"Username"
//	@Param			name		path		string	true	"Session name"
//	@Success		200			{object}	models.SuccessResponse	"Session retrieved successfully"
//	@Failure		404			{object}	models.ErrorResponse		"Session not found"
//	@Router			/sessions/{username}/{name} [get]
func (h *SessionHandler) GetSession(c echo.Context) error {
	username := c.PathParam("username")
	sessionName := c.PathParam("name")

	user, err := findUserByUsername(h.app.Dao(), username)
	if err != nil {
		return apis.NewNotFoundError("User not found", err)
	}

	session, err := findSessionByNameAndUser(h.app.Dao(), sessionName, user.Id)
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	sessionData := map[string]any{
		"id":                session.Id,
		"name":              session.GetString("name"),
		"title":             session.GetString("title"),
		"description":       session.GetString("description"),
		"public":            session.GetBool("public"),
		"created":           session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":           session.GetDateTime("updated").Time().Format(time.RFC3339),
		"gpx_track":         session.GetString("gpx_track"),
		"track_name":        session.GetString("track_name"),
		"track_description": session.GetString("track_description"),
	}

	return utils.SendSuccess(c, http.StatusOK, sessionData, "")
}

// CreateSession creates a new session for the authenticated user
//
//	@Summary		Create session
//	@Description	Creates a new tracking session for the authenticated user
//	@Tags			Sessions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			request	body		models.CreateSessionRequest	true	"Session data"
//	@Success		201		{object}	models.SuccessResponse			"Session created successfully"
//	@Failure		400		{object}	models.ErrorResponse				"Invalid request"
//	@Failure		401		{object}	models.ErrorResponse				"Authentication required"
//	@Failure		409		{object}	models.ErrorResponse				"Session already exists"
//	@Router			/sessions [post]
func (h *SessionHandler) CreateSession(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	// Get validated data from middleware
	validatedData := middleware.GetValidatedData(c)
	data, ok := validatedData.(*appmodels.CreateSessionRequest)
	if !ok {
		return apis.NewBadRequestError("Invalid request data", nil)
	}

	if data.Name == "" {
		return apis.NewBadRequestError("Session name is required", nil)
	}

	// Check if session with this name already exists for the user
	existingSession, _ := findSessionByNameAndUser(h.app.Dao(), data.Name, record.Id)
	if existingSession != nil {
		return apis.NewBadRequestError("Session with this name already exists", nil)
	}

	// Create new session
	sessionsCollection, err := h.app.Dao().FindCollectionByNameOrId("sessions")
	if err != nil {
		return apis.NewNotFoundError("sessions collection not found", err)
	}

	session := models.NewRecord(sessionsCollection)
	session.Set("name", data.Name)
	session.Set("user", record.Id)
	session.Set("title", data.Title)
	session.Set("description", data.Description)
	session.Set("public", data.Public)

	if err := h.app.Dao().SaveRecord(session); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to create session", err)
	}

	sessionData := map[string]any{
		"id":                session.Id,
		"name":              session.GetString("name"),
		"title":             session.GetString("title"),
		"description":       session.GetString("description"),
		"public":            session.GetBool("public"),
		"created":           session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":           session.GetDateTime("updated").Time().Format(time.RFC3339),
		"gpx_track":         session.GetString("gpx_track"),
		"track_name":        session.GetString("track_name"),
		"track_description": session.GetString("track_description"),
	}

	return utils.SendSuccess(c, http.StatusCreated, sessionData, "Session created successfully")
}

// UpdateSession updates an existing session
//
//	@Summary		Update session
//	@Description	Updates an existing session for the authenticated user
//	@Tags			Sessions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			username	path		string						true	"Username"
//	@Param			name		path		string						true	"Session name"
//	@Param			request		body		models.UpdateSessionRequest	true	"Updated session data"
//	@Success		200			{object}	models.SuccessResponse			"Session updated successfully"
//	@Failure		400			{object}	models.ErrorResponse				"Invalid request"
//	@Failure		401			{object}	models.ErrorResponse				"Authentication required"
//	@Failure		403			{object}	models.ErrorResponse				"Forbidden"
//	@Failure		404			{object}	models.ErrorResponse				"Session not found"
//	@Router			/sessions/{username}/{name} [put]
func (h *SessionHandler) UpdateSession(c echo.Context) error {
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

	session, err := findSessionByNameAndUser(h.app.Dao(), sessionName, record.Id)
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	// Get validated data from middleware
	validatedData := middleware.GetValidatedData(c)
	data, ok := validatedData.(*appmodels.UpdateSessionRequest)
	if !ok {
		return apis.NewBadRequestError("Invalid request data", nil)
	}

	// Update session
	session.Set("title", data.Title)
	session.Set("description", data.Description)
	session.Set("public", data.Public)

	if err := h.app.Dao().SaveRecord(session); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to update session", err)
	}

	sessionData := map[string]any{
		"id":                session.Id,
		"name":              session.GetString("name"),
		"title":             session.GetString("title"),
		"description":       session.GetString("description"),
		"public":            session.GetBool("public"),
		"created":           session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":           session.GetDateTime("updated").Time().Format(time.RFC3339),
		"gpx_track":         session.GetString("gpx_track"),
		"track_name":        session.GetString("track_name"),
		"track_description": session.GetString("track_description"),
	}

	return utils.SendSuccess(c, http.StatusOK, sessionData, "Session updated successfully")
}

// DeleteSession deletes an existing session
//
//	@Summary		Delete session
//	@Description	Deletes an existing session for the authenticated user
//	@Tags			Sessions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			username	path		string	true	"Username"
//	@Param			name		path		string	true	"Session name"
//	@Success		200			{object}	models.SuccessResponse	"Session deleted successfully"
//	@Failure		401			{object}	models.ErrorResponse		"Authentication required"
//	@Failure		403			{object}	models.ErrorResponse		"Forbidden"
//	@Failure		404			{object}	models.ErrorResponse		"Session not found"
//	@Router			/sessions/{username}/{name} [delete]
func (h *SessionHandler) DeleteSession(c echo.Context) error {
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

	session, err := findSessionByNameAndUser(h.app.Dao(), sessionName, record.Id)
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	if err := h.app.Dao().DeleteRecord(session); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to delete session", err)
	}

	return utils.SendSuccess(c, http.StatusOK, nil, "Session deleted successfully")
}

// UploadGPXTrack uploads and processes a GPX file for a session
//
//	@Summary		Upload GPX track
//	@Description	Uploads a GPX file to a session and processes track points and waypoints
//	@Tags			Sessions
//	@Accept			multipart/form-data
//	@Produce		json
//	@Security		BearerAuth
//	@Param			username	path		string	true	"Username"
//	@Param			name		path		string	true	"Session name"
//	@Param			gpx_file	formData	file	true	"GPX file to upload"
//	@Success		200			{object}	models.SuccessResponse	"GPX track uploaded successfully"
//	@Failure		400			{object}	models.ErrorResponse		"Invalid request or file"
//	@Failure		401			{object}	models.ErrorResponse		"Authentication required"
//	@Failure		403			{object}	models.ErrorResponse		"Forbidden"
//	@Failure		404			{object}	models.ErrorResponse		"Session not found"
//	@Router			/sessions/{username}/{name}/gpx [post]
func (h *SessionHandler) UploadGPXTrack(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	username := c.PathParam("username")
	sessionName := c.PathParam("name")

	// Verify user matches authenticated user
	if record.Username() != username {
		return apis.NewForbiddenError("Cannot modify another user's sessions", nil)
	}

	// Find the session
	session, err := findSessionByNameAndUser(h.app.Dao(), sessionName, record.Id)
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	// Get the uploaded file
	file, fileHeader, err := c.Request().FormFile("gpx_file")
	if err != nil {
		return apis.NewBadRequestError("No GPX file provided", err)
	}
	defer file.Close()

	// Validate file type
	if !isValidGPXFile(fileHeader.Filename, fileHeader.Header.Get("Content-Type")) {
		return apis.NewBadRequestError("Invalid file type. Please upload a GPX file", nil)
	}

	// Parse the GPX file
	gpxData, err := utils.ParseGPX(file)
	if err != nil {
		return apis.NewBadRequestError(fmt.Sprintf("Failed to parse GPX file: %v", err), err)
	}

	// Reset file reader for storage
	file.Seek(0, 0)

	// Store the original GPX file
	fs, err := h.app.NewFilesystem()
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to initialize filesystem", err)
	}
	defer fs.Close()

	// Generate unique file key
	gpxFileName := session.Id + "_" + fileHeader.Filename

	err = fs.UploadMultipart(fileHeader, gpxFileName)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to upload GPX file", err)
	}

	// Update session with GPX data
	session.Set("gpx_track", gpxFileName)
	session.Set("track_name", gpxData.TrackName)
	session.Set("track_description", gpxData.TrackDescription)

	if err := h.app.Dao().SaveRecord(session); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to update session", err)
	}

	// Process track points
	trackPointsCount, err := h.processGPXTrackPoints(session.Id, gpxData.TrackPoints)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to process track points", err)
	}

	// Process waypoints
	waypointsCount, err := h.processGPXWaypoints(session.Id, gpxData.Waypoints)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to process waypoints", err)
	}

	response := map[string]interface{}{
		"message":           "GPX track uploaded successfully",
		"track_name":        gpxData.TrackName,
		"track_description": gpxData.TrackDescription,
		"track_points":      trackPointsCount,
		"waypoints":         waypointsCount,
	}

	return utils.SendSuccess(c, http.StatusOK, response, "GPX track uploaded successfully")
}

// GetTrackData retrieves the planned track points for a session
//
//	@Summary		Get session track data
//	@Description	Returns the planned track points from uploaded GPX for a session
//	@Tags			Sessions
//	@Produce		json
//	@Param			username	path		string	true	"Username"
//	@Param			name		path		string	true	"Session name"
//	@Param			simplified	query		bool	false	"Return simplified track (default: true)"
//	@Success		200			{object}	models.SuccessResponse	"Track data retrieved successfully"
//	@Failure		404			{object}	models.ErrorResponse		"Session or track not found"
//	@Router			/sessions/{username}/{name}/track [get]
func (h *SessionHandler) GetTrackData(c echo.Context) error {
	username := c.PathParam("username")
	sessionName := c.PathParam("name")

	// Find user
	user, err := findUserByUsername(h.app.Dao(), username)
	if err != nil {
		return apis.NewNotFoundError("User not found", err)
	}

	// Find session
	session, err := findSessionByNameAndUser(h.app.Dao(), sessionName, user.Id)
	if err != nil {
		return apis.NewNotFoundError("Session not found", err)
	}

	// Check if user has access to this session
	authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if !session.GetBool("public") && (authRecord == nil || authRecord.Id != user.Id) {
		return apis.NewForbiddenError("Access denied", nil)
	}

	// Get simplified parameter (default to true)
	simplified := true
	if simplifiedStr := c.QueryParam("simplified"); simplifiedStr == "false" {
		simplified = false
	}

	// Get track points
	var orderBy string
	if simplified {
		// For simplified tracks, we might want to add a simplified flag in the future
		orderBy = "sequence ASC"
	} else {
		orderBy = "sequence ASC"
	}

	trackPoints, err := h.app.Dao().FindRecordsByFilter(
		"gpx_tracks",
		"session_id = {:session_id}",
		orderBy,
		0, 0, // No limit
		dbx.Params{"session_id": session.Id},
	)

	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to fetch track points", err)
	}

	// Format track points
	points := make([]map[string]interface{}, len(trackPoints))
	for i, point := range trackPoints {
		pointData := map[string]interface{}{
			"latitude":  point.GetFloat("latitude"),
			"longitude": point.GetFloat("longitude"),
			"sequence":  point.GetInt("sequence"),
		}

		if altitude := point.GetFloat("altitude"); altitude != 0 {
			pointData["altitude"] = altitude
		}

		points[i] = pointData
	}

	response := map[string]interface{}{
		"session_id":        session.Id,
		"track_name":        session.GetString("track_name"),
		"track_description": session.GetString("track_description"),
		"track_points":      points,
		"point_count":       len(points),
	}

	return utils.SendSuccess(c, http.StatusOK, response, "Track data retrieved successfully")
}

// processGPXTrackPoints saves track points to the database with optional simplification
func (h *SessionHandler) processGPXTrackPoints(sessionID string, points []utils.ParsedTrackPoint) (int, error) {
	if len(points) == 0 {
		return 0, nil
	}

	// Apply simplification for long tracks
	simplifiedPoints := points
	if len(points) > 100 {
		epsilon := utils.CalculateSimplificationEpsilon(points)
		if epsilon > 0 {
			simplifiedPoints = utils.SimplifyTrack(points, epsilon)
		}
	}

	// Get the gpx_tracks collection
	collection, err := h.app.Dao().FindCollectionByNameOrId("gpx_tracks")
	if err != nil {
		return 0, fmt.Errorf("gpx_tracks collection not found: %v", err)
	}

	// Delete existing track points for this session
	existingPoints, err := h.app.Dao().FindRecordsByFilter(
		"gpx_tracks",
		"session_id = {:session_id}",
		"",
		0, 0,
		dbx.Params{"session_id": sessionID},
	)
	if err == nil {
		for _, point := range existingPoints {
			h.app.Dao().DeleteRecord(point)
		}
	}

	// Create new track point records
	for _, point := range simplifiedPoints {
		record := models.NewRecord(collection)
		record.Set("session_id", sessionID)
		record.Set("latitude", point.Latitude)
		record.Set("longitude", point.Longitude)
		record.Set("sequence", point.Sequence)

		if point.Altitude != nil {
			record.Set("altitude", *point.Altitude)
		}

		if err := h.app.Dao().SaveRecord(record); err != nil {
			return 0, fmt.Errorf("failed to save track point: %v", err)
		}
	}

	return len(simplifiedPoints), nil
}

// processGPXWaypoints saves waypoints from GPX to the database
func (h *SessionHandler) processGPXWaypoints(sessionID string, waypoints []utils.ParsedWaypoint) (int, error) {
	if len(waypoints) == 0 {
		return 0, nil
	}

	// Get the waypoints collection
	collection, err := h.app.Dao().FindCollectionByNameOrId("waypoints")
	if err != nil {
		return 0, fmt.Errorf("waypoints collection not found: %v", err)
	}

	// Create waypoint records
	savedCount := 0
	for _, wp := range waypoints {
		record := models.NewRecord(collection)
		record.Set("session_id", sessionID)
		record.Set("name", wp.Name)
		record.Set("type", wp.Type)
		record.Set("description", wp.Description)
		record.Set("latitude", wp.Latitude)
		record.Set("longitude", wp.Longitude)
		record.Set("source", wp.Source)
		record.Set("position_confidence", wp.PositionConfidence)

		if wp.Altitude != nil {
			record.Set("altitude", *wp.Altitude)
		}

		if err := h.app.Dao().SaveRecord(record); err != nil {
			// Log error but continue with other waypoints
			continue
		}
		savedCount++
	}

	return savedCount, nil
}

// isValidGPXFile checks if the uploaded file is a valid GPX file
func isValidGPXFile(filename, contentType string) bool {
	// Check file extension
	if !strings.HasSuffix(strings.ToLower(filename), ".gpx") {
		return false
	}

	// Check content type
	validTypes := []string{
		"application/gpx+xml",
		"application/xml",
		"text/xml",
		"application/octet-stream", // Some browsers might send this
	}

	for _, validType := range validTypes {
		if contentType == validType {
			return true
		}
	}

	return false
}
