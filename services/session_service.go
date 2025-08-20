package services

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/dbx"
	
	appmodels "vibe-tracker/models"
	"vibe-tracker/utils"
)

// SessionService handles session-related business logic
type SessionService struct {
	app *pocketbase.PocketBase
}

// NewSessionService creates a new SessionService instance
func NewSessionService(app *pocketbase.PocketBase) *SessionService {
	return &SessionService{app: app}
}

// ListSessions returns paginated sessions for a user
func (s *SessionService) ListSessions(userID string, page, perPage int) (*appmodels.SessionsListResponse, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Calculate offset
	offset := (page - 1) * perPage

	// Get sessions with pagination
	sessions, err := s.app.Dao().FindRecordsByFilter(
		"sessions",
		"user = {:user}",
		"-created",
		perPage,
		offset,
		dbx.Params{"user": userID},
	)
	if err != nil {
		return nil, err
	}

	// Get total count
	totalItems, err := s.app.Dao().FindRecordsByFilter(
		"sessions",
		"user = {:user}",
		"",
		0,
		0,
		dbx.Params{"user": userID},
	)
	if err != nil {
		return nil, err
	}

	// Convert to response models
	sessionModels := make([]appmodels.Session, len(sessions))
	for i, session := range sessions {
		sessionModels[i] = s.recordToSession(session)
	}

	totalPages := (len(totalItems) + perPage - 1) / perPage

	return &appmodels.SessionsListResponse{
		Sessions:   sessionModels,
		Page:       page,
		PerPage:    perPage,
		TotalItems: len(totalItems),
		TotalPages: totalPages,
	}, nil
}

// GetSession returns a single session by name and user
func (s *SessionService) GetSession(sessionName, userID string) (*appmodels.Session, error) {
	session, err := s.findSessionByNameAndUser(sessionName, userID)
	if err != nil {
		return nil, err
	}

	sessionModel := s.recordToSession(session)
	return &sessionModel, nil
}

// CreateSession creates a new session
func (s *SessionService) CreateSession(req appmodels.CreateSessionRequest, userID string) (*appmodels.Session, error) {
	if req.Name == "" {
		return nil, &SessionError{Message: "Session name is required"}
	}

	// Check if session with this name already exists for the user
	existingSession, _ := s.findSessionByNameAndUser(req.Name, userID)
	if existingSession != nil {
		return nil, &SessionError{Message: "Session with this name already exists"}
	}

	// Create new session
	sessionsCollection, err := s.app.Dao().FindCollectionByNameOrId("sessions")
	if err != nil {
		return nil, err
	}

	session := models.NewRecord(sessionsCollection)
	session.Set("name", req.Name)
	session.Set("user", userID)
	session.Set("title", s.generateTitle(req))
	session.Set("description", req.Description)
	session.Set("public", req.Public)

	if err := s.app.Dao().SaveRecord(session); err != nil {
		return nil, err
	}

	sessionModel := s.recordToSession(session)
	return &sessionModel, nil
}

// UpdateSession updates an existing session
func (s *SessionService) UpdateSession(sessionName, userID string, req appmodels.UpdateSessionRequest) (*appmodels.Session, error) {
	session, err := s.findSessionByNameAndUser(sessionName, userID)
	if err != nil {
		return nil, err
	}

	// Update session fields
	if req.Title != "" {
		session.Set("title", req.Title)
	}
	session.Set("description", req.Description)
	session.Set("public", req.Public)

	if err := s.app.Dao().SaveRecord(session); err != nil {
		return nil, err
	}

	sessionModel := s.recordToSession(session)
	return &sessionModel, nil
}

// DeleteSession deletes a session
func (s *SessionService) DeleteSession(sessionName, userID string) error {
	session, err := s.findSessionByNameAndUser(sessionName, userID)
	if err != nil {
		return err
	}

	return s.app.Dao().DeleteRecord(session)
}

// FindOrCreateSession finds an existing session or creates a new one
func (s *SessionService) FindOrCreateSession(sessionName string, user *models.Record) (*models.Record, error) {
	if sessionName == "" {
		return nil, nil // No session requested
	}

	// Try to find existing session
	session, err := s.findSessionByNameAndUser(sessionName, user.Id)
	if err == nil {
		return session, nil // Found existing session
	}

	// Create new session
	sessionsCollection, err := s.app.Dao().FindCollectionByNameOrId("sessions")
	if err != nil {
		return nil, err
	}

	session = models.NewRecord(sessionsCollection)
	session.Set("name", sessionName)
	session.Set("user", user.Id)
	session.Set("title", utils.GenerateSessionTitle(sessionName))
	session.Set("description", "")
	session.Set("public", false)

	if err := s.app.Dao().SaveRecord(session); err != nil {
		return nil, err
	}

	return session, nil
}

// Helper methods

func (s *SessionService) findSessionByNameAndUser(sessionName string, userID string) (*models.Record, error) {
	if sessionName == "" || userID == "" {
		return nil, &SessionError{Message: "session name or user ID is missing"}
	}
	return s.app.Dao().FindFirstRecordByFilter("sessions", "name = {:name} && user = {:user}",
		dbx.Params{"name": sessionName, "user": userID})
}

func (s *SessionService) generateTitle(req appmodels.CreateSessionRequest) string {
	if req.Title != "" {
		return req.Title
	}
	return utils.GenerateSessionTitle(req.Name)
}

func (s *SessionService) recordToSession(record *models.Record) appmodels.Session {
	return appmodels.Session{
		ID:          record.Id,
		Name:        record.GetString("name"),
		Title:       record.GetString("title"),
		Description: record.GetString("description"),
		Public:      record.GetBool("public"),
		User:        record.GetString("user"),
		Created:     record.Created.Time(),
		Updated:     record.Updated.Time(),
	}
}

// SessionError represents a session-related error
type SessionError struct {
	Message string
}

func (e *SessionError) Error() string {
	return e.Message
}