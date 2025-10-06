package models

import "time"

// CreateSessionRequest represents the request body for creating a session
type CreateSessionRequest struct {
	Name        string `json:"name" validate:"required,session_name,min=1,max=100"`
	Title       string `json:"title,omitempty" validate:"omitempty,max=200"`
	Description string `json:"description,omitempty" validate:"omitempty,max=1000"`
	Public      *bool  `json:"public,omitempty"` // Optional - uses user's default if not specified
}

// UpdateSessionRequest represents the request body for updating a session
type UpdateSessionRequest struct {
	Title       string `json:"title,omitempty" validate:"omitempty,max=200"`
	Description string `json:"description,omitempty" validate:"omitempty,max=1000"`
	Public      bool   `json:"public"`
}

// Session represents a session in the system
type Session struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	Public           bool      `json:"public"`
	User             string    `json:"user,omitempty"`
	GpxTrack         string    `json:"gpx_track,omitempty"`
	TrackName        string    `json:"track_name,omitempty"`
	TrackDescription string    `json:"track_description,omitempty"`
	Created          time.Time `json:"created"`
	Updated          time.Time `json:"updated"`
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

// GpxTrackPoint represents a point in a planned GPX track
type GpxTrackPoint struct {
	ID        string    `json:"id"`
	SessionID string    `json:"session_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Altitude  *float64  `json:"altitude,omitempty"`
	Sequence  int       `json:"sequence"`
	Created   time.Time `json:"created"`
	Updated   time.Time `json:"updated"`
}

// Waypoint represents a waypoint associated with a session
type Waypoint struct {
	ID                 string    `json:"id"`
	Name               string    `json:"name"`
	Type               string    `json:"type"`
	Description        string    `json:"description,omitempty"`
	Latitude           float64   `json:"latitude"`
	Longitude          float64   `json:"longitude"`
	Altitude           *float64  `json:"altitude,omitempty"`
	Photo              string    `json:"photo,omitempty"`
	SessionID          string    `json:"session_id"`
	Source             string    `json:"source"`
	PositionConfidence string    `json:"position_confidence"`
	Created            time.Time `json:"created"`
	Updated            time.Time `json:"updated"`
}

// CreateWaypointRequest represents the request body for creating a waypoint
type CreateWaypointRequest struct {
	Name               string   `json:"name" validate:"required,min=1,max=200"`
	Type               string   `json:"type" validate:"required,oneof=generic food water shelter transition viewpoint camping parking danger medical fuel"`
	Description        string   `json:"description,omitempty" validate:"omitempty,max=1000"`
	Latitude           float64  `json:"latitude" validate:"required,min=-90,max=90"`
	Longitude          float64  `json:"longitude" validate:"required,min=-180,max=180"`
	Altitude           *float64 `json:"altitude,omitempty"`
	SessionID          string   `json:"session_id" validate:"required"`
	Source             string   `json:"source" validate:"required,oneof=gpx manual photo"`
	PositionConfidence string   `json:"position_confidence" validate:"required,oneof=gps time_matched tracked gpx_track last_known manual"`
}

// UpdateWaypointRequest represents the request body for updating a waypoint
type UpdateWaypointRequest struct {
	Name        string   `json:"name,omitempty" validate:"omitempty,min=1,max=200"`
	Type        string   `json:"type,omitempty" validate:"omitempty,oneof=generic food water shelter transition viewpoint camping parking danger medical fuel"`
	Description string   `json:"description,omitempty" validate:"omitempty,max=1000"`
	Latitude    *float64 `json:"latitude,omitempty" validate:"omitempty,min=-90,max=90"`
	Longitude   *float64 `json:"longitude,omitempty" validate:"omitempty,min=-180,max=180"`
	Altitude    *float64 `json:"altitude,omitempty"`
}

// WaypointsListResponse represents the paginated response for listing waypoints
type WaypointsListResponse struct {
	Waypoints  []Waypoint `json:"waypoints"`
	Page       int        `json:"page"`
	PerPage    int        `json:"perPage"`
	TotalItems int        `json:"totalItems"`
	TotalPages int        `json:"totalPages"`
}

// WaypointResponse represents a single waypoint response
type WaypointResponse struct {
	Waypoint
}

// GpxTrackResponse represents the response containing GPX track points
type GpxTrackResponse struct {
	TrackPoints []GpxTrackPoint `json:"track_points"`
	SessionID   string          `json:"session_id"`
	TrackName   string          `json:"track_name,omitempty"`
}
