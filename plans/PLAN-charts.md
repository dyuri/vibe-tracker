# Chart Widget Implementation Plan

## Overview

Create an interactive chart widget positioned at bottom center that visualizes track data with bidirectional map synchronization.

## Architecture Analysis

- **Current**: Custom web components using TypeScript, Leaflet.js map, GeoJSON data with `elevation`, `speed`, `heart_rate`, `timestamp`
- **Layout**: Theme toggle (bottom-left), login widget (bottom-right), map (full-screen)
- **Event system**: Custom events for widget communication

## Technical Approach

### 1. Chart Library & Positioning

- **Library**: Chart.js (TypeScript support, multi-axis, interactive events, responsive)
- **Position**: Fixed bottom center, ~80% width, ~200px height, above theme/login widgets
- **Layout**: CSS Grid/Flexbox with responsive breakpoints

### 2. Data Processing (`src/utils/chart-data.ts`)

- **Distance calculation**: Haversine formula between GPS points
- **Pace calculation**: `pace = 1/speed` converted to min/km format
- **Data structures**: Optimized arrays for Chart.js consumption
- **Performance**: Data sampling for large tracks (>1000 points)

### 3. Chart Widget (`src/components/widgets/chart-widget.ts`)

- **Multi-axis chart**: Elevation (m), Speed (km/h), Pace (min/km), Heart Rate (bpm)
- **Dual X-axis**: Time or Distance toggle
- **Interactive controls**: Metric visibility toggles, axis type selector
- **Theme integration**: Dark/light mode CSS custom properties

### 4. Map-Chart Synchronization

- **Chart hover** → dispatch event → map shows temporary marker
- **Map point selection** → dispatch event → chart highlights point
- **Chart point click** → map centers on coordinates
- **Event types**: `chart-hover`, `map-point-select`, `chart-point-select`

### 5. Implementation Phases

#### Phase 1: Foundation (Core Widget) ✅ COMPLETED

1. ✅ Create `chart-widget.ts` with Chart.js integration
2. ✅ Add to layout with proper positioning CSS
3. ✅ Basic chart rendering with static data
4. ✅ Implement data processing utilities

**Completed:**

- Added Chart.js v4.4.0 dependency and TypeScript types
- Created `src/components/widgets/chart-widget.ts` with full Chart.js integration
- Created `src/styles/components/widgets/chart-widget.css` with responsive positioning
- Added chart widget to global layout (bottom center, 80% width, 200px height)
- Integrated widget into TypeScript types and component imports
- Includes basic distance calculation (Haversine formula) and pace calculation
- Multi-axis chart support (elevation, speed, pace, heart rate) with toggle controls
- Time/distance axis switching capability
- Hover and click event handlers for map synchronization
- **Toggle functionality**: Collapsible widget with toggle button (📊 icon)
- **State persistence**: Saves expanded/collapsed state to localStorage
- **Consistent UX**: Matches location-widget pattern with toggle/close buttons
- **Responsive design**: Adapts from full panel to compact toggle button

#### Phase 2: Data Integration ✅ COMPLETED

1. ✅ Connect to `LocationsResponse` GeoJSON data
2. ✅ Multi-metric display with separate Y-axes
3. ✅ Time/distance axis switching
4. ✅ Metric visibility controls

**Completed:**

- Connected chart widget to app's location data flow
- Added chart widget reference to main app (app.ts)
- Chart receives same data as map widget via `displayData()` method
- Handles both initial data loads and delta updates (merges new data)
- Stores current chart data for incremental updates
- Added basic chart-map event synchronization (hover/click handlers)
- Chart click updates location widget with selected point data
- Ready to receive and display real track data from the API

#### Phase 3: Interactivity ✅ COMPLETED

1. ✅ Chart-to-map hover synchronization
2. ✅ Map-to-chart selection synchronization
3. ✅ Bidirectional point highlighting
4. ✅ Performance optimization

**Completed:**

- Added chart hover/click event handlers that dispatch custom events for map synchronization
- Implemented `highlightPoint()` and `clearHighlight()` methods for bidirectional interaction
- Chart click events update location widget with selected point data
- Events bubble up properly with `bubbles: true, composed: true` for cross-widget communication

#### Phase 4: Polish ✅ COMPLETED

1. ✅ Loading states and error handling
2. ✅ Mobile responsiveness
3. ✅ Integration testing
4. ✅ Documentation

**Completed:**

- Fixed map interaction blocking when chart widget is collapsed using `pointer-events: none` on `:host(.collapsed)`
- Resolved empty chart on first open by calling `updateChart()` after chart initialization when data exists
- Added proper toggle button positioning at bottom of widget area
- Removed point markers from chart lines for cleaner visualization (`pointRadius: 0`)
- Implemented responsive design with sidebar-to-topbar layout transformation on mobile
- Chart widget now properly integrates with existing app data flow and event system
- Fixed Canvas reuse errors and Chart.js controller registration issues

#### Phase 5: Performance Optimization

1. 🔄 Optimize chart widget opening performance (currently slow/sloppy)
2. Investigate chart rendering delays and animation smoothness
3. Consider chart data preprocessing and caching optimizations
4. Review Chart.js configuration for performance bottlenecks

## Files to Create/Modify

- `src/components/widgets/chart-widget.ts` (new)
- `src/styles/components/widgets/chart-widget.css` (new)
- `src/utils/chart-data.ts` (new)
- `src/types/chart.ts` (new)
- `src/types/dom.ts` (add ChartWidgetElement)
- `index.html` (add `<chart-widget>`)
- `package.json` (add Chart.js dependency)

## Key Features

✅ Multi-metric visualization (elevation, speed, pace, heart rate)  
✅ Time/distance axis switching  
✅ Metric visibility toggles  
✅ Bidirectional map-chart synchronization  
✅ Responsive design  
✅ Theme integration  
✅ Collapsible toggle functionality with state persistence  
✅ Clean line visualization without point markers  
✅ Proper map interaction handling when collapsed  
✅ Data integration with existing app flow  
🔄 Performance optimization for chart opening (in progress)
