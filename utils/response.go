package utils

import (
	"github.com/labstack/echo/v5"
	"vibe-tracker/models"
)

// BuildSuccess creates a standardized success response
func BuildSuccess(data interface{}, message string) models.SuccessResponse {
	return models.SuccessResponse{
		Status:  "success",
		Message: message,
		Data:    data,
	}
}

// BuildError creates a standardized error response
func BuildError(code int, message string, details string) models.ErrorResponse {
	return models.ErrorResponse{
		Code:    code,
		Message: message,
		Details: details,
	}
}

// BuildPaginated creates a standardized paginated response
func BuildPaginated(data interface{}, pagination models.PaginationMeta, message string) models.SuccessResponse {
	paginatedData := models.PaginatedResponse{
		Data:       data,
		Pagination: pagination,
	}

	return models.SuccessResponse{
		Status:  "success",
		Message: message,
		Data:    paginatedData,
	}
}

// BuildGeoJSON creates a standardized GeoJSON response wrapped in success format
func BuildGeoJSON(data interface{}, message string) models.SuccessResponse {
	return models.SuccessResponse{
		Status:  "success",
		Message: message,
		Data:    data,
	}
}

// SendSuccess sends a standardized success response
func SendSuccess(c echo.Context, statusCode int, data interface{}, message string) error {
	response := BuildSuccess(data, message)
	return c.JSON(statusCode, response)
}

// SendError sends a standardized error response
func SendError(c echo.Context, statusCode int, message string, details string) error {
	response := BuildError(statusCode, message, details)
	return c.JSON(statusCode, response)
}

// SendPaginated sends a standardized paginated response
func SendPaginated(c echo.Context, statusCode int, data interface{}, pagination models.PaginationMeta, message string) error {
	response := BuildPaginated(data, pagination, message)
	return c.JSON(statusCode, response)
}

// SendGeoJSON sends a standardized GeoJSON response
func SendGeoJSON(c echo.Context, statusCode int, data interface{}, message string) error {
	response := BuildGeoJSON(data, message)
	return c.JSON(statusCode, response)
}
