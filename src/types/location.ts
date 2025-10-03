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
  user_id?: string;
  avatar?: string;
  status?: string;
  event?: string;
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

// Generic GeoJSON Feature
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: Geometry;
  properties: LocationProperties;
}

// GeoJSON FeatureCollection for multiple locations
export interface LocationsResponse {
  type: 'FeatureCollection';
  features: LocationResponse[];
  data?: LocationsResponse; // For API wrapper compatibility
}

// Wrapped API response
export interface ApiLocationResponse {
  data: LocationResponse;
}

export interface ApiLocationsResponse {
  data: LocationsResponse;
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
  status?: string;
  event?: string;
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
  status?: string;
  event?: string;
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
  gpx_track?: string;
  track_name?: string;
  track_description?: string;
}

// GPX Track Point types
export interface GpxTrackPoint {
  id: string;
  session_id: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  sequence: number;
  created: string;
  updated: string;
}

export interface GpxTrackPointsResponse {
  type: 'FeatureCollection';
  features: GpxTrackPointFeature[];
}

export interface GpxTrackPointFeature {
  type: 'Feature';
  geometry: Geometry;
  properties: GpxTrackPointProperties;
}

export interface GpxTrackPointProperties {
  sequence: number;
  altitude?: number;
}

// Waypoint types
export interface Waypoint {
  id: string;
  name: string;
  type: WaypointType;
  description?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  photo?: string;
  session_id: string;
  source: WaypointSource;
  position_confidence: PositionConfidence;
  created: string;
  updated: string;
}

export type WaypointType =
  | 'generic'
  | 'food'
  | 'water'
  | 'shelter'
  | 'transition'
  | 'viewpoint'
  | 'camping'
  | 'parking'
  | 'danger'
  | 'medical'
  | 'fuel';

export type WaypointSource = 'gpx' | 'manual' | 'photo';

export type PositionConfidence =
  | 'gps'
  | 'time_matched'
  | 'tracked'
  | 'gpx_track'
  | 'last_known'
  | 'manual';

export interface WaypointsResponse {
  type: 'FeatureCollection';
  features: WaypointFeature[];
}

export interface WaypointFeature {
  type: 'Feature';
  geometry: Geometry;
  properties: WaypointProperties;
}

export interface WaypointProperties {
  id: string;
  name: string;
  type: WaypointType;
  description?: string;
  altitude?: number;
  photo?: string;
  source: WaypointSource;
  position_confidence: PositionConfidence;
}

// Enhanced Session interface with GPX fields
export interface EnhancedSession extends Session {
  gpx_track?: string;
  track_name?: string;
  track_description?: string;
}

// GPX Upload request
export interface GpxUploadRequest {
  gpx_file: File;
}

// Waypoint requests
export interface CreateWaypointRequest {
  name: string;
  type: WaypointType;
  description?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  session_id: string;
  source: WaypointSource;
  position_confidence: PositionConfidence;
}

export interface UpdateWaypointRequest extends Partial<CreateWaypointRequest> {
  id: string;
}

export interface PhotoWaypointUploadRequest {
  photo: File;
  session_id: string;
  name?: string;
  type?: WaypointType;
  description?: string;
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
