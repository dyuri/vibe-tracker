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

		log.Println("Adding GPX fields to sessions collection...")

		// Find the sessions collection
		collection, err := dao.FindCollectionByNameOrId("sessions")
		if err != nil {
			return fmt.Errorf("sessions collection not found: %v", err)
		}

		// Check if fields already exist to avoid duplicates
		if collection.Schema.GetFieldByName("gpx_track") != nil {
			log.Println("GPX fields already exist in sessions collection, skipping...")
			return nil
		}

		log.Println("Adding gpx_track field...")
		// Add gpx_track file field
		gpxTrackField := &schema.SchemaField{
			Name:     "gpx_track",
			Type:     schema.FieldTypeFile,
			Required: false,
			Options: &schema.FileOptions{
				MaxSelect: 1,
				MaxSize:   10485760, // 10MB limit (updated from 5MB)
				MimeTypes: []string{
					"application/gpx+xml",
					"text/xml",
					"application/xml",
					"application/octet-stream", // Some browsers send this for .gpx files
				},
			},
		}
		collection.Schema.AddField(gpxTrackField)

		log.Println("Adding track_name field...")
		// Add track_name text field
		trackNameField := &schema.SchemaField{
			Name:     "track_name",
			Type:     schema.FieldTypeText,
			Required: false,
			Options: &schema.TextOptions{
				Max: types.Pointer(200),
			},
		}
		collection.Schema.AddField(trackNameField)

		log.Println("Adding track_description field...")
		// Add track_description text field
		trackDescField := &schema.SchemaField{
			Name:     "track_description",
			Type:     schema.FieldTypeText,
			Required: false,
			Options: &schema.TextOptions{
				Max: types.Pointer(1000),
			},
		}
		collection.Schema.AddField(trackDescField)

		log.Println("Saving sessions collection with new GPX fields...")
		if err := dao.SaveCollection(collection); err != nil {
			return fmt.Errorf("failed to save sessions collection with GPX fields: %v", err)
		}

		log.Println("Successfully added GPX fields to sessions collection!")
		return nil

	}, func(db dbx.Builder) error {
		// Rollback: Remove the GPX fields from sessions collection
		dao := daos.New(db)

		log.Println("Removing GPX fields from sessions collection...")

		collection, err := dao.FindCollectionByNameOrId("sessions")
		if err != nil {
			log.Printf("Sessions collection not found during rollback: %v", err)
			return nil // Don't fail rollback if collection doesn't exist
		}

		schema := collection.Schema

		// Remove fields if they exist
		if field := schema.GetFieldByName("gpx_track"); field != nil {
			log.Println("Removing gpx_track field...")
			schema.RemoveField(field.Id)
		}
		if field := schema.GetFieldByName("track_name"); field != nil {
			log.Println("Removing track_name field...")
			schema.RemoveField(field.Id)
		}
		if field := schema.GetFieldByName("track_description"); field != nil {
			log.Println("Removing track_description field...")
			schema.RemoveField(field.Id)
		}

		if err := dao.SaveCollection(collection); err != nil {
			return fmt.Errorf("failed to remove GPX fields from sessions collection: %v", err)
		}

		log.Println("Successfully removed GPX fields from sessions collection!")
		return nil
	})
}
