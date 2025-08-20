package models

import "time"

// Coordinates represents geographic coordinates [longitude, latitude, altitude]
type Coordinates []float64

// Geometry represents GeoJSON geometry
type Geometry struct {
	Type        string      `json:"type" validate:"required,oneof=Point"`
	Coordinates Coordinates `json:"coordinates" validate:"required,min=2,max=3"`
}

// LocationProperties represents properties of a location point
type LocationProperties struct {
	Timestamp int64   `json:"timestamp" validate:"required"`
	Speed     float64 `json:"speed,omitempty" validate:"omitempty,min=0"`
	HeartRate float64 `json:"heart_rate,omitempty" validate:"omitempty,min=0,max=300"`
	Session   string  `json:"session,omitempty" validate:"omitempty,max=100"`
	Username  string  `json:"username,omitempty"`
	Title     string  `json:"session_title,omitempty"`
}

// LocationRequest represents a GeoJSON feature for tracking location
type LocationRequest struct {
	Type       string             `json:"type" validate:"required,oneof=Feature"`
	Geometry   Geometry           `json:"geometry" validate:"required"`
	Properties LocationProperties `json:"properties" validate:"required"`
}

// LocationResponse represents a GeoJSON feature response
type LocationResponse struct {
	Type       string             `json:"type"`
	Geometry   Geometry           `json:"geometry"`
	Properties LocationProperties `json:"properties"`
}

// LocationsResponse represents a GeoJSON FeatureCollection
type LocationsResponse struct {
	Type     string             `json:"type"`
	Features []LocationResponse `json:"features"`
}

// TrackingQueryParams represents query parameters for GET tracking requests
type TrackingQueryParams struct {
	Token     string  `query:"token" validate:"required"`
	Latitude  float64 `query:"latitude" validate:"required,min=-90,max=90"`
	Longitude float64 `query:"longitude" validate:"required,min=-180,max=180"`
	Altitude  float64 `query:"altitude,omitempty"`
	Speed     float64 `query:"speed,omitempty" validate:"omitempty,min=0"`
	HeartRate float64 `query:"heart_rate,omitempty" validate:"omitempty,min=0,max=300"`
	Session   string  `query:"session,omitempty" validate:"omitempty,max=100"`
}

// Location represents a stored location record
type Location struct {
	ID         string    `json:"id"`
	User       string    `json:"user"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	Altitude   float64   `json:"altitude,omitempty"`
	Speed      float64   `json:"speed,omitempty"`
	HeartRate  float64   `json:"heart_rate,omitempty"`
	Session    string    `json:"session,omitempty"`
	Timestamp  int64     `json:"timestamp"`
	Created    time.Time `json:"created"`
	Updated    time.Time `json:"updated"`
}

// SessionDataResponse represents session location data as GeoJSON
type SessionDataResponse struct {
	Type     string             `json:"type"`
	Features []LocationResponse `json:"features"`
}