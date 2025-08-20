package models

import "time"

// CreateSessionRequest represents the request body for creating a session
type CreateSessionRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=100"`
	Title       string `json:"title,omitempty" validate:"omitempty,max=200"`
	Description string `json:"description,omitempty" validate:"omitempty,max=1000"`
	Public      bool   `json:"public"`
}

// UpdateSessionRequest represents the request body for updating a session
type UpdateSessionRequest struct {
	Title       string `json:"title,omitempty" validate:"omitempty,max=200"`
	Description string `json:"description,omitempty" validate:"omitempty,max=1000"`
	Public      bool   `json:"public"`
}

// Session represents a session in the system
type Session struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Public      bool      `json:"public"`
	User        string    `json:"user,omitempty"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
}

// SessionsListResponse represents the paginated response for listing sessions
type SessionsListResponse struct {
	Sessions   []Session `json:"sessions"`
	Page       int       `json:"page"`
	PerPage    int       `json:"perPage"`
	TotalItems int       `json:"totalItems"`
	TotalPages int       `json:"totalPages"`
}

// SessionResponse represents a single session response
type SessionResponse struct {
	Session
}