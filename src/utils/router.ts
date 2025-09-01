/**
 * Simple client-side router for SPA navigation
 */

export interface Route {
  path: string;
  handler: (params: Record<string, string>) => void;
}

export class Router {
  private routes: Route[] = [];
  private currentRoute: string | null = null;

  constructor() {
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });
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
    if (this.currentRoute === path) {return;}

    window.history.pushState({}, '', path);
    this.handleRoute(path);
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

    if (!match) {return null;}

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
}
