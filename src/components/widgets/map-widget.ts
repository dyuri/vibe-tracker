import type {
  LocationResponse,
  LocationsResponse,
  MapWidgetElement,
  GeolocationCoordinates,
  GeoJSONFeature,
  LocationProperties,
} from '../../types/index';
import { createMarker } from '../ui/avatar-marker';

// Leaflet global (loaded via script tag)
declare const L: typeof import('leaflet');

/**
 * Map Widget Web Component
 * Interactive Leaflet map for displaying location data with heart rate visualization
 */
export default class MapWidget extends HTMLElement implements MapWidgetElement {
  private map: L.Map | null = null;
  private dataLayerGroup: L.LayerGroup | null = null;
  private currentPositionLayerGroup: L.LayerGroup | null = null;
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
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        :host {
          display: block;
          height: 100%;
        }
        #map {
          height: 100%;
        }
        
        /* Theme variables for shadow DOM */
        :host {
          --font-family-base: sans-serif;
          --font-size-base: 14px;
        }
    
        /* Leaflet map */
        :host([data-map-theme="dark"]) {
          .leaflet-layer,
          .leaflet-control-zoom-in,
          .leaflet-control-zoom-out,
          .leaflet-control-attribution {
            filter: invert(100%) hue-rotate(180deg) brightness(0.9) contrast(0.9);
          }
        }

        /* Leaflet popup theming */
        .leaflet-popup-content-wrapper,
        .leaflet-popup-tip {
          background-color: var(--bg-panel) !important;
          color: var(--text-primary) !important;
          box-shadow: var(--shadow-medium) !important;
        }

        .leaflet-popup-content {
          color: var(--text-primary) !important;
          font-family: var(--font-family-base) !important;
          font-size: var(--font-size-base) !important;
        }

        .leaflet-popup-content b {
          color: var(--text-primary) !important;
        }

        .leaflet-popup-close-button {
          color: var(--text-secondary) !important;
        }

        .leaflet-popup-close-button:hover {
          color: var(--text-primary) !important;
        }

        /* Leaflet zoom controls positioning */
        .leaflet-control-zoom {
          margin-top: 80px !important;
        }
      </style>
      <div id="map"></div>
    `;
  }

  /**
   * Called when the element is connected to the DOM
   * Initializes the Leaflet map and sets up event listeners
   */
  connectedCallback(): void {
    this.map = L.map(this.shadowRoot!.getElementById('map')!);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    this.dataLayerGroup = L.layerGroup().addTo(this.map);
    this.currentPositionLayerGroup = L.layerGroup().addTo(this.map);

    this.map.on('moveend', () => this.updateUrlHash());
    this.map.on('zoomend', () => this.updateUrlHash());

    this.setViewFromUrlHash();
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
    if (data.type === 'FeatureCollection') {
      this.currentFeatureCollection = data; // Store current data
      this.displayFeatureCollection(data);
    } else {
      this.currentFeatureCollection = null; // Single point mode
      this.displayPoint(data);
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
    this.dataLayerGroup!.clearLayers();

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
        const color = this.getHeartRateColor(heartRate, minHeartRate, maxHeartRate);
        const line = L.polyline(
          [
            [startPoint.geometry.coordinates[1], startPoint.geometry.coordinates[0]],
            [endPoint.geometry.coordinates[1], endPoint.geometry.coordinates[0]],
          ],
          { color: color, weight: 5 }
        );
        this.dataLayerGroup!.addLayer(line);
      }

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
    this.dataLayerGroup!.clearLayers();
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

  createPopupContent(
    properties: LocationProperties,
    coordinates: [number, number, number]
  ): string {
    const { speed, heart_rate, timestamp, session, session_title, username } = properties;
    const altitude = coordinates[2];

    const sessionDisplay =
      session_title && session_title !== session
        ? `${session_title} (${session})`
        : session || 'N/A';
    const sessionLink =
      session && username
        ? `<a href="/u/${username}/s/${session}" style="color: var(--color-primary); text-decoration: none;">${sessionDisplay}</a>`
        : sessionDisplay;

    const userLine = username
      ? `<b>User:</b> <a href="/u/${username}" style="color: var(--color-primary); text-decoration: none;">${username}</a><br>`
      : '';

    return `
      ${userLine}<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
      <b>Session:</b> ${sessionLink}<br>
      <b>Altitude:</b> ${altitude} m<br>
      <b>Speed:</b> ${speed} km/h<br>
      <b>Heart Rate:</b> ${heart_rate} bpm
    `;
  }

  /**
   * Shows the current position on the map with accuracy circle
   */
  showCurrentPosition(coords: GeolocationCoordinates): void {
    this.currentPositionLayerGroup!.clearLayers();
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
    this.currentPositionLayerGroup!.clearLayers();
  }
}

customElements.define('map-widget', MapWidget);
