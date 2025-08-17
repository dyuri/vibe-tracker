package migrations

import (
	"log"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		// Ensure users collection
		if err := ensureUsersCollection(dao); err != nil {
			return err
		}

		// Ensure locations collection
		if err := ensureLocationsCollection(dao); err != nil {
			return err
		}

		return nil
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Delete locations collection
		collection, err := dao.FindCollectionByNameOrId("locations")
		if err == nil {
			if err := dao.DeleteCollection(collection); err != nil {
				return err
			}
		}

		// Delete users collection
		collection, err = dao.FindCollectionByNameOrId("users")
		if err == nil {
			if err := dao.DeleteCollection(collection); err != nil {
				return err
			}
		}

		return nil
	})
}

func ensureUsersCollection(dao *daos.Dao) error {
	collection, err := dao.FindCollectionByNameOrId("users")
	if err == nil && collection != nil {
		modified := false

		if collection.Schema.GetFieldByName("token") == nil {
			// token field is missing, add it
			tokenField := &schema.SchemaField{
				Name:     "token",
				Type:     schema.FieldTypeText,
				Required: true,
				Options: &schema.TextOptions{
					Min:     types.Pointer(8),
					Max:     types.Pointer(16),
					Pattern: "^[a-zA-Z0-9]+$",
				},
			}
			collection.Schema.AddField(tokenField)
			modified = true
		}

		if collection.Schema.GetFieldByName("avatar") == nil {
			// avatar field is missing, add it
			avatarField := &schema.SchemaField{
				Name:     "avatar",
				Type:     schema.FieldTypeFile,
				Required: false,
				Options: &schema.FileOptions{
					MaxSelect: 1,
					MaxSize:   5242880, // 5MB in bytes
					MimeTypes: []string{
						"image/jpeg",
						"image/png",
						"image/svg+xml",
						"image/gif",
						"image/webp",
					},
				},
			}
			collection.Schema.AddField(avatarField)
			modified = true
		}

		if modified {
			if err := dao.SaveCollection(collection); err != nil {
				return err
			}
		}
		return nil // collection already exists
	}

	usersCollection := &models.Collection{
		Name:       "users",
		Type:       models.CollectionTypeAuth,
		ListRule:   nil,
		ViewRule:   nil,
		CreateRule: nil,
		UpdateRule: nil,
		DeleteRule: nil,
		Schema: schema.NewSchema(
			&schema.SchemaField{
				Name:     "token",
				Type:     schema.FieldTypeText,
				Required: true,
				Options: &schema.TextOptions{
					Min:     types.Pointer(8),
					Max:     types.Pointer(16),
					Pattern: "^[a-zA-Z0-9]+$",
				},
			},
			&schema.SchemaField{
				Name:     "avatar",
				Type:     schema.FieldTypeFile,
				Required: false,
				Options: &schema.FileOptions{
					MaxSelect: 1,
					MaxSize:   5242880, // 5MB in bytes
					MimeTypes: []string{
						"image/jpeg",
						"image/png",
						"image/svg+xml",
						"image/gif",
						"image/webp",
					},
				},
			},
		),
	}

	if err := dao.SaveCollection(usersCollection); err != nil {
		return err
	}

	// create a default user
	user, err := dao.FindAuthRecordByEmail("users", "default")
	if err != nil || user == nil {
		user := &models.Record{}
		user.RefreshId()
		user.SetUsername("default")
		user.Set("token", security.RandomString(12))
		if err := dao.SaveRecord(user); err != nil {
			log.Printf("Failed to create default user: %v", err)
		}
	}

	return nil
}

func ensureLocationsCollection(dao *daos.Dao) error {
	collection, err := dao.FindCollectionByNameOrId("locations")
	if err == nil && collection != nil {
		// TODO: check for user field
		return nil // collection already exists
	}

	newCollection := &models.Collection{
		Name:       "locations",
		Type:       models.CollectionTypeBase,
		ListRule:   nil,
		ViewRule:   nil,
		CreateRule: nil,
		UpdateRule: nil,
		DeleteRule: nil,
		Schema: schema.NewSchema(
			&schema.SchemaField{
				Name:     "user",
				Type:     schema.FieldTypeText,
				Required: true,
			},
			&schema.SchemaField{
				Name:     "timestamp",
				Type:     schema.FieldTypeDate,
				Required: false,
			},
			&schema.SchemaField{
				Name:     "latitude",
				Type:     schema.FieldTypeNumber,
				Required: true,
			},
			&schema.SchemaField{
				Name:     "longitude",
				Type:     schema.FieldTypeNumber,
				Required: true,
			},
			&schema.SchemaField{
				Name: "altitude",
				Type: schema.FieldTypeNumber,
			},
			&schema.SchemaField{
				Name: "speed",
				Type: schema.FieldTypeNumber,
			},
			&schema.SchemaField{
				Name: "heart_rate",
				Type: schema.FieldTypeNumber,
			},
			&schema.SchemaField{
				Name:     "session",
				Type:     schema.FieldTypeText,
				Required: false,
			},
		),
	}

	return dao.SaveCollection(newCollection)
}
