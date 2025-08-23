#!/bin/bash

# Git Hooks Installation Script for Vibe Tracker
# This script sets up Git hooks for local development

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.githooks"

echo "🔧 Installing Git hooks for Vibe Tracker..."

# Check if we're in a Git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "❌ Error: Not in a Git repository"
    exit 1
fi

# Check if hooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
    echo "❌ Error: Hooks directory not found at $HOOKS_DIR"
    exit 1
fi

# Configure Git to use our custom hooks directory
echo "📁 Configuring Git hooks path..."
git config core.hooksPath .githooks

# Make sure hooks are executable
echo "🔑 Making hooks executable..."
chmod +x "$HOOKS_DIR"/*

# Verify hooks are properly set up
echo "✅ Verifying Git hooks configuration..."
HOOKS_PATH=$(git config core.hooksPath)
if [ "$HOOKS_PATH" != ".githooks" ]; then
    echo "❌ Error: Git hooks path not set correctly"
    echo "Expected: .githooks"
    echo "Got: $HOOKS_PATH"
    exit 1
fi

echo ""
echo "🎉 Git hooks installed successfully!"
echo ""
echo "Installed hooks:"
for hook in "$HOOKS_DIR"/*; do
    if [ -f "$hook" ] && [ -x "$hook" ]; then
        echo "  ✅ $(basename "$hook")"
    fi
done
echo ""
echo "📋 What happens next:"
echo "  • pre-commit: Runs formatting and basic linting before each commit"
echo "  • pre-push: Runs tests and build checks before pushing"
echo ""
echo "💡 Pro tips:"
echo "  • Run './scripts/lint.sh' manually to check your code anytime"
echo "  • Use 'git commit --no-verify' to bypass hooks in emergencies"
echo "  • Use 'git push --no-verify' to bypass pre-push hooks if needed"
echo ""
echo "🛠️  Required tools:"
echo "  Make sure you have installed the following tools:"
echo "  • staticcheck: go install honnef.co/go/tools/cmd/staticcheck@latest"
echo "  • golangci-lint: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"
echo ""

# Check if required tools are installed
echo "🔍 Checking for required tools..."
MISSING_TOOLS=()

if ! command -v staticcheck >/dev/null 2>&1; then
    MISSING_TOOLS+=("staticcheck")
fi

if ! command -v golangci-lint >/dev/null 2>&1; then
    MISSING_TOOLS+=("golangci-lint")
fi

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  Warning: Missing required tools:"
    for tool in "${MISSING_TOOLS[@]}"; do
        echo "  ❌ $tool"
    done
    echo ""
    echo "Install missing tools with:"
    for tool in "${MISSING_TOOLS[@]}"; do
        case $tool in
            "staticcheck")
                echo "  go install honnef.co/go/tools/cmd/staticcheck@latest"
                ;;
            "golangci-lint")
                echo "  go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"
                ;;
        esac
    done
    echo ""
    echo "Hooks are installed but may not work properly without these tools."
else
    echo "✅ All required tools are available"
fi

echo ""
echo "🚀 You're ready to start developing with quality checks!"
echo "   Read CONTRIBUTING.md for more information about the development workflow."