/**
 * Barrel export for utilities
 * Provides a single import point for all utility functions
 */

// Utility functions
export { generateUserColor } from './utils';

// Service Worker and PWA utilities
export {
  registerServiceWorker,
  isStandalone,
  setupInstallPrompt,
  initializePWA,
  type ServiceWorkerUpdateEvent,
} from './service-worker';

// Performance monitoring utilities
export {
  initializeWebVitals,
  getPerformanceSummary,
  collectMetrics,
  type WebVitalsMetric,
  type PerformanceData,
} from './web-vitals';

// Error handling and boundaries
export {
  withErrorBoundary,
  initializeErrorHandling,
  getErrorHandler,
  reportError,
  getErrorLogs,
  clearErrorLogs,
  type ErrorInfo,
  type ErrorBoundaryOptions,
} from './error-boundary';

// Background sync and offline functionality
export {
  fetchWithSync,
  initializeBackgroundSync,
  getSyncManager,
  queueForSync,
  getSyncQueueStatus,
  clearSyncQueues,
  getFailedSyncItems,
  type SyncQueueItem,
  type SyncOptions,
} from './background-sync';

// Security utilities and CSP
export {
  generateCSPHeader,
  auditSecurity,
  initializeSecurity,
  getSecurityManager,
  validateURL,
  sanitizeInput,
  generateSecureRandom,
  type SecurityConfig,
  type SecurityAuditResult,
  type SecurityIssue,
  type CSPAnalysis,
} from './security';
