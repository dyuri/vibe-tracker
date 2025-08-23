package mocks

import (
	"github.com/pocketbase/pocketbase/models"
	"github.com/stretchr/testify/mock"
)

// MockSessionService is a mock implementation of SessionService
type MockSessionService struct {
	mock.Mock
}

func (m *MockSessionService) FindOrCreateSession(sessionName string, user *models.Record) (*models.Record, error) {
	args := m.Called(sessionName, user)
	return args.Get(0).(*models.Record), args.Error(1)
}
