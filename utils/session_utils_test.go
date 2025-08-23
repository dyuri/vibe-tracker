package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGenerateSessionTitle(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Empty string",
			input:    "",
			expected: "Untitled Session",
		},
		{
			name:     "Simple name",
			input:    "my_session",
			expected: "My Session",
		},
		{
			name:     "Name with hyphens",
			input:    "another-session",
			expected: "Another Session",
		},
		{
			name:     "Mixed separators",
			input:    "mixed_separator-name",
			expected: "Mixed Separator Name",
		},
		{
			name:     "Already title case",
			input:    "My Session",
			expected: "My Session",
		},
		{
			name:     "All caps",
			input:    "ALL_CAPS_SESSION",
			expected: "All Caps Session",
		},
		{
			name:     "Leading/trailing spaces",
			input:    "  session_name  ",
			expected: "Session Name",
		},
		{
			name:     "Multiple spaces",
			input:    "session   name",
			expected: "Session Name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := GenerateSessionTitle(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestValidateSessionName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "Valid name",
			input:    "my_session_123",
			expected: true,
		},
		{
			name:     "Valid name with hyphen",
			input:    "my-session-123",
			expected: true,
		},
		{
			name:     "Valid name with numbers",
			input:    "session123",
			expected: true,
		},
		{
			name:     "Empty string",
			input:    "",
			expected: false,
		},
		{
			name:     "Name with space",
			input:    "my session",
			expected: false,
		},
		{
			name:     "Name with special character",
			input:    "my!session",
			expected: false,
		},
		{
			name:     "Name with dot",
			input:    "my.session",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := ValidateSessionName(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestSanitizeSessionName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "No change needed",
			input:    "valid_name-123",
			expected: "valid_name-123",
		},
		{
			name:     "Invalid characters",
			input:    "name with spaces!@#$",
			expected: "name_with_spaces",
		},
		{
			name:     "Multiple underscores",
			input:    "name___with____multiple_underscores",
			expected: "name_with_multiple_underscores",
		},
		{
			name:     "Leading/trailing invalid characters",
			input:    "__name_with_invalid_chars__",
			expected: "name_with_invalid_chars",
		},
		{
			name:     "Mixed invalid characters and multiple underscores",
			input:    "!@#mixed___name$%^",
			expected: "mixed_name",
		},
		{
			name:     "Empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "Only invalid characters",
			input:    "!@#$%^&*()",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := SanitizeSessionName(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}
