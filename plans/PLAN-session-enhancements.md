# Session Enhancement Plan: GPX Tracks, Waypoints & Photos

## Phase 1: Database Schema Extensions

### 1.1 Sessions Collection Enhancement

- Add `gpx_track` file field to sessions collection for original GPX file storage
- Add `track_name` text field (extracted from GPX metadata)
- Add `track_description` text field (optional, from GPX)

### 1.2 Create GPX Tracks Collection

- New `gpx_tracks` collection for planned track points:
  - `session_id`: relation to sessions (required)
  - `latitude`, `longitude`: number fields (required)
  - `altitude`: number field (optional)
  - `sequence`: number field (point order in track)
  - `created`, `updated`: timestamps
- Separate from `locations` which are actual tracked positions
- **Note:** `user` field omitted as it can be inferred through `session_id` relation

### 1.3 Create Waypoints Collection

- New `waypoints` collection with fields:
  - `name`: string (required)
  - `type`: select field (generic, food, water, shelter, transition, etc.)
  - `description`: text/editor (optional, markdown support)
  - `latitude`, `longitude`: number fields (required)
  - `altitude`: number field (optional)
  - `photo`: file field (optional)
  - `session_id`: relation to sessions
  - `source`: text field ("gpx" or "manual")
  - `position_confidence`: select field ("gps", "tracked", "gpx_track", "last_known", "manual")
- **Note:** `user` field omitted as it can be inferred through `session_id` relation

## Phase 2: Backend Implementation

### 2.1 GPX Processing

- GPX parser to extract:
  - Track points → `gpx_tracks` collection (planned route)
  - Waypoints → `waypoints` collection
  - Track metadata → session fields
- **Track simplification**: Implement Ramer-Douglas-Peucker algorithm for long tracks
  - Store both original high-fidelity and simplified versions for map display
  - Configurable simplification tolerance based on track length/complexity
- Keep actual tracked `locations` separate for comparison

### 2.2 API Endpoints

- `POST /api/sessions/:username/:name/gpx` - Upload & process GPX
- `GET /api/sessions/:username/:name/track` - Get planned track points
- Standard waypoint CRUD endpoints
- `POST /api/waypoints/photo` - Photo upload with EXIF extraction

### 2.3 Photo Processing

- EXIF GPS extraction to auto-create waypoints
- **Intelligent fallback positioning for photos without GPS data (priority order):**
  1. **Time-based proximity matching** - Match to closest tracked location by photo timestamp (highest priority)
  2. **End of tracked locations** - Use last position from current session's tracked locations
  3. **End of GPX track** - Use final point from uploaded GPX track
  4. **Last known location** - Use most recent location from user's history
  5. **Manual placement** - Prompt user if no fallback available
- **Position confidence indicators** for waypoints (GPS > time-matched > tracked > GPX > last known)
- Image optimization for web display

## Phase 3: Frontend Implementation

### 3.1 Map Visualization Strategy

- **Planned Track**: GPX track as styled polyline (e.g., dashed blue)
- **Actual Track**: Tracked locations as solid polyline (e.g., solid red)
- **Waypoints**: Custom markers with type-based icons and confidence indicators
- **Photos**: Photo markers with thumbnail previews
- **Performance optimizations**:
  - Waypoint clustering for dense areas
  - Efficient polyline rendering for large datasets
  - Lazy loading of waypoint photos and details

### 3.2 Session Management Updates

- GPX upload component with progress indicator
- Track comparison statistics (deviation, completion %)
- Waypoint management interface
- **Easy repositioning** of auto-placed waypoints with drag-and-drop
- **Visual confidence indicators** for waypoint positioning accuracy

### 3.3 New Components

- `track-comparison-widget`: Show planned vs actual routes
- `gpx-upload-widget`: File handling and processing
- `waypoint-manager-widget`: CRUD for waypoints

## Phase 4: Data Storage & Transfer

### 4.1 Efficient Storage

- Original GPX file stored once per session
- Parsed track points in separate collection for fast queries
- Optimized coordinate precision for web display

### 4.2 API Optimization

- Paginated track point loading for long routes
- Compressed coordinate arrays for map rendering
- Lazy loading of waypoint photos

## Phase 5: Map Integration Benefits

### 5.1 Visual Comparison

- Overlay planned route with actual tracking
- Show progress along planned route
- Highlight deviations or interesting detours
- Display waypoints from both GPX and manual creation

### 5.2 Analytics Potential

- Route completion percentage
- Time spent at waypoints
- Deviation analysis from planned route

## Implementation Progress

### ✅ Phase 1: Database Schema Extensions (COMPLETED)

- **Sessions Collection Enhancement**: Added `gpx_track` (file), `track_name`, `track_description` fields
- **GPX Tracks Collection**: Created `gpx_tracks` collection for planned track points
  - Fields: session_id, latitude, longitude, altitude, sequence, timestamps
  - User access inferred through session_id relation (no redundant user field)
  - Performance indexes on session and sequence
- **Waypoints Collection**: Created `waypoints` collection with comprehensive fields
  - 11 predefined waypoint types, source tracking, position confidence levels
  - User access inferred through session_id relation
- **Go Models**: Updated session models and created new structs for GpxTrackPoint and Waypoint
- **Migration File**: `1758038352_enhance_sessions_gpx_tracks_waypoints.go` with proper rollback

### ✅ Phase 2: Backend Implementation (COMPLETED)

- **GPX Parser Utility**: Complete GPX parsing with track points and waypoints extraction
  - XML parsing with validation and error handling
  - Ramer-Douglas-Peucker algorithm for track simplification
  - Intelligent waypoint type mapping from GPX symbols
- **API Endpoints**: New endpoints for GPX and waypoint operations
  - `POST /api/sessions/:username/:name/gpx` - GPX upload with processing
  - `GET /api/sessions/:username/:name/track` - Get planned track points
  - Full waypoint CRUD: List, Get, Create, Update, Delete waypoints
  - `POST /api/waypoints/photo` - Photo upload with intelligent positioning
- **EXIF GPS Extraction**: Complete photo processing utility
  - GPS coordinate extraction from EXIF data
  - Timestamp, camera info, and orientation extraction
  - Support for JPEG and TIFF formats
- **Intelligent Photo Positioning**: 5-level fallback strategy implemented
  1. Time-based proximity matching with tracked locations (highest priority)
  2. End of tracked locations from current session
  3. End of GPX track from current session
  4. Last known location from user's history
  5. Manual placement (fallback to manual positioning)

### 🔄 Next Steps

3. **Phase 3: Frontend Implementation** - Map rendering with dual track display
4. **Phase 4: Data Storage & Transfer** - Upload and management interfaces
5. **Phase 5: Map Integration Benefits** - Testing and optimization

### 📋 Remaining TODOs

**Intelligent Photo Positioning Enhancement** (`utils/exif.go`):
Currently has placeholder implementation that needs to be completed:

1. **Time-based proximity matching** with tracked locations
2. **End of tracked locations** for current session
3. **End of GPX track** for current session
4. **Last known location** from user's history
5. **Manual placement** as final fallback

The `GetFallbackPosition` function in `utils/exif.go` currently returns an error and needs the full fallback strategy implementation as designed in Phase 2.

This approach keeps planned routes separate from actual tracking data while enabling powerful comparison and visualization features.
