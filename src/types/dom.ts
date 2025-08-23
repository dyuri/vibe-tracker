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
  startTracking(): void;
  stopTracking(): void;
  updatePosition(position: GeolocationPosition): void;
}

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
  }

  interface WindowEventMap {
    'auth-change': CustomEvent<import('./user.js').AuthChangeEventDetail>;
    'location-update': CustomEvent<import('./location.js').LocationUpdateEventDetail>;
  }
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