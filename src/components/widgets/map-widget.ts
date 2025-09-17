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
import * as L from 'leaflet';
import leafletCSS from 'leaflet/dist/leaflet.css?inline';

/**
 * Map Widget Web Component
 * Interactive Leaflet map for displaying location data with heart rate visualization
 */
export default class MapWidget extends HTMLElement implements MapWidgetElement {
  private map: L.Map | null = null;
  private dataLayerGroup: L.LayerGroup | null = null;
  private currentPositionLayerGroup: L.LayerGroup | null = null;
  private hoverMarkerLayerGroup: L.LayerGroup | null = null;
  private eventMarkerLayerGroup: L.LayerGroup | null = null;
  // New layer groups for GPX tracks and waypoints
  private gpxTrackLayerGroup: L.LayerGroup | null = null;
  private waypointsLayerGroup: L.LayerGroup | null = null;
  private currentFeatureCollection: LocationsResponse | null = null;
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
      <style>${leafletCSS}</style>
      <style>${styles}</style>
      <div id="map"></div>
    `;
  }

  /**
   * Called when the element is connected to the DOM
   * Initializes the Leaflet map and sets up event listeners
   */
  connectedCallback(): void {
    try {
      // Fix Leaflet default icon paths for Vite/webpack builds
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
        iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
        shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
      });

      this.map = L.map(this.shadowRoot!.getElementById('map')!);

      // Create custom map panes for proper layering control
      this.map.createPane('gpxPane');
      this.map.getPane('gpxPane')!.style.zIndex = '400'; // Lower z-index for GPX tracks
      this.map.getPane('overlayPane')!.style.zIndex = '600'; // Higher z-index for main tracks

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(this.map);

      // Initialize GPX and waypoint layer groups with custom pane (bottom layers)
      this.gpxTrackLayerGroup = L.layerGroup().addTo(this.map);
      this.waypointsLayerGroup = L.layerGroup().addTo(this.map);
      // Initialize main data layers on top (uses default overlay pane with zIndex 600)
      this.dataLayerGroup = L.layerGroup().addTo(this.map);
      this.currentPositionLayerGroup = L.layerGroup().addTo(this.map);
      this.hoverMarkerLayerGroup = L.layerGroup().addTo(this.map);
      this.eventMarkerLayerGroup = L.layerGroup().addTo(this.map);

      this.map.on('moveend', () => this.updateUrlHash());
      this.map.on('zoomend', () => this.updateUrlHash());

      this.setViewFromUrlHash();
    } catch (error) {
      console.error('Failed to initialize map widget:', error);
      this.shadowRoot!.getElementById('map')!.innerHTML =
        '<div class="map-error">Map initialization failed</div>';
    }
  }

  setViewFromUrlHash(): boolean {
    const hash = window.location.hash;
    if (hash.startsWith('#map=')) {
      const parts = hash.substring(5).split('/');
      if (parts.length === 3) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        const zoom = parseInt(parts[2], 10);
        if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) {
          this.map!.setView([lat, lon], zoom);
          return true;
        }
      }
    }
    return false;
  }

  updateUrlHash(): void {
    const center = this.map!.getCenter();
    const zoom = this.map!.getZoom();
    const hash = `#map=${center.lat.toFixed(6)}/${center.lng.toFixed(6)}/${zoom}`;
    history.replaceState(null, null, hash);
  }

  /**
   * Displays location data on the map
   */
  displayData(data: LocationResponse | LocationsResponse): void {
    if (!this.map || !this.dataLayerGroup) {
      console.warn('Map not initialized, cannot display data');
      return;
    }

    if (data.type === 'FeatureCollection') {
      this.currentFeatureCollection = data; // Store current data
      this.displayFeatureCollection(data);
    } else {
      this.currentFeatureCollection = null; // Single point mode
      this.displayPoint(data);
    }
  }

  /**
   * Displays GPX track data as a planned route
   */
  displayGpxTrack(data: GpxTrackPointsResponse): void {
    if (!this.map || !this.gpxTrackLayerGroup) {
      console.warn('Map not initialized, cannot display GPX track');
      return;
    }

    this.gpxTrackLayerGroup.clearLayers();

    if (!data.features || data.features.length === 0) {
      return;
    }

    // Sort track points by sequence
    const sortedPoints = [...data.features].sort(
      (a, b) => a.properties.sequence - b.properties.sequence
    );

    // Create the planned track polyline (dashed blue)
    const trackCoordinates: [number, number][] = sortedPoints.map(point => [
      point.geometry.coordinates[1], // latitude
      point.geometry.coordinates[0], // longitude
    ]);

    const plannedTrack = L.polyline(trackCoordinates, {
      color: 'hsl(320, 100%, 60%)', // Bright pink color for planned track
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 15', // Dashed line with bigger gaps to distinguish from actual track
      pane: 'gpxPane', // Use custom GPX pane with lower z-index
    });

    // Add popup to show track information
    plannedTrack.bindPopup(`
      <div class="gpx-track-popup">
        <h4>Planned Track</h4>
        <b>Points:</b> ${sortedPoints.length}<br>
        <b>Type:</b> GPX Track
      </div>
    `);

    this.gpxTrackLayerGroup.addLayer(plannedTrack);
  }

  /**
   * Displays waypoints on the map
   */
  displayWaypoints(data: WaypointsResponse): void {
    if (!this.map || !this.waypointsLayerGroup) {
      console.warn('Map not initialized, cannot display waypoints');
      return;
    }

    this.waypointsLayerGroup.clearLayers();

    if (!data.features || data.features.length === 0) {
      return;
    }

    data.features.forEach(waypoint => {
      const marker = this.createWaypointMarker(waypoint);

      const popupContent = this.createWaypointPopupContent(waypoint);
      marker.bindPopup(popupContent);

      this.waypointsLayerGroup!.addLayer(marker);
    });
  }

  /**
   * Creates a marker for a waypoint with appropriate icon
   */
  createWaypointMarker(waypoint: WaypointFeature): L.Marker {
    const [longitude, latitude] = waypoint.geometry.coordinates;
    const icon = this.getWaypointIcon(
      waypoint.properties.type,
      waypoint.properties.position_confidence
    );

    return L.marker([latitude, longitude], { icon });
  }

  /**
   * Returns appropriate icon for waypoint type and confidence
   */
  getWaypointIcon(type: WaypointType, confidence: PositionConfidence): L.DivIcon {
    const config = this.getWaypointConfig(type);
    const confidenceStyle = this.getConfidenceStyle(confidence);

    return L.divIcon({
      className: `waypoint-marker waypoint-marker-${type}`,
      html: `<div class="waypoint-marker-content" style="background-color: ${config.color}; ${confidenceStyle}">
               <span class="waypoint-marker-icon">${config.icon}</span>
             </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
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
      gps: 'opacity: 1; border: 2px solid #28a745;', // Green border for GPS
      time_matched: 'opacity: 0.9; border: 2px solid #007bff;', // Blue border
      tracked: 'opacity: 0.8; border: 2px solid #17a2b8;', // Cyan border
      gpx_track: 'opacity: 0.7; border: 2px solid #6f42c1;', // Purple border
      last_known: 'opacity: 0.6; border: 2px solid #fd7e14;', // Orange border
      manual: 'opacity: 0.5; border: 2px dashed #6c757d;', // Gray dashed border
    };

    return styles[confidence] || styles.manual;
  }

  /**
   * Creates popup content for waypoints
   */
  createWaypointPopupContent(waypoint: WaypointFeature): string {
    const { name, type, description, altitude, source, position_confidence } = waypoint.properties;
    const coords = waypoint.geometry.coordinates;

    const altitudeText = altitude ? `<b>Altitude:</b> ${altitude} m<br>` : '';
    const descriptionText = description ? `<b>Description:</b> ${description}<br>` : '';

    return `
      <div class="waypoint-popup">
        <h4>${name}</h4>
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
    if (this.gpxTrackLayerGroup) {
      this.gpxTrackLayerGroup.clearLayers();
    }
  }

  /**
   * Clears waypoints from the map
   */
  clearWaypoints(): void {
    if (this.waypointsLayerGroup) {
      this.waypointsLayerGroup.clearLayers();
    }
  }

  /**
   * Appends new location data to existing data on the map
   */
  appendData(newData: LocationsResponse): void {
    if (!this.currentFeatureCollection || !newData.features || newData.features.length === 0) {
      return;
    }

    // Get the latest timestamp from existing data
    const existingFeatures = this.currentFeatureCollection.features;
    let latestExistingTimestamp = 0;
    if (existingFeatures.length > 0) {
      latestExistingTimestamp = Math.max(...existingFeatures.map(f => f.properties.timestamp));
    }

    // Filter new features to only include truly new ones (timestamp > latest existing)
    const trulyNewFeatures = newData.features.filter(
      feature => feature.properties.timestamp > latestExistingTimestamp
    );

    // Only proceed if we have truly new features
    if (trulyNewFeatures.length === 0) {
      return;
    }

    // Merge truly new features with existing ones
    this.currentFeatureCollection.features.push(...trulyNewFeatures);

    // Re-render with the combined data
    this.displayFeatureCollection(this.currentFeatureCollection);
  }

  displayFeatureCollection(data: LocationsResponse): void {
    if (!this.dataLayerGroup || !this.eventMarkerLayerGroup) {
      console.warn('Map not initialized, cannot display feature collection');
      return;
    }

    this.dataLayerGroup.clearLayers();
    this.eventMarkerLayerGroup.clearLayers();

    const points = data.features;
    if (points.length === 0) {
      return;
    }

    // Check if this is multi-user data (different usernames) or single-user track data
    const usernames = [...new Set(points.map(p => p.properties.username).filter(u => u))];
    const isMultiUser = usernames.length > 1;

    if (isMultiUser) {
      // Multi-user mode: display individual markers for each user's location
      points.forEach(point => {
        const [longitude, latitude, _altitude] = point.geometry.coordinates;

        const marker = createMarker([latitude, longitude], point.properties);
        const coords: [number, number, number] =
          point.geometry.coordinates.length === 2
            ? ([...point.geometry.coordinates, 0] as [number, number, number])
            : (point.geometry.coordinates as [number, number, number]);
        const popupContent = this.createPopupContent(point.properties, coords);
        marker.bindPopup(popupContent);
        this.dataLayerGroup!.addLayer(marker);
      });
    } else {
      // Single-user track mode: display connected lines with heart rate coloring
      // Find min and max heart rate for color scaling
      const heartRates = points
        .map(p => p.properties.heart_rate)
        .filter(hr => hr !== null && hr !== undefined);
      const minHeartRate = Math.min(...heartRates);
      const maxHeartRate = Math.max(...heartRates);

      // Create black outlines first
      for (let i = 0; i < points.length - 1; i++) {
        const startPoint = points[i];
        const endPoint = points[i + 1];
        const outline = L.polyline(
          [
            [startPoint.geometry.coordinates[1], startPoint.geometry.coordinates[0]],
            [endPoint.geometry.coordinates[1], endPoint.geometry.coordinates[0]],
          ],
          { color: 'black', weight: 7 }
        );
        this.dataLayerGroup!.addLayer(outline);
      }

      // Create colored lines on top
      for (let i = 0; i < points.length - 1; i++) {
        const startPoint = points[i];
        const endPoint = points[i + 1];
        const heartRate = startPoint.properties.heart_rate;
        const status = startPoint.properties.status;

        // Determine line color - use status-specific colors only if both points have the same status
        const endStatus = endPoint.properties.status;
        let color: string;
        let statusStyle: { dashArray?: string; opacity?: number } = {};

        if (status === 'stopped' && endStatus === 'stopped') {
          color = '#dc3545'; // Red for stopped
          statusStyle = this.getLineStyleForStatus('stopped');
        } else if (status === 'paused' && endStatus === 'paused') {
          color = '#fd7e14'; // Orange for paused
          statusStyle = this.getLineStyleForStatus('paused');
        } else {
          color = this.getHeartRateColor(heartRate, minHeartRate, maxHeartRate);
        }

        const lineOptions = {
          color: color,
          weight: 5,
          ...statusStyle,
        };

        const line = L.polyline(
          [
            [startPoint.geometry.coordinates[1], startPoint.geometry.coordinates[0]],
            [endPoint.geometry.coordinates[1], endPoint.geometry.coordinates[0]],
          ],
          lineOptions
        );
        this.dataLayerGroup!.addLayer(line);
      }

      // Add event markers for points with events
      points.forEach(point => {
        if (point.properties.event) {
          const eventMarker = this.createEventMarker(point, point.properties.event);
          this.eventMarkerLayerGroup!.addLayer(eventMarker);
        }
      });

      // Create a transparent, clickable line
      const clickableLine = L.polyline(
        points.map(p => [p.geometry.coordinates[1], p.geometry.coordinates[0]]),
        { opacity: 0, weight: 10 }
      );
      clickableLine.on('click', (e: L.LeafletMouseEvent) => {
        let closestPoint: GeoJSONFeature | null = null;
        let minDistance = Infinity;

        points.forEach(p => {
          const latlng = L.latLng(p.geometry.coordinates[1], p.geometry.coordinates[0]);
          const distance = e.latlng.distanceTo(latlng);
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = p;
          }
        });

        if (closestPoint) {
          const coords: [number, number, number] =
            closestPoint.geometry.coordinates.length === 2
              ? ([...closestPoint.geometry.coordinates, 0] as [number, number, number])
              : (closestPoint.geometry.coordinates as [number, number, number]);
          const popupContent = this.createPopupContent(closestPoint.properties, coords);
          L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(this.map!);

          // Dispatch event for chart synchronization
          const pointIndex =
            this.currentFeatureCollection?.features.findIndex(f => f === closestPoint) ?? -1;
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
      });
      this.dataLayerGroup!.addLayer(clickableLine);

      // Add only the latest point as a marker
      const latestPoint = points[points.length - 1];
      const [longitude, latitude, _altitude] = latestPoint.geometry.coordinates;
      const marker = createMarker([latitude, longitude], latestPoint.properties);
      const coords: [number, number, number] =
        latestPoint.geometry.coordinates.length === 2
          ? ([...latestPoint.geometry.coordinates, 0] as [number, number, number])
          : (latestPoint.geometry.coordinates as [number, number, number]);
      const popupContent = this.createPopupContent(latestPoint.properties, coords);
      marker.bindPopup(popupContent);
      this.dataLayerGroup!.addLayer(marker);
    }

    if (!this.setViewFromUrlHash()) {
      this.map!.fitBounds(L.geoJSON(data).getBounds());
    }

    // For single-user mode, dispatch location update for the latest point
    if (!isMultiUser && points.length > 0) {
      const latestPoint = points[points.length - 1];
      this.dispatchEvent(
        new CustomEvent('location-update', { detail: latestPoint, bubbles: true, composed: true })
      );
    }
  }

  displayPoint(data: LocationResponse): void {
    if (!this.dataLayerGroup) {
      console.warn('Map not initialized, cannot display point');
      return;
    }

    this.dataLayerGroup.clearLayers();
    const [longitude, latitude, _altitude] = data.geometry.coordinates;

    if (!this.setViewFromUrlHash()) {
      this.map!.setView([latitude, longitude], 15);
    }
    const coords: [number, number, number] =
      data.geometry.coordinates.length === 2
        ? ([...data.geometry.coordinates, 0] as [number, number, number])
        : (data.geometry.coordinates as [number, number, number]);
    const popupContent = this.createPopupContent(data.properties, coords);
    const marker = createMarker([latitude, longitude], data.properties)
      .bindPopup(popupContent)
      .openPopup();
    this.dataLayerGroup!.addLayer(marker);

    this.dispatchEvent(
      new CustomEvent('location-update', { detail: data, bubbles: true, composed: true })
    );
  }

  getHeartRateColor(heartRate: number | null, min: number, max: number): string {
    if (heartRate === null || heartRate === undefined || max === min) {
      return '#808080'; // Grey for no data
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

  /**
   * Creates an event marker for a specific event type
   */
  createEventMarker(feature: GeoJSONFeature, eventType: string): L.Marker {
    const [longitude, latitude] = feature.geometry.coordinates;
    const icon = this.getEventMarkerIcon(eventType);

    const marker = L.marker([latitude, longitude], { icon });

    // Create popup content for the event
    const coords: [number, number, number] =
      feature.geometry.coordinates.length === 2
        ? ([...feature.geometry.coordinates, 0] as [number, number, number])
        : (feature.geometry.coordinates as [number, number, number]);
    const popupContent = this.createEventPopupContent(feature.properties, coords, eventType);
    marker.bindPopup(popupContent);

    return marker;
  }

  /**
   * Returns appropriate icon for event type
   */
  getEventMarkerIcon(eventType: string): L.DivIcon {
    const eventConfig = this.getEventConfig(eventType);

    return L.divIcon({
      className: `event-marker event-marker-${eventType}`,
      html: `<div class="event-marker-content" style="background-color: ${eventConfig.color}">
               <span class="event-marker-icon">${eventConfig.icon}</span>
             </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });
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

    return configs[eventType] || { color: '#6f42c1', icon: '●' }; // Default purple for unknown events
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

  /**
   * Returns line style configuration based on status
   */
  getLineStyleForStatus(status: string | null | undefined): {
    dashArray?: string;
    opacity?: number;
  } {
    const statusConfig: Record<string, { dashArray?: string; opacity?: number }> = {
      stopped: { dashArray: '10, 5', opacity: 0.6 }, // Dashed red lines with reduced opacity
      paused: { dashArray: '5, 5', opacity: 0.7 }, // Dotted lines with reduced opacity
    };

    return statusConfig[status || ''] || {}; // Default/active - no special styling
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
    if (!this.currentPositionLayerGroup) {
      console.warn('Map not initialized, cannot show current position');
      return;
    }

    this.currentPositionLayerGroup.clearLayers();
    const { latitude, longitude, accuracy } = coords;
    const marker = L.marker([latitude, longitude]);
    const circle = L.circle([latitude, longitude], {
      radius: accuracy,
      color: '#ff901e',
      fillColor: '#ff901e',
      fillOpacity: 0.2,
    });
    this.currentPositionLayerGroup!.addLayer(marker);
    this.currentPositionLayerGroup!.addLayer(circle);
  }

  hideCurrentPosition(): void {
    if (!this.currentPositionLayerGroup) {
      console.warn('Map not initialized, cannot hide current position');
      return;
    }

    this.currentPositionLayerGroup.clearLayers();
  }

  /**
   * Center map on specific coordinates
   */
  centerOnCoordinates(latitude: number, longitude: number, zoom?: number): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot center on coordinates');
      return;
    }

    this.map.setView([latitude, longitude], zoom || this.map.getZoom());
  }

  /**
   * Show temporary hover marker at specific coordinates
   */
  showHoverMarker(latitude: number, longitude: number): void {
    if (!this.hoverMarkerLayerGroup) {
      console.warn('Map not initialized, cannot show hover marker');
      return;
    }

    // Clear any existing hover marker
    this.hoverMarkerLayerGroup.clearLayers();

    // Create a distinctive hover marker
    const hoverMarker = L.circleMarker([latitude, longitude], {
      radius: 8,
      fillColor: '#ff0000',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    });

    this.hoverMarkerLayerGroup.addLayer(hoverMarker);
  }

  /**
   * Hide hover marker
   */
  hideHoverMarker(): void {
    if (!this.hoverMarkerLayerGroup) {
      console.warn('Map not initialized, cannot hide hover marker');
      return;
    }

    this.hoverMarkerLayerGroup.clearLayers();
  }
}

customElements.define('map-widget', MapWidget);
