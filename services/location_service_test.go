package services

import (
	"errors"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"vibe-tracker/constants"
	appmodels "vibe-tracker/models"
	"vibe-tracker/repositories"
	"vibe-tracker/services/mocks"
)

// Test helper to create a mock SessionService that implements the interface
type testSessionService struct {
	mock.Mock
}

func (m *testSessionService) FindOrCreateSession(sessionName string, user *models.Record) (*models.Record, error) {
	args := m.Called(sessionName, user)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Record), args.Error(1)
}

func (m *testSessionService) FindSessionByNameAndUser(sessionName string, userID string) (*models.Record, error) {
	args := m.Called(sessionName, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Record), args.Error(1)
}

// Ensure testSessionService implements the interface
var _ repositories.SessionServiceInterface = (*testSessionService)(nil)

// Helper function to create a mock record that can be used for testing
func createMockRecord() *models.Record {
	// Create a collection for the record
	collection := &models.Collection{}
	collection.Id = "test_collection"
	collection.Name = "test"

	// Create a record with the collection
	record := models.NewRecord(collection)
	return record
}

func TestLocationService_TrackLocationFromGeoJSON(t *testing.T) {
	t.Run("Successful location tracking", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		// Create test records
		mockRecord := createMockRecord()
		mockUser := createMockRecord()
		mockUser.Id = "user123"

		// Setup expectations
		mockLocationRepo.On("CreateNewRecord").Return(mockRecord, nil)
		mockLocationRepo.On("Create", mockRecord).Return(nil)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Create test request
		speed := 5.5
		heartRate := 140.0
		req := appmodels.LocationRequest{
			Type: "Feature",
			Geometry: appmodels.Geometry{
				Type:        "Point",
				Coordinates: []float64{-122.4194, 37.7749, 10.0}, // lon, lat, alt
			},
			Properties: appmodels.LocationProperties{
				Timestamp: constants.DefaultTimestamp, // Will use current time
				Speed:     &speed,
				HeartRate: &heartRate,
			},
		}

		// Execute
		err := service.TrackLocationFromGeoJSON(req, mockUser)

		// Assert
		assert.NoError(t, err)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("Successful location tracking with session", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		// Create test records
		mockRecord := createMockRecord()
		mockUser := createMockRecord()
		mockUser.Id = "user123"
		mockSession := createMockRecord()
		mockSession.Id = "session123"

		// Setup expectations
		mockLocationRepo.On("CreateNewRecord").Return(mockRecord, nil)
		mockLocationRepo.On("Create", mockRecord).Return(nil)
		mockSessionService.On("FindOrCreateSession", "test-session", mockUser).Return(mockSession, nil)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Create test request with session
		req := appmodels.LocationRequest{
			Type: "Feature",
			Geometry: appmodels.Geometry{
				Type:        "Point",
				Coordinates: []float64{-122.4194, 37.7749},
			},
			Properties: appmodels.LocationProperties{
				Timestamp: 1640995200, // Custom timestamp
				Session:   "test-session",
			},
		}

		// Execute
		err := service.TrackLocationFromGeoJSON(req, mockUser)

		// Assert
		assert.NoError(t, err)
		mockLocationRepo.AssertExpectations(t)
		mockSessionService.AssertExpectations(t)
	})

	t.Run("Error creating new record", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		mockUser := createMockRecord()
		mockUser.Id = "user123"

		// Setup expectations - CreateNewRecord fails
		expectedError := errors.New("database error")
		mockLocationRepo.On("CreateNewRecord").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Create test request
		req := appmodels.LocationRequest{
			Type: "Feature",
			Geometry: appmodels.Geometry{
				Type:        "Point",
				Coordinates: []float64{-122.4194, 37.7749},
			},
			Properties: appmodels.LocationProperties{
				Timestamp: constants.DefaultTimestamp,
			},
		}

		// Execute
		err := service.TrackLocationFromGeoJSON(req, mockUser)

		// Assert
		assert.Error(t, err)
		assert.Equal(t, expectedError, err)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("Error creating location record", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		mockRecord := createMockRecord()
		mockUser := createMockRecord()
		mockUser.Id = "user123"

		// Setup expectations - Create fails
		expectedError := errors.New("create error")
		mockLocationRepo.On("CreateNewRecord").Return(mockRecord, nil)
		mockLocationRepo.On("Create", mockRecord).Return(expectedError)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Create test request
		req := appmodels.LocationRequest{
			Type: "Feature",
			Geometry: appmodels.Geometry{
				Type:        "Point",
				Coordinates: []float64{-122.4194, 37.7749},
			},
			Properties: appmodels.LocationProperties{
				Timestamp: constants.DefaultTimestamp,
			},
		}

		// Execute
		err := service.TrackLocationFromGeoJSON(req, mockUser)

		// Assert
		assert.Error(t, err)
		assert.Equal(t, expectedError, err)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("Error finding or creating session", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		mockRecord := createMockRecord()
		mockUser := createMockRecord()
		mockUser.Id = "user123"

		// Setup expectations
		expectedError := errors.New("session error")
		mockLocationRepo.On("CreateNewRecord").Return(mockRecord, nil)
		mockSessionService.On("FindOrCreateSession", "test-session", mockUser).Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Create test request with session
		req := appmodels.LocationRequest{
			Type: "Feature",
			Geometry: appmodels.Geometry{
				Type:        "Point",
				Coordinates: []float64{-122.4194, 37.7749},
			},
			Properties: appmodels.LocationProperties{
				Timestamp: constants.DefaultTimestamp,
				Session:   "test-session",
			},
		}

		// Execute
		err := service.TrackLocationFromGeoJSON(req, mockUser)

		// Assert
		assert.Error(t, err)
		assert.Equal(t, expectedError, err)
		mockLocationRepo.AssertExpectations(t)
		mockSessionService.AssertExpectations(t)
	})
}

func TestLocationService_GetLatestLocationByUser(t *testing.T) {
	t.Run("Successful retrieval", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		// Create test records
		mockUser := createMockRecord()
		mockUser.Id = "user123"

		mockLocation := createMockRecord()
		// Set up location data
		timestamp := time.Now()
		parsedTime, _ := types.ParseDateTime(timestamp)

		// Mock the record's behavior
		mockLocation.Set("longitude", -122.4194)
		mockLocation.Set("latitude", 37.7749)
		mockLocation.Set("altitude", 10.0)
		mockLocation.Set("speed", 5.5)
		mockLocation.Set("heart_rate", 140.0)
		mockLocation.Set("timestamp", parsedTime)
		mockLocation.Set("user", "user123")
		mockLocation.Set("session", "")

		mockUser.Set("username", "testuser")

		// Setup expectations
		mockUserRepo.On("FindByUsername", "testuser").Return(mockUser, nil)
		mockLocationRepo.On("FindByUser", "user123", mock.Anything, "-timestamp", 1, 0).Return([]*models.Record{mockLocation}, nil)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Execute
		result, err := service.GetLatestLocationByUser("testuser")

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "Feature", result.Type)
		assert.Equal(t, "Point", result.Geometry.Type)
		assert.Len(t, result.Geometry.Coordinates, 3)
		assert.Equal(t, -122.4194, result.Geometry.Coordinates[0])
		assert.Equal(t, 37.7749, result.Geometry.Coordinates[1])
		assert.Equal(t, 10.0, result.Geometry.Coordinates[2])
		assert.Equal(t, "testuser", result.Properties.Username)
		assert.NotNil(t, result.Properties.Speed)
		assert.Equal(t, 5.5, *result.Properties.Speed)
		assert.NotNil(t, result.Properties.HeartRate)
		assert.Equal(t, 140.0, *result.Properties.HeartRate)

		mockUserRepo.AssertExpectations(t)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("User not found", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		// Setup expectations - user not found
		expectedError := errors.New("user not found")
		mockUserRepo.On("FindByUsername", "nonexistent").Return((*models.Record)(nil), expectedError)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Execute
		result, err := service.GetLatestLocationByUser("nonexistent")

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)
		mockUserRepo.AssertExpectations(t)
	})

	t.Run("No locations for user", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		// Create test user
		mockUser := createMockRecord()
		mockUser.Id = "user123"

		// Setup expectations - empty location list
		mockUserRepo.On("FindByUsername", "testuser").Return(mockUser, nil)
		mockLocationRepo.On("FindByUser", "user123", mock.Anything, "-timestamp", 1, 0).Return([]*models.Record{}, nil)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Execute
		result, err := service.GetLatestLocationByUser("testuser")

		// Assert
		assert.NoError(t, err)
		assert.Nil(t, result)
		mockUserRepo.AssertExpectations(t)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("Error finding locations", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		// Create test user
		mockUser := createMockRecord()
		mockUser.Id = "user123"

		// Setup expectations - location query fails
		expectedError := errors.New("database error")
		mockUserRepo.On("FindByUsername", "testuser").Return(mockUser, nil)
		mockLocationRepo.On("FindByUser", "user123", mock.Anything, "-timestamp", 1, 0).Return([]*models.Record{}, expectedError)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Execute
		result, err := service.GetLatestLocationByUser("testuser")

		// Assert
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedError, err)
		mockUserRepo.AssertExpectations(t)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("Location with session data", func(t *testing.T) {
		// Setup mocks
		mockLocationRepo := &mocks.MockLocationRepository{}
		mockUserRepo := &mocks.MockUserRepository{}
		mockSessionRepo := &mocks.MockSessionRepository{}
		mockSessionService := &testSessionService{}

		// Create test records
		mockUser := createMockRecord()
		mockUser.Id = "user123"
		mockUser.Set("username", "testuser")

		mockSession := createMockRecord()
		mockSession.Id = "session123"
		mockSession.Set("name", "morning-run")
		mockSession.Set("title", "Morning Run")

		mockLocation := createMockRecord()
		timestamp := time.Now()
		parsedTime, _ := types.ParseDateTime(timestamp)

		mockLocation.Set("longitude", -122.4194)
		mockLocation.Set("latitude", 37.7749)
		mockLocation.Set("timestamp", parsedTime)
		mockLocation.Set("user", "user123")
		mockLocation.Set("session", "session123")

		// Setup expectations
		mockUserRepo.On("FindByUsername", "testuser").Return(mockUser, nil)
		mockLocationRepo.On("FindByUser", "user123", mock.Anything, "-timestamp", 1, 0).Return([]*models.Record{mockLocation}, nil)
		mockSessionRepo.On("FindByID", "session123").Return(mockSession, nil)

		// Create service
		service := NewLocationService(mockLocationRepo, mockUserRepo, mockSessionRepo, mockSessionService)

		// Execute
		result, err := service.GetLatestLocationByUser("testuser")

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "morning-run", result.Properties.Session)
		assert.Equal(t, "Morning Run", result.Properties.Title)

		mockUserRepo.AssertExpectations(t)
		mockLocationRepo.AssertExpectations(t)
		mockSessionRepo.AssertExpectations(t)
	})
}
