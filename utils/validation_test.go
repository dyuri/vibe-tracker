package utils

import (
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
)

// Test structs for validation
type TestStruct struct {
	RequiredField    string  `validate:"required"`
	EmailField       string  `validate:"email"`
	MinLenField      string  `validate:"min=5"`
	MaxLenField      string  `validate:"max=10"`
	OneOfField       string  `validate:"oneof=value1 value2"`
	LatitudeField    float64 `validate:"latitude"`
	LongitudeField   float64 `validate:"longitude"`
	PositiveField    float64 `validate:"positive"`
	SessionNameField string  `validate:"session_name"`
	UsernameField    string  `validate:"username"`
	GteField         int     `validate:"gte=10"`
	LteField         int     `validate:"lte=20"`
	LenField         string  `validate:"len=7"`
}

func TestValidationErrors_Error(t *testing.T) {
	errors := ValidationErrors{
		{Field: "Field1", Message: "Field1 is invalid"},
		{Field: "Field2", Message: "Field2 is missing"},
	}
	expected := "Field1 is invalid; Field2 is missing"
	assert.Equal(t, expected, errors.Error())
}

func TestValidateStruct_Success(t *testing.T) {
	s := TestStruct{
		RequiredField:    "present",
		EmailField:       "test@example.com",
		MinLenField:      "minimum",
		MaxLenField:      "maximum",
		OneOfField:       "value1",
		LatitudeField:    45.0,
		LongitudeField:   90.0,
		PositiveField:    1.0,
		SessionNameField: "valid_session-name",
		UsernameField:    "valid_username",
		GteField:         10,
		LteField:         20,
		LenField:         "exactly",
	}

	err := ValidateStruct(s)
	assert.Nil(t, err)
}

func TestValidateStruct_Failure(t *testing.T) {
	s := TestStruct{
		RequiredField:    "",                // Fails required
		EmailField:       "invalid-email",   // Fails email
		MinLenField:      "min",             // Fails min
		MaxLenField:      "too_long_string", // Fails max
		OneOfField:       "invalid_value",   // Fails oneof
		LatitudeField:    91.0,              // Fails latitude
		LongitudeField:   -181.0,            // Fails longitude
		PositiveField:    -1.0,              // Fails positive
		SessionNameField: "invalid!session", // Fails session_name
		UsernameField:    "us",              // Fails username (min length)
		GteField:         9,                 // Fails gte
		LteField:         21,                // Fails lte
		LenField:         "short",           // Fails len
	}

	err := ValidateStruct(s)
	assert.NotNil(t, err)

	validationErrors, ok := err.(ValidationErrors)
	assert.True(t, ok)
	assert.Len(t, validationErrors, 13)

	// Check specific error messages (order might vary, so check by field)
	assert.Contains(t, validationErrors, ValidationError{Field: "RequiredField", Tag: "required", Value: "", Message: "requiredfield is required"})
	assert.Contains(t, validationErrors, ValidationError{Field: "EmailField", Tag: "email", Value: "invalid-email", Message: "emailfield must be a valid email address"})
	assert.Contains(t, validationErrors, ValidationError{Field: "MinLenField", Tag: "min", Value: "min", Message: "minlenfield must be at least 5 characters long"})
	assert.Contains(t, validationErrors, ValidationError{Field: "MaxLenField", Tag: "max", Value: "too_long_string", Message: "maxlenfield must be at most 10 characters long"})
	assert.Contains(t, validationErrors, ValidationError{Field: "OneOfField", Tag: "oneof", Value: "invalid_value", Message: "oneoffield must be one of: value1 value2"})
	assert.Contains(t, validationErrors, ValidationError{Field: "LatitudeField", Tag: "latitude", Value: "91", Message: "latitudefield must be a valid latitude (-90 to 90)"})
	assert.Contains(t, validationErrors, ValidationError{Field: "LongitudeField", Tag: "longitude", Value: "-181", Message: "longitudefield must be a valid longitude (-180 to 180)"})
	assert.Contains(t, validationErrors, ValidationError{Field: "PositiveField", Tag: "positive", Value: "-1", Message: "positivefield must be a positive number"})
	assert.Contains(t, validationErrors, ValidationError{Field: "SessionNameField", Tag: "session_name", Value: "invalid!session", Message: "sessionnamefield must be a valid session name (alphanumeric, hyphens, underscores)"})
	assert.Contains(t, validationErrors, ValidationError{Field: "UsernameField", Tag: "username", Value: "us", Message: "usernamefield must be a valid username (alphanumeric, hyphens, underscores)"})
	assert.Contains(t, validationErrors, ValidationError{Field: "GteField", Tag: "gte", Value: "9", Message: "gtefield must be greater than or equal to 10"})
	assert.Contains(t, validationErrors, ValidationError{Field: "LteField", Tag: "lte", Value: "21", Message: "ltefield must be less than or equal to 20"})
	assert.Contains(t, validationErrors, ValidationError{Field: "LenField", Tag: "len", Value: "short", Message: "lenfield must be exactly 7 characters long"})
}

func TestGetValidator(t *testing.T) {
	v := GetValidator()
	assert.NotNil(t, v)
}

// Mock FieldError for testing
type MockFieldError struct {
	validator.FieldError
	field string
	tag   string
	param string
	value interface{}
}

func (m MockFieldError) Field() string      { return m.field }
func (m MockFieldError) Tag() string        { return m.tag }
func (m MockFieldError) Param() string      { return m.param }
func (m MockFieldError) Value() interface{} { return m.value }

func TestGetErrorMessage(t *testing.T) {
	tests := []struct {
		name     string
		fe       validator.FieldError
		expected string
	}{
		{
			name:     "Required tag",
			fe:       MockFieldError{field: "Name", tag: "required"},
			expected: "name is required",
		},
		{
			name:     "Email tag",
			fe:       MockFieldError{field: "Email", tag: "email"},
			expected: "email must be a valid email address",
		},
		{
			name:     "Min tag",
			fe:       MockFieldError{field: "Password", tag: "min", param: "8"},
			expected: "password must be at least 8 characters long",
		},
		{
			name:     "Max tag",
			fe:       MockFieldError{field: "Description", tag: "max", param: "200"},
			expected: "description must be at most 200 characters long",
		},
		{
			name:     "Oneof tag",
			fe:       MockFieldError{field: "Status", tag: "oneof", param: "active inactive"},
			expected: "status must be one of: active inactive",
		},
		{
			name:     "Latitude tag",
			fe:       MockFieldError{field: "Lat", tag: "latitude"},
			expected: "lat must be a valid latitude (-90 to 90)",
		},
		{
			name:     "Longitude tag",
			fe:       MockFieldError{field: "Lon", tag: "longitude"},
			expected: "lon must be a valid longitude (-180 to 180)",
		},
		{
			name:     "Positive tag",
			fe:       MockFieldError{field: "Amount", tag: "positive"},
			expected: "amount must be a positive number",
		},
		{
			name:     "Session_name tag",
			fe:       MockFieldError{field: "SName", tag: "session_name"},
			expected: "sname must be a valid session name (alphanumeric, hyphens, underscores)",
		},
		{
			name:     "Username tag",
			fe:       MockFieldError{field: "UName", tag: "username"},
			expected: "uname must be a valid username (alphanumeric, hyphens, underscores)",
		},
		{
			name:     "Gte tag",
			fe:       MockFieldError{field: "Age", tag: "gte", param: "18"},
			expected: "age must be greater than or equal to 18",
		},
		{
			name:     "Lte tag",
			fe:       MockFieldError{field: "Score", tag: "lte", param: "100"},
			expected: "score must be less than or equal to 100",
		},
		{
			name:     "Len tag",
			fe:       MockFieldError{field: "Code", tag: "len", param: "6"},
			expected: "code must be exactly 6 characters long",
		},
		{
			name:     "Default tag",
			fe:       MockFieldError{field: "Unknown", tag: "unknown_tag"},
			expected: "unknown is not valid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := getErrorMessage(tt.fe)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestIsValidSessionName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "Valid name",
			input:    "my_session-123",
			expected: true,
		},
		{
			name:     "Empty string",
			input:    "",
			expected: false,
		},
		{
			name:     "Too long",
			input:    "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1", // 101 chars
			expected: false,
		},
		{
			name:     "Contains space",
			input:    "my session",
			expected: false,
		},
		{
			name:     "Contains special char",
			input:    "my!session",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := isValidSessionName(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestIsValidUsername(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "Valid username",
			input:    "user_name-123",
			expected: true,
		},
		{
			name:     "Too short",
			input:    "us",
			expected: false,
		},
		{
			name:     "Too long",
			input:    "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1", // 51 chars
			expected: false,
		},
		{
			name:     "Contains space",
			input:    "user name",
			expected: false,
		},
		{
			name:     "Contains special char",
			input:    "user!name",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := isValidUsername(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}
