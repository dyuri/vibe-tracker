package utils

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
)

// Validator instance using go-playground/validator
var validate *validator.Validate

// ValidationError represents a validation error with field and message
type ValidationError struct {
	Field   string `json:"field"`
	Tag     string `json:"tag"`
	Value   string `json:"value,omitempty"`
	Message string `json:"message"`
}

// ValidationErrors represents a collection of validation errors
type ValidationErrors []ValidationError

func (ve ValidationErrors) Error() string {
	var messages []string
	for _, err := range ve {
		messages = append(messages, err.Message)
	}
	return strings.Join(messages, "; ")
}

// Initialize the validator instance
func init() {
	validate = validator.New()

	// Register custom validators
	registerCustomValidators()
}

// ValidateStruct validates a struct using validator tags
func ValidateStruct(s interface{}) error {
	err := validate.Struct(s)
	if err != nil {
		var validationErrors ValidationErrors

		for _, err := range err.(validator.ValidationErrors) {
			validationErrors = append(validationErrors, ValidationError{
				Field:   err.Field(),
				Tag:     err.Tag(),
				Value:   fmt.Sprintf("%v", err.Value()),
				Message: getErrorMessage(err),
			})
		}

		return validationErrors
	}
	return nil
}

// GetValidator returns the validator instance for custom validations
func GetValidator() *validator.Validate {
	return validate
}

// Custom error message mapping
func getErrorMessage(fe validator.FieldError) string {
	field := strings.ToLower(fe.Field())

	switch fe.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", field)
	case "email":
		return fmt.Sprintf("%s must be a valid email address", field)
	case "min":
		return fmt.Sprintf("%s must be at least %s characters long", field, fe.Param())
	case "max":
		return fmt.Sprintf("%s must be at most %s characters long", field, fe.Param())
	case "oneof":
		return fmt.Sprintf("%s must be one of: %s", field, fe.Param())
	case "latitude":
		return fmt.Sprintf("%s must be a valid latitude (-90 to 90)", field)
	case "longitude":
		return fmt.Sprintf("%s must be a valid longitude (-180 to 180)", field)
	case "positive":
		return fmt.Sprintf("%s must be a positive number", field)
	case "session_name":
		return fmt.Sprintf("%s must be a valid session name (alphanumeric, hyphens, underscores)", field)
	case "username":
		return fmt.Sprintf("%s must be a valid username (alphanumeric, hyphens, underscores)", field)
	case "gte":
		return fmt.Sprintf("%s must be greater than or equal to %s", field, fe.Param())
	case "lte":
		return fmt.Sprintf("%s must be less than or equal to %s", field, fe.Param())
	case "len":
		return fmt.Sprintf("%s must be exactly %s characters long", field, fe.Param())
	default:
		return fmt.Sprintf("%s is not valid", field)
	}
}

// Register custom validators
func registerCustomValidators() {
	// Custom latitude validator
	validate.RegisterValidation("latitude", func(fl validator.FieldLevel) bool {
		val := fl.Field().Float()
		return val >= -90 && val <= 90
	})

	// Custom longitude validator
	validate.RegisterValidation("longitude", func(fl validator.FieldLevel) bool {
		val := fl.Field().Float()
		return val >= -180 && val <= 180
	})

	// Custom positive number validator
	validate.RegisterValidation("positive", func(fl validator.FieldLevel) bool {
		val := fl.Field().Float()
		return val > 0
	})

	// Custom session name validator (alphanumeric, hyphens, underscores)
	validate.RegisterValidation("session_name", func(fl validator.FieldLevel) bool {
		val := fl.Field().String()
		if val == "" {
			return true // Let required handle empty values
		}
		return isValidSessionName(val)
	})

	// Custom username validator (alphanumeric, hyphens, underscores)
	validate.RegisterValidation("username", func(fl validator.FieldLevel) bool {
		val := fl.Field().String()
		if val == "" {
			return true // Let required handle empty values
		}
		return isValidUsername(val)
	})
}

// Helper function to validate session names
func isValidSessionName(name string) bool {
	if len(name) == 0 || len(name) > 100 {
		return false
	}

	for _, char := range name {
		if !((char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			char == '-' || char == '_') {
			return false
		}
	}
	return true
}

// Helper function to validate usernames
func isValidUsername(username string) bool {
	if len(username) < 3 || len(username) > 50 {
		return false
	}

	for _, char := range username {
		if !((char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			char == '-' || char == '_') {
			return false
		}
	}
	return true
}
