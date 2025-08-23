# Vibe Tracker API Documentation

This directory contains automatically generated API documentation for the Vibe Tracker application.

## Files

- `swagger.json` - OpenAPI 3.0 specification in JSON format
- `swagger.yaml` - OpenAPI 3.0 specification in YAML format  
- `docs.go` - Generated Go code for embedding documentation

## Viewing the Documentation

### Interactive Swagger UI

When the server is running, you can view the interactive API documentation at:

```
http://localhost:8090/swagger
```

This provides a user-friendly interface to:
- Browse all available endpoints
- View request/response schemas
- Test API endpoints directly from the browser
- See authentication requirements

### Raw Specification

You can also access the raw OpenAPI specification at:

```
http://localhost:8090/swagger/json
```

## API Overview

The Vibe Tracker API provides the following functionality:

### Authentication
- User login with email/password
- JWT token refresh
- Profile management
- Avatar upload
- Custom token generation for tracking

### Session Management
- Create, read, update, delete tracking sessions
- List sessions with pagination
- Session-based location filtering

### Location Tracking
- Track location via GET (query parameters) or POST (JSON)
- Support for both JWT and custom token authentication
- Batch location uploads
- GeoJSON format support

### Public Data Access
- Access public location data
- Retrieve user's latest locations
- Session-specific location data

## Authentication Methods

The API supports two authentication methods:

1. **Bearer Token (JWT)** - For authenticated user operations
   ```
   Authorization: Bearer <jwt_token>
   ```

2. **Custom Token** - For location tracking endpoints
   ```
   ?token=<custom_token>
   ```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "status": "success",
  "data": {...},
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "code": 400,
  "message": "Error description", 
  "details": "Additional error information"
}
```

### Paginated Response
```json
{
  "status": "success",
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalItems": 100,
    "totalPages": 5
  },
  "message": "Data retrieved successfully"
}
```

## Regenerating Documentation

To regenerate the documentation after making changes to the API:

```bash
./scripts/generate-docs.sh
```

This will:
1. Parse Swagger annotations in the code
2. Generate updated `swagger.json` and `swagger.yaml` files
3. Update the embedded Go documentation

## Contributing

When adding new endpoints or modifying existing ones, make sure to:

1. Add appropriate Swagger annotations to your handlers
2. Use consistent response formats
3. Document all parameters and responses
4. Run the documentation generation script
5. Test the updated documentation in the Swagger UI