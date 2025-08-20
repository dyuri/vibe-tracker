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
)

type SessionHandler struct {
	app *pocketbase.PocketBase
}

func NewSessionHandler(app *pocketbase.PocketBase) *SessionHandler {
	return &SessionHandler{app: app}
}

func (h *SessionHandler) ListSessions(c echo.Context) error {
	username := c.PathParam("username")
	user, err := findUserByUsername(h.app.Dao(), username)
	if err != nil {
		return apis.NewNotFoundError("User not found", err)
	}

	// Parse pagination parameters
	page := 1
	perPage := 20
	if pageStr := c.QueryParam("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if perPageStr := c.QueryParam("perPage"); perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 && pp <= 100 {
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

	return c.JSON(http.StatusOK, map[string]any{
		"sessions":   sessionList,
		"page":       page,
		"perPage":    perPage,
		"totalItems": totalSessions,
		"totalPages": totalPages,
	})
}

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

	return c.JSON(http.StatusOK, map[string]any{
		"id":          session.Id,
		"name":        session.GetString("name"),
		"title":       session.GetString("title"),
		"description": session.GetString("description"),
		"public":      session.GetBool("public"),
		"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
	})
}

func (h *SessionHandler) CreateSession(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	data := struct {
		Name        string `json:"name"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Public      bool   `json:"public"`
	}{}

	if err := c.Bind(&data); err != nil {
		return apis.NewBadRequestError("Invalid request data", err)
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

	return c.JSON(http.StatusCreated, map[string]any{
		"id":          session.Id,
		"name":        session.GetString("name"),
		"title":       session.GetString("title"),
		"description": session.GetString("description"),
		"public":      session.GetBool("public"),
		"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
	})
}

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

	data := struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Public      bool   `json:"public"`
	}{}

	if err := c.Bind(&data); err != nil {
		return apis.NewBadRequestError("Invalid request data", err)
	}

	// Update session
	session.Set("title", data.Title)
	session.Set("description", data.Description)
	session.Set("public", data.Public)

	if err := h.app.Dao().SaveRecord(session); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to update session", err)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"id":          session.Id,
		"name":        session.GetString("name"),
		"title":       session.GetString("title"),
		"description": session.GetString("description"),
		"public":      session.GetBool("public"),
		"created":     session.GetDateTime("created").Time().Format(time.RFC3339),
		"updated":     session.GetDateTime("updated").Time().Format(time.RFC3339),
	})
}

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

	return c.JSON(http.StatusOK, map[string]any{
		"message": "Session deleted successfully",
	})
}
