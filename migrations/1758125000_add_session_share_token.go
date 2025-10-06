package migrations

import (
	"fmt"
	"log"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		log.Println("Adding share_token field to sessions collection...")

		// Find the sessions collection
		collection, err := dao.FindCollectionByNameOrId("sessions")
		if err != nil {
			return fmt.Errorf("sessions collection not found: %v", err)
		}

		// Check if field already exists to avoid duplicates
		if collection.Schema.GetFieldByName("share_token") != nil {
			log.Println("share_token field already exists in sessions collection, skipping...")
			return nil
		}

		log.Println("Adding share_token field...")
		// Add share_token text field (empty string by default for existing sessions)
		shareTokenField := &schema.SchemaField{
			Name:     "share_token",
			Type:     schema.FieldTypeText,
			Required: false,
			Options: &schema.TextOptions{
				Max: types.Pointer(64), // Sufficient for security tokens
			},
		}
		collection.Schema.AddField(shareTokenField)

		log.Println("Saving sessions collection with share_token field...")
		if err := dao.SaveCollection(collection); err != nil {
			return fmt.Errorf("failed to save sessions collection with share_token field: %v", err)
		}

		log.Println("Successfully added share_token field to sessions collection!")
		return nil

	}, func(db dbx.Builder) error {
		// Rollback: Remove the share_token field from sessions collection
		dao := daos.New(db)

		log.Println("Removing share_token field from sessions collection...")

		collection, err := dao.FindCollectionByNameOrId("sessions")
		if err != nil {
			log.Printf("Sessions collection not found during rollback: %v", err)
			return nil // Don't fail rollback if collection doesn't exist
		}

		schema := collection.Schema

		// Remove field if it exists
		if field := schema.GetFieldByName("share_token"); field != nil {
			log.Println("Removing share_token field...")
			schema.RemoveField(field.Id)
		}

		if err := dao.SaveCollection(collection); err != nil {
			return fmt.Errorf("failed to remove share_token field from sessions collection: %v", err)
		}

		log.Println("Successfully removed share_token field from sessions collection!")
		return nil
	})
}
