# Migration Plan: Leaflet → MapLibre GL JS

## Executive Summary

**Goal**: Migrate from Leaflet 1.9.4 to MapLibre GL JS v5 for better vector tile support and performance.

**Estimated Complexity**: Medium - The migration requires careful API translation but the patterns are similar.

**Key Benefits**:

- Hardware-accelerated vector tile rendering
- Better performance with large datasets
- Smooth zoom/rotation animations
- Modern map styling with vector tiles
- 3D terrain support (future enhancement)

## Current State Analysis

### Leaflet Usage

- **Version**: 1.9.4 (CDN via unpkg.com)
- **Primary File**: `src/components/widgets/map-widget.ts` (1089 lines)
- **Secondary File**: `src/components/ui/avatar-marker.ts`
- **Loading**: CDN links in `index.html`
- **Caching**: Service worker with CacheFirst strategy

### Features to Migrate

| Feature             | Current Implementation      | MapLibre Equivalent                                |
| ------------------- | --------------------------- | -------------------------------------------------- |
| Base map            | OSM tile layer              | Vector tile style (OSM Liberty, Maptiler, etc.)    |
| Polylines           | `L.polyline()`              | `map.addLayer()` with GeoJSON LineString           |
| Markers             | `L.marker()`, `L.divIcon()` | `map.addLayer()` with symbol layer or HTML markers |
| Circles             | `L.circle()`                | `map.addLayer()` with circle layer                 |
| Popups              | `L.popup()`                 | `maplibregl.Popup()`                               |
| Layer Groups        | `L.layerGroup()`            | Layer IDs and source management                    |
| Events              | `map.on('moveend', ...)`    | `map.on('moveend', ...)` (similar API)             |
| Custom Icons        | `L.divIcon()` with HTML     | HTML markers or custom images in style             |
| Heart Rate Coloring | Per-segment polylines       | GeoJSON with data-driven styling                   |

## Migration Steps

### Phase 1: Setup & Dependencies

#### 1.1 Update package.json

```json
{
  "dependencies": {
    "maplibre-gl": "^5.0.0"
  },
  "devDependencies": {
    "@types/maplibre-gl": "^5.0.0"
  }
}
```

#### 1.2 Update index.html

**Replace**:

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

**With**:

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/maplibre-gl@5.0.0/dist/maplibre-gl.css"
/>
<script src="https://unpkg.com/maplibre-gl@5.0.0/dist/maplibre-gl.js"></script>
```

#### 1.3 Update workbox-config.js

Update service worker cache configuration for MapLibre CDN.

### Phase 2: Choose Vector Tile Provider

**Options**:

1. **Maptiler Free Tier** - 100k tile loads/month, good styling options
2. **OpenMapTiles Self-hosted** - Full control, requires tile server setup
3. **Protomaps** - Modern vector tiles, can be self-hosted or CDN
4. **OSM Liberty** - Free, open-source style for OpenMapTiles schema

**Recommendation**: Start with **Maptiler Free Tier** for quick migration, then evaluate self-hosting if needed.

### Phase 3: Core Map Widget Migration

#### 3.1 Map Initialization (`map-widget.ts` lines 60-100)

**Before (Leaflet)**:

```typescript
this.map = L.map(this.mapContainer, {
  center: [lat, lng],
  zoom: zoom,
  zoomControl: true,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
}).addTo(this.map);
```

**After (MapLibre)**:

```typescript
this.map = new maplibregl.Map({
  container: this.mapContainer,
  style: 'https://api.maptiler.com/maps/basic-v2/style.json?key=YOUR_KEY',
  center: [lng, lat], // Note: MapLibre uses [lng, lat]
  zoom: zoom,
  attributionControl: true,
});
```

**Key Changes**:

- MapLibre uses `[lng, lat]` (opposite of Leaflet)
- Style is required (JSON URL or object)
- Container is DOM element, not ID

#### 3.2 Layer Groups → Source/Layer Management

**Before (Leaflet)**:

```typescript
this.dataLayerGroup = L.layerGroup().addTo(this.map);
this.currentPositionLayerGroup = L.layerGroup().addTo(this.map);
```

**After (MapLibre)**:

```typescript
// Sources are added once, layers reference them
this.map.addSource('tracking-data', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
});

this.map.addLayer({
  id: 'tracking-line',
  type: 'line',
  source: 'tracking-data',
  paint: { 'line-color': '#3388ff', 'line-width': 3 },
});
```

**Strategy**:

- Create sources for each logical group (tracking-data, waypoints, events, etc.)
- Use layer visibility to show/hide instead of adding/removing from map

#### 3.3 Polylines → GeoJSON LineString

**Before (Leaflet)** (lines 221-238):

```typescript
const polyline = L.polyline(latLngs, {
  color: color,
  weight: 5,
  opacity: 0.8,
});
this.dataLayerGroup.addLayer(polyline);
```

**After (MapLibre)**:

```typescript
const geojson = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: latLngs.map(([lat, lng]) => [lng, lat]),
  },
  properties: { color: color },
};

this.map.getSource('tracking-data').setData({
  type: 'FeatureCollection',
  features: [geojson],
});
```

**Challenge**: Heart rate color gradients (lines 638-668)

- **Option A**: Split into multiple LineString features, each with color property
- **Option B**: Use data-driven styling with interpolation
- **Recommendation**: Option A for simplicity

#### 3.4 Markers → HTML Markers or Symbol Layers

**Custom Markers (divIcon)** - Use HTML Markers:

**Before (Leaflet)** (lines 1043-1052):

```typescript
const icon = L.divIcon({
  className: 'waypoint-selection-marker',
  html: `<div class="marker-content">${emoji}</div>`,
  iconSize: [30, 30],
});
const marker = L.marker([lat, lng], { icon });
this.waypointsLayerGroup.addLayer(marker);
```

**After (MapLibre)**:

```typescript
const el = document.createElement('div');
el.className = 'waypoint-selection-marker';
el.innerHTML = `<div class="marker-content">${emoji}</div>`;

const marker = new maplibregl.Marker({ element: el })
  .setLngLat([lng, lat])
  .addTo(this.map);
```

**Simple Markers** - Use Symbol Layers:

```typescript
this.map.addSource('waypoints', {
  type: 'geojson',
  data: waypointsGeoJSON,
});

this.map.addLayer({
  id: 'waypoints-layer',
  type: 'symbol',
  source: 'waypoints',
  layout: {
    'icon-image': 'waypoint-icon',
    'icon-size': 1,
  },
});
```

#### 3.5 Circles → Circle Layer

**Before (Leaflet)** (lines 820-825):

```typescript
const circle = L.circle([lat, lng], {
  color: '#fff',
  fillColor: '#ff8c00',
  fillOpacity: 0.2,
  radius: accuracy,
});
this.currentPositionLayerGroup.addLayer(circle);
```

**After (MapLibre)**:

```typescript
this.map.addSource('current-position-circle', {
  type: 'geojson',
  data: {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { radius: accuracy },
  },
});

this.map.addLayer({
  id: 'accuracy-circle',
  type: 'circle',
  source: 'current-position-circle',
  paint: {
    'circle-radius': {
      stops: [
        [0, 0],
        [20, metersToPixels(accuracy, lat, map.getZoom())],
      ],
    },
    'circle-color': '#ff8c00',
    'circle-opacity': 0.2,
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 2,
  },
});
```

**Note**: MapLibre circles are screen-space (pixels), not geographic (meters). Need conversion function.

#### 3.6 Popups

**Before (Leaflet)**:

```typescript
marker.bindPopup(content).openPopup();
```

**After (MapLibre)**:

```typescript
const popup = new maplibregl.Popup()
  .setLngLat([lng, lat])
  .setHTML(content)
  .addTo(this.map);

// Or bind to marker
marker.setPopup(popup);
```

**Key Differences**:

- MapLibre popups are separate objects, not bound to layers
- Use `setHTML()` instead of passing string to constructor
- Need to manage popup lifecycle manually

#### 3.7 Events

**Map Events** (lines 91-92):

```typescript
// Similar API!
this.map.on('moveend', () => {
  /* ... */
});
this.map.on('zoomend', () => {
  /* ... */
});
```

**Click Events** (line 555):

```typescript
// Leaflet: click on polyline
polyline.on('click', e => {
  /* ... */
});

// MapLibre: click on layer
this.map.on('click', 'tracking-line', e => {
  const coordinates = e.lngLat;
  // Find closest point logic
});
```

#### 3.8 URL Hash Integration (lines 102-146)

**Update coordinate order**:

```typescript
// Leaflet: lat,lng,zoom
window.location.hash = `map=${lat}/${lng}/${zoom}`;

// MapLibre: lng,lat,zoom (more conventional)
window.location.hash = `map=${lng}/${lat}/${zoom}`;

// Or keep lat/lng order for backwards compatibility
const center = this.map.getCenter();
window.location.hash = `map=${center.lat}/${center.lng}/${zoom}`;
```

### Phase 4: Avatar Marker Component

**File**: `src/components/ui/avatar-marker.ts`

**Migration Strategy**:

- Replace `L.divIcon()` with `maplibregl.Marker({ element })`
- Update function signatures to accept MapLibre map instance
- Return `maplibregl.Marker` instead of `L.Marker`

### Phase 5: Styling & Dark Mode

#### 5.1 Update CSS (`src/styles/components/widgets/map-widget.css`)

**Replace**:

```css
.leaflet-container {
  /* ... */
}
.leaflet-popup-content-wrapper {
  /* ... */
}
```

**With**:

```css
.maplibregl-map {
  /* ... */
}
.maplibregl-popup-content {
  /* ... */
}
```

#### 5.2 Dark Mode Support

**Options**:

1. **Multiple Styles**: Load different style JSON based on theme
2. **Runtime Style Switching**: Modify style layers dynamically
3. **CSS Filters**: Apply CSS filters to map (less ideal)

**Recommendation**: Use runtime style switching with `map.setPaintProperty()`.

```typescript
const isDark = document.documentElement.classList.contains('dark');
const layers = this.map.getStyle().layers;

layers.forEach(layer => {
  if (layer.type === 'background') {
    this.map.setPaintProperty(
      layer.id,
      'background-color',
      isDark ? '#1a1a1a' : '#f0f0f0'
    );
  }
  // ... more layer adjustments
});
```

### Phase 6: Testing Updates

#### 6.1 Update E2E Tests

**Files**:

- `tests-e2e/e2e/tracking.spec.ts`
- `tests-e2e/e2e/workflows.spec.ts`

**Replace selectors**:

```typescript
// Before
await page.locator('.leaflet-marker-icon').count();
await page.locator('.leaflet-interactive').first();
await page.locator('.leaflet-popup').isVisible();

// After
await page.locator('.maplibregl-marker').count();
await page.locator('canvas.maplibregl-canvas'); // MapLibre renders to canvas
// Popups: .maplibregl-popup
```

**Note**: MapLibre uses Canvas rendering, so polylines won't be individual DOM elements.

### Phase 7: Compatibility Shims (Optional)

Create a thin wrapper to make migration incremental:

```typescript
// src/utils/map-compat.ts
export class MapCompat {
  private map: maplibregl.Map;

  constructor(container: HTMLElement, options: any) {
    this.map = new maplibregl.Map({
      container,
      center: [options.center[1], options.center[0]], // swap to lng/lat
      zoom: options.zoom,
      style: DEFAULT_STYLE,
    });
  }

  addTileLayer(url: string, options: any) {
    // Already handled by style
    return this;
  }

  // ... more compatibility methods
}
```

## Migration Checklist

### Pre-Migration

- [ ] Review current Leaflet usage (DONE)
- [ ] Choose vector tile provider (Maptiler recommended)
- [ ] Set up API keys if needed
- [ ] Create migration branch: `git checkout -b feat/maplibre-migration`
- [ ] Back up current working state

### Dependencies

- [ ] Update `package.json` with MapLibre dependencies
- [ ] Update `index.html` CDN links
- [ ] Update `workbox-config.js` for service worker caching
- [ ] Run `npm install`

### Core Migration

- [ ] Map initialization in `map-widget.ts`
- [ ] Replace layer groups with source/layer management
- [ ] Migrate polylines to GeoJSON LineStrings
- [ ] Migrate heart rate coloring (segment approach)
- [ ] Migrate markers (HTML markers for custom, symbol layers for simple)
- [ ] Migrate circles (accuracy circle)
- [ ] Migrate popups
- [ ] Migrate event handlers
- [ ] Update URL hash logic (coordinate order)
- [ ] Migrate avatar-marker.ts

### Styling

- [ ] Update CSS class names
- [ ] Implement dark mode support
- [ ] Test responsive behavior
- [ ] Verify popup styling

### Testing

- [ ] Update E2E test selectors
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Manual testing: waypoint creation
- [ ] Manual testing: track visualization
- [ ] Manual testing: heart rate coloring
- [ ] Manual testing: GPX track display
- [ ] Manual testing: event markers
- [ ] Manual testing: popups
- [ ] Manual testing: dark mode

### Documentation

- [ ] Update README if needed
- [ ] Update CLAUDE.md with MapLibre info
- [ ] Document any breaking changes
- [ ] Note performance improvements

### Cleanup

- [ ] Remove Leaflet dependencies from package.json
- [ ] Remove Leaflet CDN links from index.html
- [ ] Remove Leaflet service worker cache config
- [ ] Remove unused CSS (Leaflet-specific)
- [ ] Run linting: `./scripts/lint.sh`
- [ ] Commit changes with descriptive message

## Risk Assessment

### High Risk

- **Heart rate coloring**: Complex per-segment styling may require significant refactoring
- **Testing**: E2E tests rely on DOM elements that won't exist with Canvas rendering
- **Performance**: Large datasets might need chunking differently

### Medium Risk

- **Custom markers**: HTML markers work differently, may need CSS adjustments
- **Popups**: Manual lifecycle management vs automatic in Leaflet
- **Dark mode**: Requires different approach than CSS filters

### Low Risk

- **Map initialization**: Straightforward API translation
- **Events**: Similar event system
- **URL hash**: Simple coordinate order change

## Rollback Plan

If critical issues arise:

1. Keep Leaflet branch available: `git branch leaflet-backup`
2. Feature flag in code to switch between implementations:
   ```typescript
   const USE_MAPLIBRE = import.meta.env.VITE_USE_MAPLIBRE === 'true';
   ```
3. Revert migration: `git revert <commit-range>`

## Performance Expectations

**Expected Improvements**:

- 30-50% faster rendering for large track datasets
- Smoother zoom/pan animations
- Better mobile performance
- Reduced memory usage with vector tiles

**Potential Regressions**:

- Initial load might be slightly slower (style JSON parsing)
- More complex layer management logic

## Future Enhancements (Post-Migration)

Once MapLibre is stable:

- [ ] 3D terrain visualization
- [ ] Custom map styles (branded look)
- [ ] Clustering for dense marker sets
- [ ] Heatmap visualization for location density
- [ ] Self-hosted vector tile server (cost reduction)
- [ ] Offline map support (better with vector tiles)

## Questions for Review

1. **Vector tile provider**: Maptiler free tier OK? Or prefer self-hosted from start?
2. **Coordinate order**: Keep `lat/lng` in URL hash for backwards compatibility?
3. **Migration approach**: Big-bang (all at once) or incremental (feature flag)?
4. **Testing**: Should I add visual regression tests for map rendering?
5. **Style customization**: Want custom map colors/style, or default is fine?

## Estimated Timeline

- **Phase 1-2** (Setup & Provider): 30 minutes
- **Phase 3** (Core Migration): 3-4 hours
- **Phase 4** (Avatar Markers): 30 minutes
- **Phase 5** (Styling): 1-2 hours
- **Phase 6** (Testing): 2-3 hours
- **Phase 7** (Cleanup): 30 minutes

**Total**: ~8-11 hours of focused development

---

**Ready to proceed?** Please review the plan and let me know:

1. If you approve the overall approach
2. Your preference for vector tile provider
3. Any concerns or modifications needed
4. Whether to use incremental (feature flag) or big-bang migration
