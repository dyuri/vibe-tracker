# Implementation Plan: Status & Event-Based Track Visualization

## Overview

Enhance the MapWidget to utilize the new `status` and `event` fields from location data to provide visual feedback during track display with event markers and status-based line styling.

## Current State Analysis

- Location data structure already includes `status?: string` and `event?: string` fields
- MapWidget currently displays tracks as connected lines with heart rate-based coloring
- No existing event marker or status-based rendering logic found

## Implementation Tasks

### 1. Create Event Marker System

**File:** `src/components/widgets/map-widget.ts`

- Add new private methods for event marker creation:
  - `createEventMarker(feature, eventType)` - creates appropriate marker based on event type
  - `getEventMarkerIcon(eventType)` - returns icon/styling for specific event types
- Define event marker configurations for:
  - `start`/`stop` - Green/Red circle markers with play/stop icons
  - `pause`/`resume` - Orange/Blue circle markers with pause/play icons
  - `lap` - Yellow flag marker
  - `reset` - Gray marker with reset icon
  - Generic events - Default purple marker for unlisted event types

### 2. Implement Status-Based Line Styling

**File:** `src/components/widgets/map-widget.ts`

- Modify `displayFeatureCollection()` method to check status when drawing lines
- Update line drawing logic to use different styles based on status:
  - Default/`active` - Current heart rate-based coloring
  - `stopped` - Dashed red lines with reduced opacity
  - `paused` - Dotted orange lines with reduced opacity
- Maintain existing black outline system for visibility

### 3. Update Track Rendering Logic

**File:** `src/components/widgets/map-widget.ts`

- Enhance single-user track mode in `displayFeatureCollection()`:
  - Add event marker layer creation before line drawing
  - Process features to identify events and create markers
  - Modify line segment drawing to consider status changes
  - Ensure event markers appear above track lines (proper z-index)

### 4. Add CSS Styling Support

**File:** `src/styles/components/widgets/map-widget.css`

- Add CSS classes for event markers:
  - `.event-marker-start`, `.event-marker-stop`
  - `.event-marker-pause`, `.event-marker-resume`
  - `.event-marker-lap`, `.event-marker-reset`
  - `.event-marker-generic`
- Define marker sizes, colors, and hover effects

### 5. Update Popup Content

**File:** `src/components/widgets/map-widget.ts`

- Enhance `createPopupContent()` method to display status and event information
- Show current status and any associated event in location popups

## Technical Approach

- Event markers will be added as a separate Leaflet LayerGroup for proper management
- Status-based line styling will be implemented by checking status field during line creation
- Maintain backward compatibility - features without status/event will use current rendering
- Use Leaflet's DivIcon for custom event markers to allow CSS styling and icon fonts

## Files to Modify

1. `src/components/widgets/map-widget.ts` - Main implementation
2. `src/styles/components/widgets/map-widget.css` - Styling support
3. `src/types/location.ts` - Type definitions if needed (likely no changes required)

## Expected Behavior

- Event markers appear at exact location points where events occurred
- Track lines change style based on status (solid for active, dashed for stopped, dotted for paused)
- Event markers are clickable and show event details in popups
- Maintains existing functionality for multi-user displays and heart rate coloring

## Implementation Status

- [x] Event marker system
  - ✅ Added eventMarkerLayerGroup to MapWidget class
  - ✅ Implemented createEventMarker() method with event type handling
  - ✅ Added getEventMarkerIcon() and getEventConfig() methods
  - ✅ Created event-specific popup content with createEventPopupContent()
- [x] Status-based line styling
  - ✅ Implemented getLineStyleForStatus() method
  - ✅ Modified line drawing logic to use different colors and styles based on status
  - ✅ Added dashed lines for 'stopped' status, dotted lines for 'paused' status
- [x] CSS styling support
  - ✅ Added comprehensive CSS styles for event markers
  - ✅ Implemented hover effects and event-specific colors
  - ✅ Added event popup styling
- [x] Popup content updates
  - ✅ Enhanced createPopupContent() to display status and event information
  - ✅ Added status and event lines to location popups
- [x] Testing and refinement
  - ✅ Build test completed successfully - no TypeScript errors
  - ✅ All components compile and integrate properly

## Current Implementation Details

### Event Markers

- **start/stop**: Green/Red circular markers with play/stop icons
- **pause/resume**: Orange/Blue circular markers with pause/play icons
- **lap**: Yellow marker with flag icon
- **reset**: Gray marker with reset icon
- **Generic events**: Purple marker with dot icon

### Status-based Line Styling

- **Default/Active**: Heart rate-based coloring (existing behavior)
- **Stopped**: Red dashed lines with reduced opacity
- **Paused**: Orange dotted lines with reduced opacity

### Features Implemented

- Event markers appear at exact coordinates where events occurred
- Event markers are clickable with detailed popup information
- Track lines change style dynamically based on status field
- Backward compatibility maintained for data without status/event fields
- Proper z-index ordering (lines → event markers → regular markers)

## Backend Fixes Applied

### Issue Identified

The backend was missing proper handling of `status` and `event` fields in the location service, causing these fields to not appear in API responses.

### Fixes Implemented

- [x] **Fixed `recordToGeoJSON` function** (`services/location_service.go:254-260`)
  - Added mapping for `status` and `event` fields from database records to API responses
  - Ensures these fields appear in `/api/session/...` endpoints
- [x] **Fixed `TrackLocationFromGeoJSON` function** (`services/location_service.go:77-83`)
  - Added saving of `status` and `event` fields when tracking via GeoJSON requests
  - Supports frontend sending status/event data via POST requests
- [x] **Fixed `TrackLocationFromParams` function** (`services/location_service.go:121-127`)
  - Added saving of `status` and `event` fields when tracking via query parameters
  - Supports status/event data via GET requests with query params

### Testing Results

- ✅ Go build successful - no compilation errors
- ✅ All linting and code quality checks passed
- ✅ All existing tests continue to pass
- ✅ Backend ready for frontend integration testing

The complete feature is now implemented in both frontend and backend!
