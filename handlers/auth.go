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

	"vibe-tracker/middleware"
	appmodels "vibe-tracker/models"
	"vibe-tracker/services"
	"vibe-tracker/utils"
)

type AuthHandler struct {
	app         *pocketbase.PocketBase
	authService *services.AuthService
}

func NewAuthHandler(app *pocketbase.PocketBase, authService *services.AuthService) *AuthHandler {
	return &AuthHandler{
		app:         app,
		authService: authService,
	}
}

func (h *AuthHandler) Login(c echo.Context) error {
	// Get validated data from middleware
	data := middleware.GetValidatedData(c)
	req, ok := data.(*appmodels.LoginRequest)
	if !ok {
		return apis.NewBadRequestError("Invalid request data", nil)
	}

	response, err := h.authService.Login(*req)
	if err != nil {
		return err // Let middleware handle the structured error
	}

	return utils.SendSuccess(c, http.StatusOK, response, "Login successful")
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

	userData := map[string]any{
		"token": newToken,
		"user": map[string]any{
			"id":       record.Id,
			"username": record.Username(),
			"email":    record.Email(),
			"avatar":   record.GetString("avatar"),
		},
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "Token refreshed successfully")
}

func (h *AuthHandler) GetMe(c echo.Context) error {
	// Get authenticated user from middleware context
	info, exists := GetAuthUser(c)
	if !exists {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	userData := map[string]any{
		"id":       info.Id,
		"username": info.Username(),
		"email":    info.Email(),
		"avatar":   info.GetString("avatar"),
		"token":    info.GetString("token"),
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "")
}

func (h *AuthHandler) UpdateProfile(c echo.Context) error {
	record, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
	if record == nil {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	// Get validated data from middleware
	data := middleware.GetValidatedData(c)
	req, ok := data.(*appmodels.UpdateProfileRequest)
	if !ok {
		return apis.NewBadRequestError("Invalid request data", nil)
	}

	err := h.authService.UpdateProfile(record, *req)
	if err != nil {
		return err // Let middleware handle the structured error
	}

	userData := map[string]any{
		"id":       record.Id,
		"username": record.Username(),
		"email":    record.Email(),
		"avatar":   record.GetString("avatar"),
		"token":    record.GetString("token"),
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "Profile updated successfully")
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
	userData := map[string]any{
		"id":       record.Id,
		"username": record.Username(),
		"email":    record.Email(),
		"avatar":   record.GetString("avatar"),
		"token":    record.GetString("token"),
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "Avatar updated successfully")
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

	userData := map[string]any{
		"id":       record.Id,
		"username": record.Username(),
		"email":    record.Email(),
		"avatar":   record.GetString("avatar"),
		"token":    newToken,
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "Token regenerated successfully")
}
