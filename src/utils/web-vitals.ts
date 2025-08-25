/**
 * Web Vitals performance monitoring
 * Tracks and reports Core Web Vitals metrics
 */

// Import web-vitals statically to ensure it's available
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  entries: PerformanceEntry[];
}

// Type alias for compatibility with web-vitals Metric type
type WebVitalsCallback = (metric: Metric) => void;

export interface PerformanceData {
  url: string;
  userAgent: string;
  timestamp: number;
  metrics: Record<string, number>;
  navigation: {
    type: string;
    timing: Record<string, number>;
  };
  resources: {
    count: number;
    totalSize: number;
    transferSize: number;
  };
}

/**
 * Initialize Web Vitals monitoring
 */
export async function initializeWebVitals(): Promise<void> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    console.log('📊 Web Vitals: Not in browser environment');
    return;
  }

  try {
    // Verify all functions are available (they should be since we import them statically)
    if (!onCLS || !onFCP || !onINP || !onLCP || !onTTFB) {
      throw new Error('Web Vitals functions not available');
    }

    // Track Core Web Vitals
    onCLS(onWebVitalMetric as WebVitalsCallback);
    onFCP(onWebVitalMetric as WebVitalsCallback);
    onINP(onWebVitalMetric as WebVitalsCallback); // INP replaces FID in newer versions
    onLCP(onWebVitalMetric as WebVitalsCallback);
    onTTFB(onWebVitalMetric as WebVitalsCallback);

    // Track page visibility changes for accurate measurements
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Send any pending metrics when page becomes hidden
        sendPendingMetrics();
      }
    });

    // Track navigation performance
    trackNavigationPerformance();

    console.log('📊 Web Vitals monitoring initialized');
  } catch (error) {
    // Graceful degradation - web-vitals library not available
    console.warn(
      '📊 Web Vitals library not available, falling back to basic performance tracking:',
      error
    );
    // Fall back to basic performance tracking
    trackBasicPerformance();
  }
}

/**
 * Handle Web Vitals metric callback
 */
function onWebVitalMetric(metric: Metric): void {
  // Log the metric for debugging
  console.log(`📈 ${metric.name}:`, {
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
  });

  // Store metric for batch sending
  storeMetric(metric);

  // Send critical metrics immediately
  if (metric.name === 'INP' || (metric.name === 'CLS' && metric.rating === 'poor')) {
    sendMetricImmediately(metric);
  }
}

/**
 * Track basic navigation performance when web-vitals is not available
 */
function trackBasicPerformance(): void {
  window.addEventListener('load', () => {
    if ('performance' in window && 'timing' in window.performance) {
      const timing = window.performance.timing;
      const metrics = {
        pageLoadTime: timing.loadEventEnd - timing.navigationStart,
        domReadyTime: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstByteTime: timing.responseStart - timing.navigationStart,
        renderTime: timing.domComplete - timing.domLoading,
      };

      console.log('📊 Basic Performance Metrics:', metrics);
      storeBasicMetrics(metrics);
    }
  });
}

/**
 * Track navigation performance and resource metrics
 */
function trackNavigationPerformance(): void {
  // Use Performance Observer for more detailed metrics
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          trackNavigationEntry(entry as PerformanceNavigationTiming);
        } else if (entry.entryType === 'resource') {
          trackResourceEntry(entry as PerformanceResourceTiming);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['navigation', 'resource'] });
    } catch (error) {
      console.warn('Performance Observer not fully supported:', error);
    }
  }
}

/**
 * Track navigation timing entry
 */
function trackNavigationEntry(entry: PerformanceNavigationTiming): void {
  const metrics = {
    dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
    tcpConnection: entry.connectEnd - entry.connectStart,
    serverResponse: entry.responseStart - entry.requestStart,
    documentLoad: entry.loadEventEnd - entry.loadEventStart,
    domParsing: entry.domComplete - (entry.domContentLoadedEventStart || entry.requestStart),
  };

  console.log('🔄 Navigation Performance:', metrics);
  storeNavigationMetrics(metrics);
}

/**
 * Track resource timing entry
 */
function trackResourceEntry(entry: PerformanceResourceTiming): void {
  // Aggregate resource metrics
  const resourceData = getStoredResourceData();
  resourceData.count++;
  resourceData.totalSize += entry.transferSize || 0;
  resourceData.transferSize += entry.encodedBodySize || 0;

  storeResourceData(resourceData);
}

// Storage keys for performance data
const METRICS_STORAGE_KEY = 'vibe_vitals_metrics';
const BASIC_METRICS_KEY = 'vibe_basic_metrics';
const NAVIGATION_METRICS_KEY = 'vibe_navigation_metrics';
const RESOURCE_DATA_KEY = 'vibe_resource_data';

/**
 * Store Web Vitals metric for batch sending
 */
function storeMetric(metric: Metric): void {
  try {
    const stored = getStoredMetrics();
    stored[metric.name] = {
      value: metric.value,
      rating: metric.rating,
      timestamp: Date.now(),
    };
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn('Failed to store metric:', error);
  }
}

/**
 * Store basic performance metrics
 */
function storeBasicMetrics(metrics: Record<string, number>): void {
  try {
    localStorage.setItem(
      BASIC_METRICS_KEY,
      JSON.stringify({
        ...metrics,
        timestamp: Date.now(),
      })
    );
  } catch (_error) {
    console.warn('Failed to store basic metrics:', _error);
  }
}

/**
 * Store navigation metrics
 */
function storeNavigationMetrics(metrics: Record<string, number>): void {
  try {
    localStorage.setItem(
      NAVIGATION_METRICS_KEY,
      JSON.stringify({
        ...metrics,
        timestamp: Date.now(),
      })
    );
  } catch (_error) {
    console.warn('Failed to store navigation metrics:', _error);
  }
}

/**
 * Store resource data
 */
function storeResourceData(data: { count: number; totalSize: number; transferSize: number }): void {
  try {
    localStorage.setItem(RESOURCE_DATA_KEY, JSON.stringify(data));
  } catch (_error) {
    console.warn('Failed to store resource data:', _error);
  }
}

/**
 * Get stored metrics
 */
function getStoredMetrics(): Record<string, any> {
  try {
    const stored = localStorage.getItem(METRICS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (_error) {
    return {};
  }
}

/**
 * Get stored resource data
 */
function getStoredResourceData(): { count: number; totalSize: number; transferSize: number } {
  try {
    const stored = localStorage.getItem(RESOURCE_DATA_KEY);
    return stored ? JSON.parse(stored) : { count: 0, totalSize: 0, transferSize: 0 };
  } catch (_error) {
    return { count: 0, totalSize: 0, transferSize: 0 };
  }
}

/**
 * Send metric immediately for critical cases
 */
function sendMetricImmediately(metric: Metric): void {
  // In a real app, this would send to your analytics service
  console.log('🚨 Critical metric detected:', metric);

  // Example: Send to analytics endpoint
  // sendToAnalytics({ [metric.name]: metric.value });
}

/**
 * Send pending metrics in batch
 */
function sendPendingMetrics(): void {
  try {
    const performanceData = gatherPerformanceData();

    if (Object.keys(performanceData.metrics).length > 0) {
      console.log('📤 Sending performance data:', performanceData);

      // In a real app, send to your analytics service
      // sendToAnalytics(performanceData);

      // Clear stored metrics after sending
      clearStoredMetrics();
    }
  } catch (error) {
    console.warn('Failed to send metrics:', error);
  }
}

/**
 * Gather all performance data for sending
 */
function gatherPerformanceData(): PerformanceData {
  const vitalsMetrics = getStoredMetrics();
  const basicMetrics = getStoredBasicMetrics();
  const navigationMetrics = getStoredNavigationMetrics();
  const resourceData = getStoredResourceData();

  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    metrics: {
      ...Object.fromEntries(
        Object.entries(vitalsMetrics).map(([key, data]: [string, any]) => [key, data.value])
      ),
      ...basicMetrics,
      ...navigationMetrics,
    },
    navigation: {
      type: getNavigationType(),
      timing: navigationMetrics,
    },
    resources: resourceData,
  };
}

/**
 * Get stored basic metrics
 */
function getStoredBasicMetrics(): Record<string, number> {
  try {
    const stored = localStorage.getItem(BASIC_METRICS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (_error) {
    return {};
  }
}

/**
 * Get stored navigation metrics
 */
function getStoredNavigationMetrics(): Record<string, number> {
  try {
    const stored = localStorage.getItem(NAVIGATION_METRICS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (_error) {
    return {};
  }
}

/**
 * Get navigation type
 */
function getNavigationType(): string {
  if ('performance' in window && 'navigation' in window.performance) {
    const nav = (window.performance as any).navigation;
    switch (nav.type) {
      case 0:
        return 'navigate';
      case 1:
        return 'reload';
      case 2:
        return 'back_forward';
      case 255:
        return 'reserved';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Clear stored metrics after successful send
 */
function clearStoredMetrics(): void {
  try {
    localStorage.removeItem(METRICS_STORAGE_KEY);
    localStorage.removeItem(BASIC_METRICS_KEY);
    localStorage.removeItem(NAVIGATION_METRICS_KEY);
    localStorage.removeItem(RESOURCE_DATA_KEY);
  } catch (_error) {
    console.warn('Failed to clear stored metrics:', _error);
  }
}

/**
 * Get current performance summary for debugging
 */
export function getPerformanceSummary(): PerformanceData | null {
  try {
    return gatherPerformanceData();
  } catch (error) {
    console.warn('Failed to get performance summary:', error);
    return null;
  }
}

/**
 * Manually trigger metrics collection (useful for SPAs)
 */
export function collectMetrics(): void {
  sendPendingMetrics();
}
