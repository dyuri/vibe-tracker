package migrations

import (
	"fmt"
	"log"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		// Enhance sessions collection with GPX-related fields
		if err := enhanceSessionsCollection(dao); err != nil {
			return fmt.Errorf("failed to enhance sessions collection: %v", err)
		}

		// Create gpx_tracks collection for planned track points
		if err := createGpxTracksCollection(dao); err != nil {
			return fmt.Errorf("failed to create gpx_tracks collection: %v", err)
		}

		// Create waypoints collection
		if err := createWaypointsCollection(dao); err != nil {
			return fmt.Errorf("failed to create waypoints collection: %v", err)
		}

		return nil
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Remove waypoints collection
		if collection, err := dao.FindCollectionByNameOrId("waypoints"); err == nil {
			if err := dao.DeleteCollection(collection); err != nil {
				return fmt.Errorf("failed to delete waypoints collection: %v", err)
			}
		}

		// Remove gpx_tracks collection
		if collection, err := dao.FindCollectionByNameOrId("gpx_tracks"); err == nil {
			if err := dao.DeleteCollection(collection); err != nil {
				return fmt.Errorf("failed to delete gpx_tracks collection: %v", err)
			}
		}

		// Remove GPX-related fields from sessions
		if collection, err := dao.FindCollectionByNameOrId("sessions"); err == nil {
			schema := collection.Schema

			// Remove fields if they exist
			if field := schema.GetFieldByName("gpx_track"); field != nil {
				schema.RemoveField(field.Id)
			}
			if field := schema.GetFieldByName("track_name"); field != nil {
				schema.RemoveField(field.Id)
			}
			if field := schema.GetFieldByName("track_description"); field != nil {
				schema.RemoveField(field.Id)
			}

			if err := dao.SaveCollection(collection); err != nil {
				return fmt.Errorf("failed to remove GPX fields from sessions: %v", err)
			}
		}

		return nil
	})
}

func enhanceSessionsCollection(dao *daos.Dao) error {
	collection, err := dao.FindCollectionByNameOrId("sessions")
	if err != nil {
		return fmt.Errorf("sessions collection not found: %v", err)
	}

	schema := collection.Schema

	// Check if fields already exist to avoid duplicates
	if schema.GetFieldByName("gpx_track") != nil {
		log.Println("Sessions collection already enhanced with GPX fields")
		return nil
	}

	// Add gpx_track file field
	gpxTrackField := &schema.SchemaField{
		Name:     "gpx_track",
		Type:     schema.FieldTypeFile,
		Required: false,
		Options: &schema.FileOptions{
			MaxSelect: types.Pointer(1),
			MaxSize:   types.Pointer(5242880), // 5MB limit
			MimeTypes: []string{"application/gpx+xml", "text/xml", "application/xml"},
		},
	}

	// Add track_name text field
	trackNameField := &schema.SchemaField{
		Name:     "track_name",
		Type:     schema.FieldTypeText,
		Required: false,
		Options: &schema.TextOptions{
			Max: types.Pointer(200),
		},
	}

	// Add track_description text field
	trackDescField := &schema.SchemaField{
		Name:     "track_description",
		Type:     schema.FieldTypeText,
		Required: false,
		Options: &schema.TextOptions{
			Max: types.Pointer(1000),
		},
	}

	schema.AddField(gpxTrackField)
	schema.AddField(trackNameField)
	schema.AddField(trackDescField)

	return dao.SaveCollection(collection)
}

func createGpxTracksCollection(dao *daos.Dao) error {
	// Check if collection already exists
	if _, err := dao.FindCollectionByNameOrId("gpx_tracks"); err == nil {
		log.Println("gpx_tracks collection already exists")
		return nil
	}

	// Get sessions collection for relation
	sessionsCollection, err := dao.FindCollectionByNameOrId("sessions")
	if err != nil {
		return fmt.Errorf("sessions collection not found: %v", err)
	}

	gpxTracksCollection := &models.Collection{
		Name:       "gpx_tracks",
		Type:       models.CollectionTypeBase,
		ListRule:   types.Pointer("session_id.user = @request.auth.id"),
		ViewRule:   types.Pointer("session_id.user = @request.auth.id || session_id.public = true"),
		CreateRule: types.Pointer("session_id.user = @request.auth.id"),
		UpdateRule: types.Pointer("session_id.user = @request.auth.id"),
		DeleteRule: types.Pointer("session_id.user = @request.auth.id"),
		Schema: schema.NewSchema(
			&schema.SchemaField{
				Name:     "session_id",
				Type:     schema.FieldTypeRelation,
				Required: true,
				Options: &schema.RelationOptions{
					CollectionId:  sessionsCollection.Id,
					CascadeDelete: true,
					MinSelect:     types.Pointer(1),
					MaxSelect:     types.Pointer(1),
				},
			},
			&schema.SchemaField{
				Name:     "latitude",
				Type:     schema.FieldTypeNumber,
				Required: true,
				Options: &schema.NumberOptions{
					Min: types.Pointer(-90.0),
					Max: types.Pointer(90.0),
				},
			},
			&schema.SchemaField{
				Name:     "longitude",
				Type:     schema.FieldTypeNumber,
				Required: true,
				Options: &schema.NumberOptions{
					Min: types.Pointer(-180.0),
					Max: types.Pointer(180.0),
				},
			},
			&schema.SchemaField{
				Name:     "altitude",
				Type:     schema.FieldTypeNumber,
				Required: false,
				Options:  &schema.NumberOptions{},
			},
			&schema.SchemaField{
				Name:     "sequence",
				Type:     schema.FieldTypeNumber,
				Required: true,
				Options: &schema.NumberOptions{
					Min: types.Pointer(0.0),
				},
			},
		),
	}

	// Create indexes for performance
	gpxTracksCollection.Indexes = types.JsonArray[string]{
		"CREATE INDEX idx_gpx_tracks_session ON gpx_tracks (session_id)",
		"CREATE INDEX idx_gpx_tracks_sequence ON gpx_tracks (session_id, sequence)",
	}

	return dao.SaveCollection(gpxTracksCollection)
}

func createWaypointsCollection(dao *daos.Dao) error {
	// Check if collection already exists
	if _, err := dao.FindCollectionByNameOrId("waypoints"); err == nil {
		log.Println("waypoints collection already exists")
		return nil
	}

	// Get sessions collection for relation
	sessionsCollection, err := dao.FindCollectionByNameOrId("sessions")
	if err != nil {
		return fmt.Errorf("sessions collection not found: %v", err)
	}

	waypointsCollection := &models.Collection{
		Name:       "waypoints",
		Type:       models.CollectionTypeBase,
		ListRule:   types.Pointer("session_id.user = @request.auth.id"),
		ViewRule:   types.Pointer("session_id.user = @request.auth.id || session_id.public = true"),
		CreateRule: types.Pointer("session_id.user = @request.auth.id"),
		UpdateRule: types.Pointer("session_id.user = @request.auth.id"),
		DeleteRule: types.Pointer("session_id.user = @request.auth.id"),
		Schema: schema.NewSchema(
			&schema.SchemaField{
				Name:     "name",
				Type:     schema.FieldTypeText,
				Required: true,
				Options: &schema.TextOptions{
					Min: types.Pointer(1),
					Max: types.Pointer(200),
				},
			},
			&schema.SchemaField{
				Name:     "type",
				Type:     schema.FieldTypeSelect,
				Required: true,
				Options: &schema.SelectOptions{
					MaxSelect: 1,
					Values:    []string{"generic", "food", "water", "shelter", "transition", "viewpoint", "camping", "parking", "danger", "medical", "fuel"},
				},
			},
			&schema.SchemaField{
				Name:     "description",
				Type:     schema.FieldTypeEditor,
				Required: false,
				Options:  &schema.EditorOptions{},
			},
			&schema.SchemaField{
				Name:     "latitude",
				Type:     schema.FieldTypeNumber,
				Required: true,
				Options: &schema.NumberOptions{
					Min: types.Pointer(-90.0),
					Max: types.Pointer(90.0),
				},
			},
			&schema.SchemaField{
				Name:     "longitude",
				Type:     schema.FieldTypeNumber,
				Required: true,
				Options: &schema.NumberOptions{
					Min: types.Pointer(-180.0),
					Max: types.Pointer(180.0),
				},
			},
			&schema.SchemaField{
				Name:     "altitude",
				Type:     schema.FieldTypeNumber,
				Required: false,
				Options:  &schema.NumberOptions{},
			},
			&schema.SchemaField{
				Name:     "photo",
				Type:     schema.FieldTypeFile,
				Required: false,
				Options: &schema.FileOptions{
					MaxSelect: types.Pointer(1),
					MaxSize:   types.Pointer(10485760), // 10MB limit
					MimeTypes: []string{"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"},
				},
			},
			&schema.SchemaField{
				Name:     "session_id",
				Type:     schema.FieldTypeRelation,
				Required: true,
				Options: &schema.RelationOptions{
					CollectionId:  sessionsCollection.Id,
					CascadeDelete: true,
					MinSelect:     types.Pointer(1),
					MaxSelect:     types.Pointer(1),
				},
			},
			&schema.SchemaField{
				Name:     "source",
				Type:     schema.FieldTypeSelect,
				Required: true,
				Options: &schema.SelectOptions{
					MaxSelect: 1,
					Values:    []string{"gpx", "manual", "photo"},
				},
			},
			&schema.SchemaField{
				Name:     "position_confidence",
				Type:     schema.FieldTypeSelect,
				Required: true,
				Options: &schema.SelectOptions{
					MaxSelect: 1,
					Values:    []string{"gps", "time_matched", "tracked", "gpx_track", "last_known", "manual"},
				},
			},
		),
	}

	// Create indexes for performance
	waypointsCollection.Indexes = types.JsonArray[string]{
		"CREATE INDEX idx_waypoints_session ON waypoints (session_id)",
		"CREATE INDEX idx_waypoints_type ON waypoints (type)",
		"CREATE INDEX idx_waypoints_source ON waypoints (source)",
		"CREATE INDEX idx_waypoints_confidence ON waypoints (position_confidence)",
		"CREATE INDEX idx_waypoints_location ON waypoints (latitude, longitude)",
	}

	return dao.SaveCollection(waypointsCollection)
}