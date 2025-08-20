package models

// LoginRequest represents the request body for login
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

// UpdateProfileRequest represents the request body for updating user profile
type UpdateProfileRequest struct {
	Username    string `json:"username,omitempty" validate:"omitempty,min=3,max=50"`
	Email       string `json:"email,omitempty" validate:"omitempty,email"`
	Password    string `json:"password,omitempty" validate:"omitempty,min=6"`
	OldPassword string `json:"oldPassword,omitempty"`
}

// LoginResponse represents the response for successful login
type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// User represents a user in the system
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Avatar   string `json:"avatar,omitempty"`
	Created  string `json:"created,omitempty"`
	Updated  string `json:"updated,omitempty"`
}

// TokenResponse represents a token refresh response
type TokenResponse struct {
	Token string `json:"token"`
}

// RefreshTokenRequest represents the request for token refresh
type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}