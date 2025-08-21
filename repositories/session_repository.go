package repositories

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/dbx"
	
	"vibe-tracker/constants"
)

// sessionRepository implements SessionRepository interface
type sessionRepository struct {
	app *pocketbase.PocketBase
}

// NewSessionRepository creates a new session repository instance
func NewSessionRepository(app *pocketbase.PocketBase) SessionRepository {
	return &sessionRepository{app: app}
}

// FindByUser finds sessions for a user with pagination and sorting
func (r *sessionRepository) FindByUser(userID string, sort string, limit, offset int) ([]*models.Record, error) {
	return r.app.Dao().FindRecordsByFilter(
		constants.CollectionSessions,
		"user = {:user}",
		sort,
		limit,
		offset,
		dbx.Params{"user": userID},
	)
}

// CountByUser counts total sessions for a user
func (r *sessionRepository) CountByUser(userID string) (int, error) {
	records, err := r.app.Dao().FindRecordsByFilter(
		constants.CollectionSessions,
		"user = {:user}",
		"",
		0,
		0,
		dbx.Params{"user": userID},
	)
	if err != nil {
		return 0, err
	}
	return len(records), nil
}

// Create creates a new session record
func (r *sessionRepository) Create(session *models.Record) error {
	return r.app.Dao().SaveRecord(session)
}

// Update updates an existing session record
func (r *sessionRepository) Update(session *models.Record) error {
	return r.app.Dao().SaveRecord(session)
}

// Delete deletes a session record
func (r *sessionRepository) Delete(session *models.Record) error {
	return r.app.Dao().DeleteRecord(session)
}

// FindByNameAndUser finds a session by name and user
func (r *sessionRepository) FindByNameAndUser(name, userID string) (*models.Record, error) {
	return r.app.Dao().FindFirstRecordByFilter(constants.CollectionSessions, "name = {:name} && user = {:user}",
		dbx.Params{"name": name, "user": userID})
}

// FindByID finds a session by ID
func (r *sessionRepository) FindByID(sessionID string) (*models.Record, error) {
	return r.app.Dao().FindRecordById(constants.CollectionSessions, sessionID)
}

// GetCollection gets the sessions collection
func (r *sessionRepository) GetCollection() (*models.Collection, error) {
	return r.app.Dao().FindCollectionByNameOrId(constants.CollectionSessions)
}

// CreateNewRecord creates a new record for the sessions collection
func (r *sessionRepository) CreateNewRecord() (*models.Record, error) {
	collection, err := r.GetCollection()
	if err != nil {
		return nil, err
	}
	return models.NewRecord(collection), nil
}