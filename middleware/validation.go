package middleware

import (
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/apis"

	"vibe-tracker/utils"
)

// ValidationMiddleware provides input validation middleware
type ValidationMiddleware struct{}

func NewValidationMiddleware() *ValidationMiddleware {
	return &ValidationMiddleware{}
}

// ValidateJSON middleware that validates and binds JSON request bodies
func (v *ValidationMiddleware) ValidateJSON(target interface{}) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if c.Request().Method != "POST" && c.Request().Method != "PUT" && c.Request().Method != "PATCH" {
				return next(c)
			}

			contentType := c.Request().Header.Get("Content-Type")
			if !strings.Contains(contentType, "application/json") {
				return apis.NewBadRequestError("Content-Type must be application/json", nil)
			}

			// Create a new instance of the target type
			targetValue := reflect.New(reflect.TypeOf(target).Elem()).Interface()

			// Read and decode the body
			body, err := io.ReadAll(c.Request().Body)
			if err != nil {
				return apis.NewBadRequestError("Failed to read request body", err)
			}

			if len(body) == 0 {
				return apis.NewBadRequestError("Request body is empty", nil)
			}

			if err := json.Unmarshal(body, targetValue); err != nil {
				return apis.NewBadRequestError("Invalid JSON format", err)
			}

			// Validate the parsed data using utils validator
			if err := utils.ValidateStruct(targetValue); err != nil {
				return apis.NewBadRequestError("Validation failed", err)
			}

			// Store the validated data in context
			c.Set("validated_data", targetValue)
			return next(c)
		}
	}
}

// ValidateRequired middleware that checks for required path parameters
func (v *ValidationMiddleware) ValidateRequired(params ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			missing := []string{}

			for _, param := range params {
				value := c.PathParam(param)
				if value == "" {
					missing = append(missing, param)
				}
			}

			if len(missing) > 0 {
				return apis.NewBadRequestError(
					fmt.Sprintf("Missing required path parameters: %s", strings.Join(missing, ", ")),
					nil,
				)
			}

			return next(c)
		}
	}
}

// Common validators
func ValidatePositiveInt(value string) error {
	if value == "0" || strings.HasPrefix(value, "-") {
		return fmt.Errorf("must be a positive integer")
	}
	return nil
}

func ValidateEmail(value string) error {
	if !strings.Contains(value, "@") || !strings.Contains(value, ".") {
		return fmt.Errorf("must be a valid email address")
	}
	return nil
}

func ValidateLength(min, max int) func(string) error {
	return func(value string) error {
		if len(value) < min {
			return fmt.Errorf("must be at least %d characters long", min)
		}
		if max > 0 && len(value) > max {
			return fmt.Errorf("must be at most %d characters long", max)
		}
		return nil
	}
}

// SanitizeInput middleware that sanitizes common input fields
func (v *ValidationMiddleware) SanitizeInput() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get the validated data from context
			data := c.Get("validated_data")
			if data != nil {
				sanitized := v.sanitizeStruct(data)
				c.Set("validated_data", sanitized)
			}

			return next(c)
		}
	}
}

// Helper function to get validated data from context
func GetValidatedData(c echo.Context) interface{} {
	return c.Get("validated_data")
}

// ValidateQueryParams validates and binds query parameters to a struct
func (v *ValidationMiddleware) ValidateQueryParams(target interface{}) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Create a new instance of the target type
			targetValue := reflect.New(reflect.TypeOf(target).Elem()).Interface()

			// Bind query parameters
			if err := c.Bind(targetValue); err != nil {
				return apis.NewBadRequestError("Failed to bind query parameters", err)
			}

			// Validate the bound data
			if err := utils.ValidateStruct(targetValue); err != nil {
				return apis.NewBadRequestError("Query parameter validation failed", err)
			}

			// Store the validated data in context
			c.Set("validated_query", targetValue)
			return next(c)
		}
	}
}

// GetValidatedQuery returns validated query parameters from context
func GetValidatedQuery(c echo.Context) interface{} {
	return c.Get("validated_query")
}

func (v *ValidationMiddleware) sanitizeStruct(data interface{}) interface{} {
	value := reflect.ValueOf(data)
	if value.Kind() == reflect.Ptr {
		elem := value.Elem()
		if elem.Kind() == reflect.Struct {
			return v.sanitizeStructFields(elem).Interface()
		}
	}
	return data
}

func (v *ValidationMiddleware) sanitizeStructFields(value reflect.Value) reflect.Value {
	typ := value.Type()
	newValue := reflect.New(typ).Elem()

	for i := 0; i < value.NumField(); i++ {
		field := value.Field(i)
		newField := newValue.Field(i)

		if field.Kind() == reflect.String && newField.CanSet() {
			// Basic sanitization - trim whitespace
			sanitized := strings.TrimSpace(field.String())
			newField.SetString(sanitized)
		} else if newField.CanSet() {
			newField.Set(field)
		}
	}

	return newValue
}
