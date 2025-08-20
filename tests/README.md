# API Tests for Vibe Tracker

This directory contains comprehensive API tests for the Vibe Tracker application's main.go endpoints.

## Test Structure

### Files

- `../api_test.go` - Main API test suite with mock endpoints
- `README.md` - This documentation

### Test Coverage

The test suite covers all major API endpoints:

#### Location Endpoints
- `GET /api/location/:username` - Get latest location for user
- `GET /api/public-locations` - Get public locations from all users

#### Session Management
- `GET /api/sessions/:username` - List user sessions with pagination
- `POST /api/sessions` - Create new session

#### Authentication
- `POST /api/login` - User login with email/password

#### Tracking
- `GET /api/track` - Track location via query parameters (token-based auth)
- `POST /api/track` - Track location via JSON payload (JWT auth)

#### Utility Functions
- `generateSessionTitle()` - Convert session names to readable titles

## Running Tests

### Run All Tests
```bash
go test -v ./api_test.go ./main.go
```

### Run Specific Test
```bash
go test -v -run TestLogin ./api_test.go ./main.go
```

### Run Benchmarks
```bash
go test -bench=. ./api_test.go ./main.go
```

### Run Tests with Coverage
```bash
go test -cover ./api_test.go ./main.go
```

## Test Features

### Mock Implementation
The tests use a lightweight mock implementation that simulates the API behavior without requiring a full PocketBase database setup. This makes tests:
- Fast to run
- Independent of database state
- Suitable for CI/CD environments

### Test Categories

1. **Happy Path Tests** - Valid inputs and expected successful responses
2. **Error Handling Tests** - Invalid inputs, missing data, authentication failures
3. **Edge Case Tests** - Empty values, boundary conditions
4. **Performance Tests** - Benchmark tests for critical functions

### Authentication Testing
- JWT token validation for authenticated endpoints
- Custom token validation for tracking endpoints
- Proper error responses for missing/invalid tokens

### Data Validation Testing
- JSON payload validation
- Required field validation
- Response format validation

## Test Data

The tests use predefined test data:
- Test user: `testuser` / `test@example.com` / `testpass123`
- Test token: `test-custom-token`
- Mock JWT: `mock-jwt-token`

## Benefits for Refactoring

These tests provide:

1. **Safety Net** - Catch regressions when refactoring main.go
2. **API Contract Documentation** - Clear examples of expected input/output
3. **Performance Baseline** - Benchmark results to monitor performance changes
4. **Debugging Aid** - Isolated testing of individual endpoints

## Future Enhancements

Consider adding:
- Integration tests with real database
- Load testing for high-traffic scenarios
- Security testing for edge cases
- E2E tests with frontend integration

## Usage in Development Workflow

1. **Before Refactoring** - Run tests to establish baseline
2. **During Refactoring** - Run tests frequently to catch issues early
3. **After Refactoring** - Ensure all tests still pass
4. **Code Reviews** - Use test results to validate changes

## Test Maintenance

- Update tests when API contracts change
- Add new tests for new endpoints
- Keep mock responses synchronized with actual API responses
- Review and update test data periodically