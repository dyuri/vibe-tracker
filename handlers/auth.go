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

// Login handles user authentication
//
//	@Summary		User login
//	@Description	Authenticate user with email and password
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			request	body		models.LoginRequest		true	"Login credentials"
//	@Success		200		{object}	models.SuccessResponse	"Login successful"
//	@Failure		400		{object}	models.ErrorResponse		"Invalid request"
//	@Failure		401		{object}	models.ErrorResponse		"Invalid credentials"
//	@Router			/login [post]
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

// RefreshToken refreshes an expired JWT token
//
//	@Summary		Refresh JWT token
//	@Description	Refresh an expired JWT token using refresh token
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			request	body		models.RefreshTokenRequest	true	"Refresh token request"
//	@Success		200		{object}	models.SuccessResponse		"Token refreshed successfully"
//	@Failure		400		{object}	models.ErrorResponse			"Invalid request"
//	@Failure		401		{object}	models.ErrorResponse			"Invalid refresh token"
//	@Router			/auth/refresh [post]
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
			"id":                     record.Id,
			"username":               record.Username(),
			"email":                  record.Email(),
			"avatar":                 record.GetString("avatar"),
			"default_session_public": record.GetBool("default_session_public"),
		},
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "Token refreshed successfully")
}

// GetMe returns the current authenticated user's profile
//
//	@Summary		Get current user profile
//	@Description	Returns the authenticated user's profile information
//	@Tags			Authentication
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	models.SuccessResponse	"User profile retrieved successfully"
//	@Failure		401	{object}	models.ErrorResponse		"Authentication required"
//	@Router			/me [get]
func (h *AuthHandler) GetMe(c echo.Context) error {
	// Get authenticated user from middleware context
	info, exists := GetAuthUser(c)
	if !exists {
		return apis.NewUnauthorizedError("Authentication required", nil)
	}

	userData := map[string]any{
		"id":                     info.Id,
		"username":               info.Username(),
		"email":                  info.Email(),
		"avatar":                 info.GetString("avatar"),
		"token":                  info.GetString("token"),
		"default_session_public": info.GetBool("default_session_public"),
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "")
}

// UpdateProfile updates the current user's profile
//
//	@Summary		Update user profile
//	@Description	Updates the authenticated user's profile information
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			request	body		models.UpdateProfileRequest	true	"Profile update data"
//	@Success		200		{object}	models.SuccessResponse		"Profile updated successfully"
//	@Failure		400		{object}	models.ErrorResponse			"Invalid request"
//	@Failure		401		{object}	models.ErrorResponse			"Authentication required"
//	@Router			/profile [put]
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
		"id":                     record.Id,
		"username":               record.Username(),
		"email":                  record.Email(),
		"avatar":                 record.GetString("avatar"),
		"token":                  record.GetString("token"),
		"default_session_public": record.GetBool("default_session_public"),
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "Profile updated successfully")
}

// UploadAvatar uploads a new avatar for the current user
//
//	@Summary		Upload user avatar
//	@Description	Uploads a new avatar image for the authenticated user
//	@Tags			Authentication
//	@Accept			multipart/form-data
//	@Produce		json
//	@Security		BearerAuth
//	@Param			avatar	formData	file					true	"Avatar image file"
//	@Success		200		{object}	models.SuccessResponse	"Avatar uploaded successfully"
//	@Failure		400		{object}	models.ErrorResponse		"Invalid file or request"
//	@Failure		401		{object}	models.ErrorResponse		"Authentication required"
//	@Router			/profile/avatar [post]
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
		"id":                     record.Id,
		"username":               record.Username(),
		"email":                  record.Email(),
		"avatar":                 record.GetString("avatar"),
		"token":                  record.GetString("token"),
		"default_session_public": record.GetBool("default_session_public"),
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "Avatar updated successfully")
}

// RegenerateToken generates a new custom token for the user
//
//	@Summary		Regenerate custom token
//	@Description	Generates a new custom token for location tracking
//	@Tags			Authentication
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	models.SuccessResponse	"Token regenerated successfully"
//	@Failure		401	{object}	models.ErrorResponse		"Authentication required"
//	@Failure		500	{object}	models.ErrorResponse		"Internal server error"
//	@Router			/profile/regenerate-token [put]
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
		"id":                     record.Id,
		"username":               record.Username(),
		"email":                  record.Email(),
		"avatar":                 record.GetString("avatar"),
		"token":                  newToken,
		"default_session_public": record.GetBool("default_session_public"),
	}

	return utils.SendSuccess(c, http.StatusOK, userData, "Token regenerated successfully")
}
