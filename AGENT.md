# Vibe Tracker

This is a simple location tracker website built with Go/PocketBase for the backend and
Leaflet.js for the frontend.

## Generic rules

- Always **PLAN** first, and only start coding when I approved the plan.
- If the plan is saved into a file, update it as you proceed.
- If gemini-bridge is available, use it for web search, or when you have to find something in the codebase.

## Build & Commands

- Run dev server: `go run . serve`
- Run linting: `./scripts/lint.sh`
- Install Git hooks: `./scripts/install-hooks.sh`

### Development Environment

- Admin: http://localhost:8090/\_/
- Client: http://localhost:8090/
- API Documentation: http://localhost:8090/swagger

### Development Setup

For the best development experience, install Git hooks that automatically check code quality:

```bash
# Install required tools
go install honnef.co/go/tools/cmd/staticcheck@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Install Git hooks
./scripts/install-hooks.sh
```

This sets up:

- **pre-commit hook**: Automatically formats code and runs basic linting
- **pre-push hook**: Runs full test suite and build verification

## Code Style

- Go: code is formatted with `go fmt`
  - Use `go fmt` to format the code before committing.
  - Indent go code with tabs.
- Indent HTML, JavaScript and CSS code with 2 spaces.
- Try to use max. 100 characters per line.
- I'm an old school guy, so use semi-colons in JavaScript.

## Testing

- feel free to use playwright for testing the frontend
- test credentials for the webapp:
  - email: $TEST_EMAIL env variable
  - password: $TEST_PASSWORD env variable
- there's usually some test data under `/u/dyuri`
