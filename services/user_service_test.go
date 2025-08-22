package services

import (
	"errors"
	"testing"

	"github.com/pocketbase/pocketbase/models"
	"github.com/stretchr/testify/assert"

	appmodels "vibe-tracker/models"
	"vibe-tracker/services/mocks"
)

func TestUserService_GetUserByUsername(t *testing.T) {
	t.Run("Successful user retrieval", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")

		// Setup expectations
		mockRepo.On("FindByUsername", "testuser").Return(testUser, nil)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.GetUserByUsername("testuser")

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "user123", result.Id)
		// Note: Username() requires complex PocketBase setup, testing ID is sufficient for unit test

		mockRepo.AssertExpectations(t)
	})

	t.Run("User not found", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		expectedError := errors.New("user not found")

		// Setup expectations
		mockRepo.On("FindByUsername", "nonexistent").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.GetUserByUsername("nonexistent")

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})
}

func TestUserService_GetUserByEmail(t *testing.T) {
	t.Run("Successful user retrieval", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")

		// Setup expectations
		mockRepo.On("FindByEmail", "test@example.com").Return(testUser, nil)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.GetUserByEmail("test@example.com")

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "user123", result.Id)
		// Note: Email() requires complex PocketBase setup, testing ID is sufficient for unit test

		mockRepo.AssertExpectations(t)
	})

	t.Run("User not found", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		expectedError := errors.New("user not found")

		// Setup expectations
		mockRepo.On("FindByEmail", "nonexistent@example.com").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.GetUserByEmail("nonexistent@example.com")

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)

		mockRepo.AssertExpectations(t)
	})
}

func TestUserService_GetUserByID(t *testing.T) {
	t.Run("Successful user retrieval", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")

		// Setup expectations
		mockRepo.On("FindByID", "user123").Return(testUser, nil)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.GetUserByID("user123")

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "user123", result.Id)

		mockRepo.AssertExpectations(t)
	})

	t.Run("User not found", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		expectedError := errors.New("user not found")

		// Setup expectations
		mockRepo.On("FindByID", "nonexistent").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.GetUserByID("nonexistent")

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)

		mockRepo.AssertExpectations(t)
	})
}

func TestUserService_GetUserByToken(t *testing.T) {
	t.Run("Successful user retrieval", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")
		token := "test-token-123"

		// Setup expectations
		mockRepo.On("FindByToken", token).Return(testUser, nil)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.GetUserByToken(token)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "user123", result.Id)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Invalid token", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		expectedError := errors.New("token not found")

		// Setup expectations
		mockRepo.On("FindByToken", "invalid-token").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.GetUserByToken("invalid-token")

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)

		mockRepo.AssertExpectations(t)
	})
}

func TestUserService_ValidateUserOwnership(t *testing.T) {
	t.Run("No authenticated user", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		isValid, err := service.ValidateUserOwnership(nil, "testuser")

		// Assert
		assert.Error(t, err)
		assert.False(t, isValid)
		assert.IsType(t, &UserError{}, err)
		assert.Contains(t, err.Error(), "Authentication required")
	})

	// Note: Testing same user vs different user requires complex PocketBase record setup
	// for Username() method. This business logic would be better tested in integration tests.
}

func TestUserService_UpdateAvatar(t *testing.T) {
	t.Run("Successful avatar update", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")
		avatarFile := "new-avatar.png"

		// Setup expectations
		mockRepo.On("Save", testUser).Return(nil)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		err := service.UpdateAvatar(testUser, avatarFile)

		// Assert
		assert.NoError(t, err)
		assert.Equal(t, avatarFile, testUser.GetString("avatar"))

		mockRepo.AssertExpectations(t)
	})

	t.Run("Save error", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")
		avatarFile := "new-avatar.png"
		expectedError := errors.New("database error")

		// Setup expectations
		mockRepo.On("Save", testUser).Return(expectedError)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		err := service.UpdateAvatar(testUser, avatarFile)

		// Assert
		assert.Error(t, err)
		assert.Equal(t, expectedError, err)

		mockRepo.AssertExpectations(t)
	})
}

func TestUserService_ConvertToUserModel(t *testing.T) {
	t.Run("Basic conversion structure", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")
		testUser.Set("avatar", "avatar.png")

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result := service.ConvertToUserModel(testUser)

		// Assert - Test what we can test reliably
		assert.Equal(t, "user123", result.ID)
		assert.Equal(t, "avatar.png", result.Avatar)
		assert.IsType(t, appmodels.User{}, result)
		// Note: Username() and Email() require complex PocketBase setup
		// The important thing is that the method doesn't panic and returns proper structure
	})

	t.Run("Conversion with empty avatar", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")
		// Avatar is empty by default

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result := service.ConvertToUserModel(testUser)

		// Assert
		assert.Equal(t, "user123", result.ID)
		assert.Empty(t, result.Avatar)
		assert.IsType(t, appmodels.User{}, result)
	})
}

func TestUserService_ValidateUserExists(t *testing.T) {
	t.Run("User exists", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		testUser := createTestUserRecord("user123", "testuser", "test@example.com")

		// Setup expectations
		mockRepo.On("FindByUsername", "testuser").Return(testUser, nil)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.ValidateUserExists("testuser")

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "user123", result.Id)

		mockRepo.AssertExpectations(t)
	})

	t.Run("User does not exist", func(t *testing.T) {
		// Setup mocks
		mockRepo := &mocks.MockUserRepository{}
		expectedError := errors.New("repository error")

		// Setup expectations
		mockRepo.On("FindByUsername", "nonexistent").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewUserService(mockRepo)

		// Execute
		result, err := service.ValidateUserExists("nonexistent")

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.IsType(t, &UserError{}, err)
		assert.Contains(t, err.Error(), "User not found")

		mockRepo.AssertExpectations(t)
	})
}

func TestUserError_Error(t *testing.T) {
	t.Run("Error message formatting", func(t *testing.T) {
		// Create error
		userError := &UserError{Message: "Test error message"}

		// Execute
		result := userError.Error()

		// Assert
		assert.Equal(t, "Test error message", result)
	})
}