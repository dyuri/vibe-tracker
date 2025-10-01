# Lazy Loading Plan for Bottom Panel Tabs

## Current State

- `session-map-panel-widget.ts` eagerly imports all tab widgets at the top (lines 4-7):
  - `import './chart-widget'`
  - `import './track-comparison-widget'`
  - `import './gpx-upload-widget'`
  - `import './waypoint-manager-widget'`
  - Combined size: ~70KB

- `app.ts` also imports chart-widget eagerly (line 17) - **NOT NEEDED**
  - The chart events are handled through session-map-panel-widget
  - Chart-widget is only used internally by session-map-panel-widget

- All widgets are rendered in the DOM immediately, even for tabs that aren't visible or accessible

## Problem

This causes unnecessary bytes to be loaded at initial page load:

- Users may never access certain tabs (Chart, Comparison, GPX, Waypoints)
- Each widget has its own code, styles, and dependencies
- Slower initial page load and time-to-interactive

## Optimization Strategy

Defer loading of tab-specific widgets until their tab is activated for the first time.

## Changes Required

### 1. Remove eager imports from session-map-panel-widget.ts (lines 4-7)

```typescript
// Remove these lines:
import './chart-widget';
import './track-comparison-widget';
import './gpx-upload-widget';
import './waypoint-manager-widget';
```

### 2. Remove eager import from app.ts (line 17)

```typescript
// Remove this line:
import '@/components/widgets/chart-widget';
```

### 3. Update render() method in session-map-panel-widget.ts

- Keep tab structure but remove actual widget elements from initial render
- Replace with placeholder divs that will be populated on demand

**Current:**

```html
<div class="tab-content" data-tab="chart">
  <chart-widget></chart-widget>
</div>
```

**After:**

```html
<div class="tab-content" data-tab="chart">
  <div class="widget-container" data-widget="chart-widget"></div>
</div>
```

### 4. Add lazy loading logic in switchTab() method

- Check if widget already loaded (track loaded state per tab)
- Dynamically import widget module
- Create and insert widget element into placeholder
- Handle loading states/errors

**Example implementation:**

```typescript
private async loadTabWidget(tabId: string): Promise<void> {
  if (this.loadedWidgets.has(tabId)) {
    return; // Already loaded
  }

  const container = this.shadowRoot!.querySelector(
    `[data-tab="${tabId}"] .widget-container`
  );

  if (!container) return;

  try {
    // Show loading state
    container.innerHTML = '<div class="loading">Loading...</div>';

    // Dynamic import based on tab
    switch (tabId) {
      case 'chart':
        await import('./chart-widget');
        container.innerHTML = '<chart-widget></chart-widget>';
        break;
      case 'comparison':
        await import('./track-comparison-widget');
        container.innerHTML = '<track-comparison-widget></track-comparison-widget>';
        break;
      case 'gpx':
        await import('./gpx-upload-widget');
        container.innerHTML = '<gpx-upload-widget></gpx-upload-widget>';
        break;
      case 'waypoints':
        await import('./waypoint-manager-widget');
        container.innerHTML = '<waypoint-manager-widget></waypoint-manager-widget>';
        break;
    }

    this.loadedWidgets.add(tabId);
  } catch (error) {
    console.error(`Failed to load widget for tab ${tabId}:`, error);
    container.innerHTML = '<div class="error">Failed to load widget</div>';
  }
}
```

### 5. Track loaded widgets

Add class property:

```typescript
private loadedWidgets = new Set<string>();
```

### 6. Update switchTab() method

Call `loadTabWidget()` before switching:

```typescript
private async switchTab(tab: HTMLElement): void {
  const tabId = tab.dataset.tab;
  if (!tabId) return;

  // Load widget if not already loaded
  await this.loadTabWidget(tabId);

  // Rest of existing tab switching logic...
}
```

## Benefits

- **Reduces initial bundle size** by ~70KB
- **Faster initial page load** and time-to-interactive
- **Widgets only loaded when user actually needs them**
- **Maintains exact same user experience** once tabs are accessed
- **Better perceived performance** with loading states
- **Future-proof** - easy to add more lazy-loaded tabs

## Implementation Notes

- The Overview and Profile tabs don't use custom widgets, so no lazy loading needed
- Keep the Edit tab inline since it's just a form (no heavy widget)
- Ensure proper TypeScript types are maintained for dynamically loaded widgets
- Consider adding visual loading indicators for better UX
- Test that chart events (hover, click) still work after lazy loading
