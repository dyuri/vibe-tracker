package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
)

// Test utility functions from main.go
func TestGenerateSessionTitle(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"morning_run", "Morning Run"},
		{"evening-cycle", "Evening Cycle"},
		{"weekend_hike_2024", "Weekend Hike 2024"},
		{"", "Untitled Session"},
		{"single", "Single"},
		{"snake_case_session", "Snake Case Session"},
		{"kebab-case-session", "Kebab Case Session"},
		{"MixedCase", "Mixedcase"},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("Input: %s", test.input), func(t *testing.T) {
			result := generateSessionTitle(test.input)
			if result != test.expected {
				t.Errorf("Expected '%s', got '%s'", test.expected, result)
			}
		})
	}
}

// Mock handler functions for testing API structure
func setupMockRouter() *echo.Echo {
	e := echo.New()

	// Location endpoints
	e.GET("/api/location/:username", func(c echo.Context) error {
		username := c.PathParam("username")
		if username == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Username required")
		}
		if username == "nonexistent" {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"type": "Feature",
			"geometry": map[string]interface{}{
				"type":        "Point",
				"coordinates": []float64{-122.3321, 47.6062, 100.0},
			},
			"properties": map[string]interface{}{
				"username":      username,
				"timestamp":     time.Now().Unix(),
				"speed":         5.5,
				"heart_rate":    120.0,
				"session":       "test-session",
				"session_title": "Test Session",
			},
		})
	})

	e.GET("/api/public-locations", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"type":     "FeatureCollection",
			"features": []interface{}{},
		})
	})

	// Session endpoints
	e.GET("/api/sessions/:username", func(c echo.Context) error {
		username := c.PathParam("username")
		if username == "nonexistent" {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"sessions":   []interface{}{},
			"page":       1,
			"perPage":    20,
			"totalItems": 0,
			"totalPages": 0,
		})
	})

	e.POST("/api/sessions", func(c echo.Context) error {
		var data struct {
			Name        string `json:"name"`
			Title       string `json:"title"`
			Description string `json:"description"`
			Public      bool   `json:"public"`
		}

		if err := c.Bind(&data); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid request data")
		}

		if data.Name == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Session name is required")
		}

		return c.JSON(http.StatusCreated, map[string]interface{}{
			"id":          "mock-session-id",
			"name":        data.Name,
			"title":       data.Title,
			"description": data.Description,
			"public":      data.Public,
			"created":     time.Now().Format(time.RFC3339),
			"updated":     time.Now().Format(time.RFC3339),
		})
	})

	// Authentication endpoints
	e.POST("/api/login", func(c echo.Context) error {
		var data struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}

		if err := c.Bind(&data); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid request data")
		}

		if data.Email != "test@example.com" || data.Password != "testpass123" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"token": "mock-jwt-token",
			"user": map[string]interface{}{
				"id":       "mock-user-id",
				"username": "testuser",
				"email":    "test@example.com",
			},
		})
	})

	// Tracking endpoints
	e.GET("/api/track", func(c echo.Context) error {
		token := c.QueryParam("token")
		if token == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Token required")
		}
		if token != "test-custom-token" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"status": "success",
		})
	})

	e.POST("/api/track", func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" || authHeader != "Bearer mock-jwt-token" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid authorization")
		}

		var data map[string]interface{}
		if err := c.Bind(&data); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Failed to parse request data")
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"status": "success",
		})
	})

	return e
}

// Helper function to make HTTP requests
func makeTestRequest(method, path string, body interface{}, headers map[string]string) (*httptest.ResponseRecorder, error) {
	var reqBody *bytes.Buffer

	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	router := setupMockRouter()
	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	return w, nil
}

// Location endpoint tests
func TestGetLocationByUsername(t *testing.T) {
	t.Run("Valid user", func(t *testing.T) {
		w, err := makeTestRequest("GET", "/api/location/testuser", nil, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if response["type"] != "Feature" {
			t.Errorf("Expected type 'Feature', got %v", response["type"])
		}

		properties, ok := response["properties"].(map[string]interface{})
		if !ok {
			t.Fatalf("Properties field is not a map")
		}

		if properties["username"] != "testuser" {
			t.Errorf("Expected username 'testuser', got %v", properties["username"])
		}
	})

	t.Run("Invalid user", func(t *testing.T) {
		w, err := makeTestRequest("GET", "/api/location/nonexistent", nil, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
		}
	})
}

func TestGetPublicLocations(t *testing.T) {
	w, err := makeTestRequest("GET", "/api/public-locations", nil, nil)
	if err != nil {
		t.Fatalf("Failed to make request: %v", err)
	}

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["type"] != "FeatureCollection" {
		t.Errorf("Expected type 'FeatureCollection', got %v", response["type"])
	}

	if _, ok := response["features"]; !ok {
		t.Error("Response missing features field")
	}
}

// Session endpoint tests
func TestGetUserSessions(t *testing.T) {
	t.Run("Valid user", func(t *testing.T) {
		w, err := makeTestRequest("GET", "/api/sessions/testuser", nil, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		// Check required fields
		fields := []string{"sessions", "page", "perPage", "totalItems", "totalPages"}
		for _, field := range fields {
			if _, ok := response[field]; !ok {
				t.Errorf("Response missing %s field", field)
			}
		}
	})

	t.Run("Invalid user", func(t *testing.T) {
		w, err := makeTestRequest("GET", "/api/sessions/nonexistent", nil, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
		}
	})
}

func TestCreateSession(t *testing.T) {
	t.Run("Valid session data", func(t *testing.T) {
		sessionData := map[string]interface{}{
			"name":        "test-session",
			"title":       "Test Session",
			"description": "A test session",
			"public":      true,
		}

		w, err := makeTestRequest("POST", "/api/sessions", sessionData, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status %d, got %d", http.StatusCreated, w.Code)
		}

		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		// Check response fields
		expectedFields := map[string]interface{}{
			"name":        "test-session",
			"title":       "Test Session",
			"description": "A test session",
			"public":      true,
		}

		for field, expected := range expectedFields {
			if response[field] != expected {
				t.Errorf("Expected %s to be %v, got %v", field, expected, response[field])
			}
		}
	})

	t.Run("Missing session name", func(t *testing.T) {
		sessionData := map[string]interface{}{
			"title":       "Test Session",
			"description": "A test session",
			"public":      true,
		}

		w, err := makeTestRequest("POST", "/api/sessions", sessionData, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
		}
	})
}

// Authentication endpoint tests
func TestLogin(t *testing.T) {
	t.Run("Valid credentials", func(t *testing.T) {
		loginData := map[string]string{
			"email":    "test@example.com",
			"password": "testpass123",
		}

		w, err := makeTestRequest("POST", "/api/login", loginData, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		// Check for token
		if _, ok := response["token"]; !ok {
			t.Error("Response missing token field")
		}

		// Check user data
		user, ok := response["user"].(map[string]interface{})
		if !ok {
			t.Fatalf("User field is not a map")
		}

		if user["email"] != "test@example.com" {
			t.Errorf("Expected email 'test@example.com', got %v", user["email"])
		}

		if user["username"] != "testuser" {
			t.Errorf("Expected username 'testuser', got %v", user["username"])
		}
	})

	t.Run("Invalid credentials", func(t *testing.T) {
		loginData := map[string]string{
			"email":    "test@example.com",
			"password": "wrongpassword",
		}

		w, err := makeTestRequest("POST", "/api/login", loginData, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
		}
	})
}

// Tracking endpoint tests
func TestTrackLocationGET(t *testing.T) {
	t.Run("Valid token", func(t *testing.T) {
		w, err := makeTestRequest("GET", "/api/track?token=test-custom-token&latitude=47.6062&longitude=-122.3321", nil, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if response["status"] != "success" {
			t.Errorf("Expected status 'success', got %v", response["status"])
		}
	})

	t.Run("Missing token", func(t *testing.T) {
		w, err := makeTestRequest("GET", "/api/track?latitude=47.6062&longitude=-122.3321", nil, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
		}
	})

	t.Run("Invalid token", func(t *testing.T) {
		w, err := makeTestRequest("GET", "/api/track?token=invalid-token&latitude=47.6062&longitude=-122.3321", nil, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
		}
	})
}

func TestTrackLocationPOST(t *testing.T) {
	t.Run("Valid GeoJSON data", func(t *testing.T) {
		trackingData := map[string]interface{}{
			"type": "Feature",
			"geometry": map[string]interface{}{
				"type":        "Point",
				"coordinates": []float64{-122.3321, 47.6062, 100.0},
			},
			"properties": map[string]interface{}{
				"timestamp":  time.Now().Unix(),
				"speed":      5.5,
				"heart_rate": 120.0,
				"session":    "test-session",
			},
		}

		headers := map[string]string{
			"Authorization": "Bearer mock-jwt-token",
		}

		w, err := makeTestRequest("POST", "/api/track", trackingData, headers)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if response["status"] != "success" {
			t.Errorf("Expected status 'success', got %v", response["status"])
		}
	})

	t.Run("Invalid authorization", func(t *testing.T) {
		trackingData := map[string]interface{}{
			"type": "Feature",
		}

		w, err := makeTestRequest("POST", "/api/track", trackingData, nil)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
		}
	})
}

// Benchmark tests for performance monitoring
func BenchmarkMakeTestRequest(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, _ = makeTestRequest("GET", "/api/location/testuser", nil, nil)
	}
}

func BenchmarkGenerateSessionTitle(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = generateSessionTitle("test_session_name")
	}
}
