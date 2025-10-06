package migrations

import (
	"fmt"
	"log"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models/schema"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		log.Println("Adding default_session_public field to users collection...")

		// Find the users collection
		collection, err := dao.FindCollectionByNameOrId("users")
		if err != nil {
			return fmt.Errorf("users collection not found: %v", err)
		}

		// Check if field already exists to avoid duplicates
		if collection.Schema.GetFieldByName("default_session_public") != nil {
			log.Println("default_session_public field already exists in users collection, skipping...")
			return nil
		}

		log.Println("Adding default_session_public field...")
		// Add default_session_public boolean field (defaults to false for privacy)
		defaultSessionPublicField := &schema.SchemaField{
			Name:     "default_session_public",
			Type:     schema.FieldTypeBool,
			Required: false,
			Options:  &schema.BoolOptions{},
		}
		collection.Schema.AddField(defaultSessionPublicField)

		log.Println("Saving users collection with new field...")
		if err := dao.SaveCollection(collection); err != nil {
			return fmt.Errorf("failed to save users collection with default_session_public field: %v", err)
		}

		log.Println("Successfully added default_session_public field to users collection!")
		return nil

	}, func(db dbx.Builder) error {
		// Rollback: Remove the default_session_public field from users collection
		dao := daos.New(db)

		log.Println("Removing default_session_public field from users collection...")

		collection, err := dao.FindCollectionByNameOrId("users")
		if err != nil {
			log.Printf("Users collection not found during rollback: %v", err)
			return nil // Don't fail rollback if collection doesn't exist
		}

		schema := collection.Schema

		// Remove field if it exists
		if field := schema.GetFieldByName("default_session_public"); field != nil {
			log.Println("Removing default_session_public field...")
			schema.RemoveField(field.Id)
		}

		if err := dao.SaveCollection(collection); err != nil {
			return fmt.Errorf("failed to remove default_session_public field from users collection: %v", err)
		}

		log.Println("Successfully removed default_session_public field from users collection!")
		return nil
	})
}
