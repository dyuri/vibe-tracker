package middleware

import (
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strconv"
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

			// Custom binding that properly handles pointer fields for optional parameters
			if err := v.bindQueryParams(c, targetValue); err != nil {
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

// bindQueryParams custom query parameter binding that properly handles pointer fields
func (v *ValidationMiddleware) bindQueryParams(c echo.Context, target interface{}) error {
	value := reflect.ValueOf(target)
	if value.Kind() != reflect.Ptr || value.Elem().Kind() != reflect.Struct {
		return fmt.Errorf("target must be a pointer to struct")
	}

	elem := value.Elem()
	elemType := elem.Type()

	for i := 0; i < elem.NumField(); i++ {
		field := elem.Field(i)
		fieldType := elemType.Field(i)

		// Get the query tag name
		queryTag := fieldType.Tag.Get("query")
		if queryTag == "" {
			continue
		}

		// Handle comma-separated tags (e.g., "name,omitempty")
		tagParts := strings.Split(queryTag, ",")
		paramName := tagParts[0]

		// Get the query parameter value
		queryValue := c.QueryParam(paramName)

		// Skip empty values for optional fields
		if queryValue == "" {
			continue
		}

		// Set the field value based on its type
		if !field.CanSet() {
			continue
		}

		if err := v.setFieldValue(field, queryValue); err != nil {
			return fmt.Errorf("failed to set field %s: %v", fieldType.Name, err)
		}
	}

	return nil
}

// setFieldValue sets a field value from a string, handling different types including pointers
func (v *ValidationMiddleware) setFieldValue(field reflect.Value, value string) error {
	switch field.Kind() {
	case reflect.String:
		field.SetString(value)

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		intVal, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return err
		}
		field.SetInt(intVal)

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		uintVal, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return err
		}
		field.SetUint(uintVal)

	case reflect.Float32, reflect.Float64:
		floatVal, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return err
		}
		field.SetFloat(floatVal)

	case reflect.Bool:
		boolVal, err := strconv.ParseBool(value)
		if err != nil {
			return err
		}
		field.SetBool(boolVal)

	case reflect.Ptr:
		// Handle pointer fields
		if field.IsNil() {
			// Create a new instance of the pointed-to type
			field.Set(reflect.New(field.Type().Elem()))
		}

		// Recursively set the pointed-to value
		return v.setFieldValue(field.Elem(), value)

	default:
		return fmt.Errorf("unsupported field type: %v", field.Kind())
	}

	return nil
}
