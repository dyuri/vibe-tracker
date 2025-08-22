package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/apis"
	"vibe-tracker/constants"
	"vibe-tracker/utils"
)

// ErrorHandler provides error handling middleware and utilities
type ErrorHandler struct{}

func NewErrorHandler() *ErrorHandler {
	return &ErrorHandler{}
}

// RecoveryMiddleware recovers from panics and returns proper error responses
func (h *ErrorHandler) RecoveryMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			defer func() {
				if r := recover(); r != nil {
					var err error
					switch x := r.(type) {
					case string:
						err = fmt.Errorf("panic: %s", x)
					case error:
						err = fmt.Errorf("panic: %w", x)
					default:
						err = fmt.Errorf("panic: %v", x)
					}

					utils.LogError(err, "panic recovered").
						Str("method", c.Request().Method).
						Str("path", c.Request().URL.Path).
						Msg("Request panic recovered")

					if !c.Response().Committed {
						c.JSON(http.StatusInternalServerError, map[string]string{
							"error": "Internal server error",
						})
					}
				}
			}()
			return next(c)
		}
	}
}

// LoggingMiddleware logs requests and responses
func (h *ErrorHandler) LoggingMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			req := c.Request()
			res := c.Response()

			utils.RequestLogger(req.Method, req.URL.Path, "").
				Msg("Request started")

			err := next(c)

			if err != nil {
				utils.LogError(err, "request failed").
					Str("method", req.Method).
					Str("path", req.URL.Path).
					Int("status", res.Status).
					Msg("Request completed with error")
			} else {
				utils.LogInfo().
					Str("method", req.Method).
					Str("path", req.URL.Path).
					Int("status", res.Status).
					Msg("Request completed successfully")
			}

			return err
		}
	}
}

// CORSMiddleware adds CORS headers for API requests with configurable origins
func (h *ErrorHandler) CORSMiddleware(allowedOrigins []string, allowAll bool) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			origin := c.Request().Header.Get("Origin")

			// Set CORS headers based on configuration
			if allowAll {
				// Development mode - allow all origins
				if origin != "" {
					c.Response().Header().Set("Access-Control-Allow-Origin", origin)
				} else {
					c.Response().Header().Set("Access-Control-Allow-Origin", "*")
				}
			} else if len(allowedOrigins) > 0 {
				// Production mode - check allowed origins
				originAllowed := false
				for _, allowed := range allowedOrigins {
					if origin == allowed {
						c.Response().Header().Set("Access-Control-Allow-Origin", origin)
						originAllowed = true
						break
					}
				}
				if !originAllowed && origin != "" {
					// Log unauthorized origin attempt
					utils.LogError(nil, "unauthorized CORS origin").
						Str("origin", origin).
						Str("path", c.Request().URL.Path).
						Msg("Blocked CORS request from unauthorized origin")
					return apis.NewForbiddenError("Origin not allowed", nil)
				}
			} else {
				// Default restrictive behavior
				c.Response().Header().Set("Access-Control-Allow-Origin", "http://localhost:8090")
			}

			c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
			c.Response().Header().Set("Access-Control-Allow-Credentials", "true")
			c.Response().Header().Set("Access-Control-Max-Age", "86400") // 24 hours

			// Handle preflight requests
			if c.Request().Method == "OPTIONS" {
				return c.NoContent(http.StatusOK)
			}

			return next(c)
		}
	}
}

// SecurityHeaders middleware adds comprehensive security headers
func (h *ErrorHandler) SecurityHeaders(hstsEnabled, cspEnabled bool) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			headers := c.Response().Header()

			// Basic security headers
			headers.Set("X-Content-Type-Options", "nosniff")
			headers.Set("X-Frame-Options", "DENY")
			headers.Set("X-XSS-Protection", "1; mode=block")
			headers.Set("Referrer-Policy", "strict-origin-when-cross-origin")

			// Permissions Policy (formerly Feature Policy)
			headers.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()")

			// HSTS for HTTPS connections
			if hstsEnabled && (c.Request().TLS != nil || c.Request().Header.Get("X-Forwarded-Proto") == "https") {
				headers.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
			}

			// Content Security Policy
			if cspEnabled {
				csp := h.buildCSP(c)
				headers.Set("Content-Security-Policy", csp)
			}

			return next(c)
		}
	}
}

// buildCSP constructs Content Security Policy based on request path
func (h *ErrorHandler) buildCSP(c echo.Context) string {
	path := c.Request().URL.Path

	// Base CSP directives
	directives := []string{
		"default-src " + constants.CSPDefaultSrc,
		"script-src " + constants.CSPScriptSrc,
		"style-src " + constants.CSPStyleSrc,
		"img-src " + constants.CSPImgSrc,
		"connect-src " + constants.CSPConnectSrc,
		"font-src " + constants.CSPFontSrc,
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"upgrade-insecure-requests",
	}

	// Special CSP for Swagger UI endpoints
	if strings.HasPrefix(path, "/swagger") {
		// Swagger UI needs more permissive policies for its functionality
		directives = []string{
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
			"style-src 'self' 'unsafe-inline' https://unpkg.com",
			"img-src 'self' data: https:",
			"connect-src 'self'",
			"font-src 'self' https://unpkg.com",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-ancestors 'none'",
		}
	}

	return strings.Join(directives, "; ")
}

// ErrorResponse standardizes error responses
type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// StandardizeErrors converts various error types to consistent API responses
func StandardizeErrors() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)

			if err != nil {
				// Handle our custom AppError types
				if appErr, ok := err.(*utils.AppError); ok {
					// Log the structured error
					utils.LogError(appErr, "application error").
						Str("error_type", string(appErr.Type)).
						Int("status_code", appErr.Code).
						Str("user_id", appErr.UserID).
						Str("request_id", appErr.RequestID).
						Msg("Structured error occurred")

					return appErr.ToAPIError()
				}

				// Let PocketBase handle its own error types
				if apiErr, ok := err.(*apis.ApiError); ok {
					return apiErr
				}

				// Handle Echo HTTP errors
				if httpErr, ok := err.(*echo.HTTPError); ok {
					return apis.NewApiError(httpErr.Code, fmt.Sprintf("%v", httpErr.Message), err)
				}

				// Wrap unknown errors as internal errors
				appErr := utils.NewInternalError("Unexpected error occurred", err)
				utils.LogError(err, "unhandled error").
					Str("error_type", string(appErr.Type)).
					Msg("Unhandled error wrapped as internal error")

				return appErr.ToAPIError()
			}

			return nil
		}
	}
}
