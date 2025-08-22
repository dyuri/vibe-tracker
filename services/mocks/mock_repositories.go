package mocks

import (
	"time"

	"github.com/pocketbase/pocketbase/models"
	"github.com/stretchr/testify/mock"
)

// MockLocationRepository is a mock implementation of LocationRepository
type MockLocationRepository struct {
	mock.Mock
}

func (m *MockLocationRepository) Create(location *models.Record) error {
	args := m.Called(location)
	return args.Error(0)
}

func (m *MockLocationRepository) FindByUser(userID string, filters map[string]interface{}, sort string, limit, offset int) ([]*models.Record, error) {
	args := m.Called(userID, filters, sort, limit, offset)
	return args.Get(0).([]*models.Record), args.Error(1)
}

func (m *MockLocationRepository) FindByUserWithSession(userID, sessionID string, sort string, limit, offset int) ([]*models.Record, error) {
	args := m.Called(userID, sessionID, sort, limit, offset)
	return args.Get(0).([]*models.Record), args.Error(1)
}

func (m *MockLocationRepository) FindPublicLocations(limit, offset int) ([]*models.Record, error) {
	args := m.Called(limit, offset)
	return args.Get(0).([]*models.Record), args.Error(1)
}

func (m *MockLocationRepository) FindAllLocations(userID, sessionFilter string, fromTime, toTime *time.Time, sort string, limit, offset int) ([]*models.Record, error) {
	args := m.Called(userID, sessionFilter, fromTime, toTime, sort, limit, offset)
	return args.Get(0).([]*models.Record), args.Error(1)
}

func (m *MockLocationRepository) GetCollection() (*models.Collection, error) {
	args := m.Called()
	return args.Get(0).(*models.Collection), args.Error(1)
}

func (m *MockLocationRepository) CreateNewRecord() (*models.Record, error) {
	args := m.Called()
	return args.Get(0).(*models.Record), args.Error(1)
}

// MockUserRepository is a mock implementation of UserRepository
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) FindByUsername(username string) (*models.Record, error) {
	args := m.Called(username)
	return args.Get(0).(*models.Record), args.Error(1)
}

func (m *MockUserRepository) FindByEmail(email string) (*models.Record, error) {
	args := m.Called(email)
	return args.Get(0).(*models.Record), args.Error(1)
}

func (m *MockUserRepository) FindByID(userID string) (*models.Record, error) {
	args := m.Called(userID)
	return args.Get(0).(*models.Record), args.Error(1)
}

func (m *MockUserRepository) FindByToken(token string) (*models.Record, error) {
	args := m.Called(token)
	return args.Get(0).(*models.Record), args.Error(1)
}

func (m *MockUserRepository) Save(user *models.Record) error {
	args := m.Called(user)
	return args.Error(0)
}

// MockSessionRepository is a mock implementation of SessionRepository
type MockSessionRepository struct {
	mock.Mock
}

func (m *MockSessionRepository) FindByUser(userID string, sort string, limit, offset int) ([]*models.Record, error) {
	args := m.Called(userID, sort, limit, offset)
	return args.Get(0).([]*models.Record), args.Error(1)
}

func (m *MockSessionRepository) CountByUser(userID string) (int, error) {
	args := m.Called(userID)
	return args.Int(0), args.Error(1)
}

func (m *MockSessionRepository) Create(session *models.Record) error {
	args := m.Called(session)
	return args.Error(0)
}

func (m *MockSessionRepository) Update(session *models.Record) error {
	args := m.Called(session)
	return args.Error(0)
}

func (m *MockSessionRepository) Delete(session *models.Record) error {
	args := m.Called(session)
	return args.Error(0)
}

func (m *MockSessionRepository) FindByNameAndUser(name, userID string) (*models.Record, error) {
	args := m.Called(name, userID)
	return args.Get(0).(*models.Record), args.Error(1)
}

func (m *MockSessionRepository) FindByID(sessionID string) (*models.Record, error) {
	args := m.Called(sessionID)
	return args.Get(0).(*models.Record), args.Error(1)
}

func (m *MockSessionRepository) GetCollection() (*models.Collection, error) {
	args := m.Called()
	return args.Get(0).(*models.Collection), args.Error(1)
}

func (m *MockSessionRepository) CreateNewRecord() (*models.Record, error) {
	args := m.Called()
	return args.Get(0).(*models.Record), args.Error(1)
}
