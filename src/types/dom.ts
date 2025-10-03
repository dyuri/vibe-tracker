/**
 * DOM and Web Components types for custom elements
 */

import type {
  LocationResponse,
  LocationsResponse,
  WaypointsResponse,
  GpxTrackPointsResponse,
} from './location';

// Re-export types for use by components
export type {
  LocationResponse,
  LocationsResponse,
  WaypointsResponse,
  GpxTrackPointsResponse,
} from './location';

export type { User } from './user';

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
  displayGpxTrack(data: GpxTrackPointsResponse): void;
  showCurrentPosition(coords: GeolocationCoordinates): void;
  hideCurrentPosition(): void;
  centerOnCoordinates(latitude: number, longitude: number, zoom?: number): void;
  showHoverMarker(latitude: number, longitude: number): void;
  hideHoverMarker(): void;
  showSelectedMarker(latitude: number, longitude: number): void;
  hideSelectedMarker(): void;
  hasSelectedMarker(): boolean;
  startWaypointSelection(): void;
  stopWaypointSelection(): void;
  isInWaypointSelectionMode(): boolean;
  getSelectedWaypointCoordinates(): [number, number] | null;
  clearWaypoints(): void;
  displayWaypoints(data: WaypointsResponse): void;
}

// Profile widget
export interface ProfileWidgetElement extends HTMLElement, CustomElementLifecycle {}

// Session management widget
export interface SessionManagementWidgetElement extends HTMLElement, CustomElementLifecycle {}

export interface TrackComparisonWidgetElement extends HTMLElement {
  setPlannedTrack(track: GpxTrackPointsResponse): void;
  setActualTrack(track: LocationsResponse): void;
}

export interface GpxUploadWidgetElement extends HTMLElement {
  onFileSelected(callback: (file: File) => void): void;
  showUploadProgress(progress: number): void;
  showUploadSuccess(message: string): void;
  showUploadError(error: string): void;
  reset(): void;
}

export interface WaypointManagerWidgetElement extends HTMLElement {
  loadWaypoints(sessionId: string): void;
  loadWaypointsFromData(sessionId: string, waypointsData: WaypointsResponse): void;
  refreshWaypoints(): void;
  showCreateForm(): void;
  hideCreateForm(): void;
  showPhotoUploadDialog(): void;
  setPhotoWaypointLocation(latitude: number, longitude: number): void;
}

export interface PhotoWaypointUploadWidgetElement extends HTMLElement {
  setSessionId(sessionId: string): void;
  show(): void;
  hide(): void;
  setManualLocation(latitude: number, longitude: number): void;
}

// Chart widget
export interface ChartWidgetElement extends HTMLElement, CustomElementLifecycle {
  displayData(data: any): void;
  highlightPoint(index: number): void;
  clearHighlight(): void;
}

// Session map panel widget
export interface SessionMapPanelWidgetElement extends HTMLElement, CustomElementLifecycle {
  setSessionData(sessionData: any): void;
  displayData(data: LocationsResponse | LocationResponse): void;
  displayGpxTrack(data: GpxTrackPointsResponse): void;
  displayWaypoints(data: WaypointsResponse): void;
  highlightPoint(index: number): void;
  clearHighlight(): void;
  updateLocationData(feature?: any): void;
  switchToTab(tabId: string): void;
  expandPanel(): void;
  isPanelCollapsed(): boolean;
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
    'profile-widget': ProfileWidgetElement;
    'session-management-widget': SessionManagementWidgetElement;
    'chart-widget': ChartWidgetElement;
    'session-map-panel-widget': SessionMapPanelWidgetElement;
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
