package handlers

import (
	"net/http"
	"strconv"
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
		"id":          session.Id,
		"name":        session.GetString("name"),
		"title":       session.GetString("title"),
		"description": session.GetString("description"),
		"public":      session.GetBool("public"),
		"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
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
		"id":          session.Id,
		"name":        session.GetString("name"),
		"title":       session.GetString("title"),
		"description": session.GetString("description"),
		"public":      session.GetBool("public"),
		"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
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
		"id":          session.Id,
		"name":        session.GetString("name"),
		"title":       session.GetString("title"),
		"description": session.GetString("description"),
		"public":      session.GetBool("public"),
		"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
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
