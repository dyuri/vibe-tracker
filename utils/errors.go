package utils

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/pocketbase/apis"
)

// ErrorType represents different categories of errors in the application
type ErrorType string

const (
	ErrorTypeValidation     ErrorType = "validation"
	ErrorTypeAuthentication ErrorType = "authentication"
	ErrorTypeAuthorization  ErrorType = "authorization"
	ErrorTypeNotFound       ErrorType = "not_found"
	ErrorTypeConflict       ErrorType = "conflict"
	ErrorTypeInternal       ErrorType = "internal"
	ErrorTypeExternal       ErrorType = "external"
	ErrorTypeRateLimit      ErrorType = "rate_limit"
)

// AppError represents a structured application error
type AppError struct {
	Type      ErrorType              `json:"type"`
	Code      int                    `json:"code"`
	Message   string                 `json:"message"`
	Details   string                 `json:"details,omitempty"`
	Internal  error                  `json:"-"` // Internal error, not exposed to API
	RequestID string                 `json:"request_id,omitempty"`
	UserID    string                 `json:"user_id,omitempty"`
	Context   map[string]interface{} `json:"context,omitempty"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Internal != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Type, e.Message, e.Internal)
	}
	return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

// Unwrap returns the internal error for error wrapping
func (e *AppError) Unwrap() error {
	return e.Internal
}

// ToAPIError converts AppError to PocketBase ApiError
func (e *AppError) ToAPIError() *apis.ApiError {
	return apis.NewApiError(e.Code, e.Message, e)
}

// NewValidationError creates a validation error
func NewValidationError(message string, details ...string) *AppError {
	err := &AppError{
		Type:    ErrorTypeValidation,
		Code:    http.StatusBadRequest,
		Message: message,
	}
	if len(details) > 0 {
		err.Details = details[0]
	}
	return err
}

// NewAuthenticationError creates an authentication error
func NewAuthenticationError(message string, internal error) *AppError {
	return &AppError{
		Type:     ErrorTypeAuthentication,
		Code:     http.StatusUnauthorized,
		Message:  message,
		Internal: internal,
	}
}

// NewAuthorizationError creates an authorization error
func NewAuthorizationError(message string, userID string) *AppError {
	return &AppError{
		Type:    ErrorTypeAuthorization,
		Code:    http.StatusForbidden,
		Message: message,
		UserID:  userID,
	}
}

// NewNotFoundError creates a not found error
func NewNotFoundError(resource string, identifier string) *AppError {
	return &AppError{
		Type:    ErrorTypeNotFound,
		Code:    http.StatusNotFound,
		Message: fmt.Sprintf("%s not found", resource),
		Details: identifier,
	}
}

// NewConflictError creates a conflict error
func NewConflictError(message string, details string) *AppError {
	return &AppError{
		Type:    ErrorTypeConflict,
		Code:    http.StatusConflict,
		Message: message,
		Details: details,
	}
}

// NewInternalError creates an internal server error
func NewInternalError(message string, internal error) *AppError {
	return &AppError{
		Type:     ErrorTypeInternal,
		Code:     http.StatusInternalServerError,
		Message:  message,
		Internal: internal,
	}
}

// NewExternalError creates an external service error
func NewExternalError(service string, internal error) *AppError {
	return &AppError{
		Type:     ErrorTypeExternal,
		Code:     http.StatusBadGateway,
		Message:  fmt.Sprintf("External service %s is unavailable", service),
		Internal: internal,
	}
}

// NewRateLimitError creates a rate limit error
func NewRateLimitError(message string) *AppError {
	return &AppError{
		Type:    ErrorTypeRateLimit,
		Code:    http.StatusTooManyRequests,
		Message: message,
	}
}

// WrapError wraps an existing error with context
func WrapError(err error, errorType ErrorType, message string) *AppError {
	if appErr, ok := err.(*AppError); ok {
		// Already an AppError, just add context
		appErr.Context = map[string]interface{}{
			"wrapped_from": message,
		}
		return appErr
	}

	code := http.StatusInternalServerError
	switch errorType {
	case ErrorTypeValidation:
		code = http.StatusBadRequest
	case ErrorTypeAuthentication:
		code = http.StatusUnauthorized
	case ErrorTypeAuthorization:
		code = http.StatusForbidden
	case ErrorTypeNotFound:
		code = http.StatusNotFound
	case ErrorTypeConflict:
		code = http.StatusConflict
	case ErrorTypeRateLimit:
		code = http.StatusTooManyRequests
	case ErrorTypeExternal:
		code = http.StatusBadGateway
	}

	return &AppError{
		Type:     errorType,
		Code:     code,
		Message:  message,
		Internal: err,
	}
}

// LogAndWrapError logs an error and wraps it
func LogAndWrapError(err error, errorType ErrorType, message string, userID ...string) *AppError {
	appErr := WrapError(err, errorType, message)

	if len(userID) > 0 {
		appErr.UserID = userID[0]
	}

	// Log the error with context
	logEvent := LogError(err, message).
		Str("error_type", string(errorType)).
		Int("status_code", appErr.Code)

	if appErr.UserID != "" {
		logEvent = logEvent.Str("user_id", appErr.UserID)
	}

	if appErr.Details != "" {
		logEvent = logEvent.Str("details", appErr.Details)
	}

	logEvent.Msg("Application error occurred")

	return appErr
}
