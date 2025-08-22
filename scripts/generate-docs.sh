#!/bin/bash

# Generate API documentation using swaggo/swag
# This script creates OpenAPI/Swagger documentation from code annotations

set -e

echo "📚 Generating API documentation..."

# Check if swag is installed
if ! command -v swag &> /dev/null; then
    echo "❌ swag is not installed. Installing..."
    go install github.com/swaggo/swag/cmd/swag@latest
fi

# Generate swagger docs
echo "🔄 Running swag init..."
swag init --generalInfo main.go --output docs/api

# Check if generation was successful
if [ -f "docs/api/swagger.json" ] && [ -f "docs/api/swagger.yaml" ]; then
    echo "✅ API documentation generated successfully!"
    echo "📄 Files created:"
    echo "   - docs/api/swagger.json"
    echo "   - docs/api/swagger.yaml"
    echo "   - docs/api/docs.go"
    echo ""
    echo "🌐 To view the documentation:"
    echo "   - Start the server: go run . serve"
    echo "   - Open: http://localhost:8090/swagger/index.html"
else
    echo "❌ Failed to generate documentation"
    exit 1
fi