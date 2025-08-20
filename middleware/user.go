package middleware

import (
	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/dbx"
)

const (
	RequestUserContextKey = "request_user"
)

// UserMiddleware provides user lookup middleware functions
type UserMiddleware struct {
	app *pocketbase.PocketBase
}

func NewUserMiddleware(app *pocketbase.PocketBase) *UserMiddleware {
	return &UserMiddleware{app: app}
}

// LoadUserFromPath middleware that loads user from :username path parameter
func (m *UserMiddleware) LoadUserFromPath() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			username := c.PathParam("username")
			if username == "" {
				return apis.NewBadRequestError("Username parameter is required", nil)
			}

			user, err := m.findUserByUsername(username)
			if err != nil {
				return apis.NewNotFoundError("User not found", err)
			}

			c.Set(RequestUserContextKey, user)
			return next(c)
		}
	}
}

// RequireUserOwnership middleware that ensures authenticated user matches the requested user
func (m *UserMiddleware) RequireUserOwnership() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get authenticated user
			authUser, exists := GetAuthUser(c)
			if !exists {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			// Get requested user from path
			username := c.PathParam("username")
			if username == "" {
				return apis.NewBadRequestError("Username parameter is required", nil)
			}

			// Check if authenticated user matches requested user
			if authUser.Username() != username {
				return apis.NewForbiddenError("Cannot access another user's resources", nil)
			}

			// Also set the user in request context for convenience
			c.Set(RequestUserContextKey, authUser)
			return next(c)
		}
	}
}

// LoadUserFromPathOptional middleware that optionally loads user from :username path parameter
func (m *UserMiddleware) LoadUserFromPathOptional() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			username := c.PathParam("username")
			if username != "" {
				user, _ := m.findUserByUsername(username)
				if user != nil {
					c.Set(RequestUserContextKey, user)
				}
			}
			return next(c)
		}
	}
}

// Helper function to get request user from context
func GetRequestUser(c echo.Context) (*models.Record, bool) {
	user, exists := c.Get(RequestUserContextKey).(*models.Record)
	return user, exists
}

// Private helper method
func (m *UserMiddleware) findUserByUsername(username string) (*models.Record, error) {
	if username == "" {
		return nil, apis.NewBadRequestError("Username is required", nil)
	}
	return m.app.Dao().FindFirstRecordByFilter("users", "username = {:username}", dbx.Params{"username": username})
}