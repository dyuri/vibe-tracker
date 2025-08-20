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

## 4. Middleware Extraction
- Implement authentication middleware (JWT, custom token).
- Add user lookup and error handling middleware.
- Centralize input validation middleware.

## 5. Models Definition
- Define request/response structs in `models/`:
  - `LoginRequest`, `SessionRequest`, `TrackingData`, etc.
  - `UserResponse`, `SessionResponse`, `LocationResponse`, etc.
- Add struct tags for validation.

## 6. Services Layer
- Move business logic to `services/`:
  - `auth_service.go` (auth, token management)
  - `session_service.go` (session logic)
  - `location_service.go` (tracking, GeoJSON)
  - `user_service.go` (user operations)
- Services should use repositories for DB access.

## 7. Repository Layer
- Abstract DB operations in `repositories/`:
  - `user_repository.go`, `session_repository.go`, `location_repository.go`
- Use interfaces for easier mocking/testing.

## 8. Constants & Config
- Move all hardcoded values (pagination, limits, etc.) to `constants/`.
- Create a `config/` package for environment variables and app settings.

## 9. Validation
- Use struct tags and validation libraries (e.g., go-playground/validator) for input validation.
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
