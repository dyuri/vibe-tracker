# Contributing to Vibe Tracker

Welcome to the Vibe Tracker project! This document provides guidelines for contributing to this location tracking application built with Go/PocketBase backend and Leaflet.js frontend.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Git Workflow](#git-workflow)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Tools and Commands](#tools-and-commands)

## Getting Started

### Prerequisites

- Go 1.23.6 or later
- Node.js (for frontend development and testing)
- Git

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd vibe-tracker-gemini
   ```

2. **Install Go dependencies:**
   ```bash
   go mod download
   ```

3. **Install development tools:**
   ```bash
   # Install static analysis tools
   go install honnef.co/go/tools/cmd/staticcheck@latest
   go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
   go install golang.org/x/vuln/cmd/govulncheck@latest
   ```

4. **Set up Git hooks (recommended):**
   ```bash
   # Run the installation script
   ./scripts/install-hooks.sh
   
   # Or manually configure Git to use our hooks
   git config core.hooksPath .githooks
   ```

5. **Start the development server:**
   ```bash
   go run . serve
   ```

   - Admin UI: http://localhost:8090/_/
   - Client: http://localhost:8090/
   - API: http://localhost:8090/api/
   - API Documentation: http://localhost:8090/swagger

## Code Style Guidelines

### Go Code Style

- **Formatting**: All Go code must be formatted with `go fmt`
- **Indentation**: Use tabs for indentation (Go standard)
- **Line Length**: Try to keep lines under 100 characters
- **Naming**: Follow Go naming conventions
  - Use camelCase for variables and functions
  - Use PascalCase for exported functions and types
  - Use ALL_CAPS for constants
- **Comments**: Write clear, concise comments for exported functions and complex logic
- **Error Handling**: Always handle errors explicitly, don't ignore them

### Frontend Code Style

- **Indentation**: Use 2 spaces for HTML, JavaScript, and CSS
- **JavaScript**: Use semicolons (old school style)
- **Line Length**: Try to keep lines under 100 characters
- **Comments**: Use JSDoc style comments for functions

### General Guidelines

- Write self-documenting code
- Prefer clarity over cleverness
- Keep functions small and focused
- Use meaningful variable and function names
- Avoid deep nesting when possible

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical bug fixes
- `refactor/description` - Code refactoring

### Commit Messages

Follow the conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add JWT token refresh endpoint

fix(sessions): handle session deletion edge case

docs(api): update authentication documentation
```

### Git Hooks

We use Git hooks to enforce code quality:

- **pre-commit**: Runs formatting checks and basic linting
- **pre-push**: Runs full test suite and build checks

To bypass hooks in emergency situations (use sparingly):
```bash
git commit --no-verify
git push --no-verify
```

## Testing

### Running Tests

```bash
# Run all tests
go test ./...

# Run tests with race detection
go test -race ./...

# Run tests with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Test Credentials

For integration testing:
- Username: `claude@claude.ai`
- Password: `claude123`
- Test data usually available under `/u/dyuri`

### Frontend Testing

We use Playwright for frontend testing:

```bash
# Install Playwright (if not already installed)
npm install -g playwright

# Run frontend tests
playwright test
```

### Writing Tests

- Write unit tests for all service layer functions
- Use table-driven tests where appropriate
- Mock external dependencies using testify/mock
- Follow the pattern: Arrange, Act, Assert
- Test both happy paths and error cases

## Pull Request Process

1. **Before submitting:**
   - Ensure your code passes all linting and tests
   - Run `./scripts/lint.sh` to verify locally
   - Update documentation if needed
   - Add tests for new functionality

2. **Create the pull request:**
   - Use a descriptive title
   - Fill out the PR template completely
   - Reference any related issues
   - Add screenshots for UI changes

3. **During review:**
   - Respond to feedback promptly
   - Make requested changes in separate commits
   - Keep the PR focused and avoid scope creep

4. **After approval:**
   - Squash commits if requested
   - Ensure CI passes
   - Merge using the "Squash and merge" strategy

## Project Structure

```
vibe-tracker-gemini/
├── .github/workflows/     # GitHub Actions CI/CD
├── .githooks/            # Git hooks for local development
├── config/               # Application configuration
├── constants/            # Application constants
├── container/            # Dependency injection container
├── docs/                 # Documentation and API specs
├── handlers/             # HTTP request handlers
├── middleware/           # HTTP middleware
├── migrations/           # Database migrations
├── models/               # Data models and DTOs
├── public/               # Static frontend files
├── repositories/         # Data access layer
├── scripts/              # Development and build scripts
├── services/             # Business logic layer
├── tests/                # Test files
├── utils/                # Utility functions
├── main.go               # Application entry point
├── go.mod                # Go module definition
├── .golangci.yml         # Linter configuration
└── CONTRIBUTING.md       # This file
```

## Tools and Commands

### Development Scripts

```bash
# Run linting and static analysis
./scripts/lint.sh

# Install Git hooks
./scripts/install-hooks.sh

# Generate API documentation
./scripts/generate-docs.sh
```

### Manual Commands

```bash
# Format all Go code
go fmt ./...

# Run static analysis
go vet ./...
staticcheck ./...
golangci-lint run

# Build the application
go build ./...

# Run with specific environment
go run . serve --dev

# Run tests with verbose output
go test -v ./...
```

### IDE Configuration

#### VS Code Settings

Recommended `.vscode/settings.json`:

```json
{
  "go.formatTool": "gofmt",
  "go.lintTool": "golangci-lint",
  "go.testFlags": ["-v"],
  "editor.tabSize": 2,
  "editor.insertSpaces": false,
  "editor.rulers": [100],
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true
}
```

#### Recommended Extensions

- Go (Google)
- golangci-lint (golangci)
- REST Client (for API testing)
- GitLens
- Thunder Client (for API testing)

## Getting Help

- Check existing issues and PRs before creating new ones
- Join discussions in issue comments
- Review the API documentation at `/swagger` when server is running
- Read the project README for basic usage information

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to Vibe Tracker! 🎉