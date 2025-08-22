# Metrics & Monitoring Implementation Plan

## Overview
Implement comprehensive metrics collection and monitoring using Prometheus for observability, performance monitoring, and operational insights. This will provide detailed application and business metrics for production monitoring systems.

## 1. Metrics System Architecture

### 1.1 Metrics Handler (`handlers/metrics.go`)
- **Metrics Endpoint**: `/metrics` - Prometheus format metrics
- **Authentication**: Optional IP-based access control
- **Performance**: Efficient metrics serialization
- **Security**: Configurable access restrictions

### 1.2 Metrics Service (`services/metrics_service.go`)
- **Metrics Registry**: Central metrics management
- **Custom Collectors**: Business-specific metrics
- **Performance Monitoring**: Request/response metrics
- **Resource Tracking**: System and application metrics

### 1.3 Metrics Middleware (`middleware/metrics.go`)
- **HTTP Metrics**: Request duration, count, size
- **Automatic Labeling**: Method, path, status code
- **Low Overhead**: Optimized for production use
- **Integration**: Works with existing middleware stack

### 1.4 Metrics Configuration
- Add `MetricsConfig` to existing `AppConfig`
- Environment variables:
  - `METRICS_ENABLED=true` - Enable metrics collection
  - `METRICS_PATH=/metrics` - Metrics endpoint path
  - `METRICS_AUTH_ENABLED=false` - Require IP whitelisting
  - `METRICS_ALLOWED_IPS=""` - Comma-separated allowed IPs
  - `METRICS_NAMESPACE=vibe_tracker` - Prometheus namespace

## 2. Metrics Categories

### 2.1 HTTP Request Metrics
- **Request Duration**: Histogram with percentiles (50th, 90th, 95th, 99th)
  - Labels: method, path, status_code
- **Request Count**: Counter by endpoint
  - Labels: method, path, status_code
- **Request Size**: Histogram of request body sizes
- **Response Size**: Histogram of response body sizes
- **Active Requests**: Gauge of concurrent requests

### 2.2 Application Metrics
- **User Metrics**:
  - Total registered users (gauge)
  - Active users (last 24h, 7d, 30d)
  - New user registrations (counter)
- **Session Metrics**:
  - Total sessions (gauge)
  - Active sessions (gauge)
  - Sessions created/deleted (counter)
- **Location Metrics**:
  - Location points tracked (counter)
  - Tracking events per minute (gauge)
  - Data volume processed (counter)

### 2.3 Security Metrics
- **Authentication Metrics**:
  - Login attempts (counter) - success/failure
  - Token refreshes (counter)
  - Authentication errors (counter)
- **Rate Limiting Metrics**:
  - Rate limit violations (counter) - by endpoint type
  - Blocked requests (counter) - by reason
- **Security Events**:
  - Brute force attempts (counter)
  - Suspicious requests (counter)
  - Security violations (counter) - by type

### 2.4 System Metrics
- **Runtime Metrics**:
  - Go runtime stats (goroutines, memory, GC)
  - Process metrics (CPU, memory, file descriptors)
- **Database Metrics**:
  - Query duration (histogram)
  - Database connections (gauge)
  - Database errors (counter)
- **Performance Metrics**:
  - Response time by service layer
  - Cache hit/miss ratios

## 3. Implementation Details

### 3.1 Prometheus Integration
- Use `prometheus/client_golang` library
- Standard metric types: Counter, Gauge, Histogram, Summary
- Custom collectors for business metrics
- Efficient metric registration and collection

### 3.2 Metric Naming Convention
- Namespace: `vibe_tracker`
- Format: `{namespace}_{subsystem}_{metric}_{unit}`
- Examples:
  - `vibe_tracker_http_requests_total`
  - `vibe_tracker_http_request_duration_seconds`
  - `vibe_tracker_users_active_total`
  - `vibe_tracker_locations_tracked_total`

### 3.3 Labels Strategy
- **Consistent Labeling**: Same labels across related metrics
- **Cardinality Control**: Avoid high-cardinality labels
- **Standard Labels**: method, path, status_code, user_type
- **Business Labels**: session_type, location_source, auth_method

### 3.4 Container Integration (`container/container.go`)
- Add `MetricsService` to DI container
- Metrics middleware registration
- Integration with existing services for business metrics

## 4. Metrics Collection Points

### 4.1 Middleware Integration
- HTTP request/response metrics in existing error handler
- Security event metrics in security middleware
- Rate limiting metrics in rate limit middleware
- Authentication metrics in auth middleware

### 4.2 Service Layer Integration
- Business logic metrics in service methods
- Database operation metrics in repository layer
- Custom metrics for domain-specific events

### 4.3 Background Metrics
- Periodic collection of gauge metrics
- System resource monitoring
- Database statistics collection
- Cache performance metrics

## 5. Advanced Features

### 5.1 Custom Business Metrics
- **Session Analysis**:
  - Average session duration
  - Location points per session
  - Session geographic distribution
- **User Behavior**:
  - API endpoint usage patterns
  - Feature adoption rates
  - User retention metrics
- **Performance Insights**:
  - Slow query detection
  - Memory usage patterns
  - Error rate analysis

### 5.2 Alerting Ready Metrics
- **SLI Metrics**: Service Level Indicators
  - Request success rate (>99.9%)
  - Response time percentiles (<200ms p95)
  - System availability (>99.95%)
- **Error Budgets**: Track against SLOs
- **Capacity Metrics**: Resource utilization thresholds

### 5.3 Metrics Aggregation
- **Time-based Aggregation**: Rate calculations over time windows
- **Dimensional Aggregation**: Metrics by user type, session type
- **Geographic Aggregation**: Metrics by location/region (if applicable)

## 6. Configuration Examples

### 6.1 Development Configuration
```bash
METRICS_ENABLED=true
METRICS_PATH=/metrics
METRICS_AUTH_ENABLED=false
METRICS_NAMESPACE=vibe_tracker_dev
```

### 6.2 Production Configuration
```bash
METRICS_ENABLED=true
METRICS_PATH=/internal/metrics    # Non-obvious path
METRICS_AUTH_ENABLED=true
METRICS_ALLOWED_IPS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
METRICS_NAMESPACE=vibe_tracker
```

### 6.3 High-Performance Configuration
```bash
METRICS_ENABLED=true
METRICS_COLLECTION_INTERVAL=30s
METRICS_HISTOGRAM_BUCKETS=0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5,10
METRICS_MAX_CARDINALITY=1000000
```

## 7. Integration with Monitoring Stack

### 7.1 Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'vibe-tracker'
    static_configs:
      - targets: ['vibe-tracker:8090']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 7.2 Grafana Dashboard Templates
- **Application Overview**: Key business metrics
- **HTTP Performance**: Request rates, latencies, errors
- **Security Monitoring**: Authentication, rate limiting, threats
- **System Resources**: Memory, CPU, goroutines, database

### 7.3 Alert Rules
- High error rate alerts
- Response time degradation
- Security event thresholds
- Resource utilization warnings

## 8. Testing Strategy

### 8.1 Metrics Tests (`tests/metrics_test.go`)
- Metrics collection accuracy
- Prometheus format compliance
- Performance impact measurement
- Cardinality validation
- Label consistency testing

### 8.2 Integration Testing
- Prometheus scraping validation
- Grafana dashboard functionality
- Alert rule testing

## 9. Performance Considerations

### 9.1 Collection Efficiency
- Minimal CPU overhead (<1%)
- Memory-efficient metric storage
- Batch processing for high-volume metrics
- Configurable collection intervals

### 9.2 Cardinality Management
- Label value limits
- Automatic cleanup of unused metrics
- Cardinality monitoring and alerting
- Dynamic sampling for high-cardinality metrics

### 9.3 Network Impact
- Efficient metric serialization
- Compression support
- Configurable scrape intervals
- Batch metric updates

## 10. Security Considerations

### 10.1 Access Control
- IP-based access restrictions
- Optional authentication for metrics endpoint
- Network isolation for metrics collection
- Audit logging for metrics access

### 10.2 Information Exposure
- Sanitized metric labels (no PII)
- Aggregated data only (no individual user data)
- Configurable detail levels
- Production vs development metric sets

This plan provides comprehensive metrics and monitoring capabilities essential for production observability and operational excellence.