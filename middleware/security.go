package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/apis"

	"vibe-tracker/constants"
	"vibe-tracker/utils"
)

// SecurityMiddleware provides additional security controls
type SecurityMiddleware struct {
	maxRequestSize int64
	requestTimeout time.Duration
	enableLogging  bool
}

// NewSecurityMiddleware creates a new security middleware instance
func NewSecurityMiddleware(maxSize int64, timeout time.Duration, enableLogging bool) *SecurityMiddleware {
	return &SecurityMiddleware{
		maxRequestSize: maxSize,
		requestTimeout: timeout,
		enableLogging:  enableLogging,
	}
}

// RequestSizeLimit limits the size of incoming requests
func (m *SecurityMiddleware) RequestSizeLimit() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			req := c.Request()
			
			// Get content length
			contentLength := req.ContentLength
			if contentLength > m.maxRequestSize {
				if m.enableLogging {
					utils.LogSecurityViolation(c.RealIP(), "request_size_exceeded", fmt.Sprintf("Content-Length: %d bytes", contentLength))
				}
				
				return apis.NewBadRequestError("Request size exceeds limit", map[string]any{
					"max_size_mb": m.maxRequestSize / (1024 * 1024),
				})
			}
			
			// Wrap request body with a limited reader for additional protection
			if req.Body != nil {
				req.Body = http.MaxBytesReader(c.Response(), req.Body, m.maxRequestSize)
			}
			
			return next(c)
		}
	}
}

// RequestTimeout adds timeout protection to requests
func (m *SecurityMiddleware) RequestTimeout() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Create context with timeout
			ctx, cancel := context.WithTimeout(c.Request().Context(), m.requestTimeout)
			defer cancel()
			
			// Set the new context
			c.SetRequest(c.Request().WithContext(ctx))
			
			// Channel to receive the result
			done := make(chan error, 1)
			
			// Execute the handler in a goroutine
			go func() {
				done <- next(c)
			}()
			
			// Wait for completion or timeout
			select {
			case err := <-done:
				return err
			case <-ctx.Done():
				if m.enableLogging {
					utils.LogError(nil, "request timeout exceeded").
						Str("timeout", m.requestTimeout.String()).
						Str("method", c.Request().Method).
						Str("path", c.Request().URL.Path).
						Str("client_ip", c.RealIP()).
						Msg("Request timed out")
				}
				
				return apis.NewApiError(http.StatusRequestTimeout, "Request timeout", map[string]any{
					"timeout_seconds": int(m.requestTimeout.Seconds()),
				})
			}
		}
	}
}

// UserAgentFilter blocks requests from known malicious user agents
func (m *SecurityMiddleware) UserAgentFilter() echo.MiddlewareFunc {
	// Common malicious user agent patterns
	blockedPatterns := []string{
		"sqlmap",
		"nikto",
		"nessus",
		"openvas",
		"masscan",
		"nmap",
		"zgrab",
		"python-requests/", // Block default python requests
		"curl/",            // Block default curl (legitimate tools should set custom UA)
		"wget/",            // Block default wget
		"Go-http-client/",  // Block default Go HTTP client
		"<script",          // XSS attempts
		"javascript:",      // XSS attempts
		"data:text/html",   // XSS attempts
	}
	
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userAgent := c.Request().Header.Get("User-Agent")
			
			// Block empty user agents
			if userAgent == "" {
				if m.enableLogging {
					utils.LogError(nil, "blocked empty user agent").
						Str("client_ip", c.RealIP()).
						Str("path", c.Request().URL.Path).
						Msg("Request blocked: empty user agent")
				}
				
				return apis.NewForbiddenError("User-Agent header required", nil)
			}
			
			// Check against blocked patterns
			userAgentLower := strings.ToLower(userAgent)
			for _, pattern := range blockedPatterns {
				if strings.Contains(userAgentLower, pattern) {
					if m.enableLogging {
						utils.LogSuspiciousRequest(c.RealIP(), userAgent, c.Request().URL.Path, fmt.Sprintf("malicious_user_agent_pattern_%s", pattern))
					}
					
					return apis.NewForbiddenError("Access denied", nil)
				}
			}
			
			return next(c)
		}
	}
}

// IPWhitelist allows only whitelisted IP addresses (for admin endpoints)
func (m *SecurityMiddleware) IPWhitelist(allowedIPs []string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if len(allowedIPs) == 0 {
				return next(c) // No restriction if no IPs specified
			}
			
			clientIP := c.RealIP()
			allowed := false
			
			for _, ip := range allowedIPs {
				if clientIP == ip || ip == "*" {
					allowed = true
					break
				}
			}
			
			if !allowed {
				if m.enableLogging {
					utils.LogError(nil, "IP not in whitelist").
						Str("client_ip", clientIP).
						Str("path", c.Request().URL.Path).
						Msg("Request blocked: IP not whitelisted")
				}
				
				return apis.NewForbiddenError("Access denied", nil)
			}
			
			return next(c)
		}
	}
}

// FileUploadSecurity provides security controls for file uploads
func (m *SecurityMiddleware) FileUploadSecurity() echo.MiddlewareFunc {
	// Dangerous file extensions
	dangerousExts := []string{
		".php", ".php3", ".php4", ".php5", ".php7", ".phtml",
		".asp", ".aspx", ".jsp", ".jspx",
		".exe", ".bat", ".cmd", ".com", ".scr",
		".js", ".vbs", ".jar", ".war",
		".sh", ".bash", ".zsh",
		".py", ".rb", ".pl",
		".htaccess", ".htpasswd",
	}
	
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Only process multipart forms (file uploads)
			contentType := c.Request().Header.Get("Content-Type")
			if !strings.Contains(contentType, "multipart/form-data") {
				return next(c)
			}
			
			// Parse multipart form with size limit
			err := c.Request().ParseMultipartForm(constants.MaxFileUploadSize)
			if err != nil {
				if m.enableLogging {
					utils.LogError(err, "failed to parse multipart form").
						Str("client_ip", c.RealIP()).
						Str("path", c.Request().URL.Path).
						Msg("File upload parsing failed")
				}
				
				return apis.NewBadRequestError("Invalid file upload", nil)
			}
			
			// Check uploaded files
			if c.Request().MultipartForm != nil && c.Request().MultipartForm.File != nil {
				for fieldName, files := range c.Request().MultipartForm.File {
					for _, file := range files {
						// Check file extension
						filename := strings.ToLower(file.Filename)
						for _, ext := range dangerousExts {
							if strings.HasSuffix(filename, ext) {
								if m.enableLogging {
									utils.LogError(nil, "dangerous file extension blocked").
										Str("filename", file.Filename).
										Str("extension", ext).
										Str("field_name", fieldName).
										Str("client_ip", c.RealIP()).
										Msg("File upload blocked: dangerous extension")
								}
								
								return apis.NewBadRequestError("File type not allowed", map[string]any{
									"filename": file.Filename,
								})
							}
						}
						
						// Check file size
						if file.Size > constants.MaxFileUploadSize {
							if m.enableLogging {
								utils.LogError(nil, "file size limit exceeded").
									Str("filename", file.Filename).
									Int64("size", file.Size).
									Int64("max_size", constants.MaxFileUploadSize).
									Str("client_ip", c.RealIP()).
									Msg("File upload blocked: size limit exceeded")
							}
							
							return apis.NewBadRequestError("File size exceeds limit", map[string]any{
								"filename":    file.Filename,
								"max_size_mb": constants.MaxFileUploadSize / (1024 * 1024),
							})
						}
					}
				}
			}
			
			return next(c)
		}
	}
}

// RequestLogging logs security-relevant request information
func (m *SecurityMiddleware) RequestLogging() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !m.enableLogging {
				return next(c)
			}
			
			start := time.Now()
			
			// Execute the request
			err := next(c)
			
			// Log the request
			duration := time.Since(start)
			status := c.Response().Status
			
			// Log suspicious patterns
			suspicious := false
			suspiciousReasons := []string{}
			
			// Check for suspicious paths
			path := c.Request().URL.Path
			if strings.Contains(path, "..") || 
			   strings.Contains(path, "<script") ||
			   strings.Contains(path, "javascript:") ||
			   strings.Contains(path, "data:text/html") {
				suspicious = true
				suspiciousReasons = append(suspiciousReasons, "suspicious_path")
			}
			
			// Check for suspicious query parameters
			query := c.Request().URL.RawQuery
			if strings.Contains(query, "<script") ||
			   strings.Contains(query, "javascript:") ||
			   strings.Contains(query, "union select") ||
			   strings.Contains(query, "drop table") {
				suspicious = true
				suspiciousReasons = append(suspiciousReasons, "suspicious_query")
			}
			
			// Log entry
			logger := utils.GetLogger().With().
				Str("method", c.Request().Method).
				Str("path", path).
				Str("client_ip", c.RealIP()).
				Str("user_agent", c.Request().Header.Get("User-Agent")).
				Int("status", status).
				Dur("duration", duration).
				Int64("request_size", c.Request().ContentLength).
				Logger()
			
			if suspicious {
				logger.Warn().
					Strs("suspicious_reasons", suspiciousReasons).
					Msg("Suspicious request detected")
			} else if status >= 400 {
				logger.Warn().
					Msg("Request failed")
			} else {
				logger.Info().
					Msg("Request completed")
			}
			
			return err
		}
	}
}