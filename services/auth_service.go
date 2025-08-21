package services

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tokens"
	"github.com/pocketbase/pocketbase/tools/security"
	
	appmodels "vibe-tracker/models"
	"vibe-tracker/repositories"
)

// AuthService handles authentication-related business logic
type AuthService struct {
	app      *pocketbase.PocketBase
	userRepo repositories.UserRepository
}

// NewAuthService creates a new AuthService instance
func NewAuthService(app *pocketbase.PocketBase, userRepo repositories.UserRepository) *AuthService {
	return &AuthService{
		app:      app,
		userRepo: userRepo,
	}
}

// Login authenticates a user and returns a token and user information
func (s *AuthService) Login(req appmodels.LoginRequest) (*appmodels.LoginResponse, error) {
	// Find user by email
	record, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		return nil, err
	}

	// Validate password
	if !record.ValidatePassword(req.Password) {
		return nil, &AuthError{Message: "Invalid credentials"}
	}

	// Generate auth token
	token, err := tokens.NewRecordAuthToken(s.app, record)
	if err != nil {
		return nil, err
	}

	// Convert record to user model
	user := s.recordToUser(record)

	response := &appmodels.LoginResponse{
		Token: token,
		User:  user,
	}

	return response, nil
}

// UpdateProfile updates user profile information
func (s *AuthService) UpdateProfile(record *models.Record, req appmodels.UpdateProfileRequest) error {
	// Update username if provided
	if req.Username != "" && req.Username != record.Username() {
		record.SetUsername(req.Username)
	}

	// Update email if provided
	if req.Email != "" && req.Email != record.Email() {
		record.SetEmail(req.Email)
	}

	// Update password if provided
	if req.Password != "" {
		if req.OldPassword == "" {
			return &AuthError{Message: "Old password required to set new password"}
		}
		if !record.ValidatePassword(req.OldPassword) {
			return &AuthError{Message: "Invalid old password"}
		}
		record.SetPassword(req.Password)
	}

	// Save the updated record
	if err := s.userRepo.Save(record); err != nil {
		return err
	}

	return nil
}

// RegenerateToken generates a new custom token for the user
func (s *AuthService) RegenerateToken(record *models.Record) (string, error) {
	// Generate a new random token
	newToken := security.RandomString(32)
	
	// Update the user's token
	record.Set("token", newToken)
	
	if err := s.userRepo.Save(record); err != nil {
		return "", err
	}
	
	return newToken, nil
}

// GetUserByToken finds a user by their custom token
func (s *AuthService) GetUserByToken(token string) (*models.Record, error) {
	return s.userRepo.FindByToken(token)
}

// GetUserByID finds a user by their ID
func (s *AuthService) GetUserByID(userID string) (*models.Record, error) {
	return s.userRepo.FindByID(userID)
}

// recordToUser converts a PocketBase record to a User model
func (s *AuthService) recordToUser(record *models.Record) appmodels.User {
	return appmodels.User{
		ID:       record.Id,
		Username: record.Username(),
		Email:    record.Email(),
		Avatar:   record.GetString("avatar"),
		Created:  record.Created.String(),
		Updated:  record.Updated.String(),
	}
}

// AuthError represents an authentication-related error
type AuthError struct {
	Message string
}

func (e *AuthError) Error() string {
	return e.Message
}