package handlers

import (
	"errors"
	"fmt"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/daos"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tools/security"

	"vibe-tracker/utils"
)

func getAuthRecordFromToken(app *pocketbase.PocketBase, token string) (*models.Record, error) {
	// Parse and verify the JWT token using PocketBase's method
	claims, err := security.ParseJWT(token, app.Settings().RecordAuthToken.Secret)
	if err != nil {
		return nil, err
	}

	// Get the record ID from claims
	recordId, ok := claims["id"].(string)
	if !ok {
		return nil, errors.New("invalid token: missing record id")
	}

	// Get the collection ID from claims
	collectionId, ok := claims["collectionId"].(string)
	if !ok {
		return nil, errors.New("invalid token: missing collection id")
	}

	// Find and return the record
	record, err := app.Dao().FindRecordById(collectionId, recordId)
	if err != nil {
		return nil, err
	}

	return record, nil
}

func findUserByUsername(dao *daos.Dao, username string) (*models.Record, error) {
	if username == "" {
		return nil, errors.New("username is missing")
	}
	return dao.FindFirstRecordByFilter("users", "username = {:username}", dbx.Params{"username": username})
}

func findSessionByNameAndUser(dao *daos.Dao, sessionName string, userId string) (*models.Record, error) {
	if sessionName == "" || userId == "" {
		return nil, errors.New("session name or user ID is missing")
	}
	return dao.FindFirstRecordByFilter("sessions", "name = {:name} && user = {:user}",
		dbx.Params{"name": sessionName, "user": userId})
}

func findOrCreateSession(dao *daos.Dao, sessionName string, user *models.Record) (*models.Record, error) {
	if sessionName == "" {
		return nil, nil // No session requested
	}

	// Try to find existing session
	session, err := findSessionByNameAndUser(dao, sessionName, user.Id)
	if err == nil {
		return session, nil // Found existing session
	}

	// Create new session
	sessionsCollection, err := dao.FindCollectionByNameOrId("sessions")
	if err != nil {
		return nil, fmt.Errorf("sessions collection not found: %v", err)
	}

	session = models.NewRecord(sessionsCollection)
	session.Set("name", sessionName)
	session.Set("user", user.Id)
	session.Set("public", false)

	// Generate a nice title from the session name
	title := GenerateSessionTitle(sessionName)
	session.Set("title", title)
	session.Set("description", "")

	if err := dao.SaveRecord(session); err != nil {
		return nil, fmt.Errorf("failed to create session: %v", err)
	}

	return session, nil
}

// GenerateSessionTitle is deprecated, use utils.GenerateSessionTitle instead
func GenerateSessionTitle(sessionName string) string {
	return utils.GenerateSessionTitle(sessionName)
}
