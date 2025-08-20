package handlers

import (
	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/models"
)

const (
	RequestUserContextKey = "request_user"
	UserContextKey        = "auth_user"
)

// GetRequestUser helper function to get request user from context
func GetRequestUser(c echo.Context) (*models.Record, bool) {
	user, exists := c.Get(RequestUserContextKey).(*models.Record)
	return user, exists
}

// GetAuthUser helper function to get authenticated user from context
func GetAuthUser(c echo.Context) (*models.Record, bool) {
	user, exists := c.Get(UserContextKey).(*models.Record)
	return user, exists
}