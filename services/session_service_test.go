package services

import (
	"errors"
	"testing"

	"github.com/pocketbase/pocketbase/models"
	"github.com/stretchr/testify/assert"

	"vibe-tracker/constants"
	appmodels "vibe-tracker/models"
	"vibe-tracker/services/mocks"
)

// Helper function to create a mock record for sessions
func createMockSessionRecord() *models.Record {
	collection := &models.Collection{}
	collection.Id = "sessions_collection"
	collection.Name = "sessions"

	record := models.NewRecord(collection)
	return record
}

// Helper function to create test session data
func createTestSessionRecord(id, name, title, userID string, public bool) *models.Record {
	record := createMockSessionRecord()
	record.Id = id
	record.Set("name", name)
	record.Set("title", title)
	record.Set("user", userID)
	record.Set("public", public)
	return record
}

func TestSessionService_ListSessions(t *testing.T) {
	t.Run("Successful pagination with default values", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		// Create test data
		userID := "user123"
		session1 := createTestSessionRecord("session1", "morning-run", "Morning Run", userID, true)
		session2 := createTestSessionRecord("session2", "evening-walk", "Evening Walk", userID, false)
		testSessions := []*models.Record{session1, session2}

		// Setup expectations
		mockRepo.On("FindByUser", userID, "-created", constants.DefaultPerPage, 0).Return(testSessions, nil)
		mockRepo.On("CountByUser", userID).Return(2, nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.ListSessions(userID, 1, 20)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, 2, len(result.Sessions))
		assert.Equal(t, 2, result.TotalItems)
		assert.Equal(t, 1, result.Page)
		assert.Equal(t, 20, result.PerPage)
		assert.Equal(t, "morning-run", result.Sessions[0].Name)
		assert.Equal(t, "Morning Run", result.Sessions[0].Title)
		assert.True(t, result.Sessions[0].Public)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Pagination with custom page and perPage", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		testSessions := []*models.Record{}

		// Setup expectations for page 2, 5 per page (offset = 5)
		mockRepo.On("FindByUser", userID, "-created", 5, 5).Return(testSessions, nil)
		mockRepo.On("CountByUser", userID).Return(12, nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.ListSessions(userID, 2, 5)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, 0, len(result.Sessions))
		assert.Equal(t, 12, result.TotalItems)
		assert.Equal(t, 2, result.Page)
		assert.Equal(t, 5, result.PerPage)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Invalid page defaults to 1", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		testSessions := []*models.Record{}

		// Should use page 1 (offset 0) when page is 0 or negative
		mockRepo.On("FindByUser", userID, "-created", constants.DefaultPerPage, 0).Return(testSessions, nil)
		mockRepo.On("CountByUser", userID).Return(0, nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute with invalid page
		result, err := service.ListSessions(userID, 0, 20)

		// Assert
		assert.NoError(t, err)
		assert.Equal(t, 1, result.Page)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Invalid perPage uses default", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		testSessions := []*models.Record{}

		// Should use DefaultPerPage when perPage is out of bounds
		mockRepo.On("FindByUser", userID, "-created", constants.DefaultPerPage, 0).Return(testSessions, nil)
		mockRepo.On("CountByUser", userID).Return(0, nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute with invalid perPage (too high)
		result, err := service.ListSessions(userID, 1, 150)

		// Assert
		assert.NoError(t, err)
		assert.Equal(t, constants.DefaultPerPage, result.PerPage)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Repository error returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		expectedError := errors.New("database error")

		// Setup expectations
		mockRepo.On("FindByUser", userID, "-created", constants.DefaultPerPage, 0).Return([]*models.Record{}, expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.ListSessions(userID, 1, 20)

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Count error returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		testSessions := []*models.Record{}
		expectedError := errors.New("count error")

		// Setup expectations
		mockRepo.On("FindByUser", userID, "-created", constants.DefaultPerPage, 0).Return(testSessions, nil)
		mockRepo.On("CountByUser", userID).Return(0, expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.ListSessions(userID, 1, 20)

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})
}

func TestSessionService_GetSession(t *testing.T) {
	t.Run("Successful session retrieval", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		// Create test data
		userID := "user123"
		sessionName := "morning-run"
		testSession := createTestSessionRecord("session1", sessionName, "Morning Run", userID, true)

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, userID).Return(testSession, nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.GetSession(sessionName, userID)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, sessionName, result.Name)
		assert.Equal(t, "Morning Run", result.Title)
		assert.True(t, result.Public)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Session not found returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		sessionName := "nonexistent"
		expectedError := errors.New("session not found")

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, userID).Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.GetSession(sessionName, userID)

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})
}

func TestSessionService_CreateSession(t *testing.T) {
	t.Run("Successful session creation with all fields", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		req := appmodels.CreateSessionRequest{
			Name:        "morning-run",
			Title:       "Morning Run",
			Description: "My daily morning run",
			Public:      true,
		}

		newRecord := createMockSessionRecord()
		createdRecord := createTestSessionRecord("session1", req.Name, req.Title, userID, req.Public)
		createdRecord.Set("description", req.Description)

		// Setup expectations
		mockRepo.On("FindByNameAndUser", req.Name, userID).Return((*models.Record)(nil), errors.New("not found"))
		mockRepo.On("CreateNewRecord").Return(newRecord, nil)
		mockRepo.On("Create", newRecord).Return(nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.CreateSession(req, userID)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, req.Name, result.Name)
		assert.Equal(t, req.Title, result.Title)
		assert.Equal(t, req.Description, result.Description)
		assert.Equal(t, req.Public, result.Public)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Session creation with generated title", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		req := appmodels.CreateSessionRequest{
			Name:   "morning-run",
			Public: false,
		}

		newRecord := createMockSessionRecord()

		// Setup expectations
		mockRepo.On("FindByNameAndUser", req.Name, userID).Return((*models.Record)(nil), errors.New("not found"))
		mockRepo.On("CreateNewRecord").Return(newRecord, nil)
		mockRepo.On("Create", newRecord).Return(nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.CreateSession(req, userID)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, req.Name, result.Name)
		assert.Equal(t, "Morning Run", result.Title) // Generated from name
		assert.False(t, result.Public)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Duplicate session name returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		req := appmodels.CreateSessionRequest{
			Name:   "existing-session",
			Public: true,
		}

		existingSession := createTestSessionRecord("session1", req.Name, "Existing Session", userID, true)

		// Setup expectations
		mockRepo.On("FindByNameAndUser", req.Name, userID).Return(existingSession, nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.CreateSession(req, userID)

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "already exists")

		mockRepo.AssertExpectations(t)
	})

	t.Run("CreateNewRecord error returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		req := appmodels.CreateSessionRequest{
			Name:   "new-session",
			Public: true,
		}

		expectedError := errors.New("database error")

		// Setup expectations
		mockRepo.On("FindByNameAndUser", req.Name, userID).Return((*models.Record)(nil), errors.New("not found"))
		mockRepo.On("CreateNewRecord").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.CreateSession(req, userID)

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})
}

func TestSessionService_UpdateSession(t *testing.T) {
	t.Run("Successful session update", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		sessionName := "morning-run"
		req := appmodels.UpdateSessionRequest{
			Title:       "Updated Morning Run",
			Description: "Updated description",
			Public:      false,
		}

		existingSession := createTestSessionRecord("session1", sessionName, "Morning Run", userID, true)

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, userID).Return(existingSession, nil)
		mockRepo.On("Update", existingSession).Return(nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.UpdateSession(sessionName, userID, req)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, req.Title, result.Title)
		assert.Equal(t, req.Description, result.Description)
		assert.Equal(t, req.Public, result.Public)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Session not found returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		sessionName := "nonexistent"
		req := appmodels.UpdateSessionRequest{
			Title:  "Updated Title",
			Public: true,
		}

		expectedError := errors.New("session not found")

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, userID).Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.UpdateSession(sessionName, userID, req)

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Update error returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		sessionName := "morning-run"
		req := appmodels.UpdateSessionRequest{
			Title:  "Updated Title",
			Public: true,
		}

		existingSession := createTestSessionRecord("session1", sessionName, "Morning Run", userID, true)
		expectedError := errors.New("update failed")

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, userID).Return(existingSession, nil)
		mockRepo.On("Update", existingSession).Return(expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.UpdateSession(sessionName, userID, req)

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})
}

func TestSessionService_DeleteSession(t *testing.T) {
	t.Run("Successful session deletion", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		sessionName := "morning-run"
		existingSession := createTestSessionRecord("session1", sessionName, "Morning Run", userID, true)

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, userID).Return(existingSession, nil)
		mockRepo.On("Delete", existingSession).Return(nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		err := service.DeleteSession(sessionName, userID)

		// Assert
		assert.NoError(t, err)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Session not found returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		sessionName := "nonexistent"
		expectedError := errors.New("session not found")

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, userID).Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		err := service.DeleteSession(sessionName, userID)

		// Assert
		assert.Error(t, err)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Delete error returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		userID := "user123"
		sessionName := "morning-run"
		existingSession := createTestSessionRecord("session1", sessionName, "Morning Run", userID, true)
		expectedError := errors.New("delete failed")

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, userID).Return(existingSession, nil)
		mockRepo.On("Delete", existingSession).Return(expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		err := service.DeleteSession(sessionName, userID)

		// Assert
		assert.Error(t, err)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})
}

func TestSessionService_FindOrCreateSession(t *testing.T) {
	t.Run("Find existing session", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		sessionName := "morning-run"
		user := createMockRecord()
		user.Id = "user123"
		existingSession := createTestSessionRecord("session1", sessionName, "Morning Run", user.Id, true)

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, user.Id).Return(existingSession, nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.FindOrCreateSession(sessionName, user)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, existingSession.Id, result.Id)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Create new session when not found", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		sessionName := "new-session"
		user := createMockRecord()
		user.Id = "user123"
		newRecord := createMockSessionRecord()

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, user.Id).Return((*models.Record)(nil), errors.New("not found"))
		mockRepo.On("CreateNewRecord").Return(newRecord, nil)
		mockRepo.On("Update", newRecord).Return(nil)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.FindOrCreateSession(sessionName, user)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, newRecord.Id, result.Id)

		mockRepo.AssertExpectations(t)
	})

	t.Run("CreateNewRecord error returns error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockSessionRepository{}

		sessionName := "new-session"
		user := createMockRecord()
		user.Id = "user123"
		expectedError := errors.New("database error")

		// Setup expectations
		mockRepo.On("FindByNameAndUser", sessionName, user.Id).Return((*models.Record)(nil), errors.New("not found"))
		mockRepo.On("CreateNewRecord").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewSessionService(mockRepo)

		// Execute
		result, err := service.FindOrCreateSession(sessionName, user)

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})
}
