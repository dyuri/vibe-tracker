package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/forms"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tokens"
	"github.com/pocketbase/pocketbase/tools/security"
	
	appmodels "vibe-tracker/models"
)

type AuthHandler struct {
	app *pocketbase.PocketBase
}

func NewAuthHandler(app *pocketbase.PocketBase) *AuthHandler {
	return &AuthHandler{app: app}
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req appmodels.LoginRequest
	if err := c.Bind(&req); err != nil {
		return apis.NewBadRequestError("Invalid request data", err)
	}

	// Find user by email
	record, err := h.app.Dao().FindAuthRecordByEmail("users", req.Email)
	if err != nil {
		return apis.NewUnauthorizedError("Invalid credentials", err)
	}

	// Validate password
	if !record.ValidatePassword(req.Password) {
		return apis.NewUnauthorizedError("Invalid credentials", nil)
	}

	// Generate auth token
	token, err := tokens.NewRecordAuthToken(h.app, record)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to generate token", err)
	}

	response := appmodels.LoginResponse{
		Token: token,
		User: appmodels.User{
			ID:       record.Id,
			Username: record.Username(),
			Email:    record.Email(),
			Avatar:   record.GetString("avatar"),
		},
	}
	
	return c.JSON(http.StatusOK, response)
}

func (h *AuthHandler) RefreshToken(c echo.Context) error {
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return apis.NewUnauthorizedError("Missing or invalid token", nil)
	}

	token := authHeader[7:]

	// Verify and parse the existing token
	record, err := getAuthRecordFromToken(h.app, token)
	if err != nil {
		return apis.NewUnauthorizedError("Invalid or expired token", err)
	}

	// Generate new token
	newToken, err := tokens.NewRecordAuthToken(h.app, record)
	if err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to generate new token", err)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"token": newToken,
		"user": map[string]any{
			"id":       record.Id,
			"username": record.Username(),
			"email":    record.Email(),
			"avatar":   record.GetString("avatar"),
		},
	})
}

func (h *AuthHandler) GetMe(c echo.Context) error {
	// Get authenticated user from middleware context
	info, exists := GetAuthUser(c)
	if !exists {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"id":       info.Id,
		"username": info.Username(),
		"email":    info.Email(),
		"avatar":   info.GetString("avatar"),
		"token":    info.GetString("token"),
	})
}

func (h *AuthHandler) UpdateProfile(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	var req appmodels.UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return apis.NewBadRequestError("Invalid request data", err)
	}

	// Update username if provided
	if req.Username != "" && req.Username != record.Username() {
		record.SetUsername(req.Username)
	}

	// Update email if provided
	if req.Email != "" && req.Email != record.Email() {
		record.SetEmail(req.Email)
	}

	// Update password if provided
	if req.Password != "" {
		if req.OldPassword == "" {
			return apis.NewBadRequestError("Old password required to set new password", nil)
		}
		if !record.ValidatePassword(req.OldPassword) {
			return apis.NewBadRequestError("Invalid old password", nil)
		}
		record.SetPassword(req.Password)
	}

	if err := h.app.Dao().SaveRecord(record); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to update profile", err)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"id":       record.Id,
		"username": record.Username(),
		"email":    record.Email(),
		"avatar":   record.GetString("avatar"),
		"token":    record.GetString("token"),
	})
}

func (h *AuthHandler) UploadAvatar(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	// Use PocketBase forms to handle file upload properly
	form := forms.NewRecordUpsert(h.app, record)

	// Load the multipart form data
	if err := form.LoadRequest(c.Request(), ""); err != nil {
		return apis.NewBadRequestError("Failed to parse form data", err)
	}

	// Submit the form (this will handle file upload automatically)
	if err := form.Submit(); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to save avatar", err)
	}

	// Return updated user data
	return c.JSON(http.StatusOK, map[string]any{
		"id":       record.Id,
		"username": record.Username(),
		"email":    record.Email(),
		"avatar":   record.GetString("avatar"),
		"token":    record.GetString("token"),
	})
}

func (h *AuthHandler) RegenerateToken(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	// Generate new custom token
	newToken := security.RandomString(12)
	record.Set("token", newToken)

	if err := h.app.Dao().SaveRecord(record); err != nil {
		return apis.NewApiError(http.StatusInternalServerError, "Failed to regenerate token", err)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"id":       record.Id,
		"username": record.Username(),
		"email":    record.Email(),
		"avatar":   record.GetString("avatar"),
		"token":    newToken,
	})
}
