/**
 * Location and Session types matching Go backend models and GeoJSON format
 */

// Geographic coordinates [longitude, latitude, altitude?]
export type Coordinates = [number, number] | [number, number, number];

// GeoJSON geometry
export interface Geometry {
  type: 'Point';
  coordinates: Coordinates;
}

// Location properties for GeoJSON features
export interface LocationProperties {
  timestamp: number;
  speed?: number | null;
  heart_rate?: number | null;
  session?: string;
  username?: string;
  session_title?: string;
}

// GeoJSON feature for location requests/responses
export interface LocationRequest {
  type: 'Feature';
  geometry: Geometry;
  properties: LocationProperties;
}

export interface LocationResponse {
  type: 'Feature';
  geometry: Geometry;
  properties: LocationProperties;
}

// GeoJSON FeatureCollection for multiple locations
export interface LocationsResponse {
  type: 'FeatureCollection';
  features: LocationResponse[];
}

// Query parameters for GET tracking requests
export interface TrackingQueryParams {
  token: string;
  latitude: number;
  longitude: number;
  timestamp?: number;
  altitude?: number;
  speed?: number;
  heart_rate?: number;
  session?: string;
}

// Stored location record (from database)
export interface Location {
  id: string;
  user: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heart_rate?: number;
  session?: string;
  timestamp: number;
  created: string;
  updated: string;
}

// Session management types
export interface CreateSessionRequest {
  name: string;
  title?: string;
  description?: string;
  public: boolean;
}

export interface UpdateSessionRequest {
  title?: string;
  description?: string;
  public: boolean;
}

export interface Session {
  id: string;
  name: string;
  title: string;
  description: string;
  public: boolean;
  user?: string;
  created: string;
  updated: string;
}

export interface SessionsListResponse {
  sessions: Session[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface SessionResponse extends Session {}

export interface SessionDataResponse {
  type: 'FeatureCollection';
  features: LocationResponse[];
}

// Custom events for map widget
export interface LocationUpdateEventDetail extends LocationResponse {}

export interface LocationUpdateEvent extends CustomEvent<LocationUpdateEventDetail> {
  type: 'location-update';
}
