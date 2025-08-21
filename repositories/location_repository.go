package repositories

import (
	"fmt"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/dbx"
)

// locationRepository implements LocationRepository interface
type locationRepository struct {
	app *pocketbase.PocketBase
}

// NewLocationRepository creates a new location repository instance
func NewLocationRepository(app *pocketbase.PocketBase) LocationRepository {
	return &locationRepository{app: app}
}

// Create creates a new location record
func (r *locationRepository) Create(location *models.Record) error {
	return r.app.Dao().SaveRecord(location)
}

// FindByUser finds locations for a user with optional filters
func (r *locationRepository) FindByUser(userID string, filters map[string]interface{}, sort string, limit, offset int) ([]*models.Record, error) {
	filter := "user = {:user}"
	params := dbx.Params{"user": userID}

	// Add additional filters
	for key, value := range filters {
		switch key {
		case "from":
			filter += " && timestamp >= {:from}"
			params["from"] = value
		case "to":
			filter += " && timestamp <= {:to}"
			params["to"] = value
		case "session":
			filter += " && session = {:session}"
			params["session"] = value
		default:
			filter += fmt.Sprintf(" && %s = {:%s}", key, key)
			params[key] = value
		}
	}

	return r.app.Dao().FindRecordsByFilter(
		"locations",
		filter,
		sort,
		limit,
		offset,
		params,
	)
}

// FindByUserWithSession finds locations for a user within a specific session
func (r *locationRepository) FindByUserWithSession(userID, sessionID string, sort string, limit, offset int) ([]*models.Record, error) {
	return r.app.Dao().FindRecordsByFilter(
		"locations",
		"user = {:user} && session = {:session}",
		sort,
		limit,
		offset,
		dbx.Params{"user": userID, "session": sessionID},
	)
}

// GetCollection gets the locations collection
func (r *locationRepository) GetCollection() (*models.Collection, error) {
	return r.app.Dao().FindCollectionByNameOrId("locations")
}

// CreateNewRecord creates a new record for the locations collection
func (r *locationRepository) CreateNewRecord() (*models.Record, error) {
	collection, err := r.GetCollection()
	if err != nil {
		return nil, err
	}
	return models.NewRecord(collection), nil
}

// FindPublicLocations finds locations with public sessions
func (r *locationRepository) FindPublicLocations(limit, offset int) ([]*models.Record, error) {
	return r.app.Dao().FindRecordsByFilter(
		"locations",
		"user.username != '' AND session != ''",
		"-timestamp",
		limit,
		offset,
	)
}

// FindAllLocations finds locations with complex filters
func (r *locationRepository) FindAllLocations(userID, sessionFilter string, fromTime, toTime *time.Time, sort string, limit, offset int) ([]*models.Record, error) {
	filter := ""
	params := dbx.Params{}

	if userID != "" {
		filter = "user = {:user}"
		params["user"] = userID
	}

	if sessionFilter != "" {
		if filter != "" {
			filter += " && "
		}
		filter += "session = {:session}"
		params["session"] = sessionFilter
	}

	if fromTime != nil {
		if filter != "" {
			filter += " && "
		}
		filter += "timestamp >= {:from}"
		params["from"] = fromTime
	}

	if toTime != nil {
		if filter != "" {
			filter += " && "
		}
		filter += "timestamp <= {:to}"
		params["to"] = toTime
	}

	if filter == "" {
		filter = "id != ''"
	}

	return r.app.Dao().FindRecordsByFilter(
		"locations",
		filter,
		sort,
		limit,
		offset,
		params,
	)
}