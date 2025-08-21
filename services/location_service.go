package services

import (
	"strconv"
	"time"

	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tools/types"
	
	appmodels "vibe-tracker/models"
	"vibe-tracker/constants"
	"vibe-tracker/repositories"
)

// LocationService handles location tracking and GeoJSON business logic
type LocationService struct {
	locationRepo   repositories.LocationRepository
	userRepo       repositories.UserRepository
	sessionRepo    repositories.SessionRepository
	sessionService *SessionService
}

// NewLocationService creates a new LocationService instance
func NewLocationService(locationRepo repositories.LocationRepository, userRepo repositories.UserRepository, sessionRepo repositories.SessionRepository, sessionService *SessionService) *LocationService {
	return &LocationService{
		locationRepo:   locationRepo,
		userRepo:       userRepo,
		sessionRepo:    sessionRepo,
		sessionService: sessionService,
	}
}

// TrackLocationFromGeoJSON processes a GeoJSON location request
func (s *LocationService) TrackLocationFromGeoJSON(req appmodels.LocationRequest, user *models.Record) error {
	record, err := s.locationRepo.CreateNewRecord()
	if err != nil {
		return err
	}
	record.Set("user", user.Id)

	// Set timestamp
	if req.Properties.Timestamp == constants.DefaultTimestamp {
		record.Set("timestamp", types.NowDateTime())
	} else {
		timeStamp, _ := types.ParseDateTime(time.Unix(req.Properties.Timestamp, 0))
		record.Set("timestamp", timeStamp)
	}

	// Set coordinates
	record.Set("longitude", req.Geometry.Coordinates[0])
	record.Set("latitude", req.Geometry.Coordinates[1])
	
	// Set altitude if provided
	if len(req.Geometry.Coordinates) > 2 {
		record.Set("altitude", req.Geometry.Coordinates[2])
	}

	// Set optional properties
	if req.Properties.Speed != nil && *req.Properties.Speed > 0 {
		record.Set("speed", *req.Properties.Speed)
	}
	if req.Properties.HeartRate != nil && *req.Properties.HeartRate > 0 {
		record.Set("heart_rate", *req.Properties.HeartRate)
	}

	// Handle session
	if req.Properties.Session != "" {
		session, err := s.sessionService.FindOrCreateSession(req.Properties.Session, user)
		if err != nil {
			return err
		}
		if session != nil {
			record.Set("session", session.Id)
		}
	}

	return s.locationRepo.Create(record)
}

// TrackLocationFromParams processes location data from query parameters
func (s *LocationService) TrackLocationFromParams(params appmodels.TrackingQueryParams, user *models.Record) error {
	record, err := s.locationRepo.CreateNewRecord()
	if err != nil {
		return err
	}
	record.Set("user", user.Id)
	record.Set("timestamp", types.NowDateTime())
	record.Set("longitude", params.Longitude)
	record.Set("latitude", params.Latitude)

	// Set optional parameters
	if params.Altitude != nil {
		record.Set("altitude", *params.Altitude)
	}
	if params.Speed != nil && *params.Speed > 0 {
		record.Set("speed", *params.Speed)
	}
	if params.HeartRate != nil && *params.HeartRate > 0 {
		record.Set("heart_rate", *params.HeartRate)
	}

	// Handle session
	if params.Session != "" {
		session, err := s.sessionService.FindOrCreateSession(params.Session, user)
		if err != nil {
			return err
		}
		if session != nil {
			record.Set("session", session.Id)
		}
	}

	return s.locationRepo.Create(record)
}

// GetLatestLocationByUser returns the latest location for a user as GeoJSON
func (s *LocationService) GetLatestLocationByUser(username string) (*appmodels.LocationResponse, error) {
	// Find user by username
	user, err := s.userRepo.FindByUsername(username)
	if err != nil {
		return nil, err
	}

	// Get latest location  
	locations, err := s.locationRepo.FindByUser(user.Id, nil, "-timestamp", 1, 0)
	if err != nil || len(locations) == 0 {
		return nil, err
	}
	location := locations[0]

	return s.recordToGeoJSON(location, user)
}

// GetPublicLocations returns all public latest locations as GeoJSON FeatureCollection
func (s *LocationService) GetPublicLocations() (*appmodels.LocationsResponse, error) {
	// Get users with public sessions that have recent locations
	records, err := s.locationRepo.FindPublicLocations(constants.PublicLocationsLimit, 0)
	if err != nil {
		return nil, err
	}

	features := make([]appmodels.LocationResponse, 0)
	userLatestMap := make(map[string]*models.Record)

	// Filter to only latest location per user with public sessions
	for _, record := range records {
		userID := record.GetString("user")
		sessionID := record.GetString("session")
		
		if sessionID != "" {
			// Check if session is public
			session, err := s.sessionRepo.FindByID(sessionID)
			if err != nil || !session.GetBool("public") {
				continue
			}
		}

		// Keep only the latest location per user
		if existing, exists := userLatestMap[userID]; !exists || 
			record.GetDateTime("timestamp").Time().After(existing.GetDateTime("timestamp").Time()) {
			userLatestMap[userID] = record
		}
	}

	// Convert to GeoJSON features
	for _, record := range userLatestMap {
		user, err := s.userRepo.FindByID(record.GetString("user"))
		if err != nil {
			continue
		}

		geoJSON, err := s.recordToGeoJSON(record, user)
		if err != nil {
			continue
		}

		features = append(features, *geoJSON)
	}

	return &appmodels.LocationsResponse{
		Type:     "FeatureCollection",
		Features: features,
	}, nil
}

// GetSessionData returns all locations for a specific session as GeoJSON
func (s *LocationService) GetSessionData(username, sessionName string) (*appmodels.SessionDataResponse, error) {
	// Find user by username
	user, err := s.userRepo.FindByUsername(username)
	if err != nil {
		return nil, err
	}

	// Find session
	session, err := s.sessionService.findSessionByNameAndUser(sessionName, user.Id)
	if err != nil {
		return nil, err
	}

	// Get all locations for this session
	locations, err := s.locationRepo.FindByUserWithSession(user.Id, session.Id, "timestamp", 0, 0)
	if err != nil {
		return nil, err
	}

	features := make([]appmodels.LocationResponse, 0, len(locations))
	for _, location := range locations {
		geoJSON, err := s.recordToGeoJSON(location, user)
		if err != nil {
			continue
		}
		features = append(features, *geoJSON)
	}

	return &appmodels.SessionDataResponse{
		Type:     "FeatureCollection",
		Features: features,
	}, nil
}

// Helper methods

func (s *LocationService) recordToGeoJSON(record *models.Record, user *models.Record) (*appmodels.LocationResponse, error) {
	coordinates := []float64{
		record.GetFloat("longitude"),
		record.GetFloat("latitude"),
	}
	
	if altitude := record.GetFloat("altitude"); altitude != 0 {
		coordinates = append(coordinates, altitude)
	}

	properties := appmodels.LocationProperties{
		Timestamp: record.GetDateTime("timestamp").Time().Unix(),
		Username:  user.GetString("username"),
	}

	if speed := record.GetFloat("speed"); speed > 0 {
		properties.Speed = &speed
	}
	if heartRate := record.GetFloat("heart_rate"); heartRate > 0 {
		properties.HeartRate = &heartRate
	}

	// Get session info if available
	if sessionID := record.GetString("session"); sessionID != "" {
		session, err := s.sessionRepo.FindByID(sessionID)
		if err == nil {
			properties.Session = session.GetString("name")
			properties.Title = session.GetString("title")
		}
	}

	return &appmodels.LocationResponse{
		Type: "Feature",
		Geometry: appmodels.Geometry{
			Type:        "Point",
			Coordinates: coordinates,
		},
		Properties: properties,
	}, nil
}

// ParseCoordinatesFromParams parses latitude/longitude from string parameters
func (s *LocationService) ParseCoordinatesFromParams(latStr, lonStr, altStr string) (float64, float64, float64, error) {
	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		return 0, 0, 0, &LocationError{Message: "Invalid latitude"}
	}

	lon, err := strconv.ParseFloat(lonStr, 64)
	if err != nil {
		return 0, 0, 0, &LocationError{Message: "Invalid longitude"}
	}

	var alt float64
	if altStr != "" {
		alt, _ = strconv.ParseFloat(altStr, 64)
	}

	return lat, lon, alt, nil
}

// LocationError represents a location-related error
type LocationError struct {
	Message string
}

func (e *LocationError) Error() string {
	return e.Message
}