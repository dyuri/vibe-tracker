package repositories

import (
	"time"
	
	"github.com/pocketbase/pocketbase/models"
)

// UserRepository defines the interface for user database operations
type UserRepository interface {
	FindByUsername(username string) (*models.Record, error)
	FindByEmail(email string) (*models.Record, error)
	FindByID(userID string) (*models.Record, error)
	FindByToken(token string) (*models.Record, error)
	Save(user *models.Record) error
}

// SessionRepository defines the interface for session database operations
type SessionRepository interface {
	FindByUser(userID string, sort string, limit, offset int) ([]*models.Record, error)
	CountByUser(userID string) (int, error)
	Create(session *models.Record) error
	Update(session *models.Record) error
	Delete(session *models.Record) error
	FindByNameAndUser(name, userID string) (*models.Record, error)
	FindByID(sessionID string) (*models.Record, error)
	GetCollection() (*models.Collection, error)
	CreateNewRecord() (*models.Record, error)
}

// LocationRepository defines the interface for location database operations
type LocationRepository interface {
	Create(location *models.Record) error
	FindByUser(userID string, filters map[string]interface{}, sort string, limit, offset int) ([]*models.Record, error)
	FindByUserWithSession(userID, sessionID string, sort string, limit, offset int) ([]*models.Record, error)
	FindPublicLocations(limit, offset int) ([]*models.Record, error)
	FindAllLocations(userID, sessionFilter string, fromTime, toTime *time.Time, sort string, limit, offset int) ([]*models.Record, error)
	GetCollection() (*models.Collection, error)
	CreateNewRecord() (*models.Record, error)
}