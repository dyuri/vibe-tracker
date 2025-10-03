# Plan: Integrate Session Management into Map View

## Problem Analysis

Currently, session management is separated from the map view, requiring users to navigate to `/profile/sessions` to manage sessions. This creates a disconnect between viewing session data (on the map) and managing it.

## Proposed Solution: Unified Session Management Panel

### 1. Architecture Overview

Create a new unified widget that combines session overview, chart display, and track comparison in a tabbed interface positioned at the bottom of the map view (where chart widget currently is).

### 2. New Component Structure

```
SessionMapPanelWidget (replaces chart-widget position)
├── Public Tabs (visible to all visitors)
│   ├── Overview Tab (session info, statistics)
│   ├── Chart Tab (current chart-widget functionality)
│   └── Track Comparison Tab
└── Owner-Only Tabs (visible only to session owner)
    ├── Edit Session Tab (basic session editing)
    ├── GPX Track Tab (gpx-upload-widget)
    └── Waypoints Tab (waypoint-manager-widget)
```

### 3. Implementation Steps

#### Phase 1: Create New SessionMapPanelWidget

- Create `src/components/widgets/session-map-panel-widget.ts`
- Implement tabbed interface with public/private tab visibility logic
- Move chart functionality into "Chart" tab
- Add session overview display in "Overview" tab
- Integrate track comparison functionality

#### Phase 2: Update Map View Layout

- Replace `<chart-widget>` with `<session-map-panel-widget>` in `index.html`
- Update CSS positioning to maintain bottom panel layout
- Ensure responsive design for mobile devices

#### Phase 3: Authentication & Permission System

- Detect session ownership by comparing current user with session's user
- Show/hide owner-only tabs based on authentication state
- Implement graceful fallback for unauthenticated users

#### Phase 4: Widget Integration

- Move chart logic from ChartWidget into chart tab
- Integrate simplified session editing (from session-management-widget)
- Embed gpx-upload-widget and waypoint-manager-widget in their respective tabs
- Add track-comparison-widget with existing data loading logic

#### Phase 5: Data Flow & State Management

- Create unified session context provider
- Implement data sharing between tabs (session data, GPX data, chart data)
- Handle session updates and refresh dependent widgets
- Maintain existing map-chart interaction (hover, click events)

### 4. URL Context & Session Detection

The widget will automatically detect session context from URL:

- `/u/[username]/s/[session]` - Show full interface with session-specific data
- `/u/[username]` - Show user's latest session
- `/` - Hide session-specific features, show public data only

### 5. Tab Visibility Logic

```typescript
interface TabConfig {
  id: string;
  label: string;
  visible: (isOwner: boolean, hasSession: boolean) => boolean;
  component: string;
}

const tabs: TabConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    visible: (_, hasSession) => hasSession,
    component: 'session-overview',
  },
  {
    id: 'chart',
    label: 'Chart',
    visible: (_, hasSession) => hasSession,
    component: 'chart-display',
  },
  {
    id: 'comparison',
    label: 'Comparison',
    visible: (_, hasSession) => hasSession,
    component: 'track-comparison',
  },
  {
    id: 'edit',
    label: 'Edit',
    visible: (isOwner, hasSession) => isOwner && hasSession,
    component: 'session-edit',
  },
  {
    id: 'gpx',
    label: 'GPX Track',
    visible: (isOwner, hasSession) => isOwner && hasSession,
    component: 'gpx-upload',
  },
  {
    id: 'waypoints',
    label: 'Waypoints',
    visible: (isOwner, hasSession) => isOwner && hasSession,
    component: 'waypoint-manager',
  },
];
```

### 6. Benefits

- **Unified Experience**: All session-related functionality in one place
- **Context Awareness**: Session management directly connected to map visualization
- **Progressive Disclosure**: Public users see relevant tabs, owners see management options
- **Simplified Navigation**: No need to switch between views for session management
- **Improved Mobile UX**: Bottom panel approach works well on mobile devices

### 7. Migration Strategy

- Keep existing `/profile/sessions` route as fallback/alternative
- Gradually deprecate standalone session management widget
- Maintain backward compatibility with existing session URLs
- Preserve all current functionality during transition

### 8. Technical Considerations

- Reuse existing widget components to minimize code duplication
- Maintain chart-map interaction events and hover synchronization
- Handle session ownership detection securely (server-side verification)
- Optimize loading - only initialize visible tabs to improve performance
- Ensure proper cleanup when switching between sessions

This approach transforms the map view into a comprehensive session management interface while maintaining clean separation between public viewing and private management features.
