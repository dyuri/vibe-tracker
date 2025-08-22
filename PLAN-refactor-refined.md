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

## 12. Dependency Injection
- Use constructor functions or a lightweight DI pattern for services and repositories.
- Pass dependencies via context where appropriate.

## 13. API Documentation
- Add Swagger/OpenAPI annotations to handlers.
- Generate and publish API docs for onboarding and external use.

## 14. Security & Rate Limiting
- Add rate limiting middleware for sensitive endpoints.
- Review authentication and authorization logic for consistency.

## 15. Health Checks & Metrics
- Add `/health` endpoint for readiness/liveness checks.
- Integrate basic metrics (e.g., Prometheus) for monitoring.

## 16. Tests
- Write unit tests for handlers, services, repositories, and middleware.
- Add integration tests for key API flows.
- Use mocks for DB and external dependencies.

## 17. Main.go Cleanup
- Reduce main.go to app initialization and route registration only.
- Import and register handlers, middleware, and config.
- Consolidate OnBeforeServe hooks into one.

## 18. Code Style & CI
- Enforce gofmt and golint in CI.
- Add static analysis tools (staticcheck, govet).
- Document code style and contribution guidelines.

---

**Outcome:**
- Modular, maintainable, and testable codebase.
- Consistent API and error handling.
- Easier onboarding and future feature development.
- Production-ready with monitoring, security, and documentation.
