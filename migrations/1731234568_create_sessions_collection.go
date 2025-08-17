package migrations

import (
	"fmt"
	"log"
	"strings"

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

		// Create sessions collection
		if err := createSessionsCollection(dao); err != nil {
			return err
		}

		// Migrate existing session data
		if err := migrateExistingSessionData(dao); err != nil {
			return err
		}

		// Update locations collection to add session_id relation
		if err := addSessionRelationToLocations(dao); err != nil {
			return err
		}

		return nil
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Remove session_id field from locations
		locationsCollection, err := dao.FindCollectionByNameOrId("locations")
		if err == nil {
			sessionIdField := locationsCollection.Schema.GetFieldByName("session_id")
			if sessionIdField != nil {
				locationsCollection.Schema.RemoveField(sessionIdField.Id)
				if err := dao.SaveCollection(locationsCollection); err != nil {
					return err
				}
			}
		}

		// Delete sessions collection
		collection, err := dao.FindCollectionByNameOrId("sessions")
		if err == nil {
			if err := dao.DeleteCollection(collection); err != nil {
				return err
			}
		}

		return nil
	})
}

func createSessionsCollection(dao *daos.Dao) error {
	// Check if sessions collection already exists
	_, err := dao.FindCollectionByNameOrId("sessions")
	if err == nil {
		return nil // Collection already exists
	}

	sessionsCollection := &models.Collection{
		Name:       "sessions",
		Type:       models.CollectionTypeBase,
		ListRule:   types.Pointer("user = @request.auth.id"),
		ViewRule:   types.Pointer("user = @request.auth.id || public = true"),
		CreateRule: types.Pointer("user = @request.auth.id"),
		UpdateRule: types.Pointer("user = @request.auth.id"),
		DeleteRule: types.Pointer("user = @request.auth.id"),
		Schema: schema.NewSchema(
			&schema.SchemaField{
				Name:     "name",
				Type:     schema.FieldTypeText,
				Required: true,
				Options: &schema.TextOptions{
					Min:     types.Pointer(1),
					Max:     types.Pointer(50),
					Pattern: "^[a-zA-Z0-9_-]+$",
				},
			},
			&schema.SchemaField{
				Name:     "user",
				Type:     schema.FieldTypeRelation,
				Required: true,
				Options: &schema.RelationOptions{
					CollectionId:  "", // Will be set after we get the users collection
					CascadeDelete: true,
					MinSelect:     types.Pointer(1),
					MaxSelect:     types.Pointer(1),
				},
			},
			&schema.SchemaField{
				Name:     "public",
				Type:     schema.FieldTypeBool,
				Required: false,
				Options:  &schema.BoolOptions{},
			},
			&schema.SchemaField{
				Name:     "title",
				Type:     schema.FieldTypeText,
				Required: false,
				Options: &schema.TextOptions{
					Max: types.Pointer(200),
				},
			},
			&schema.SchemaField{
				Name:     "description",
				Type:     schema.FieldTypeEditor,
				Required: false,
				Options:  &schema.EditorOptions{},
			},
		),
	}

	// Get users collection to set relation
	usersCollection, err := dao.FindCollectionByNameOrId("users")
	if err != nil {
		return fmt.Errorf("users collection not found: %v", err)
	}

	// Set the relation to users collection
	userField := sessionsCollection.Schema.GetFieldByName("user")
	if userField != nil {
		if relationOptions, ok := userField.Options.(*schema.RelationOptions); ok {
			relationOptions.CollectionId = usersCollection.Id
		}
	}

	// Create indexes for performance
	sessionsCollection.Indexes = types.JsonArray[string]{
		"CREATE UNIQUE INDEX idx_sessions_user_name ON sessions (user, name)",
		"CREATE INDEX idx_sessions_user ON sessions (user)",
		"CREATE INDEX idx_sessions_public ON sessions (public)",
	}

	return dao.SaveCollection(sessionsCollection)
}

func migrateExistingSessionData(dao *daos.Dao) error {
	// Get all unique (user, session) combinations from locations
	type sessionData struct {
		User    string `db:"user"`
		Session string `db:"session"`
	}

	var existingSessions []sessionData
	err := dao.DB().NewQuery("SELECT DISTINCT user, session FROM locations WHERE session != '' AND session IS NOT NULL").All(&existingSessions)

	if err != nil {
		return fmt.Errorf("failed to query existing sessions: %v", err)
	}

	if len(existingSessions) == 0 {
		log.Println("No existing sessions to migrate")
		return nil
	}

	log.Printf("Migrating %d unique sessions", len(existingSessions))

	// Get collections
	sessionsCollection, err := dao.FindCollectionByNameOrId("sessions")
	if err != nil {
		return fmt.Errorf("sessions collection not found: %v", err)
	}

	// Create session records for each unique combination
	for _, sessionData := range existingSessions {
		// Generate a nice title from the session name
		title := generateSessionTitle(sessionData.Session)

		// Create session record
		sessionRecord := models.NewRecord(sessionsCollection)
		sessionRecord.Set("name", sessionData.Session)
		sessionRecord.Set("user", sessionData.User)
		sessionRecord.Set("public", false)
		sessionRecord.Set("title", title)
		sessionRecord.Set("description", "")

		if err := dao.SaveRecord(sessionRecord); err != nil {
			log.Printf("Warning: Failed to create session record for user %s, session %s: %v", 
				sessionData.User, sessionData.Session, err)
			// Continue with other sessions instead of failing completely
		}
	}

	return nil
}

func addSessionRelationToLocations(dao *daos.Dao) error {
	locationsCollection, err := dao.FindCollectionByNameOrId("locations")
	if err != nil {
		return fmt.Errorf("locations collection not found: %v", err)
	}

	// Check if session_id field already exists
	if locationsCollection.Schema.GetFieldByName("session_id") != nil {
		return nil // Field already exists
	}

	// Get sessions collection for relation
	sessionsCollection, err := dao.FindCollectionByNameOrId("sessions")
	if err != nil {
		return fmt.Errorf("sessions collection not found: %v", err)
	}

	// Add session_id relation field
	sessionIdField := &schema.SchemaField{
		Name:     "session_id",
		Type:     schema.FieldTypeRelation,
		Required: false, // Allow existing records without sessions
		Options: &schema.RelationOptions{
			CollectionId:  sessionsCollection.Id,
			CascadeDelete: false, // Don't delete locations when session is deleted
			MinSelect:     nil,
			MaxSelect:     types.Pointer(1),
		},
	}

	locationsCollection.Schema.AddField(sessionIdField)
	if err := dao.SaveCollection(locationsCollection); err != nil {
		return fmt.Errorf("failed to add session_id field to locations: %v", err)
	}

	// Update existing location records to reference the new sessions
	return updateLocationSessionReferences(dao)
}

func updateLocationSessionReferences(dao *daos.Dao) error {
	// Get all locations that have a session but no session_id
	locations, err := dao.FindRecordsByFilter("locations", 
		"session != '' && session != null && session_id = null", 
		"", 0, 0)

	if err != nil {
		return fmt.Errorf("failed to query locations needing session_id update: %v", err)
	}

	log.Printf("Updating %d location records with session references", len(locations))

	for _, location := range locations {
		sessionName := location.GetString("session")
		userId := location.GetString("user")

		if sessionName == "" || userId == "" {
			continue
		}

		// Find the corresponding session record
		sessionRecord, err := dao.FindFirstRecordByFilter("sessions",
			"name = {:name} && user = {:user}",
			dbx.Params{"name": sessionName, "user": userId})

		if err != nil {
			log.Printf("Warning: Could not find session record for user %s, session %s: %v",
				userId, sessionName, err)
			continue
		}

		// Update the location to reference the session
		location.Set("session_id", sessionRecord.Id)
		if err := dao.SaveRecord(location); err != nil {
			log.Printf("Warning: Failed to update location %s with session_id: %v",
				location.Id, err)
		}
	}

	return nil
}

func generateSessionTitle(sessionName string) string {
	if sessionName == "" {
		return "Untitled Session"
	}

	// Convert snake_case and kebab-case to Title Case
	words := strings.FieldsFunc(sessionName, func(c rune) bool {
		return c == '_' || c == '-'
	})

	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
		}
	}

	title := strings.Join(words, " ")
	if title == "" {
		return "Untitled Session"
	}

	return title
}