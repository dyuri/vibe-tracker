import type {
  LocationResponse,
  LocationsResponse,
  MapWidgetElement,
  GeolocationCoordinates,
  GeoJSONFeature,
  LocationProperties,
  GpxTrackPointsResponse,
  WaypointsResponse,
  WaypointFeature,
  WaypointType,
  PositionConfidence,
} from '@/types';
import { createMarker } from '@/components/ui';
import styles from '@/styles/components/widgets/map-widget.css?inline';
import maplibregl from 'maplibre-gl';
import maplibreCSS from 'maplibre-gl/dist/maplibre-gl.css?inline';
import { Protocol } from 'pmtiles';

// Register PMTiles protocol with MapLibre
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

/**
 * Map Widget Web Component
 * Interactive MapLibre map for displaying location data with heart rate visualization
 */
export default class MapWidget extends HTMLElement implements MapWidgetElement {
  private map: maplibregl.Map | null = null;
  private mapSourcesReady: boolean = false;
  private pendingData: (LocationResponse | LocationsResponse) | null = null;
  private pendingGpxTrack: GpxTrackPointsResponse | null = null;
  private markers: Map<string, maplibregl.Marker> = new Map();
  private currentPositionMarker: maplibregl.Marker | null = null;
  private hoverMarker: maplibregl.Marker | null = null;
  private waypointMarkers: Map<string, maplibregl.Marker> = new Map();
  private currentFeatureCollection: LocationsResponse | null = null;
  // Waypoint selection properties
  private waypointSelectionMode: boolean = false;
  private waypointSelectionMarker: maplibregl.Marker | null = null;
  private selectedWaypointCoords: [number, number] | null = null;
  private colorScale: Array<Array<number>> = [
    [0, 0, 255], // Blue
    [0, 255, 0], // Green
    [255, 255, 0], // Yellow
    [255, 165, 0], // Orange
    [255, 0, 0], // Red
  ];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${maplibreCSS}</style>
      <style>${styles}</style>
      <div id="map"></div>
    `;
  }

  /**
   * Called when the element is connected to the DOM
   * Initializes the MapLibre map and sets up event listeners
   */
  connectedCallback(): void {
    try {
      // Custom self-hosted tile server
      const style = 'https://map.horak.hu/style.json';

      // Parse URL hash for initial position to avoid animated zoom from default
      let initialCenter: [number, number] = [0, 0];
      let initialZoom = 2;
      const hash = window.location.hash;
      if (hash.startsWith('#map=')) {
        const mapParam = hash
          .substring(1)
          .split('&')
          .find(p => p.startsWith('map='));
        if (mapParam) {
          const parts = mapParam.substring(4).split('/');
          if (parts.length === 3) {
            const lat = parseFloat(parts[0]);
            const lon = parseFloat(parts[1]);
            const zoom = parseInt(parts[2], 10);
            if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) {
              initialCenter = [lon, lat];
              initialZoom = zoom;
            }
          }
        }
      }

      this.map = new maplibregl.Map({
        container: this.shadowRoot!.getElementById('map')!,
        style: style,
        center: initialCenter,
        zoom: initialZoom,
        // TODO fix attributionControl: true,
      });

      this.map.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Wait for map to load before adding sources
      this.map.on('load', () => {
        this.initializeMapSources();
        this.mapSourcesReady = true;
        if (this.pendingData) {
          this.displayData(this.pendingData);
          this.pendingData = null;
        }
        if (this.pendingGpxTrack) {
          this.displayGpxTrack(this.pendingGpxTrack);
          this.pendingGpxTrack = null;
        }
      });

      this.map.on('moveend', () => this.updateUrlHash());
      this.map.on('zoomend', () => this.updateUrlHash());

      this.setViewFromUrlHash();
    } catch (error) {
      console.error('Failed to initialize map widget:', error);
      this.shadowRoot!.getElementById('map')!.innerHTML =
        '<div class="map-error">Map initialization failed</div>';
    }
  }

  /**
   * Initialize all GeoJSON sources for map layers
   */
  private initializeMapSources(): void {
    if (!this.map) {
      return;
    }

    // Source for main tracking data (polylines)
    this.map.addSource('tracking-data', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Source for GPX planned tracks
    this.map.addSource('gpx-track', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Source for current position accuracy circle
    this.map.addSource('current-position-circle', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Add layers for tracking data
    // Black outline layer (bottom)
    this.map.addLayer({
      id: 'tracking-outline',
      type: 'line',
      source: 'tracking-data',
      filter: ['==', ['get', 'layer'], 'outline'],
      paint: {
        'line-color': 'black',
        'line-width': 7,
      },
    });

    // Colored tracking line layer (top)
    this.map.addLayer({
      id: 'tracking-line',
      type: 'line',
      source: 'tracking-data',
      filter: ['==', ['get', 'layer'], 'main'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 5,
        'line-opacity': ['coalesce', ['get', 'opacity'], 1],
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    // GPX planned track layer
    this.map.addLayer({
      id: 'gpx-track-line',
      type: 'line',
      source: 'gpx-track',
      paint: {
        'line-color': 'hsl(320, 100%, 60%)',
        'line-width': 4,
        'line-opacity': 0.8,
        'line-dasharray': [2, 3],
      },
    });

    // Accuracy circle layer
    this.map.addLayer({
      id: 'accuracy-circle',
      type: 'circle',
      source: 'current-position-circle',
      paint: {
        'circle-radius': ['get', 'radiusPixels'],
        'circle-color': '#ff901e',
        'circle-opacity': 0.2,
        'circle-stroke-color': '#ff901e',
        'circle-stroke-width': 2,
      },
    });

    // Add click handler for tracking lines
    this.map.on('click', 'tracking-line', (e: maplibregl.MapMouseEvent) => {
      this.handleTrackLineClick(e);
    });

    // Change cursor on hover
    this.map.on('mouseenter', 'tracking-line', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });
    this.map.on('mouseleave', 'tracking-line', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = '';
      }
    });
  }

  /**
   * Handle click on tracking line to find closest point
   */
  private handleTrackLineClick(e: maplibregl.MapMouseEvent): void {
    if (!this.currentFeatureCollection) {
      return;
    }

    const points = this.currentFeatureCollection.features;
    let closestPoint: GeoJSONFeature | null = null;
    let minDistance = Infinity;

    const clickLngLat = e.lngLat;

    points.forEach(p => {
      const pointLngLat = new maplibregl.LngLat(
        p.geometry.coordinates[0],
        p.geometry.coordinates[1]
      );
      const distance = clickLngLat.distanceTo(pointLngLat);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = p;
      }
    });

    if (closestPoint) {
      const pointIndex = points.findIndex(f => f === closestPoint);
      if (pointIndex !== -1) {
        this.dispatchEvent(
          new CustomEvent('map-point-click', {
            detail: { feature: closestPoint, index: pointIndex },
            bubbles: true,
            composed: true,
          })
        );
      }
    }
  }

  setViewFromUrlHash(): boolean {
    const hash = window.location.hash;
    if (hash.startsWith('#map=')) {
      const hashParts = hash.substring(1).split('&');
      const mapParam = hashParts.find(p => p.startsWith('map='));

      if (mapParam) {
        const parts = mapParam.substring(4).split('/');
        if (parts.length === 3) {
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          const zoom = parseInt(parts[2], 10);
          if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) {
            // MapLibre uses [lng, lat], but we keep lat/lng in URL for backwards compat
            this.map!.setCenter([lon, lat]);
            this.map!.setZoom(zoom);
            return true;
          }
        }
      }
    }
    return false;
  }

  updateUrlHash(waypointId?: string): void {
    if (!this.map) {
      return;
    }

    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    // Keep lat/lng order in URL for backwards compatibility
    let hash = `#map=${center.lat.toFixed(6)}/${center.lng.toFixed(6)}/${Math.round(zoom)}`;

    const currentHash = window.location.hash;

    if (waypointId) {
      hash += `&wp=${waypointId}`;
    } else if (currentHash.includes('&wp=')) {
      const wpMatch = currentHash.match(/&wp=([^&]+)/);
      if (wpMatch) {
        hash += `&wp=${wpMatch[1]}`;
      }
    }

    if (currentHash.includes('&refresh=1')) {
      hash += '&refresh=1';
    }

    history.replaceState(null, '', hash);
  }

  /**
   * Removes waypoint parameter from URL
   */
  private clearWaypointFromUrl(): void {
    if (!this.map) {
      return;
    }
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    const hash = `#map=${center.lat.toFixed(6)}/${center.lng.toFixed(6)}/${Math.round(zoom)}`;
    history.replaceState(null, '', hash);
  }

  /**
   * Opens a waypoint popup by waypoint ID
   */
  private openWaypointPopupById(waypointId: string): void {
    const marker = this.waypointMarkers.get(waypointId);
    if (marker) {
      marker.togglePopup();
    }
  }

  /**
   * Displays location data on the map
   */
  displayData(data: LocationResponse | LocationsResponse): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot display data');
      return;
    }

    if (!this.mapSourcesReady) {
      this.pendingData = data;
      return;
    }

    if (data.type === 'FeatureCollection') {
      this.currentFeatureCollection = data;
      this.displayFeatureCollection(data);
    } else {
      this.currentFeatureCollection = null;
      this.displayPoint(data);
    }
  }

  /**
   * Displays GPX track data as a planned route
   */
  displayGpxTrack(data: GpxTrackPointsResponse): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot display GPX track');
      return;
    }

    if (!this.mapSourcesReady) {
      this.pendingGpxTrack = data;
      return;
    }

    const source = this.map.getSource('gpx-track') as maplibregl.GeoJSONSource;
    if (!source) {
      return;
    }

    if (!data.features || data.features.length === 0) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Sort track points by sequence
    const sortedPoints = [...data.features].sort(
      (a, b) => a.properties.sequence - b.properties.sequence
    );

    // Create GeoJSON LineString for the planned track
    const lineFeature: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: sortedPoints.map(point => [
          point.geometry.coordinates[0], // longitude
          point.geometry.coordinates[1], // latitude
        ]),
      },
      properties: {
        points: sortedPoints.length,
        type: 'GPX Track',
      },
    };

    source.setData({
      type: 'FeatureCollection',
      features: [lineFeature],
    });
  }

  /**
   * Displays waypoints on the map
   */
  displayWaypoints(data: WaypointsResponse): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot display waypoints');
      return;
    }

    // Clear existing waypoint markers
    this.waypointMarkers.forEach(marker => marker.remove());
    this.waypointMarkers.clear();

    if (!data.features || data.features.length === 0) {
      return;
    }

    data.features.forEach(waypoint => {
      const marker = this.createWaypointMarker(waypoint);
      const popupContent = this.createWaypointPopupContent(waypoint);

      const popup = new maplibregl.Popup({ offset: 10 }).setHTML(popupContent);

      marker.setPopup(popup);

      // Update URL when popup is opened
      marker.getElement().addEventListener('click', () => {
        this.updateUrlHash(waypoint.properties.id);
      });

      popup.on('close', () => {
        this.clearWaypointFromUrl();
      });

      this.waypointMarkers.set(waypoint.properties.id, marker);
      marker.addTo(this.map!);
    });

    // After waypoints are loaded, check if URL has a waypoint parameter to open
    const hash = window.location.hash;
    if (hash.includes('&wp=')) {
      const wpMatch = hash.match(/&wp=([^&]+)/);
      if (wpMatch) {
        const waypointId = wpMatch[1];
        setTimeout(() => {
          this.openWaypointPopupById(waypointId);
        }, 100);
      }
    }
  }

  /**
   * Creates a marker for a waypoint with appropriate icon
   */
  createWaypointMarker(waypoint: WaypointFeature): maplibregl.Marker {
    const [longitude, latitude] = waypoint.geometry.coordinates;
    const el = this.createWaypointElement(
      waypoint.properties.type,
      waypoint.properties.position_confidence
    );

    return new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]);
  }

  /**
   * Creates HTML element for waypoint marker
   */
  createWaypointElement(type: WaypointType, confidence: PositionConfidence): HTMLElement {
    const config = this.getWaypointConfig(type);
    const confidenceStyle = this.getConfidenceStyle(confidence);

    const el = document.createElement('div');
    el.className = `waypoint-marker waypoint-marker-${type}`;
    el.innerHTML = `<div class="waypoint-marker-content" style="background-color: ${config.color}; ${confidenceStyle}">
                     <span class="waypoint-marker-icon">${config.icon}</span>
                   </div>`;
    el.style.width = '20px';
    el.style.height = '20px';

    return el;
  }

  /**
   * Returns configuration for different waypoint types
   */
  getWaypointConfig(type: WaypointType): { color: string; icon: string } {
    const configs: Record<WaypointType, { color: string; icon: string }> = {
      generic: { color: '#6c757d', icon: '📍' },
      food: { color: '#fd7e14', icon: '🍽️' },
      water: { color: '#0dcaf0', icon: '💧' },
      shelter: { color: '#198754', icon: '🏠' },
      transition: { color: '#6f42c1', icon: '🚌' },
      viewpoint: { color: '#e83e8c', icon: '👁️' },
      camping: { color: '#20c997', icon: '⛺' },
      parking: { color: '#495057', icon: '🅿️' },
      danger: { color: '#dc3545', icon: '⚠️' },
      medical: { color: '#0d6efd', icon: '🏥' },
      fuel: { color: '#ffc107', icon: '⛽' },
    };

    return configs[type] || configs.generic;
  }

  /**
   * Returns style adjustments based on position confidence
   */
  getConfidenceStyle(confidence: PositionConfidence): string {
    const styles: Record<PositionConfidence, string> = {
      gps: 'border: 2px solid #28a745;',
      time_matched: 'border: 2px solid #007bff;',
      tracked: 'border: 2px solid #17a2b8;',
      gpx_track: 'border: 2px solid #6f42c1;',
      last_known: 'border: 2px solid #fd7e14;',
      manual: 'border: 2px solid #6c757d;',
    };

    return styles[confidence] || styles.manual;
  }

  /**
   * Creates popup content for waypoints
   */
  createWaypointPopupContent(waypoint: WaypointFeature): string {
    const { name, type, description, altitude, source, position_confidence, photo, id } =
      waypoint.properties;
    const coords = waypoint.geometry.coordinates;

    const altitudeText = altitude ? `<b>Altitude:</b> ${altitude} m<br>` : '';
    const descriptionText = description ? `<b>Description:</b> ${description}<br>` : '';

    let photoHtml = '';
    if (photo) {
      const photoUrl = `/api/files/waypoints/${id}/${photo}`;
      const thumbnailUrl = `${photoUrl}?thumb=150x150`;
      photoHtml = `
        <div class="waypoint-photo">
          <a href="${photoUrl}" target="_blank" rel="noopener noreferrer">
            <img src="${thumbnailUrl}" alt="${name}" />
          </a>
        </div>
      `;
    }

    return `
      <div class="waypoint-popup">
        <h4>${name}</h4>
        ${photoHtml}
        <b>Type:</b> ${type.charAt(0).toUpperCase() + type.slice(1)}<br>
        ${descriptionText}
        <b>Coordinates:</b> ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}<br>
        ${altitudeText}
        <b>Source:</b> ${source}<br>
        <b>Confidence:</b> ${position_confidence.replace('_', ' ')}
      </div>
    `;
  }

  /**
   * Clears GPX track from the map
   */
  clearGpxTrack(): void {
    const source = this.map?.getSource('gpx-track') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  /**
   * Clears waypoints from the map
   */
  clearWaypoints(): void {
    this.waypointMarkers.forEach(marker => marker.remove());
    this.waypointMarkers.clear();
  }

  /**
   * Appends new location data to existing data on the map
   */
  appendData(newData: LocationsResponse): void {
    if (!this.currentFeatureCollection || !newData.features || newData.features.length === 0) {
      return;
    }

    const existingFeatures = this.currentFeatureCollection.features;
    let latestExistingTimestamp = 0;
    if (existingFeatures.length > 0) {
      latestExistingTimestamp = Math.max(...existingFeatures.map(f => f.properties.timestamp));
    }

    const trulyNewFeatures = newData.features.filter(
      feature => feature.properties.timestamp > latestExistingTimestamp
    );

    if (trulyNewFeatures.length === 0) {
      return;
    }

    this.currentFeatureCollection.features.push(...trulyNewFeatures);
    this.displayFeatureCollection(this.currentFeatureCollection);
  }

  displayFeatureCollection(data: LocationsResponse): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot display feature collection');
      return;
    }

    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers.clear();

    const points = data.features;
    if (points.length === 0) {
      return;
    }

    // Check if multi-user data
    const usernames = [...new Set(points.map(p => p.properties.username).filter(u => u))];
    const isMultiUser = usernames.length > 1;

    if (isMultiUser) {
      // Multi-user mode: display individual markers
      points.forEach(point => {
        const [longitude, latitude] = point.geometry.coordinates;
        const marker = createMarker([latitude, longitude], point.properties);

        const coords: [number, number, number] =
          point.geometry.coordinates.length === 2
            ? ([...point.geometry.coordinates, 0] as [number, number, number])
            : (point.geometry.coordinates as [number, number, number]);

        const popupContent = this.createPopupContent(point.properties, coords);
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupContent);

        const mapMarker = new maplibregl.Marker({ element: marker.getElement() })
          .setLngLat([longitude, latitude])
          .setPopup(popup)
          .addTo(this.map!);

        this.markers.set(`${point.properties.timestamp}`, mapMarker);
      });
    } else {
      // Single-user track mode: create polylines with heart rate coloring
      this.renderTrackPolylines(points);

      // Add event markers
      this.renderEventMarkers(points);

      // Add only the latest point as a marker
      const latestPoint = points[points.length - 1];
      const [longitude, latitude] = latestPoint.geometry.coordinates;
      const marker = createMarker([latitude, longitude], latestPoint.properties);

      const coords: [number, number, number] =
        latestPoint.geometry.coordinates.length === 2
          ? ([...latestPoint.geometry.coordinates, 0] as [number, number, number])
          : (latestPoint.geometry.coordinates as [number, number, number]);

      const popupContent = this.createPopupContent(latestPoint.properties, coords);
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupContent);

      const mapMarker = new maplibregl.Marker({ element: marker.getElement() })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(this.map!);

      this.markers.set('latest', mapMarker);
    }

    // Fit bounds
    if (!this.setViewFromUrlHash()) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach(p => {
        bounds.extend([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
      });
      this.map!.fitBounds(bounds, { padding: 50, animate: false });
    }

    // Dispatch location update
    if (!isMultiUser && points.length > 0) {
      const latestPoint = points[points.length - 1];
      this.dispatchEvent(
        new CustomEvent('location-update', { detail: latestPoint, bubbles: true, composed: true })
      );
    }
  }

  /**
   * Render track polylines with heart rate coloring
   */
  private renderTrackPolylines(points: GeoJSONFeature[]): void {
    const source = this.map?.getSource('tracking-data') as maplibregl.GeoJSONSource;
    if (!source) {
      return;
    }

    const heartRates = points
      .map(p => p.properties.heart_rate)
      .filter(hr => hr !== null && hr !== undefined);
    const minHeartRate = Math.min(...heartRates);
    const maxHeartRate = Math.max(...heartRates);

    const features: GeoJSON.Feature[] = [];

    // Create line segments for both outline and colored lines
    for (let i = 0; i < points.length - 1; i++) {
      const startPoint = points[i];
      const endPoint = points[i + 1];
      const heartRate = startPoint.properties.heart_rate;
      const status = startPoint.properties.status;
      const endStatus = endPoint.properties.status;

      // Determine line color
      let color: string;
      let opacity = 1;

      if (status === 'stopped' && endStatus === 'stopped') {
        color = '#dc3545';
        opacity = 0.6;
      } else if (status === 'paused' && endStatus === 'paused') {
        color = '#fd7e14';
        opacity = 0.7;
      } else {
        color = this.getHeartRateColor(heartRate, minHeartRate, maxHeartRate);
      }

      // Outline feature
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [startPoint.geometry.coordinates[0], startPoint.geometry.coordinates[1]],
            [endPoint.geometry.coordinates[0], endPoint.geometry.coordinates[1]],
          ],
        },
        properties: {
          layer: 'outline',
        },
      });

      // Main colored line feature
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [startPoint.geometry.coordinates[0], startPoint.geometry.coordinates[1]],
            [endPoint.geometry.coordinates[0], endPoint.geometry.coordinates[1]],
          ],
        },
        properties: {
          layer: 'main',
          color: color,
          opacity: opacity,
        },
      });
    }

    source.setData({
      type: 'FeatureCollection',
      features: features,
    });
  }

  /**
   * Render event markers on the map
   */
  private renderEventMarkers(points: GeoJSONFeature[]): void {
    points.forEach(point => {
      if (point.properties.event) {
        const [longitude, latitude] = point.geometry.coordinates;
        const el = this.createEventMarkerElement(point.properties.event);

        const coords: [number, number, number] =
          point.geometry.coordinates.length === 2
            ? ([...point.geometry.coordinates, 0] as [number, number, number])
            : (point.geometry.coordinates as [number, number, number]);

        const popupContent = this.createEventPopupContent(
          point.properties,
          coords,
          point.properties.event
        );

        const popup = new maplibregl.Popup({ offset: 10 }).setHTML(popupContent);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .setPopup(popup)
          .addTo(this.map!);

        this.markers.set(`event-${point.properties.timestamp}`, marker);
      }
    });
  }

  /**
   * Creates HTML element for event marker
   */
  createEventMarkerElement(eventType: string): HTMLElement {
    const eventConfig = this.getEventConfig(eventType);

    const el = document.createElement('div');
    el.className = `event-marker event-marker-${eventType}`;
    el.innerHTML = `<div class="event-marker-content" style="background-color: ${eventConfig.color}">
                     <span class="event-marker-icon">${eventConfig.icon}</span>
                   </div>`;
    el.style.width = '20px';
    el.style.height = '20px';

    return el;
  }

  /**
   * Returns configuration for different event types
   */
  getEventConfig(eventType: string): { color: string; icon: string } {
    const configs: Record<string, { color: string; icon: string }> = {
      start: { color: '#28a745', icon: '▶' },
      stop: { color: '#dc3545', icon: '⏹' },
      pause: { color: '#fd7e14', icon: '⏸' },
      resume: { color: '#007bff', icon: '▶' },
      lap: { color: '#ffc107', icon: '⚑' },
      reset: { color: '#6c757d', icon: '↻' },
    };

    return configs[eventType] || { color: '#6f42c1', icon: '●' };
  }

  /**
   * Creates popup content specifically for events
   */
  createEventPopupContent(
    properties: LocationProperties,
    coordinates: [number, number, number],
    eventType: string
  ): string {
    const { timestamp, session, session_title, username } = properties;

    const sessionDisplay =
      session_title && session_title !== session
        ? `${session_title} (${session})`
        : session || 'N/A';
    const sessionLink =
      session && username
        ? `<a href="/u/${username}/s/${session}" class="popup-link">${sessionDisplay}</a>`
        : sessionDisplay;

    const userLine = username
      ? `<b>User:</b> <a href="/u/${username}" class="popup-link">${username}</a><br>`
      : '';

    return `
      <div class="event-popup">
        <h4 class="event-title">Event: ${eventType.charAt(0).toUpperCase() + eventType.slice(1)}</h4>
        ${userLine}<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
        <b>Session:</b> ${sessionLink}
      </div>
    `;
  }

  displayPoint(data: LocationResponse): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot display point');
      return;
    }

    this.markers.forEach(marker => marker.remove());
    this.markers.clear();

    const [longitude, latitude] = data.geometry.coordinates;

    if (!this.setViewFromUrlHash()) {
      this.map.setCenter([longitude, latitude]);
      this.map.setZoom(15);
    }

    const coords: [number, number, number] =
      data.geometry.coordinates.length === 2
        ? ([...data.geometry.coordinates, 0] as [number, number, number])
        : (data.geometry.coordinates as [number, number, number]);

    const popupContent = this.createPopupContent(data.properties, coords);
    const marker = createMarker([latitude, longitude], data.properties);

    const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupContent).addTo(this.map);

    const mapMarker = new maplibregl.Marker({ element: marker.getElement() })
      .setLngLat([longitude, latitude])
      .setPopup(popup)
      .addTo(this.map);

    mapMarker.togglePopup(); // Open popup
    this.markers.set('single', mapMarker);

    this.dispatchEvent(
      new CustomEvent('location-update', { detail: data, bubbles: true, composed: true })
    );
  }

  getHeartRateColor(heartRate: number | null, min: number, max: number): string {
    if (heartRate === null || heartRate === undefined || max === min) {
      return '#808080';
    }
    const ratio = (heartRate - min) / (max - min);
    const rgb = this.interpolateColor(ratio, this.colorScale);
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  interpolateColor(ratio: number, colorStops: Array<Array<number>>): Array<number> {
    const numStops = colorStops.length;
    if (ratio <= 0) {
      return colorStops[0];
    }
    if (ratio >= 1) {
      return colorStops[numStops - 1];
    }

    const segment = 1 / (numStops - 1);
    const segmentIndex = Math.floor(ratio / segment);
    const localRatio = (ratio % segment) / segment;

    const color1 = colorStops[segmentIndex];
    const color2 = colorStops[Math.min(segmentIndex + 1, numStops - 1)];

    const r = Math.round(color1[0] + (color2[0] - color1[0]) * localRatio);
    const g = Math.round(color1[1] + (color2[1] - color1[1]) * localRatio);
    const b = Math.round(color1[2] + (color2[2] - color1[2]) * localRatio);

    return [r, g, b];
  }

  createPopupContent(
    properties: LocationProperties,
    coordinates: [number, number, number]
  ): string {
    const { speed, heart_rate, timestamp, session, session_title, username, status, event } =
      properties;
    const altitude = coordinates[2];

    const sessionDisplay =
      session_title && session_title !== session
        ? `${session_title} (${session})`
        : session || 'N/A';
    const sessionLink =
      session && username
        ? `<a href="/u/${username}/s/${session}" class="popup-link">${sessionDisplay}</a>`
        : sessionDisplay;

    const userLine = username
      ? `<b>User:</b> <a href="/u/${username}" class="popup-link">${username}</a><br>`
      : '';

    const statusLine = status
      ? `<b>Status:</b> ${status.charAt(0).toUpperCase() + status.slice(1)}<br>`
      : '';

    const eventLine = event
      ? `<b>Event:</b> ${event.charAt(0).toUpperCase() + event.slice(1)}<br>`
      : '';

    return `
      ${userLine}<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
      <b>Session:</b> ${sessionLink}<br>
      ${statusLine}${eventLine}<b>Altitude:</b> ${altitude} m<br>
      <b>Speed:</b> ${speed} km/h<br>
      <b>Heart Rate:</b> ${heart_rate} bpm
    `;
  }

  /**
   * Shows the current position on the map with accuracy circle
   */
  showCurrentPosition(coords: GeolocationCoordinates): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot show current position');
      return;
    }

    const { latitude, longitude, accuracy } = coords;

    // Remove existing marker if any
    if (this.currentPositionMarker) {
      this.currentPositionMarker.remove();
    }

    // Create marker for current position
    this.currentPositionMarker = new maplibregl.Marker({ color: '#ff901e' })
      .setLngLat([longitude, latitude])
      .addTo(this.map);

    // Update accuracy circle
    const source = this.map.getSource('current-position-circle') as maplibregl.GeoJSONSource;
    if (source) {
      // Convert meters to pixels at current zoom level
      const metersPerPixel =
        (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, this.map.getZoom());
      const radiusPixels = accuracy / metersPerPixel;

      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            properties: {
              radiusPixels: radiusPixels,
            },
          },
        ],
      });
    }
  }

  hideCurrentPosition(): void {
    if (this.currentPositionMarker) {
      this.currentPositionMarker.remove();
      this.currentPositionMarker = null;
    }

    const source = this.map?.getSource('current-position-circle') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  /**
   * Center map on specific coordinates
   */
  centerOnCoordinates(
    latitude: number,
    longitude: number,
    zoomOrWaypointId?: number | string
  ): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot center on coordinates');
      return;
    }

    let zoom: number | undefined;
    let waypointId: string | undefined;

    if (typeof zoomOrWaypointId === 'number') {
      zoom = zoomOrWaypointId;
    } else if (typeof zoomOrWaypointId === 'string') {
      waypointId = zoomOrWaypointId;
    }

    this.map.setCenter([longitude, latitude]);
    if (zoom !== undefined) {
      this.map.setZoom(zoom);
    }

    if (waypointId) {
      this.updateUrlHash(waypointId);
      this.openWaypointPopupById(waypointId);
    }
  }

  /**
   * Show temporary hover marker at specific coordinates
   */
  showHoverMarker(latitude: number, longitude: number): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot show hover marker');
      return;
    }

    if (this.hoverMarker) {
      this.hoverMarker.remove();
    }

    const el = document.createElement('div');
    el.className = 'hover-marker';
    el.style.width = '16px';
    el.style.height = '16px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#ff0000';
    el.style.border = '2px solid #ffffff';

    this.hoverMarker = new maplibregl.Marker({ element: el })
      .setLngLat([longitude, latitude])
      .addTo(this.map);
  }

  /**
   * Hide hover marker
   */
  hideHoverMarker(): void {
    if (this.hoverMarker) {
      this.hoverMarker.remove();
      this.hoverMarker = null;
    }
  }

  /**
   * Show persistent selected marker at specific coordinates
   */
  showSelectedMarker(latitude: number, longitude: number): void {
    this.showHoverMarker(latitude, longitude);
  }

  /**
   * Hide selected marker
   */
  hideSelectedMarker(): void {
    this.hideHoverMarker();
  }

  /**
   * Check if a marker is currently shown
   */
  hasSelectedMarker(): boolean {
    return this.hoverMarker !== null;
  }

  /**
   * Start waypoint selection mode
   */
  startWaypointSelection(): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot start waypoint selection');
      return;
    }

    this.waypointSelectionMode = true;
    this.selectedWaypointCoords = null;

    const canvas = this.map.getCanvas();
    canvas.style.cursor = 'crosshair';

    this.map.on('click', this.handleWaypointSelectionClick);

    this.showWaypointSelectionInstructions();

    console.log('Started waypoint selection mode');
  }

  /**
   * Stop waypoint selection mode
   */
  stopWaypointSelection(): void {
    if (!this.map) {
      return;
    }

    this.waypointSelectionMode = false;
    this.selectedWaypointCoords = null;

    const canvas = this.map.getCanvas();
    canvas.style.cursor = '';

    this.map.off('click', this.handleWaypointSelectionClick);

    if (this.waypointSelectionMarker) {
      this.waypointSelectionMarker.remove();
      this.waypointSelectionMarker = null;
    }

    this.hideWaypointSelectionInstructions();

    console.log('Stopped waypoint selection mode');
  }

  /**
   * Check if currently in waypoint selection mode
   */
  isInWaypointSelectionMode(): boolean {
    return this.waypointSelectionMode;
  }

  /**
   * Get selected waypoint coordinates
   */
  getSelectedWaypointCoordinates(): [number, number] | null {
    return this.selectedWaypointCoords;
  }

  /**
   * Handle waypoint selection click
   */
  private handleWaypointSelectionClick = (e: maplibregl.MapMouseEvent): void => {
    if (!this.waypointSelectionMode || !this.map) {
      return;
    }

    const { lat, lng } = e.lngLat;
    this.selectedWaypointCoords = [lat, lng];

    if (this.waypointSelectionMarker) {
      this.waypointSelectionMarker.remove();
    }

    const el = document.createElement('div');
    el.className = 'waypoint-selection-marker';
    el.innerHTML = '📍';
    el.style.fontSize = '30px';

    this.waypointSelectionMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(this.map);

    this.dispatchEvent(
      new CustomEvent('waypoint-selected', {
        detail: {
          latitude: lat,
          longitude: lng,
          coordinates: [lat, lng],
        },
        bubbles: true,
      })
    );

    console.log('Waypoint selected at:', lat, lng);
  };

  /**
   * Show waypoint selection instructions
   */
  private showWaypointSelectionInstructions(): void {
    const mapContainer = this.shadowRoot!.getElementById('map')!;

    if (mapContainer.querySelector('.waypoint-instructions')) {
      return;
    }

    const instructionOverlay = document.createElement('div');
    instructionOverlay.className = 'waypoint-instructions';
    instructionOverlay.innerHTML = `
      <div class="waypoint-instruction-content">
        <span>📍 Click on the map to select waypoint location</span>
        <button class="instruction-close-btn" onclick="this.closest('map-widget').stopWaypointSelection()">×</button>
      </div>
    `;

    mapContainer.appendChild(instructionOverlay);
  }

  /**
   * Hide waypoint selection instructions
   */
  private hideWaypointSelectionInstructions(): void {
    const instructionOverlay = this.shadowRoot!.querySelector('.waypoint-instructions');
    if (instructionOverlay) {
      instructionOverlay.remove();
    }
  }
}

customElements.define('map-widget', MapWidget);
