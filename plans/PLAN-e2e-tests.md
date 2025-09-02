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

### Database Management ✅ COMPLETED

- ✅ Create `tests-e2e/fixtures/template.db` - clean PocketBase database with schema
- ✅ Implement database isolation using temporary files per test run
- ✅ Add database seeding utilities for consistent test data
- ✅ Created `tests-e2e/fixtures/sample-data.json` with comprehensive test data
- ✅ Modified main.go to support custom data directory via `--dir` flag

### Global Setup & Teardown ✅ COMPLETED

- ✅ `tests-e2e/global-setup.ts` - Database preparation, Go backend verification, directory setup
- ✅ `tests-e2e/global-teardown.ts` - Process cleanup, database removal, temp file cleanup
- ✅ `tests-e2e/helpers/health-check.ts` - Health check utilities with polling and timeout protection

## 3. **Test Infrastructure** ✅ COMPLETED

### Authentication Helpers ✅ COMPLETED

- ✅ `tests-e2e/helpers/auth.ts` - Login via API, manage JWT tokens and storageState
- ✅ Support for test credentials from environment variables (`$TEST_EMAIL`, `$TEST_PASSWORD`)
- ✅ Reusable authentication contexts for different user roles
- ✅ UI login/logout helper functions
- ✅ Storage state management for persistent authentication

### Test Data Management ✅ COMPLETED

- ✅ `tests-e2e/helpers/test-data.ts` - Create users, sessions, locations via API
- ✅ `tests-e2e/fixtures/` - Static test data (sample locations, session configs)
- ✅ Cleanup utilities for test isolation
- ✅ Batch data creation and scenario setup utilities

### API Client Helper ✅ COMPLETED

- ✅ `tests-e2e/helpers/api-client.ts` - Comprehensive API client for PocketBase
- ✅ Authentication, session, location, and user endpoints
- ✅ Error handling and response standardization
- ✅ Utility functions for common operations (batch operations, condition waiting)

## 4. **Test Suites** ✅ COMPLETED

### Authentication Tests ✅ COMPLETED (`tests-e2e/e2e/auth.spec.ts`)

- ✅ Login/logout flows with UI interactions
- ✅ Invalid credentials error handling
- ✅ Authentication persistence across reloads
- ✅ Token validation and refresh
- ✅ Storage state verification

### Location Tracking Tests ✅ COMPLETED (`tests-e2e/e2e/tracking.spec.ts`)

- ✅ Manual location posting via map widget
- ✅ Map display and marker rendering
- ✅ Public vs private location visibility
- ✅ Location popup interactions
- ✅ Session-based location filtering

### Session Management Tests ✅ COMPLETED (`tests-e2e/e2e/sessions.spec.ts`)

- ✅ Create/edit/delete sessions via UI
- ✅ Session visibility toggling (public/private)
- ✅ Session listing and widget interactions
- ✅ Pagination handling for multiple sessions

### User Interface Tests ✅ COMPLETED (`tests-e2e/e2e/ui.spec.ts`)

- ✅ Main page loading and widget visibility
- ✅ Theme toggle functionality
- ✅ Responsive design testing (mobile/tablet)
- ✅ Error handling for network failures
- ✅ Keyboard navigation support
- ✅ Loading states and consistent styling
- ✅ Window resize handling

### Integration Workflows ✅ COMPLETED (`tests-e2e/e2e/workflows.spec.ts`)

- ✅ Complete user journeys (login → create session → track locations → share)
- ✅ Cross-user interactions (public session visibility)
- ✅ Data consistency between UI and API
- ✅ Error recovery and network failure handling
- ✅ Full session lifecycle testing

## 5. **CI/CD Integration** - SKIP FOR NOW

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
tests-e2e/                    # E2E tests (separate from Go backend tests in tests/)
├── e2e/
│   ├── auth.spec.ts
│   ├── tracking.spec.ts
│   ├── sessions.spec.ts
│   ├── ui.spec.ts
│   └── workflows.spec.ts
├── helpers/
│   ├── auth.ts
│   ├── test-data.ts
│   ├── api-client.ts
│   └── health-check.ts
├── fixtures/
│   ├── template.db
│   └── sample-data.json
├── global-setup.ts
├── global-teardown.ts
└── playwright.config.ts      # Root level
```

## Implementation Notes

- **Chrome Focus**: Initial implementation will target Chrome browser only for simplicity
- **Database Strategy**: Use ephemeral test database files per test run for maximum isolation
- **Authentication**: Store and reuse storageState to avoid repeated login UI interactions
- **Test Data**: Create via API calls for true integration testing
- **CI/CD**: Ensure backend is fully operational before running tests

This plan provides comprehensive E2E testing while maintaining test isolation, supporting CI/CD, and following Playwright best practices for PocketBase applications.
