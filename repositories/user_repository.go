package repositories

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/models"

	"vibe-tracker/constants"
)

// userRepository implements UserRepository interface
type userRepository struct {
	app *pocketbase.PocketBase
}

// NewUserRepository creates a new user repository instance
func NewUserRepository(app *pocketbase.PocketBase) UserRepository {
	return &userRepository{app: app}
}

// FindByUsername finds a user by username
func (r *userRepository) FindByUsername(username string) (*models.Record, error) {
	return r.app.Dao().FindFirstRecordByFilter(constants.CollectionUsers, "username = {:username}",
		dbx.Params{"username": username})
}

// FindByEmail finds a user by email
func (r *userRepository) FindByEmail(email string) (*models.Record, error) {
	return r.app.Dao().FindAuthRecordByEmail(constants.CollectionUsers, email)
}

// FindByID finds a user by ID
func (r *userRepository) FindByID(userID string) (*models.Record, error) {
	return r.app.Dao().FindRecordById(constants.CollectionUsers, userID)
}

// FindByToken finds a user by their custom token
func (r *userRepository) FindByToken(token string) (*models.Record, error) {
	return r.app.Dao().FindFirstRecordByFilter(constants.CollectionUsers, "token = {:token}",
		dbx.Params{"token": token})
}

// Save saves a user record
func (r *userRepository) Save(user *models.Record) error {
	return r.app.Dao().SaveRecord(user)
}
