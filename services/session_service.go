package services

import (
	"github.com/pocketbase/pocketbase/models"

	"vibe-tracker/constants"
	appmodels "vibe-tracker/models"
	"vibe-tracker/repositories"
	"vibe-tracker/utils"
)

// SessionService handles session-related business logic
type SessionService struct {
	repo repositories.SessionRepository
}

// NewSessionService creates a new SessionService instance
func NewSessionService(repo repositories.SessionRepository) *SessionService {
	return &SessionService{repo: repo}
}

// ListSessions returns paginated sessions for a user
func (s *SessionService) ListSessions(userID string, page, perPage int) (*appmodels.SessionsListResponse, error) {
	if page < constants.DefaultPage {
		page = constants.DefaultPage
	}
	if perPage < constants.MinPerPageLimit || perPage > constants.MaxPerPageLimit {
		perPage = constants.DefaultPerPage
	}

	// Calculate offset
	offset := (page - 1) * perPage

	// Get sessions with pagination
	sessions, err := s.repo.FindByUser(userID, "-created", perPage, offset)
	if err != nil {
		return nil, err
	}

	// Get total count
	totalCount, err := s.repo.CountByUser(userID)
	if err != nil {
		return nil, err
	}

	// Convert to response models
	sessionModels := make([]appmodels.Session, len(sessions))
	for i, session := range sessions {
		sessionModels[i] = s.recordToSession(session)
	}

	totalPages := (totalCount + perPage - 1) / perPage

	return &appmodels.SessionsListResponse{
		Sessions:   sessionModels,
		Page:       page,
		PerPage:    perPage,
		TotalItems: totalCount,
		TotalPages: totalPages,
	}, nil
}

// GetSession returns a single session by name and user
func (s *SessionService) GetSession(sessionName, userID string) (*appmodels.Session, error) {
	session, err := s.FindSessionByNameAndUser(sessionName, userID)
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
	existingSession, _ := s.FindSessionByNameAndUser(req.Name, userID)
	if existingSession != nil {
		return nil, &SessionError{Message: "Session with this name already exists"}
	}

	// Create new session
	session, err := s.repo.CreateNewRecord()
	if err != nil {
		return nil, err
	}
	session.Set("name", req.Name)
	session.Set("user", userID)
	session.Set("title", s.generateTitle(req))
	session.Set("description", req.Description)
	session.Set("public", req.Public)

	if err := s.repo.Create(session); err != nil {
		return nil, err
	}

	sessionModel := s.recordToSession(session)
	return &sessionModel, nil
}

// UpdateSession updates an existing session
func (s *SessionService) UpdateSession(sessionName, userID string, req appmodels.UpdateSessionRequest) (*appmodels.Session, error) {
	session, err := s.FindSessionByNameAndUser(sessionName, userID)
	if err != nil {
		return nil, err
	}

	// Update session fields
	if req.Title != "" {
		session.Set("title", req.Title)
	}
	session.Set("description", req.Description)
	session.Set("public", req.Public)

	if err := s.repo.Update(session); err != nil {
		return nil, err
	}

	sessionModel := s.recordToSession(session)
	return &sessionModel, nil
}

// DeleteSession deletes a session
func (s *SessionService) DeleteSession(sessionName, userID string) error {
	session, err := s.FindSessionByNameAndUser(sessionName, userID)
	if err != nil {
		return err
	}

	return s.repo.Delete(session)
}

// FindOrCreateSession finds an existing session or creates a new one
func (s *SessionService) FindOrCreateSession(sessionName string, user *models.Record) (*models.Record, error) {
	if sessionName == "" {
		return nil, nil // No session requested
	}

	// Try to find existing session
	session, err := s.FindSessionByNameAndUser(sessionName, user.Id)
	if err == nil {
		return session, nil // Found existing session
	}

	// Create new session
	session, err = s.repo.CreateNewRecord()
	if err != nil {
		return nil, err
	}
	session.Set("name", sessionName)
	session.Set("user", user.Id)
	session.Set("title", utils.GenerateSessionTitle(sessionName))
	session.Set("description", "")
	session.Set("public", false)

	if err := s.repo.Update(session); err != nil {
		return nil, err
	}

	return session, nil
}

// Helper methods

func (s *SessionService) FindSessionByNameAndUser(sessionName string, userID string) (*models.Record, error) {
	if sessionName == "" || userID == "" {
		return nil, &SessionError{Message: "session name or user ID is missing"}
	}
	return s.repo.FindByNameAndUser(sessionName, userID)
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
