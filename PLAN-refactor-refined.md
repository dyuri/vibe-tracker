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

## 8. Constants & Config
- Move all hardcoded values (pagination, limits, etc.) to `constants/`.
- Create a `config/` package for environment variables and app settings.

## 9. Validation
- Use struct tags and validation libraries for input validation.
- Add validation checks to all endpoints.

## 10. Response Standardization
- Create response builder utilities for consistent API responses.
- Ensure all endpoints return standardized error and success formats.

## 11. Logging & Error Handling
- Replace log.Printf with a structured logger (e.g., zap, zerolog).
- Define custom error types for common API errors.
- Use error wrapping for traceability.

## 12. Dependency Injection
- Use constructor functions or a lightweight DI pattern for services and repositories.
- Pass dependencies via context where appropriate.

## 13. API Documentation
- Add Swagger/OpenAPI annotations to handlers.
- Generate and publish API docs for onboarding and external use.

## 14. Security & Rate Limiting
- Add rate limiting middleware for sensitive endpoints.
- Consider CSRF protection for POST/PUT/DELETE if exposed to browsers.
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
