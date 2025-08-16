import { createMarker } from './avatar-marker.js';

export default class MapWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        :host {
          display: block;
          height: 100%;
        }
        #map {
          height: 100%;
        }
      </style>
      <div id="map"></div>
    `;
    this.map = null;
    this.dataLayerGroup = null;
    this.currentPositionLayerGroup = null;
    this.colorScale = [
      [0, 0, 255],    // Blue
      [0, 255, 0],    // Green
      [255, 255, 0],  // Yellow
      [255, 165, 0],  // Orange
      [255, 0, 0]     // Red
    ];
  }

  connectedCallback() {
    this.map = L.map(this.shadowRoot.getElementById('map'));
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    this.dataLayerGroup = L.layerGroup().addTo(this.map);
    this.currentPositionLayerGroup = L.layerGroup().addTo(this.map);

    this.map.on('moveend', () => this.updateUrlHash());
    this.map.on('zoomend', () => this.updateUrlHash());

    this.setViewFromUrlHash();
  }

  setViewFromUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#map=')) {
      const parts = hash.substring(5).split('/');
      if (parts.length === 3) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        const zoom = parseInt(parts[2], 10);
        if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) {
          this.map.setView([lat, lon], zoom);
          return true;
        }
      }
    }
    return false;
  }

  updateUrlHash() {
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    const hash = `#map=${center.lat.toFixed(6)}/${center.lng.toFixed(6)}/${zoom}`;
    history.replaceState(null, null, hash);
  }

  displayData(data) {
    if (data.type === 'FeatureCollection') {
      this.displayFeatureCollection(data);
    } else {
      this.displayPoint(data);
    }
  }

  displayFeatureCollection(data) {
    this.dataLayerGroup.clearLayers();

    const points = data.features;
    if (points.length === 0) {
      return;
    }

    // Find min and max heart rate for color scaling
    const heartRates = points.map((p) => p.properties.heart_rate).filter(hr => hr !== null && hr !== undefined);
    const minHeartRate = Math.min(...heartRates);
    const maxHeartRate = Math.max(...heartRates);

    // Create black outlines first
    for (let i = 0; i < points.length - 1; i++) {
      const startPoint = points[i];
      const endPoint = points[i+1];
      const outline = L.polyline([[startPoint.geometry.coordinates[1], startPoint.geometry.coordinates[0]], [endPoint.geometry.coordinates[1], endPoint.geometry.coordinates[0]]], { color: 'black', weight: 7 });
      this.dataLayerGroup.addLayer(outline);
    }

    // Create colored lines on top
    for (let i = 0; i < points.length - 1; i++) {
      const startPoint = points[i];
      const endPoint = points[i+1];
      const heartRate = startPoint.properties.heart_rate;
      const color = this.getHeartRateColor(heartRate, minHeartRate, maxHeartRate);
      const line = L.polyline([[startPoint.geometry.coordinates[1], startPoint.geometry.coordinates[0]], [endPoint.geometry.coordinates[1], endPoint.geometry.coordinates[0]]], { color: color, weight: 5 });
      this.dataLayerGroup.addLayer(line);
    }

    const latestPoint = points[points.length - 1];

    // Create a transparent, clickable line
    const clickableLine = L.polyline(points.map(p => [p.geometry.coordinates[1], p.geometry.coordinates[0]]), { opacity: 0, weight: 10 });
    clickableLine.on('click', (e) => {
      let closestPoint = null;
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
        const { speed, heart_rate, timestamp, session } = closestPoint.properties;
        const altitude = closestPoint.geometry.coordinates[2];
        const popupContent = `
              <b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
              <b>Session:</b> ${session || "N/A"}<br>
              <b>Altitude:</b> ${altitude} m<br>
              <b>Speed:</b> ${speed} km/h<br>
              <b>Heart Rate:</b> ${heart_rate} bpm
            `;
        L.popup()
          .setLatLng(e.latlng)
          .setContent(popupContent)
          .openOn(this.map);
      }
    });
    this.dataLayerGroup.addLayer(clickableLine);

    // Add only the latest point as a marker
    const [longitude, latitude, altitude] = latestPoint.geometry.coordinates;
    const marker = createMarker([latitude, longitude], latestPoint.properties);
    const { speed, heart_rate, timestamp, session } = latestPoint.properties;
    const popupContent = `
            <b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
            <b>Session:</b> ${session || "N/A"}<br>
            <b>Altitude:</b> ${altitude} m<br>
            <b>Speed:</b> ${speed} km/h<br>
            <b>Heart Rate:</b> ${heart_rate} bpm
          `;
    marker.bindPopup(popupContent);
    this.dataLayerGroup.addLayer(marker);

    if (!this.setViewFromUrlHash()) {
      this.map.fitBounds(L.geoJSON(data).getBounds());
    }

    if (latestPoint) {
      this.dispatchEvent(new CustomEvent('location-update', { detail: latestPoint, bubbles: true, composed: true }));
    }
  }

  displayPoint(data) {
    this.dataLayerGroup.clearLayers();
    const [longitude, latitude, altitude] = data.geometry.coordinates;
    const { speed, heart_rate, timestamp, session } = data.properties;

    if (!this.setViewFromUrlHash()) {
      this.map.setView([latitude, longitude], 15);
    }
    const marker = createMarker([latitude, longitude], data.properties)
      .bindPopup(
        `
            <b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
            <b>Session:</b> ${session || "N/A"}<br>
            <b>Altitude:</b> ${altitude} m<br>
            <b>Speed:</b> ${speed} km/h<br>
            <b>Heart Rate:</b> ${heart_rate} bpm
        `,
      )
      .openPopup();
    this.dataLayerGroup.addLayer(marker);

    this.dispatchEvent(new CustomEvent('location-update', { detail: data, bubbles: true, composed: true }));
  }

  getHeartRateColor(heartRate, min, max) {
    if (heartRate === null || heartRate === undefined || max == min) {
      return "#808080"; // Grey for no data
    }
    const ratio = (heartRate - min) / (max - min);
    const rgb = this.interpolateColor(ratio, this.colorScale);
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  interpolateColor(ratio, colorStops) {
    const numStops = colorStops.length;
    if (ratio <= 0) return colorStops[0];
    if (ratio >= 1) return colorStops[numStops - 1];

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

  showCurrentPosition(coords) {
    this.currentPositionLayerGroup.clearLayers();
    const { latitude, longitude, accuracy } = coords;
    const marker = L.circleMarker([latitude, longitude], {
      radius: 4,
      color: "#ff901e",
      fillColor: "#ff901e",
      fillOpacity: 1,
    });
    const circle = L.circle([latitude, longitude], {
      radius: accuracy,
      color: "#ff901e",
      fillColor: "#ff901e",
      fillOpacity: 0.2,
    });
    this.currentPositionLayerGroup.addLayer(marker);
    this.currentPositionLayerGroup.addLayer(circle);
  }

  hideCurrentPosition() {
    this.currentPositionLayerGroup.clearLayers();
  }
}

customElements.define('map-widget', MapWidget);
