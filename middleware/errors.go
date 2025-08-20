package middleware

import (
	"fmt"
	"log"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/apis"
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
					
					log.Printf("Recovered from panic in %s %s: %v", c.Request().Method, c.Request().URL.Path, err)
					
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
			
			log.Printf("Started %s %s", req.Method, req.URL.Path)
			
			err := next(c)
			
			if err != nil {
				log.Printf("Request %s %s failed: %v (Status: %d)", 
					req.Method, req.URL.Path, err, res.Status)
			} else {
				log.Printf("Completed %s %s (Status: %d)", 
					req.Method, req.URL.Path, res.Status)
			}
			
			return err
		}
	}
}

// CORSMiddleware adds CORS headers for API requests
func (h *ErrorHandler) CORSMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			origin := c.Request().Header.Get("Origin")
			
			// Allow all origins for development, but you might want to restrict this in production
			if origin != "" {
				c.Response().Header().Set("Access-Control-Allow-Origin", origin)
			} else {
				c.Response().Header().Set("Access-Control-Allow-Origin", "*")
			}
			
			c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
			c.Response().Header().Set("Access-Control-Allow-Credentials", "true")
			
			// Handle preflight requests
			if c.Request().Method == "OPTIONS" {
				return c.NoContent(http.StatusOK)
			}
			
			return next(c)
		}
	}
}

// SecurityHeaders middleware adds basic security headers
func (h *ErrorHandler) SecurityHeaders() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set("X-Content-Type-Options", "nosniff")
			c.Response().Header().Set("X-Frame-Options", "DENY")
			c.Response().Header().Set("X-XSS-Protection", "1; mode=block")
			
			// Only add HSTS in production or HTTPS
			if c.Request().TLS != nil || c.Request().Header.Get("X-Forwarded-Proto") == "https" {
				c.Response().Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}
			
			return next(c)
		}
	}
}

// RateLimitInfo holds rate limiting information
type RateLimitInfo struct {
	requests map[string]int
	// In a real implementation, you'd want to use a more sophisticated
	// rate limiting mechanism with time windows, Redis, etc.
}

// SimpleRateLimit provides basic rate limiting (for demonstration)
func (h *ErrorHandler) SimpleRateLimit(maxRequests int) echo.MiddlewareFunc {
	info := &RateLimitInfo{
		requests: make(map[string]int),
	}
	
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get client IP (simplified)
			clientIP := c.RealIP()
			
			// Check current request count (this is overly simplified)
			if info.requests[clientIP] >= maxRequests {
				return apis.NewApiError(http.StatusTooManyRequests, "Rate limit exceeded", nil)
			}
			
			info.requests[clientIP]++
			
			return next(c)
		}
	}
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
				// Let PocketBase handle its own error types
				if apiErr, ok := err.(*apis.ApiError); ok {
					return apiErr
				}
				
				// Handle Echo HTTP errors
				if httpErr, ok := err.(*echo.HTTPError); ok {
					return apis.NewApiError(httpErr.Code, fmt.Sprintf("%v", httpErr.Message), err)
				}
				
				// Handle other errors as internal server errors
				return apis.NewApiError(http.StatusInternalServerError, "Internal server error", err)
			}
			
			return nil
		}
	}
}