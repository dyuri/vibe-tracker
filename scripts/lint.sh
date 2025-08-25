#!/bin/bash

# Vibe Tracker Linting Script
# This script runs all the linting and static analysis tools

set -e

echo "🔍 Running code quality checks..."

# Go formatting check
echo "📝 Checking Go formatting..."
UNFORMATTED=$(go fmt ./...)
if [ -n "$UNFORMATTED" ]; then
    echo "❌ The following files are not formatted:"
    echo "$UNFORMATTED"
    exit 1
fi
echo "✅ Go formatting check passed"

# Go vet - built-in static analysis
echo "🔎 Running go vet..."
go vet ./...
echo "✅ go vet passed"

# Staticcheck - advanced static analysis
echo "🔍 Running staticcheck..."
if command -v staticcheck >/dev/null 2>&1; then
    staticcheck ./...
    echo "✅ staticcheck passed"
else
    echo "⚠️  staticcheck not found, install with: go install honnef.co/go/tools/cmd/staticcheck@latest"
fi

# Golangci-lint (if available)
echo "🔧 Running golangci-lint..."
if command -v golangci-lint >/dev/null 2>&1; then
    golangci-lint run
    echo "✅ golangci-lint passed"
else
    echo "⚠️  golangci-lint not found, install with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"
fi

# Build check
echo "🏗️  Checking if project builds..."
go build -o /tmp/vibe-tracker-lint-test .
rm -f /tmp/vibe-tracker-lint-test
echo "✅ Build check passed"

# TypeScript type check
echo "🔧 Running TypeScript checks..."
if command -v npm >/dev/null 2>&1; then
    npx tsc --noEmit --skipLibCheck
    echo "✅ TypeScript checks passed"
else
    echo "⚠️  npm not found, skipping TypeScript checks"
fi

# Test check
echo "🧪 Running tests..."
go test ./...
echo "✅ Tests passed"

echo "🎉 All code quality checks passed!"