import { vi } from 'vitest';

// Mock global variables that are available in the browser
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(() => {
    localStorageMock.getItem = vi.fn(() => null);
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Also set global localStorage for Node.js tests
global.localStorage = localStorageMock;

Object.defineProperty(window, 'customElements', {
  value: {
    define: vi.fn(),
    get: vi.fn(),
    whenDefined: vi.fn(() => Promise.resolve()),
  },
});

// Mock Leaflet global
global.L = {
  map: vi.fn(() => ({
    on: vi.fn(),
    setView: vi.fn(),
    fitBounds: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 0, lng: 0 })),
    getZoom: vi.fn(() => 10),
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn(),
  })),
  layerGroup: vi.fn(() => ({
    addTo: vi.fn(),
    clearLayers: vi.fn(),
    addLayer: vi.fn(),
  })),
  marker: vi.fn(() => ({
    bindPopup: vi.fn(),
    openPopup: vi.fn(),
  })),
  divIcon: vi.fn(),
  polyline: vi.fn(() => ({
    on: vi.fn(),
  })),
  popup: vi.fn(() => ({
    setLatLng: vi.fn(),
    setContent: vi.fn(),
    openOn: vi.fn(),
  })),
  circle: vi.fn(),
  geoJSON: vi.fn(() => ({
    getBounds: vi.fn(),
  })),
  latLng: vi.fn((lat, lng) => ({ lat, lng, distanceTo: vi.fn(() => 100) })),
};
