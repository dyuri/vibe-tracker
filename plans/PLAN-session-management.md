# Plan: Merge Session "Manage" and "Edit" Buttons

## Problem

Currently each session has confusing "Manage" and "Edit" buttons that overlap in functionality, creating a poor user experience.

## ✅ IMPLEMENTATION COMPLETED

## Proposed Solution: Single "Manage" Button with Unified Interface

### 1. Remove Duplicate "Edit" Button

- Remove the standalone "Edit" button from each session list item
- Keep only the "Manage" button (may rename to "Open" or "Configure")

### 2. Enhance Overview Tab in Detail View

- Make the Overview tab the primary editing interface
- Move basic session editing (name, title, description, public flag) directly into the Overview tab
- Replace the current "Edit Session" quick action with inline editing capabilities

### 3. Redesign Overview Tab Layout

```
Overview Tab Structure:
├── Session Basic Info (Inline Editable)
│   ├── Name field (read-only after creation)
│   ├── Title field (editable)
│   ├── Description field (editable)
│   └── Public/Private toggle
├── Session Statistics (current metadata display)
├── Quick Actions
│   ├── View Tracking button
│   ├── Save Changes button (appears when edited)
│   └── Delete Session button
```

### 4. Implementation Changes

- Modify `renderSessions()` to remove the edit button
- Enhance `showSessionDetails()` to include editable form fields in overview
- Update the overview tab HTML template to include form inputs
- Add inline editing logic with save/cancel functionality
- Maintain the advanced features in their respective tabs (GPX, Waypoints, Comparison)

### 5. User Workflow Benefits

- Single entry point: Users click "Manage" to access all session features
- Progressive disclosure: Basic editing in Overview, advanced features in other tabs
- Clearer mental model: One button leads to one comprehensive interface
- Consistent with session creation workflow (form-based editing)

### 6. Maintain Easy Session Creation

- Keep the existing "Create New Session" form at the top
- No changes to session creation workflow
- Clear separation between creation (top form) and management (detail view)

This approach eliminates confusion while maintaining all current functionality and keeping session creation simple.
