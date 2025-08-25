/**
 * DOM and Web Components types for custom elements
 */

// Base class for all custom elements
export interface CustomElementConstructor {
  new (): HTMLElement;
}

// Custom element lifecycle callbacks
export interface CustomElementLifecycle {
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
  adoptedCallback?(): void;
}

// Map widget specific types
export interface MapWidgetElement extends HTMLElement, CustomElementLifecycle {
  displayData(data: any): void;
  appendData(newData: any): void;
  showCurrentPosition(coords: GeolocationCoordinates): void;
  hideCurrentPosition(): void;
}

// Theme toggle widget
export interface ThemeToggleElement extends HTMLElement, CustomElementLifecycle {}

// Location widget
export interface LocationWidgetElement extends HTMLElement, CustomElementLifecycle {
  update(detail: any): void;
}

// Login widget
export interface LoginWidgetElement extends HTMLElement, CustomElementLifecycle {
  showPanel(): void;
}

// Profile widget
export interface ProfileWidgetElement extends HTMLElement, CustomElementLifecycle {}

// Session management widget
export interface SessionManagementWidgetElement extends HTMLElement, CustomElementLifecycle {}

// Geolocation coordinates (extending built-in types)
export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy: number;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface GeolocationPosition {
  coords: GeolocationCoordinates;
  timestamp: number;
}

// Custom element registry extensions
declare global {
  interface HTMLElementTagNameMap {
    'map-widget': MapWidgetElement;
    'theme-toggle': ThemeToggleElement;
    'location-widget': LocationWidgetElement;
    'login-widget': LoginWidgetElement;
    'profile-widget': ProfileWidgetElement;
    'session-management-widget': SessionManagementWidgetElement;
  }

  interface WindowEventMap {
    'auth-change': CustomEvent<import('./user.ts').AuthChangeEventDetail>;
    'location-update': CustomEvent<import('./location.ts').LocationUpdateEventDetail>;
  }

  interface Window {
    authService: import('../types/index.ts').AuthService;
  }

  // Browser timer types (override Node.js types)
  function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;
  function clearTimeout(timeoutId: number): void;
  function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;
  function clearInterval(intervalId: number): void;
}

// Leaflet map integration types (extending @types/leaflet)
export interface LeafletMapOptions {
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

// CSS custom properties for theming
export interface CSSCustomProperties {
  '--bg-panel'?: string;
  '--text-primary'?: string;
  '--text-secondary'?: string;
  '--color-primary'?: string;
  '--shadow-medium'?: string;
  '--font-family-base'?: string;
  '--font-size-base'?: string;
}
