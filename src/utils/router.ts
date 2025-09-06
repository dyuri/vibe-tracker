/**
 * Enhanced client-side router with Navigation API support and progressive enhancement
 */

export interface Route {
  path: string;
  handler: (params: Record<string, string>) => void | Promise<void>;
}

export class Router {
  private routes: Route[] = [];
  private currentRoute: string | null = null;
  private supportsNavigationAPI: boolean;
  private supportsViewTransitions: boolean;

  constructor() {
    // Feature detection
    this.supportsNavigationAPI = 'navigation' in window;
    this.supportsViewTransitions = false; // Disabled for SPA performance

    console.log(
      `Router initialized: Navigation API=${this.supportsNavigationAPI}, View Transitions=${this.supportsViewTransitions}`
    );

    if (this.supportsNavigationAPI) {
      this.setupNavigationAPI();
    } else {
      this.setupHistoryAPIFallback();
    }
  }

  /**
   * Add a route handler
   */
  addRoute(path: string, handler: (params: Record<string, string>) => void): void {
    this.routes.push({ path, handler });
  }

  /**
   * Navigate to a route programmatically
   */
  navigate(path: string): void {
    if (this.currentRoute === path) {
      return;
    }

    if (this.supportsNavigationAPI) {
      // Use Navigation API for programmatic navigation
      (window as any).navigation.navigate(path);
    } else {
      // Fallback to History API
      window.history.pushState({}, '', path);
      this.handleRouteWithTransition(path);
    }
  }

  /**
   * Handle route changes
   */
  private handleRoute(path: string): void {
    this.currentRoute = path;

    // Find matching route
    for (const route of this.routes) {
      const params = this.matchRoute(route.path, path);
      if (params !== null) {
        route.handler(params);
        return;
      }
    }

    // No matching route found - could handle 404 here
    console.warn(`No route handler found for: ${path}`);
  }

  /**
   * Match a route pattern against a path and extract parameters
   */
  private matchRoute(pattern: string, path: string): Record<string, string> | null {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\[([^\]]+)\]/g, '([^/]+)') // Convert [param] to capture group
      .replace(/\//g, '\\/'); // Escape slashes

    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);

    if (!match) {
      return null;
    }

    // Extract parameter names from pattern
    const paramNames = [];
    const paramMatches = pattern.match(/\[([^\]]+)\]/g);
    if (paramMatches) {
      for (const paramMatch of paramMatches) {
        paramNames.push(paramMatch.slice(1, -1)); // Remove [ and ]
      }
    }

    // Build params object
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = match[i + 1];
    }

    return params;
  }

  /**
   * Start the router - call this to begin routing
   */
  start(): void {
    this.handleRoute(window.location.pathname);
  }

  /**
   * Get current route path
   */
  getCurrentRoute(): string | null {
    return this.currentRoute;
  }

  /**
   * Setup Navigation API for modern browsers
   */
  private setupNavigationAPI(): void {
    (window as any).navigation.addEventListener('navigate', (event: any) => {
      // Only intercept same-origin navigations
      if (!this.shouldInterceptNavigation(event)) {
        return;
      }

      const url = new URL(event.destination.url);
      const path = url.pathname;

      // Check if we have a route handler for this path
      const matchingRoute = this.routes.find(route => this.matchRoute(route.path, path) !== null);

      if (matchingRoute) {
        event.intercept({
          handler: () => this.handleRouteWithTransition(path),
        });
      }
    });
  }

  /**
   * Setup History API fallback for older browsers
   */
  private setupHistoryAPIFallback(): void {
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });
  }

  /**
   * Determine if navigation should be intercepted
   */
  private shouldInterceptNavigation(event: any): boolean {
    // Don't intercept if:
    // - Cross-origin navigation
    // - Form submission
    // - Download request
    // - Hash-only changes (for now)

    if (event.destination.url === undefined) {
      return false;
    }

    const url = new URL(event.destination.url);

    // Only handle same-origin navigations
    if (url.origin !== window.location.origin) {
      return false;
    }

    // Don't handle downloads
    if (event.downloadRequest) {
      return false;
    }

    // Don't handle form submissions (for now)
    if (event.formData) {
      return false;
    }

    return true;
  }

  /**
   * Handle route with optional view transitions
   */
  /**
   * Handle route without view transitions (disabled for SPA performance)
   */
  private async handleRouteWithTransition(path: string): Promise<void> {
    // View transitions disabled for performance - just handle route directly
    this.handleRoute(path);
  }
}
