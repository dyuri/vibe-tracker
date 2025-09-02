/**
 * Enhanced error boundary utilities for web components
 * Provides centralized error handling and reporting
 */

export interface ErrorInfo {
  error: Error;
  errorInfo?: {
    componentStack?: string;
    errorBoundary?: string;
  };
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
}

export interface ErrorBoundaryOptions {
  fallbackUI?: string | HTMLElement;
  onError?: (error: Error, errorInfo?: any) => void;
  reportToService?: boolean;
  retryable?: boolean;
  componentName?: string;
}

/**
 * Global error handler for unhandled errors
 */
class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: ErrorInfo[] = [];
  private maxQueueSize = 50;
  private reportingEnabled = true;

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalHandlers(): void {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', event => {
      this.handleError(event.error || new Error(event.message), {
        componentStack: `at ${event.filename}:${event.lineno}:${event.colno}`,
        errorBoundary: 'global',
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          componentStack: 'Promise rejection',
          errorBoundary: 'global',
        }
      );
    });

    // Handle custom error events from components
    window.addEventListener('component-error', event => {
      const customEvent = event as CustomEvent<{ error: Error; component: string }>;
      this.handleError(customEvent.detail.error, {
        componentStack: customEvent.detail.component,
        errorBoundary: 'component',
      });
    });
  }

  /**
   * Handle and report errors
   */
  handleError(error: Error, errorInfo?: any): void {
    const errorData: ErrorInfo = {
      error,
      errorInfo,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
    };

    // Add to queue
    this.errorQueue.push(errorData);
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest error
    }

    // Log error for debugging
    console.group('🚨 Error Boundary Caught Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Stack:', error.stack);
    console.groupEnd();

    // Report error if enabled
    if (this.reportingEnabled) {
      this.reportError(errorData);
    }
  }

  /**
   * Report error to monitoring service
   */
  private async reportError(errorData: ErrorInfo): Promise<void> {
    try {
      // In a real app, send to your error monitoring service
      // Example: Sentry, Bugsnag, or custom endpoint

      // For now, store in localStorage for debugging
      this.storeErrorLocally(errorData);

      // Example of sending to a monitoring endpoint:
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData),
      // });
    } catch (reportError) {
      console.warn('Failed to report error:', reportError);
    }
  }

  /**
   * Store error locally for debugging
   */
  private storeErrorLocally(errorData: ErrorInfo): void {
    try {
      const errors = this.getStoredErrors();
      errors.push({
        message: errorData.error.message,
        stack: errorData.error.stack,
        timestamp: errorData.timestamp,
        url: errorData.url,
        component: errorData.errorInfo?.componentStack,
      });

      // Keep only last 20 errors
      if (errors.length > 20) {
        errors.splice(0, errors.length - 20);
      }

      localStorage.setItem('vibe_error_log', JSON.stringify(errors));
    } catch (_error) {
      console.warn('Failed to store error locally:', _error);
    }
  }

  /**
   * Get stored errors for debugging
   */
  getStoredErrors(): any[] {
    try {
      const stored = localStorage.getItem('vibe_error_log');
      return stored ? JSON.parse(stored) : [];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    try {
      localStorage.removeItem('vibe_error_log');
      this.errorQueue = [];
    } catch (_error) {
      console.warn('Failed to clear error log:', _error);
    }
  }

  /**
   * Get user ID if available
   */
  private getUserId(): string | undefined {
    try {
      const user = window.authService?.getCurrentUser();
      // Handle both promise and direct user object
      if (user && typeof user === 'object' && 'id' in user) {
        return (user as any).id;
      }
      return undefined;
    } catch (_error) {
      return undefined;
    }
  }

  /**
   * Get session ID
   */
  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('sessionId') || undefined;
    } catch (_error) {
      return undefined;
    }
  }

  /**
   * Enable/disable error reporting
   */
  setReportingEnabled(enabled: boolean): void {
    this.reportingEnabled = enabled;
  }
}

/**
 * Error boundary mixin for web components
 */
export function withErrorBoundary<T extends new (...args: any[]) => HTMLElement>(
  BaseClass: T,
  options: ErrorBoundaryOptions = {}
): T {
  return class extends BaseClass {
    private errorBoundaryOptions: ErrorBoundaryOptions;
    private hasError = false;
    private originalHTML = '';

    constructor(...args: any[]) {
      super(...args);
      this.errorBoundaryOptions = options;
      this.setupErrorBoundary();
    }

    /**
     * Set up error boundary for this component
     */
    private setupErrorBoundary(): void {
      // Store original HTML for potential restoration
      this.originalHTML = this.innerHTML;

      // Wrap component methods in try-catch
      this.wrapComponentMethods();

      // Set up error listeners
      this.addEventListener('error', this.handleComponentError.bind(this), true);
    }

    /**
     * Wrap component methods with error handling
     */
    private wrapComponentMethods(): void {
      const prototype = Object.getPrototypeOf(this);
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        name => typeof this[name] === 'function' && name !== 'constructor'
      );

      methodNames.forEach(methodName => {
        const originalMethod = this[methodName];
        this[methodName] = (...args: any[]) => {
          try {
            return originalMethod.apply(this, args);
          } catch (error) {
            this.handleComponentError(error);
          }
        };
      });
    }

    /**
     * Handle component-specific errors
     */
    private handleComponentError(error: Error | Event): void {
      const actualError = error instanceof Error ? error : new Error('Component error');

      this.hasError = true;

      // Call custom error handler if provided
      if (this.errorBoundaryOptions.onError) {
        try {
          this.errorBoundaryOptions.onError(actualError, {
            componentStack: this.errorBoundaryOptions.componentName || this.tagName,
          });
        } catch (handlerError) {
          console.warn('Error in custom error handler:', handlerError);
        }
      }

      // Report to global error handler
      GlobalErrorHandler.getInstance().handleError(actualError, {
        componentStack: this.errorBoundaryOptions.componentName || this.tagName,
        errorBoundary: 'component',
      });

      // Show fallback UI
      this.showFallbackUI(actualError);

      // Dispatch error event for parent components
      this.dispatchEvent(
        new CustomEvent('component-error', {
          detail: {
            error: actualError,
            component: this.errorBoundaryOptions.componentName || this.tagName,
          },
          bubbles: true,
        })
      );
    }

    /**
     * Show fallback UI when error occurs
     */
    private showFallbackUI(error: Error): void {
      try {
        if (this.errorBoundaryOptions.fallbackUI) {
          if (typeof this.errorBoundaryOptions.fallbackUI === 'string') {
            this.innerHTML = this.errorBoundaryOptions.fallbackUI;
          } else {
            this.innerHTML = '';
            this.appendChild(this.errorBoundaryOptions.fallbackUI.cloneNode(true));
          }
        } else {
          this.innerHTML = this.getDefaultErrorUI(error);
        }
      } catch (fallbackError) {
        console.error('Error showing fallback UI:', fallbackError);
        this.innerHTML = '<div class="error">An error occurred</div>';
      }
    }

    /**
     * Get default error UI
     */
    private getDefaultErrorUI(error: Error): string {
      const retryButton =
        this.errorBoundaryOptions.retryable !== false
          ? '<button onclick="this.closest(\'*\').retryRender()">Retry</button>'
          : '';

      return `
        <div class="component-error" style="
          padding: var(--spacing-md, 1rem);
          border: 1px solid var(--color-error, #dc3545);
          border-radius: var(--border-radius, 0.25rem);
          background: var(--bg-error-light, #f8d7da);
          color: var(--color-error, #dc3545);
          text-align: center;
        ">
          <h4>Something went wrong</h4>
          <p>This component encountered an error and couldn't render properly.</p>
          <details class="error-details">
            <summary>Error Details</summary>
            <pre class="error-pre">${error.message}</pre>
          </details>
          ${retryButton}
        </div>
      `;
    }

    /**
     * Retry rendering the component
     */
    retryRender(): void {
      try {
        this.hasError = false;
        this.innerHTML = this.originalHTML;

        // Re-initialize component if it has an init method
        if ('init' in this && typeof this.init === 'function') {
          this.init();
        }

        // Dispatch retry event
        this.dispatchEvent(
          new CustomEvent('component-retry', {
            detail: { component: this.errorBoundaryOptions.componentName || this.tagName },
            bubbles: true,
          })
        );
      } catch (retryError) {
        console.error('Error during retry:', retryError);
        this.handleComponentError(retryError);
      }
    }
  };
}

/**
 * Initialize global error handling
 */
export function initializeErrorHandling(): void {
  GlobalErrorHandler.getInstance();
  console.log('🛡️ Error boundary system initialized');
}

/**
 * Get error handler instance for manual error reporting
 */
export function getErrorHandler(): GlobalErrorHandler {
  return GlobalErrorHandler.getInstance();
}

/**
 * Report error manually
 */
export function reportError(error: Error, context?: string): void {
  GlobalErrorHandler.getInstance().handleError(error, {
    componentStack: context,
    errorBoundary: 'manual',
  });
}

/**
 * Get stored error logs for debugging
 */
export function getErrorLogs(): any[] {
  return GlobalErrorHandler.getInstance().getStoredErrors();
}

/**
 * Clear error logs
 */
export function clearErrorLogs(): void {
  GlobalErrorHandler.getInstance().clearErrorLog();
}
