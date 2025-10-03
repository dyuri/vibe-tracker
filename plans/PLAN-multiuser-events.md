# Multi-User Events Support Plan

## Overview

Add an events system that allows tracking multiple users together on the same map for competitions, group runs, or any multi-user activity, while maintaining existing single-user session functionality.

## Architecture Approach

**Event Model** - Create a new `events` collection that groups multiple users' sessions together, rather than changing the existing session model. This maintains backward compatibility and clear separation of concerns.

## Phase 1: Database Schema

### 1.1 Create `events` Collection

- `name`: string (unique, URL-friendly identifier)
- `title`: string (display name)
- `description`: text (optional)
- `creator`: relation to users
- `start_time`, `end_time`: datetime (optional boundaries)
- `public`: boolean (visibility)
- `rules`: JSON (optional - scoring rules, distance goals, etc.)
- `status`: select (planned, active, finished, cancelled)
- `event_type`: select (competition, group_run, training, social, other)
- `created`, `updated`: timestamps

### 1.2 Create `event_participants` Collection

Many-to-many relationship between events, users, and sessions:

- `event_id`: relation to events (required)
- `user_id`: relation to users (required)
- `session_id`: relation to sessions (required) - which session they're using
- `status`: select (registered, active, finished, DNF, disqualified)
- `join_time`: datetime
- `start_time`, `finish_time`: datetime (optional)
- `notes`: text (optional)
- `created`, `updated`: timestamps

## Phase 2: Backend Implementation

### 2.1 Go Models

- `Event` struct with all fields
- `EventParticipant` struct
- Request/response models for API

### 2.2 API Endpoints

**Event Management:**

- `POST /api/events` - Create event
- `GET /api/events` - List events (with filters: public, active, mine, type)
- `GET /api/events/:name` - Get event details
- `PUT /api/events/:name` - Update event (creator only)
- `DELETE /api/events/:name` - Delete event (creator only)

**Participation:**

- `POST /api/events/:name/join` - Join with session (body: session_id)
- `DELETE /api/events/:name/leave` - Leave event
- `GET /api/events/:name/participants` - Get all participants with stats
- `GET /api/events/:name/data` - Get aggregated location data for all participants

### 2.3 Service Layer

- `EventService` for business logic
- Permission checks (who can edit, delete, etc.)
- Validation (session ownership, duplicate participation, etc.)

## Phase 3: Frontend Implementation

### 3.1 Routing

- Add route: `/events/[name]` - Event view page
- Add route: `/events` - List/browse events
- Update router in `src/utils/router.ts`

### 3.2 Event View Page (`/events/[name]`)

New page displaying:

- **Map** showing all participants' tracks with distinct colors
- **Participant panel** with:
  - List of participants with avatars
  - Live status indicators
  - Statistics (distance, duration, speed, etc.)
  - Toggle visibility per participant
- **Event info** card (title, description, rules, time, type)
- **Leaderboard** (sortable by various metrics) - optional for competitions

### 3.3 Multi-User Map Enhancements

Extend `map-widget.ts` to support:

- Multiple polylines with auto-assigned colors per user
- Color legend showing user-to-color mapping
- Toggle individual tracks on/off
- Highlight track on hover/click
- User avatar markers showing current positions
- Waypoints for all participants

### 3.4 Event Management UI

- **Create Event** form/modal
- **Event List** view with filtering (by type, status, participation)
- **Join Event** flow (select which session to use)
- **Event Settings** (for creator)

### 3.5 Session Integration

Update session management to:

- Show if session is part of an event
- Allow joining events from session view
- Link to event view

## Phase 4: Additional Features (Future)

### 4.1 Live Tracking

- WebSocket or polling for real-time updates
- Live leaderboard updates (for competitions)
- Position updates on map

### 4.2 Advanced Statistics

- Head-to-head comparisons (for competitions)
- Split times at waypoints
- Route efficiency metrics
- Heart rate comparisons
- Group statistics (average pace, total distance, etc.)

### 4.3 Social Features

- Event chat/comments
- Photo sharing during event
- Achievement badges
- Post-event summary reports
- Group photos at waypoints

## Implementation Order

1. Database migrations for both collections
2. Backend models and API endpoints
3. Frontend routing and event view page
4. Multi-user map widget enhancements
5. Event management UI
6. Session integration points
7. Testing and refinement

## Use Cases

- **Competition**: Race tracking with leaderboards
- **Group Run**: Friends running together, seeing each other's progress
- **Training**: Coach tracking multiple athletes
- **Social**: Community events like charity runs
- **Other**: Any multi-user tracking scenario

## Benefits

✅ Backward compatible - existing sessions unchanged
✅ Flexible - users can be in multiple events
✅ Scalable - supports any number of participants
✅ Reuses existing session/location infrastructure
✅ Clear ownership model with creator permissions
✅ Versatile - works for competitions, group activities, training, etc.
