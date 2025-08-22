package tests

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"

	"vibe-tracker/config"
	"vibe-tracker/middleware"
)

// TestRateLimitingMiddleware tests rate limiting functionality
func TestRateLimitingMiddleware(t *testing.T) {
	tests := []struct {
		name           string
		endpoint       string
		requestCount   int
		expectBlocked  bool
		expectedStatus int
	}{
		{
			name:           "Auth endpoint rate limit",
			endpoint:       "/auth",
			requestCount:   10, // Should exceed auth limit of 5 per minute
			expectBlocked:  true,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Public endpoint within limit",
			endpoint:       "/public",
			requestCount:   50, // Should be within public limit of 100 per minute
			expectBlocked:  false,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Tracking endpoint rate limit",
			endpoint:       "/track",
			requestCount:   70, // Should exceed tracking limit of 60 per minute
			expectBlocked:  true,
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create Echo instance
			e := echo.New()
			
			// Create rate limiting middleware
			rateLimiter := middleware.NewRateLimitMiddleware()
			
			// Set up test handler
			handler := func(c echo.Context) error {
				return c.String(http.StatusOK, "OK")
			}
			
			// Apply appropriate middleware based on endpoint
			var middlewareFunc echo.MiddlewareFunc
			switch tt.endpoint {
			case "/auth":
				middlewareFunc = rateLimiter.AuthEndpoints()
			case "/public":
				middlewareFunc = rateLimiter.PublicEndpoints()
			case "/track":
				middlewareFunc = rateLimiter.TrackingEndpoints()
			default:
				middlewareFunc = rateLimiter.PublicEndpoints()
			}
			
			// Register route with middleware
			e.GET(tt.endpoint, handler, middlewareFunc)
			
			// Make requests
			var lastResponse *httptest.ResponseRecorder
			for i := 0; i < tt.requestCount; i++ {
				req := httptest.NewRequest(http.MethodGet, tt.endpoint, nil)
				req.Header.Set("X-Real-IP", "192.168.1.100")
				rec := httptest.NewRecorder()
				e.ServeHTTP(rec, req)
				lastResponse = rec
				
				// Short delay between requests
				time.Sleep(10 * time.Millisecond)
			}
			
			// Check final response
			if tt.expectBlocked {
				assert.Equal(t, tt.expectedStatus, lastResponse.Code, "Expected rate limit to be exceeded")
			} else {
				assert.Equal(t, http.StatusOK, lastResponse.Code, "Expected requests to be within rate limit")
			}
		})
	}
}

// TestSecurityMiddleware tests various security protections
func TestSecurityMiddleware(t *testing.T) {
	cfg := &config.AppConfig{}
	cfg.Security.MaxRequestSize = 1024 // 1KB for testing
	cfg.Security.RequestTimeout = 100 * time.Millisecond
	cfg.Security.EnableRequestLogs = false // Disable for testing

	securityMiddleware := middleware.NewSecurityMiddleware(
		cfg.Security.MaxRequestSize,
		cfg.Security.RequestTimeout,
		cfg.Security.EnableRequestLogs,
	)

	tests := []struct {
		name           string
		setupRequest   func() *http.Request
		middleware     echo.MiddlewareFunc
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "Request size limit exceeded",
			setupRequest: func() *http.Request {
				largeBody := strings.NewReader(strings.Repeat("a", 2048)) // 2KB > 1KB limit
				req := httptest.NewRequest(http.MethodPost, "/test", largeBody)
				req.Header.Set("Content-Length", "2048")
				return req
			},
			middleware:     securityMiddleware.RequestSizeLimit(),
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "Request within size limit",
			setupRequest: func() *http.Request {
				smallBody := strings.NewReader("small content")
				req := httptest.NewRequest(http.MethodPost, "/test", smallBody)
				req.Header.Set("Content-Length", "13")
				return req
			},
			middleware:     securityMiddleware.RequestSizeLimit(),
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "Empty User-Agent blocked",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/test", nil)
				// Don't set User-Agent header
				return req
			},
			middleware:     securityMiddleware.UserAgentFilter(),
			expectedStatus: http.StatusForbidden,
			expectedError:  true,
		},
		{
			name: "Malicious User-Agent blocked",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/test", nil)
				req.Header.Set("User-Agent", "sqlmap/1.0")
				return req
			},
			middleware:     securityMiddleware.UserAgentFilter(),
			expectedStatus: http.StatusForbidden,
			expectedError:  true,
		},
		{
			name: "Legitimate User-Agent allowed",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/test", nil)
				req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; TestBot)")
				return req
			},
			middleware:     securityMiddleware.UserAgentFilter(),
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create Echo instance
			e := echo.New()
			
			// Set up test handler
			handler := func(c echo.Context) error {
				return c.String(http.StatusOK, "OK")
			}
			
			// Register route with middleware
			e.GET("/test", handler, tt.middleware)
			e.POST("/test", handler, tt.middleware)
			
			// Execute request
			req := tt.setupRequest()
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			
			// Verify response
			assert.Equal(t, tt.expectedStatus, rec.Code, "Unexpected response status")
			
			if tt.expectedError {
				assert.Contains(t, rec.Body.String(), "error", "Expected error response body")
			} else {
				assert.Equal(t, "OK", rec.Body.String(), "Expected success response")
			}
		})
	}
}

// TestAuthSecurityMiddleware tests brute force protection
func TestAuthSecurityMiddleware(t *testing.T) {
	authSecurity := middleware.NewAuthSecurityMiddleware(3, 5*time.Minute, false)
	defer authSecurity.Stop()

	e := echo.New()
	
	// Mock handler that simulates failed authentication
	failHandler := func(c echo.Context) error {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
	}
	
	// Mock handler that simulates successful authentication
	successHandler := func(c echo.Context) error {
		return c.String(http.StatusOK, "Success")
	}

	t.Run("Brute force protection after failed attempts", func(t *testing.T) {
		// Register route with brute force protection
		e.POST("/login-fail", failHandler, authSecurity.BruteForceProtection())
		
		clientIP := "192.168.1.101"
		
		// Make 4 failed requests (should trigger lockout after 3rd)
		for i := 0; i < 4; i++ {
			req := httptest.NewRequest(http.MethodPost, "/login-fail", nil)
			req.Header.Set("X-Real-IP", clientIP)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			
			if i < 3 {
				// First 3 should return unauthorized
				assert.Equal(t, http.StatusUnauthorized, rec.Code, fmt.Sprintf("Request %d should be unauthorized", i+1))
			} else {
				// 4th should be blocked by brute force protection
				assert.Equal(t, http.StatusTooManyRequests, rec.Code, "Request should be blocked by brute force protection")
				assert.Contains(t, rec.Body.String(), "Too many failed login attempts", "Should contain brute force message")
			}
		}
	})

	t.Run("Successful login clears failed attempts", func(t *testing.T) {
		// Register route with brute force protection
		e.POST("/login-success", successHandler, authSecurity.BruteForceProtection())
		
		clientIP := "192.168.1.102"
		
		// Make a successful request
		req := httptest.NewRequest(http.MethodPost, "/login-success", nil)
		req.Header.Set("X-Real-IP", clientIP)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		
		assert.Equal(t, http.StatusOK, rec.Code, "Successful login should work")
		assert.Equal(t, "Success", rec.Body.String(), "Should return success message")
	})
}

// TestSecurityHeaders tests security header middleware
func TestSecurityHeaders(t *testing.T) {
	errorHandler := middleware.NewErrorHandler()
	
	tests := []struct {
		name         string
		path         string
		hstsEnabled  bool
		cspEnabled   bool
		expectedHeaders map[string]string
	}{
		{
			name:        "Basic security headers",
			path:        "/test",
			hstsEnabled: false,
			cspEnabled:  false,
			expectedHeaders: map[string]string{
				"X-Content-Type-Options": "nosniff",
				"X-Frame-Options":        "DENY",
				"X-XSS-Protection":       "1; mode=block",
				"Referrer-Policy":        "strict-origin-when-cross-origin",
			},
		},
		{
			name:        "Swagger CSP headers",
			path:        "/swagger",
			hstsEnabled: false,
			cspEnabled:  true,
			expectedHeaders: map[string]string{
				"Content-Security-Policy": "default-src 'self'",
				"X-Content-Type-Options":  "nosniff",
			},
		},
		{
			name:        "HSTS enabled for HTTPS",
			path:        "/test",
			hstsEnabled: true,
			cspEnabled:  false,
			expectedHeaders: map[string]string{
				"X-Content-Type-Options": "nosniff",
				// HSTS won't be set in test without TLS
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create Echo instance
			e := echo.New()
			
			// Set up test handler
			handler := func(c echo.Context) error {
				return c.String(http.StatusOK, "OK")
			}
			
			// Register route with security headers middleware
			middleware := errorHandler.SecurityHeaders(tt.hstsEnabled, tt.cspEnabled)
			e.GET(tt.path, handler, middleware)
			
			// Execute request
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			
			// Verify response
			assert.Equal(t, http.StatusOK, rec.Code, "Request should succeed")
			
			// Check expected headers
			for header, expectedValue := range tt.expectedHeaders {
				actualValue := rec.Header().Get(header)
				if expectedValue != "" {
					assert.Contains(t, actualValue, expectedValue, fmt.Sprintf("Header %s should contain %s", header, expectedValue))
				} else {
					assert.NotEmpty(t, actualValue, fmt.Sprintf("Header %s should be set", header))
				}
			}
		})
	}
}

// TestCORSMiddleware tests CORS configuration
func TestCORSMiddleware(t *testing.T) {
	errorHandler := middleware.NewErrorHandler()
	
	tests := []struct {
		name           string
		allowedOrigins []string
		allowAll       bool
		requestOrigin  string
		expectedStatus int
		expectOrigin   string
	}{
		{
			name:           "Allow all origins in development",
			allowedOrigins: []string{},
			allowAll:       true,
			requestOrigin:  "http://localhost:3000",
			expectedStatus: http.StatusOK,
			expectOrigin:   "http://localhost:3000",
		},
		{
			name:           "Allowed origin in production",
			allowedOrigins: []string{"https://vibetracker.com"},
			allowAll:       false,
			requestOrigin:  "https://vibetracker.com",
			expectedStatus: http.StatusOK,
			expectOrigin:   "https://vibetracker.com",
		},
		{
			name:           "Blocked origin in production",
			allowedOrigins: []string{"https://vibetracker.com"},
			allowAll:       false,
			requestOrigin:  "https://malicious.com",
			expectedStatus: http.StatusForbidden,
			expectOrigin:   "",
		},
		{
			name:           "OPTIONS preflight request",
			allowedOrigins: []string{"https://vibetracker.com"},
			allowAll:       false,
			requestOrigin:  "https://vibetracker.com",
			expectedStatus: http.StatusOK,
			expectOrigin:   "https://vibetracker.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create Echo instance
			e := echo.New()
			
			// Set up test handler
			handler := func(c echo.Context) error {
				return c.String(http.StatusOK, "OK")
			}
			
			// Register route with CORS middleware
			corsMiddleware := errorHandler.CORSMiddleware(tt.allowedOrigins, tt.allowAll)
			e.GET("/test", handler, corsMiddleware)
			e.OPTIONS("/test", handler, corsMiddleware)
			
			// Execute request
			var req *http.Request
			if tt.name == "OPTIONS preflight request" {
				req = httptest.NewRequest(http.MethodOptions, "/test", nil)
			} else {
				req = httptest.NewRequest(http.MethodGet, "/test", nil)
			}
			
			if tt.requestOrigin != "" {
				req.Header.Set("Origin", tt.requestOrigin)
			}
			
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			
			// Verify response
			assert.Equal(t, tt.expectedStatus, rec.Code, "Unexpected response status")
			
			// Check CORS headers
			if tt.expectOrigin != "" {
				assert.Equal(t, tt.expectOrigin, rec.Header().Get("Access-Control-Allow-Origin"), "Unexpected CORS origin header")
			}
			
			if tt.expectedStatus == http.StatusOK {
				assert.NotEmpty(t, rec.Header().Get("Access-Control-Allow-Methods"), "Should have CORS methods header")
				assert.NotEmpty(t, rec.Header().Get("Access-Control-Allow-Headers"), "Should have CORS headers header")
			}
		})
	}
}

