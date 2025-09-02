# Playwright Integration Tests Implementation Plan

## Overview

Add comprehensive Playwright E2E tests for the Vibe Tracker application, covering authentication, location tracking, session management, and user workflows.

## 1. **Core Configuration** ✅ COMPLETED

- ✅ Create `playwright.config.ts` with test settings, Chrome browser configuration, and test patterns
- ✅ Configure base URL, timeout settings, and test data directory structure
- ✅ Set up test report generation and screenshot capture on failures
- ✅ **Browser Focus**: Chrome only for initial implementation
- ✅ Web server integration with Go backend and health checks
- ✅ Test artifacts configuration (screenshots, videos, traces)

## 2. **Test Environment Setup**

### Database Management

- Create `tests/fixtures/template.db` - clean PocketBase database with schema
- Implement database isolation using temporary files per test run
- Add database seeding utilities for consistent test data

### Global Setup & Teardown

- `tests/global-setup.ts` - Start Go backend with test database, wait for readiness
- `tests/global-teardown.ts` - Stop backend, cleanup temp files
- Add health check utility to ensure backend is ready before tests

## 3. **Test Infrastructure**

### Authentication Helpers

- `tests/helpers/auth.ts` - Login via API, manage JWT tokens and storageState
- Support for test credentials from environment variables (`$TEST_EMAIL`, `$TEST_PASSWORD`)
- Reusable authentication contexts for different user roles

### Test Data Management

- `tests/helpers/test-data.ts` - Create users, sessions, locations via API
- `tests/fixtures/` - Static test data (sample locations, session configs)
- Cleanup utilities for test isolation

### Custom Fixtures

- Page object models for major app sections (login, map, profile, sessions)
- Reusable workflows (login flow, location creation, session management)
- API request helpers for direct backend interaction

## 4. **Test Suites**

### Authentication Tests (`tests/e2e/auth.spec.ts`)

- Login/logout flows
- Registration process
- Token validation and refresh
- Profile management (avatar upload, settings)

### Location Tracking Tests (`tests/e2e/tracking.spec.ts`)

- Manual location posting
- Map display and interaction
- Public vs private locations
- Location history and filtering

### Session Management Tests (`tests/e2e/sessions.spec.ts`)

- Create/edit/delete sessions
- Session visibility settings
- Session listing and pagination
- Navigation between sessions

### User Interface Tests (`tests/e2e/ui.spec.ts`)

- SPA navigation and routing
- Widget functionality (login, theme toggle)
- Responsive design testing
- Error handling and user feedback

### Integration Workflows (`tests/e2e/workflows.spec.ts`)

- Complete user journeys (signup → create session → track locations → share)
- Cross-user interactions (public location viewing)
- Data consistency across UI and API

## 5. **CI/CD Integration**

- Add test environment setup to GitHub Actions
- Configure test database initialization in CI
- Add test results reporting and artifact collection
- Implement parallel test execution for faster CI runs

## 6. **Documentation & Maintenance**

- Update README with E2E testing instructions
- Create debugging guide for test failures
- Add test data management documentation
- Set up test maintenance procedures

## File Structure

```
tests/
├── e2e/
│   ├── auth.spec.ts
│   ├── tracking.spec.ts
│   ├── sessions.spec.ts
│   ├── ui.spec.ts
│   └── workflows.spec.ts
├── helpers/
│   ├── auth.ts
│   ├── test-data.ts
│   └── api-client.ts
├── fixtures/
│   ├── template.db
│   └── sample-data.json
├── global-setup.ts
├── global-teardown.ts
└── playwright.config.ts
```

## Implementation Notes

- **Chrome Focus**: Initial implementation will target Chrome browser only for simplicity
- **Database Strategy**: Use ephemeral test database files per test run for maximum isolation
- **Authentication**: Store and reuse storageState to avoid repeated login UI interactions
- **Test Data**: Create via API calls for true integration testing
- **CI/CD**: Ensure backend is fully operational before running tests

This plan provides comprehensive E2E testing while maintaining test isolation, supporting CI/CD, and following Playwright best practices for PocketBase applications.
