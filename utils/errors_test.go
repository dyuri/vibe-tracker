package utils

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
)

func TestAppError_Error(t *testing.T) {
	tests := []struct {
		name     string
		appError *AppError
		expected string
	}{
		{
			name: "without internal error",
			appError: &AppError{
				Type:    ErrorTypeValidation,
				Message: "Validation failed",
			},
			expected: "validation: Validation failed",
		},
		{
			name: "with internal error",
			appError: &AppError{
				Type:    ErrorTypeInternal,
				Message: "Something went wrong",
				Internal: errors.New("database connection failed"),
			},
			expected: "internal: Something went wrong (caused by: database connection failed)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.appError.Error(); got != tt.expected {
				t.Errorf("AppError.Error() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestAppError_Unwrap(t *testing.T) {
	internalErr := errors.New("test internal error")
	appError := &AppError{
		Internal: internalErr,
	}

	if got := appError.Unwrap(); got != internalErr {
		t.Errorf("AppError.Unwrap() = %v, want %v", got, internalErr)
	}
}

func TestAppError_ToAPIError(t *testing.T) {
	appError := &AppError{
		Code:    http.StatusBadRequest,
		Message: "Test message.",
		Type:    ErrorTypeValidation,
	}

	apiError := appError.ToAPIError()

	if apiError.Code != appError.Code {
		t.Errorf("ToAPIError() Code = %v, want %v", apiError.Code, appError.Code)
	}
	if apiError.Message != appError.Message {
		t.Errorf("ToAPIError() Message = %q, want %q", apiError.Message, appError.Message)
		t.Logf("apiError.Message bytes: %v", []byte(apiError.Message))
		t.Logf("appError.Message bytes: %v", []byte(appError.Message))
	}
}

func TestNewValidationError(t *testing.T) {
	err := NewValidationError("Invalid input")
	if err.Type != ErrorTypeValidation || err.Code != http.StatusBadRequest || err.Message != "Invalid input" || err.Details != "" {
		t.Errorf("NewValidationError failed: %+v", err)
	}

	errWithDetails := NewValidationError("Invalid input", "Field X is missing")
	if errWithDetails.Details != "Field X is missing" {
		t.Errorf("NewValidationError with details failed: %+v", errWithDetails)
	}
}

func TestNewAuthenticationError(t *testing.T) {
	internalErr := errors.New("invalid credentials")
	err := NewAuthenticationError("Authentication failed", internalErr)
	if err.Type != ErrorTypeAuthentication || err.Code != http.StatusUnauthorized || err.Message != "Authentication failed" || err.Internal != internalErr {
		t.Errorf("NewAuthenticationError failed: %+v", err)
	}
}

func TestNewAuthorizationError(t *testing.T) {
	err := NewAuthorizationError("Unauthorized access", "user123")
	if err.Type != ErrorTypeAuthorization || err.Code != http.StatusForbidden || err.Message != "Unauthorized access" || err.UserID != "user123" {
		t.Errorf("NewAuthorizationError failed: %+v", err)
	}
}

func TestNewNotFoundError(t *testing.T) {
	err := NewNotFoundError("User", "456")
	if err.Type != ErrorTypeNotFound || err.Code != http.StatusNotFound || err.Message != "User not found" || err.Details != "456" {
		t.Errorf("NewNotFoundError failed: %+v", err)
	}
}

func TestNewConflictError(t *testing.T) {
	err := NewConflictError("Resource already exists", "Duplicate ID")
	if err.Type != ErrorTypeConflict || err.Code != http.StatusConflict || err.Message != "Resource already exists" || err.Details != "Duplicate ID" {
		t.Errorf("NewConflictError failed: %+v", err)
	}
}

func TestNewInternalError(t *testing.T) {
	internalErr := errors.New("db error")
	err := NewInternalError("Server error", internalErr)
	if err.Type != ErrorTypeInternal || err.Code != http.StatusInternalServerError || err.Message != "Server error" || err.Internal != internalErr {
		t.Errorf("NewInternalError failed: %+v", err)
	}
}

func TestNewExternalError(t *testing.T) {
	internalErr := errors.New("timeout")
	err := NewExternalError("PaymentGateway", internalErr)
	if err.Type != ErrorTypeExternal || err.Code != http.StatusBadGateway || err.Message != "External service PaymentGateway is unavailable" || err.Internal != internalErr {
		t.Errorf("NewExternalError failed: %+v", err)
	}
}

func TestNewRateLimitError(t *testing.T) {
	err := NewRateLimitError("Too many requests")
	if err.Type != ErrorTypeRateLimit || err.Code != http.StatusTooManyRequests || err.Message != "Too many requests" {
		t.Errorf("NewRateLimitError failed: %+v", err)
	}
}

func TestWrapError(t *testing.T) {
	// Test wrapping a standard error
	stdErr := errors.New("original error")
	wrappedErr := WrapError(stdErr, ErrorTypeInternal, "Wrapped message")
	if wrappedErr.Type != ErrorTypeInternal || wrappedErr.Code != http.StatusInternalServerError || wrappedErr.Message != "Wrapped message" || wrappedErr.Internal != stdErr {
		t.Errorf("WrapError (standard error) failed: %+v", wrappedErr)
	}

	// Test wrapping an existing AppError
	existingAppErr := NewValidationError("Existing validation error")
	reWrappedErr := WrapError(existingAppErr, ErrorTypeInternal, "Re-wrapped message")
	if reWrappedErr != existingAppErr { // Should return the same AppError instance
		t.Errorf("WrapError (existing AppError) returned new instance: %+v", reWrappedErr)
	}
	if _, ok := reWrappedErr.Context["wrapped_from"]; !ok {
		t.Errorf("WrapError (existing AppError) did not add context")
	}

	// Test different error types for status codes
	tests := []struct {
		errType    ErrorType
		statusCode int
	}{
		{ErrorTypeValidation, http.StatusBadRequest},
		{ErrorTypeAuthentication, http.StatusUnauthorized},
		{ErrorTypeAuthorization, http.StatusForbidden},
		{ErrorTypeNotFound, http.StatusNotFound},
		{ErrorTypeConflict, http.StatusConflict},
		{ErrorTypeRateLimit, http.StatusTooManyRequests},
		{ErrorTypeExternal, http.StatusBadGateway},
		{ErrorTypeInternal, http.StatusInternalServerError}, // Default case
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("WrapError with %s", tt.errType), func(t *testing.T) {
			err := WrapError(errors.New("some error"), tt.errType, "test message")
			if err.Code != tt.statusCode {
				t.Errorf("WrapError for %s: got status code %d, want %d", tt.errType, err.Code, tt.statusCode)
			}
		})
	}
}
