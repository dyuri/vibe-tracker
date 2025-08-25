# Refined Step-by-Step Refactor Plan for main.go

## ✅ 1. Preparation & Analysis - COMPLETED

- ✅ Review all existing endpoints, business logic, and helper functions in main.go.
- ✅ Identify all duplicated code, hardcoded values, and mixed concerns.
- ✅ List all models, request/response shapes, and DB queries used.

## ✅ 2. Directory and Package Setup - COMPLETED

- ✅ Create the following directories:
  - ✅ `handlers/`
  - ✅ `middleware/`
  - ✅ `models/`
  - ✅ `services/`
  - ✅ `repositories/`
  - ✅ `config/`
  - ✅ `constants/`
  - ✅ `tests/` (already existed)

## ✅ 3. Handlers Extraction - COMPLETED

- ✅ Move each route handler to its own file in `handlers/`, grouped by domain:
  - ✅ `auth.go` (login, refresh, profile)
  - ✅ `sessions.go` (session CRUD)
  - ✅ `tracking.go` (location endpoints)
  - ✅ `public.go` (public data endpoints)
- ✅ Refactor handlers to use service and middleware layers.
- ✅ Create `helpers.go` with shared utility functions

## ✅ 4. Middleware Extraction - COMPLETED

- ✅ Implement authentication middleware (JWT, custom token).
- ✅ Add user lookup and error handling middleware.
- ✅ Centralize input validation middleware.
- ✅ Create comprehensive middleware package:
  - ✅ `auth.go` (JWT, custom token, flexible auth)
  - ✅ `user.go` (user lookup, ownership validation)
  - ✅ `errors.go` (error handling, logging, CORS, security headers)
  - ✅ `validation.go` (input validation, sanitization)
- ✅ Update handlers to use middleware context helpers
- ✅ Apply middleware to routes in main.go

## ✅ 5. Models Definition - COMPLETED

- ✅ Define request/response structs in `models/`:
  - ✅ `auth.go` (LoginRequest, UpdateProfileRequest, LoginResponse, User, TokenResponse)
  - ✅ `session.go` (CreateSessionRequest, UpdateSessionRequest, Session, SessionsListResponse)
  - ✅ `location.go` (LocationRequest, LocationResponse, TrackingQueryParams, Location)
  - ✅ `common.go` (ErrorResponse, SuccessResponse, PaginationMeta)
- ✅ Add struct tags for validation and JSON serialization
- ✅ Updated auth handlers to use new models (Login, UpdateProfile)
- ✅ Verified all tests still pass with new models

## ✅ 6. Services Layer - COMPLETED

- ✅ Move business logic to `services/`:
  - ✅ `auth_service.go` (authentication, token management, profile updates)
  - ✅ `session_service.go` (session CRUD, pagination, validation)
  - ✅ `location_service.go` (tracking, GeoJSON conversion, public locations)
  - ✅ `user_service.go` (user operations, ownership validation)
- ✅ Created `utils/session_utils.go` for shared utilities (GenerateSessionTitle)
- ✅ Updated auth handlers to use services (Login, UpdateProfile)
- ✅ Resolved import cycle between handlers and services
- ✅ Comprehensive error handling with custom error types
- ✅ All tests passing with services integration

## ✅ 7. Repository Layer - COMPLETED

- ✅ Abstract DB operations in `repositories/`:
  - ✅ `interfaces.go` (UserRepository, SessionRepository, LocationRepository interfaces)
  - ✅ `user_repository.go` (user CRUD operations with FindByUsername, FindByEmail, FindByID, FindByToken, Save)
  - ✅ `session_repository.go` (session CRUD with pagination, FindByUser, CountByUser, Create, Update, Delete, FindByNameAndUser, FindByID)
  - ✅ `location_repository.go` (location operations with Create, FindByUser, FindPublicLocations, FindAllLocations)
- ✅ Use interfaces for easier mocking/testing
- ✅ Updated all services to use repository pattern instead of direct database access
- ✅ Updated service constructors to accept repository interfaces
- ✅ Updated main.go to create repositories → services → handlers dependency chain
- ✅ All compilation errors fixed and build successful
- ✅ All API tests passing, confirming repository layer functionality

## ✅ 8. Constants & Config - COMPLETED

- ✅ Move all hardcoded values (pagination, limits, etc.) to `constants/`:
  - ✅ `constants/app.go` (pagination defaults: DefaultPage=1, DefaultPerPage=20, MaxPerPageLimit=100)
  - ✅ Collection names: CollectionUsers, CollectionSessions, CollectionLocations
  - ✅ API endpoints: APIPrefix="/api", EndpointLogin="/login", EndpointTrack="/track", etc.
  - ✅ Default values: DefaultAltitude=0.0, DefaultSpeed=0.0, DefaultTimestamp=0
  - ✅ Environment variable names: EnvAutomigrate="PB_AUTOMIGRATE", EnvPort="PORT", EnvHost="HOST"
- ✅ Create a `config/` package for environment variables and app settings:
  - ✅ `config/config.go` with AppConfig struct for centralized configuration
  - ✅ Environment variable parsing with defaults (getEnvOrDefault, getBoolEnvOrDefault, getIntEnvOrDefault)
  - ✅ Server configuration methods (GetServerAddress, IsProductionMode, IsDevelopmentMode)
  - ✅ Proper handling of PocketBase automigrate setting
- ✅ Updated all services to use constants instead of hardcoded values
- ✅ Updated all repositories to use collection name constants
- ✅ Updated handlers to use pagination and validation constants
- ✅ Updated main.go to use config package for environment variables and route constants
- ✅ All compilation errors fixed and build successful
- ✅ All API tests passing, confirming constants and config integration

## 9. Validation ✅

- ✅ Integrated go-playground/validator/v10 package for comprehensive validation
- ✅ Added validation struct tags to all request models with custom validators (latitude, longitude, session_name, username)
- ✅ Created utils/validation.go with structured error handling and custom validation functions
- ✅ Updated middleware/validation.go to use new validator system for JSON and query parameter validation
- ✅ Applied validation middleware to all API endpoints requiring input validation
- ✅ All handlers updated to use validated data from middleware context
- ✅ Build successful and all API tests passing

## ✅ 10. Response Standardization - COMPLETED

- ✅ Created `utils/response.go` with standardized response utilities:
  - ✅ `SendSuccess()` for success responses with data and message
  - ✅ `SendError()` for error responses with code, message, and details
  - ✅ `SendPaginated()` for paginated responses with metadata
  - ✅ `SendGeoJSON()` for GeoJSON responses (used by location endpoints)
- ✅ Standardized all 15+ API endpoints across all handlers:
  - ✅ Auth endpoints (login, refresh, profile, logout)
  - ✅ Session endpoints (list, get, create, update, delete)
  - ✅ Tracking endpoints (track, track-batch)
  - ✅ Public endpoints (public-locations, session data, latest locations)
- ✅ All endpoints now return consistent format:
  - ✅ Success: `{status: "success", data: {...}, message: "..."}`
  - ✅ Error: `{code: 400, message: "...", details: {...}}`
  - ✅ Paginated: `{status: "success", data: [...], pagination: {...}, message: "..."}`
- ✅ Updated frontend JavaScript files for backward compatibility:
  - ✅ `auth-service.js` - handles new auth response format
  - ✅ `session-management-widget.js` - handles new session response format
  - ✅ `app.js` - handles new location/GeoJSON response format
- ✅ Fixed map functionality to work with standardized responses
- ✅ All API tests passing and frontend functionality verified

## ✅ 11. Logging & Error Handling - COMPLETED

- ✅ Replaced log.Printf with structured logger (zerolog):
  - ✅ Created `utils/logger.go` with zerolog integration
  - ✅ Console-friendly output for development mode
  - ✅ Structured JSON logging for production
  - ✅ Context-aware logging with request details (method, path, status, user_id)
- ✅ Defined custom error types for common API errors:
  - ✅ Created `utils/errors.go` with comprehensive AppError system
  - ✅ Error types: validation, authentication, authorization, not_found, conflict, internal, external, rate_limit
  - ✅ Automatic conversion to PocketBase ApiError format
- ✅ Implemented error wrapping for traceability:
  - ✅ Error context and chaining with LogAndWrapError function
  - ✅ Structured error logging with user_id, request_id, and error_type fields
- ✅ Updated all components to use new logging/error system:
  - ✅ `main.go`: Removed log import, initialized structured logger, replaced log.Fatal
  - ✅ `middleware/errors.go`: Replaced all log.Printf with structured logging, enhanced error handling
  - ✅ `services/auth_service.go`: Replaced custom AuthError with structured error types
  - ✅ `handlers/auth.go`: Simplified error handling to let middleware process structured errors
- ✅ Enhanced middleware with panic recovery, request/response logging, and automatic error type detection
- ✅ All compilation errors resolved and API tests passing (8/8 test suites)
- ✅ Application startup verified with structured logging functionality

## ✅ 12. Dependency Injection - COMPLETED

- ✅ Created dedicated `container/` package with comprehensive DI container
- ✅ Implemented lightweight DI pattern managing all application dependencies:
  - ✅ `container/container.go` with Container struct holding all dependencies
  - ✅ `container/context.go` with context utilities for dependency injection
- ✅ Used existing constructor functions for services and repositories
- ✅ Created proper initialization order: repositories → services → handlers → middleware
- ✅ Added context-based dependency passing with utilities:
  - ✅ `WithContainer()`, `GetContainer()` for DI container access
  - ✅ `InjectServices()` for injecting common services into request context
  - ✅ Individual context helpers for each service type
- ✅ Updated main.go to use DI container, reducing complexity significantly
- ✅ Added injection middleware to make dependencies available in request context
- ✅ Maintained backward compatibility - all existing tests pass
- ✅ Application builds successfully and starts correctly
- ✅ All API tests passing (8/8 test suites)

## ✅ 13. API Documentation - COMPLETED

- ✅ Installed and setup swaggo/swag for OpenAPI documentation generation
- ✅ Added comprehensive Swagger/OpenAPI annotations to all handlers:
  - ✅ Authentication endpoints (login, refresh, profile, avatar, token regeneration)
  - ✅ Session management endpoints (list, get, create, update, delete)
  - ✅ Location tracking endpoints (GET and POST methods)
  - ✅ Public data endpoints (user locations, session data, public locations)
- ✅ Created documentation generation script (`scripts/generate-docs.sh`)
- ✅ Generated API docs into `docs/api/` folder:
  - ✅ `swagger.json` - OpenAPI specification in JSON format
  - ✅ `swagger.yaml` - OpenAPI specification in YAML format
  - ✅ `docs.go` - Embedded Go documentation
  - ✅ `README.md` - Documentation overview and usage guide
- ✅ Added Swagger UI endpoint for interactive documentation:
  - ✅ Accessible at `/swagger` when server is running
  - ✅ JSON specification available at `/swagger/json`
  - ✅ Custom Swagger UI implementation for Echo v5 compatibility
- ✅ All API tests passing, confirming documentation doesn't break functionality
- ✅ Comprehensive documentation covering authentication, request/response formats, and error handling

## ✅ 14. Security & Rate Limiting - COMPLETED

- ✅ Created comprehensive rate limiting middleware (`middleware/rate_limit.go`):
  - ✅ Configurable limits per endpoint type (auth: 5/min, tracking: 60/min, sessions: 30/min, public: 100/min, docs: 10/min)
  - ✅ Token bucket algorithm with automatic cleanup and goroutine management
  - ✅ Client IP-based tracking with support for reverse proxies (X-Forwarded-For, X-Real-IP)
- ✅ Enhanced security configuration (`config/config.go`, `constants/app.go`):
  - ✅ Added SecurityConfig struct with comprehensive security settings
  - ✅ Environment variable support for all security features
  - ✅ CSP (Content Security Policy) directives configuration
  - ✅ Configurable timeouts, size limits, and security toggles
- ✅ Implemented authentication security enhancements (`middleware/auth_security.go`):
  - ✅ Brute force protection with configurable lockout (default: 5 attempts, 15min lockout)
  - ✅ JWT token blacklisting with automatic cleanup
  - ✅ Session security features and hijacking detection
  - ✅ Failed attempt tracking with client IP monitoring
- ✅ Enhanced security headers middleware (`middleware/errors.go`):
  - ✅ HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
  - ✅ CORS with configurable origins (development vs production modes)
  - ✅ Special CSP handling for Swagger UI endpoints
  - ✅ Permissions Policy headers for privacy protection
- ✅ Created request security controls (`middleware/security.go`):
  - ✅ Request size limits with configurable thresholds (default: 10MB)
  - ✅ Request timeout protection (default: 30s)
  - ✅ User-Agent filtering blocking malicious patterns (sqlmap, nikto, default curl, etc.)
  - ✅ File upload security with extension and size validation
  - ✅ IP whitelist support for admin endpoints
  - ✅ Comprehensive request logging for security monitoring
- ✅ Enhanced security audit logging (`utils/logger.go`):
  - ✅ Structured security event logging with standardized fields
  - ✅ Specialized logging functions for different violation types
  - ✅ Security event categorization (rate_limit, brute_force, suspicious_request, etc.)
  - ✅ Integration with existing zerolog structured logging system
- ✅ Dependency injection integration (`container/container.go`, `main.go`):
  - ✅ All security middleware integrated into DI container
  - ✅ Applied to appropriate endpoint groups with proper middleware ordering
  - ✅ Conditional activation based on configuration settings
  - ✅ Security middleware applied to documentation endpoints
- ✅ Comprehensive security testing (`tests/security_integration_test.go`):
  - ✅ Integration tests for all middleware components
  - ✅ Configuration validation and middleware creation tests
  - ✅ Token blacklist functionality tests
  - ✅ Performance benchmarks showing minimal overhead (<40ns/op)
  - ✅ Rate limiting, brute force protection, and security header tests
- ✅ Updated documentation:
  - ✅ Created comprehensive configuration guide (`docs/configuration.md`)
  - ✅ Updated README.md with proper User-Agent headers for curl examples
  - ✅ Environment variable reference with examples for dev/prod/high-security deployments
- ✅ All API tests passing and application builds successfully
- ✅ Security features active and protecting all endpoints with minimal performance impact

## ✅ 15. Health Checks & Metrics - COMPLETED

- ✅ Added comprehensive health check system with three endpoints:
  - ✅ `/health/live` - Liveness probe (always returns 200 if process running)
  - ✅ `/health/ready` - Readiness probe (checks database connectivity and service availability)
  - ✅ `/health` - Detailed health endpoint (comprehensive system information with configurable access)
- ✅ Created health check models (`models/health.go`) with status enums and response structures
- ✅ Implemented health service (`services/health_service.go`) with database monitoring, resource checks, and caching
- ✅ Added health configuration (`config/config.go`) with environment variables for all settings
- ✅ Created health constants (`constants/health.go`) for endpoints and configuration defaults
- ✅ Integrated health service into DI container with proper dependency injection
- ✅ Added health handler (`handlers/health.go`) with IP-based access control for detailed endpoint
- ✅ Registered health endpoints in main.go with conditional enablement
- ✅ Created comprehensive health tests (`tests/health_test.go`) covering models, configuration, and service behavior
- ✅ Updated documentation (`docs/configuration.md`) with health check configuration guide and Kubernetes examples
- ✅ Health endpoints return appropriate HTTP status codes (200/503) for orchestration systems
- ❌ Integrate basic metrics (e.g., Prometheus) for monitoring. - Will do later, see @PLAN-metrics.md

## ✅ 16. Tests - COMPLETED

- ✅ Comprehensive unit test suite for all service layers:
  - ✅ **SessionService** - 21 test cases covering CRUD operations, pagination, validation, and error scenarios
  - ✅ **AuthService** - 13 test cases covering authentication, profile updates, token management, and security validations
  - ✅ **UserService** - 15 test cases covering user operations, ownership validation, and data transformation
  - ✅ **LocationService** - Already had comprehensive test coverage with GeoJSON processing and tracking functionality
  - ✅ **Utils package** - Extensive test coverage for utility functions
- ✅ Established robust testing patterns using testify/assert and testify/mock for consistency
- ✅ Created comprehensive mock system (`services/mocks/mock_repositories.go`) for database abstraction
- ✅ Focused unit tests on business logic validation while identifying integration test needs for complex PocketBase features
- ✅ **Total Test Coverage**: 49+ test cases across all services with 100% test success rate
- ✅ All tests passing and integrated into build process
- ✅ Created test helper functions and reusable patterns for future test development
- ❌ Integration tests for key API flows - Planned for future implementation
- ❌ Handler and middleware unit tests - Lower priority, would benefit from integration testing approach

## ✅ 17. Main.go Cleanup - COMPLETED

- ✅ Reduced main.go to app initialization and route registration only
- ✅ Consolidated two OnBeforeServe hooks into one organized hook
- ✅ Extracted route setup into organized helper functions:
  - ✅ `setupGlobalMiddleware()` - Configures global middleware in correct order
  - ✅ `setupAPIRoutes()` - All API endpoint configuration grouped by domain
  - ✅ `setupDocumentationRoutes()` - Swagger/documentation endpoints
  - ✅ `setupHealthRoutes()` - Health check endpoints with conditional enablement
  - ✅ `setupStaticRoutes()` - Frontend static file serving
- ✅ Main function now focused only on:
  - ✅ App initialization and configuration loading
  - ✅ Logger and DI container setup
  - ✅ Single OnBeforeServe hook calling organized setup functions
- ✅ Code compilation successful and application starts correctly
- ✅ All existing functionality preserved with improved organization

## ✅ 18. Code Style & CI - COMPLETED

- ✅ Implemented comprehensive code style enforcement:
  - ✅ Git hooks for local enforcement (pre-commit: formatting & linting, pre-push: tests & build)
  - ✅ Cost-effective GitHub Actions CI workflow (minimal usage: ~100-200 minutes/month)
  - ✅ Automated formatting with `go fmt` validation
  - ✅ Static analysis with `go vet`, `staticcheck`, and `golangci-lint`
- ✅ Created development tools and scripts:
  - ✅ `scripts/lint.sh` - Manual linting and quality checks
  - ✅ `scripts/install-hooks.sh` - Automated Git hooks setup
  - ✅ `.golangci.yml` - Comprehensive linter configuration
  - ✅ `.github/workflows/ci.yml` - GitHub Actions CI/CD pipeline
- ✅ Enhanced developer experience:
  - ✅ `CONTRIBUTING.md` - Complete development guidelines and workflow
  - ✅ Updated `CLAUDE.md` with setup instructions and development commands
  - ✅ Updated `.gitignore` with development tool artifacts
  - ✅ IDE configuration recommendations and settings
- ✅ Quality enforcement strategy:
  - ✅ **Local-first**: Git hooks catch issues before commits/pushes
  - ✅ **CI verification**: GitHub Actions validate PRs and main branch
  - ✅ **Cost-optimized**: Minimal cloud resources usage with aggressive caching
  - ✅ **Developer-friendly**: Easy bypass options and clear error messages
- ✅ All tools installed and tested successfully:
  - ✅ `staticcheck` for advanced static analysis
  - ✅ `golangci-lint` for comprehensive linting
  - ✅ `govulncheck` for security vulnerability detection
- ✅ Complete setup validation: linting, formatting, tests, and build checks all pass

---

**Outcome:**

- Modular, maintainable, and testable codebase.
- Consistent API and error handling.
- Easier onboarding and future feature development.
- Production-ready with monitoring, security, and documentation.
