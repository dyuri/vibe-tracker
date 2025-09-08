package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		collection, err := dao.FindCollectionByNameOrId("locations")
		if err != nil {
			return err
		}

		// Add status field
		if collection.Schema.GetFieldByName("status") == nil {
			statusField := &schema.SchemaField{
				Name:     "status",
				Type:     schema.FieldTypeText,
				Required: false,
				Options: &schema.TextOptions{
					Max: types.Pointer(100), // Reasonable limit for status strings
				},
			}
			collection.Schema.AddField(statusField)
		}

		// Add event field
		if collection.Schema.GetFieldByName("event") == nil {
			eventField := &schema.SchemaField{
				Name:     "event",
				Type:     schema.FieldTypeText,
				Required: false,
				Options: &schema.TextOptions{
					Max: types.Pointer(100), // Reasonable limit for event strings
				},
			}
			collection.Schema.AddField(eventField)
		}

		return dao.SaveCollection(collection)
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		collection, err := dao.FindCollectionByNameOrId("locations")
		if err != nil {
			return err
		}

		// Remove event field
		if field := collection.Schema.GetFieldByName("event"); field != nil {
			collection.Schema.RemoveField(field.Id)
		}

		// Remove status field
		if field := collection.Schema.GetFieldByName("status"); field != nil {
			collection.Schema.RemoveField(field.Id)
		}

		return dao.SaveCollection(collection)
	})
}
