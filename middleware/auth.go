package middleware

import (
	"errors"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/models"
)

const (
	UserContextKey = "auth_user"
)

// AuthMiddleware provides authentication middleware functions
type AuthMiddleware struct {
	app *pocketbase.PocketBase
}

func NewAuthMiddleware(app *pocketbase.PocketBase) *AuthMiddleware {
	return &AuthMiddleware{app: app}
}

// RequireJWTAuth middleware that requires valid JWT authentication
func (m *AuthMiddleware) RequireJWTAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				return apis.NewUnauthorizedError("Missing or invalid authorization header", nil)
			}

			token := authHeader[7:]
			record, err := m.getAuthRecordFromToken(token)
			if err != nil {
				return apis.NewUnauthorizedError("Invalid or expired token", err)
			}

			// Set the authenticated user in context for PocketBase compatibility
			c.Set(apis.ContextAuthRecordKey, record)
			c.Set(UserContextKey, record)

			return next(c)
		}
	}
}

// RequireCustomTokenAuth middleware that requires valid custom token authentication
func (m *AuthMiddleware) RequireCustomTokenAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Try query parameter first, then header
			token := c.QueryParam("token")
			if token == "" {
				authHeader := c.Request().Header.Get("Authorization")
				if authHeader != "" && !strings.HasPrefix(authHeader, "Bearer ") {
					token = authHeader
				}
			}

			if token == "" {
				return apis.NewUnauthorizedError("Authentication token required", nil)
			}

			record, err := m.findUserByToken(token)
			if err != nil {
				return apis.NewUnauthorizedError("Invalid authentication token", err)
			}

			c.Set(UserContextKey, record)
			return next(c)
		}
	}
}

// RequireFlexibleAuth middleware that accepts either JWT or custom token
func (m *AuthMiddleware) RequireFlexibleAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			var record *models.Record
			var err error

			// Try JWT first (Authorization: Bearer <jwt>)
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				token := authHeader[7:]

				// Try to get the auth record from context first (if already processed by PocketBase middleware)
				if info := c.Get(apis.ContextAuthRecordKey); info != nil {
					if r, ok := info.(*models.Record); ok {
						record = r
					}
				}

				// If not available via context, try token verification
				if record == nil {
					record, err = m.getAuthRecordFromToken(token)
					if err == nil {
						c.Set(apis.ContextAuthRecordKey, record)
					}
				}
			}

			// If JWT failed, try custom token
			if record == nil {
				customToken := c.QueryParam("token")
				if customToken == "" && !strings.HasPrefix(authHeader, "Bearer ") {
					customToken = authHeader
				}

				if customToken != "" {
					record, err = m.findUserByToken(customToken)
				}
			}

			if record == nil {
				return apis.NewUnauthorizedError("Valid authentication required", err)
			}

			c.Set(UserContextKey, record)
			return next(c)
		}
	}
}

// OptionalAuth middleware that optionally extracts user if authenticated
func (m *AuthMiddleware) OptionalAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			var record *models.Record

			// Try JWT first
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				token := authHeader[7:]
				record, _ = m.getAuthRecordFromToken(token)
			}

			// Try custom token
			if record == nil {
				customToken := c.QueryParam("token")
				if customToken == "" && authHeader != "" && !strings.HasPrefix(authHeader, "Bearer ") {
					customToken = authHeader
				}
				if customToken != "" {
					record, _ = m.findUserByToken(customToken)
				}
			}

			if record != nil {
				c.Set(apis.ContextAuthRecordKey, record)
				c.Set(UserContextKey, record)
			}

			return next(c)
		}
	}
}

// Helper function to get authenticated user from context
func GetAuthUser(c echo.Context) (*models.Record, bool) {
	user, exists := c.Get(UserContextKey).(*models.Record)
	return user, exists
}

// Private helper methods
func (m *AuthMiddleware) getAuthRecordFromToken(token string) (*models.Record, error) {
	// Use PocketBase's built-in record authentication token parsing
	record, err := m.app.Dao().FindAuthRecordByToken(token, m.app.Settings().RecordAuthToken.Secret)
	if err != nil {
		return nil, err
	}

	return record, nil
}

func (m *AuthMiddleware) findUserByToken(token string) (*models.Record, error) {
	if token == "" {
		return nil, errors.New("token is missing")
	}

	// Remove the "Bearer " prefix if present
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	return m.app.Dao().FindFirstRecordByFilter("users", "token = {:token}", dbx.Params{"token": token})
}
