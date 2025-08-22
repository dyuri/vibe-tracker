# Vibe Tracker Configuration

This document describes all available configuration options for the Vibe Tracker API. Configuration is managed through environment variables with sensible defaults.

## Environment Variables

### General Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENVIRONMENT` | string | `development` | Application environment (`development`, `production`) |
| `AUTOMIGRATE` | bool | `true` | Enable automatic database migrations on startup |

### Security Configuration

#### Core Security Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SECURITY_ENABLE_RATE_LIMITING` | bool | `true` | Enable rate limiting middleware |
| `SECURITY_RATE_LIMIT_STRICT` | bool | `false` | Use strict rate limiting (per-IP vs global) |
| `SECURITY_MAX_REQUEST_SIZE` | int64 | `10485760` | Maximum request size in bytes (10MB) |
| `SECURITY_REQUEST_TIMEOUT` | duration | `30s` | Request timeout duration |
| `SECURITY_ENABLE_REQUEST_LOGS` | bool | `true` | Enable detailed request logging |

#### Authentication Security

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SECURITY_ENABLE_BRUTE_FORCE_PROTECTION` | bool | `true` | Enable brute force protection |
| `SECURITY_FAILED_LOGIN_THRESHOLD` | int | `5` | Failed login attempts before lockout |
| `SECURITY_ACCOUNT_LOCKOUT_DURATION` | duration | `15m` | Account lockout duration |

#### CORS Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SECURITY_CORS_ALLOW_ALL` | bool | `true` (dev), `false` (prod) | Allow all CORS origins |
| `SECURITY_CORS_ALLOWED_ORIGINS` | string | `""` | Comma-separated list of allowed origins |

#### Security Headers

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SECURITY_HSTS_ENABLED` | bool | `true` (prod), `false` (dev) | Enable HTTP Strict Transport Security |
| `SECURITY_CSP_ENABLED` | bool | `true` | Enable Content Security Policy |

### Rate Limiting Configuration

Rate limits are defined per endpoint type. Values are requests per minute.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_AUTH` | int | `5` | Auth endpoints (login, token refresh) |
| `RATE_LIMIT_TRACKING` | int | `60` | Location tracking endpoints |
| `RATE_LIMIT_SESSION` | int | `30` | Session management endpoints |
| `RATE_LIMIT_PUBLIC` | int | `100` | Public location viewing endpoints |
| `RATE_LIMIT_DOCS` | int | `10` | Documentation endpoints (Swagger) |

### Content Security Policy

CSP directives can be customized for different security requirements.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CSP_DEFAULT_SRC` | string | `'self'` | Default source directive |
| `CSP_SCRIPT_SRC` | string | `'self' 'unsafe-inline'` | Script source directive |
| `CSP_STYLE_SRC` | string | `'self' 'unsafe-inline'` | Style source directive |
| `CSP_IMG_SRC` | string | `'self' data: https:` | Image source directive |
| `CSP_CONNECT_SRC` | string | `'self'` | Connect source directive |
| `CSP_FONT_SRC` | string | `'self'` | Font source directive |

### File Upload Security

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MAX_FILE_UPLOAD_SIZE` | int64 | `5242880` | Maximum file upload size in bytes (5MB) |

## Configuration Examples

### Development Environment

```bash
# .env.development
ENVIRONMENT=development
SECURITY_CORS_ALLOW_ALL=true
SECURITY_HSTS_ENABLED=false
SECURITY_ENABLE_REQUEST_LOGS=true
RATE_LIMIT_AUTH=10
```

### Production Environment

```bash
# .env.production
ENVIRONMENT=production
SECURITY_CORS_ALLOW_ALL=false
SECURITY_CORS_ALLOWED_ORIGINS=https://vibetracker.com,https://www.vibetracker.com
SECURITY_HSTS_ENABLED=true
SECURITY_CSP_ENABLED=true
SECURITY_ENABLE_BRUTE_FORCE_PROTECTION=true
SECURITY_FAILED_LOGIN_THRESHOLD=3
SECURITY_ACCOUNT_LOCKOUT_DURATION=30m
RATE_LIMIT_AUTH=5
RATE_LIMIT_PUBLIC=50
```

### High Security Environment

```bash
# .env.high-security
ENVIRONMENT=production
SECURITY_RATE_LIMIT_STRICT=true
SECURITY_MAX_REQUEST_SIZE=1048576  # 1MB
SECURITY_REQUEST_TIMEOUT=10s
SECURITY_FAILED_LOGIN_THRESHOLD=3
SECURITY_ACCOUNT_LOCKOUT_DURATION=1h
RATE_LIMIT_AUTH=3
RATE_LIMIT_TRACKING=30
RATE_LIMIT_PUBLIC=20
```

## Security Recommendations

### Production Deployment

1. **Enable HTTPS**: Set `SECURITY_HSTS_ENABLED=true`
2. **Restrict CORS**: Set specific origins in `SECURITY_CORS_ALLOWED_ORIGINS`
3. **Enable CSP**: Keep `SECURITY_CSP_ENABLED=true`
4. **Brute Force Protection**: Use low thresholds (`SECURITY_FAILED_LOGIN_THRESHOLD=3`)
5. **Rate Limiting**: Adjust limits based on expected traffic patterns

### High Traffic Environments

1. **Increase Rate Limits**: Adjust limits for your traffic patterns
2. **Optimize Request Size**: Set appropriate `SECURITY_MAX_REQUEST_SIZE`
3. **Request Timeout**: Balance between user experience and resource protection
4. **Logging**: Consider disabling `SECURITY_ENABLE_REQUEST_LOGS` for performance

### API-Only Deployments

```bash
# Strict API-only configuration
SECURITY_CORS_ALLOWED_ORIGINS=https://your-frontend.com
CSP_DEFAULT_SRC='none'
CSP_SCRIPT_SRC='none'
CSP_STYLE_SRC='none'
RATE_LIMIT_PUBLIC=200  # Higher for API usage
```

## Monitoring and Observability

The application logs security events with structured logging. Key metrics to monitor:

- **Rate limit violations**: `security_event=rate_limit_exceeded`
- **Brute force attempts**: `security_event=brute_force_attempt`
- **Suspicious requests**: `security_event=suspicious_request`
- **Security violations**: `security_event=security_violation`

## Configuration Validation

The application validates configuration on startup and will fail to start with invalid values:

- Duration values must be valid Go duration strings (e.g., `30s`, `5m`, `1h`)
- Integer values must be positive
- CORS origins must be valid URLs when not allowing all
- Rate limits should be reasonable (typically 1-1000 requests per minute)

## Default Security Behavior

Without any environment variables set, the application runs with:

- Development-friendly CORS (allows all origins)
- Moderate rate limiting
- Basic security headers
- Brute force protection enabled
- Request logging enabled
- HSTS disabled (suitable for HTTP development)

This provides a secure baseline while remaining developer-friendly for local development.