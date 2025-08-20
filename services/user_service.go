package services

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/dbx"
	
	appmodels "vibe-tracker/models"
)

// UserService handles user-related business logic
type UserService struct {
	app *pocketbase.PocketBase
}

// NewUserService creates a new UserService instance
func NewUserService(app *pocketbase.PocketBase) *UserService {
	return &UserService{app: app}
}

// GetUserByUsername finds a user by username
func (s *UserService) GetUserByUsername(username string) (*models.Record, error) {
	return s.app.Dao().FindFirstRecordByFilter("users", "username = {:username}",
		dbx.Params{"username": username})
}

// GetUserByEmail finds a user by email
func (s *UserService) GetUserByEmail(email string) (*models.Record, error) {
	return s.app.Dao().FindAuthRecordByEmail("users", email)
}

// GetUserByID finds a user by ID
func (s *UserService) GetUserByID(userID string) (*models.Record, error) {
	return s.app.Dao().FindRecordById("users", userID)
}

// GetUserByToken finds a user by their custom token
func (s *UserService) GetUserByToken(token string) (*models.Record, error) {
	return s.app.Dao().FindFirstRecordByFilter("users", "token = {:token}",
		dbx.Params{"token": token})
}

// ValidateUserOwnership checks if a user owns a resource by comparing user IDs
func (s *UserService) ValidateUserOwnership(authUser *models.Record, targetUsername string) (bool, error) {
	if authUser == nil {
		return false, &UserError{Message: "Authentication required"}
	}

	// If target username matches authenticated user, allow access
	if authUser.Username() == targetUsername {
		return true, nil
	}

	return false, &UserError{Message: "Access denied: you can only access your own resources"}
}

// UpdateAvatar updates the user's avatar
func (s *UserService) UpdateAvatar(user *models.Record, avatarFile string) error {
	user.Set("avatar", avatarFile)
	return s.app.Dao().SaveRecord(user)
}

// ConvertToUserModel converts a PocketBase record to a User model
func (s *UserService) ConvertToUserModel(record *models.Record) appmodels.User {
	return appmodels.User{
		ID:       record.Id,
		Username: record.Username(),
		Email:    record.Email(),
		Avatar:   record.GetString("avatar"),
		Created:  record.Created.String(),
		Updated:  record.Updated.String(),
	}
}

// ValidateUserExists checks if a user exists by username
func (s *UserService) ValidateUserExists(username string) (*models.Record, error) {
	user, err := s.GetUserByUsername(username)
	if err != nil {
		return nil, &UserError{Message: "User not found"}
	}
	return user, nil
}

// UserError represents a user-related error
type UserError struct {
	Message string
}

func (e *UserError) Error() string {
	return e.Message
}