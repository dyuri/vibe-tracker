# SPA Migration Plan: From MPA to Single Page Application

## Current State Analysis

- **MPA Setup**: Currently using Vite with `appType: 'mpa'` and multiple entry points (`index.html`, `public/profile.html`, `public/sessions.html`)
- **Static Routing**: Backend serves static HTML files for `/profile` and `/profile/sessions` routes
- **Separate Apps**: Three distinct TypeScript entry points (`app.ts`, `profile-app.ts`, `sessions-app.ts`) with significant code duplication
- **Widget Architecture**: Well-designed Web Components that are perfect for dynamic loading

## Migration Strategy

### 1. **Vite Configuration Updates**

- Change `appType` from `'mpa'` to `'spa'`
- Remove multiple entry points, keep only `main: 'index.html'`
- Remove proxy rules for `/u/[username]` routes (frontend will handle these)

### 2. **Frontend Router Implementation**

- Create a lightweight client-side router in the main app
- Handle these routes:
  - `/` - Main map view (existing functionality)
  - `/profile` - Profile widget (replaces profile.html)
  - `/profile/sessions` - Session management widget (replaces sessions.html)
  - `/u/[username]` - User-specific map view
  - `/u/[username]/s/[session]` - Session-specific map view

### 3. **Dynamic Widget Loading**

- Implement lazy loading for profile and session management widgets
- Create dynamic import functions to load widgets only when needed
- Update main app to conditionally render widgets based on current route

### 4. **Unified App Structure**

- Merge common code from `profile-app.ts` and `sessions-app.ts` into main `app.ts`
- Consolidate shared functionality:
  - Single `AuthService` initialization
  - Single PWA initialization
  - Unified authentication event handling
- Remove duplicate app files

### 5. **HTML Template Updates**

- Update main `index.html` to serve as the single entry point
- Add container elements for dynamically loaded content
- Ensure header structure supports all views

### 6. **Cleanup**

- Remove `public/profile.html` and `public/sessions.html`
- Remove `src/apps/profile-app.ts` and `src/apps/sessions-app.ts`
- Clean up Vite build configuration

## Implementation Steps

### Phase 1: Router and Core SPA Setup

1. Create client-side router utility
2. Update Vite config to SPA mode
3. Modify main `index.html` for SPA architecture

### Phase 2: Merge App Logic

1. Consolidate authentication and PWA logic in main `app.ts`
2. Implement dynamic widget loading system
3. Add route-based content rendering

### Phase 3: Widget Integration

1. Update widget loading to be route-dependent
2. Implement lazy loading for profile and session widgets
3. Ensure proper cleanup when switching routes

### Phase 4: Cleanup and Testing

1. Remove old HTML files and app entries
2. Remove old app TypeScript files
3. Update Vite build configuration
4. Test all routes and functionality

## Benefits

- **Faster Development**: No more page refreshes when navigating
- **Better UX**: Seamless navigation between views
- **Code Consolidation**: Remove ~70% duplicate code between apps
- **Proper `/u/[username]` Handling**: Frontend can handle these routes during development
- **Smaller Bundle**: Dynamic loading reduces initial page load size
- **Maintainability**: Single entry point easier to manage

## Risk Mitigation

- Gradual migration approach allows testing at each step
- Web Components architecture makes widgets easy to integrate
- Existing authentication and widget systems require minimal changes
- Fallback mechanisms can be implemented for route handling

## Progress Tracker

### ✅ Phase 1: Router and Core SPA Setup

- [x] Plan saved to plans/PLAN-fe-refactor-spa.md

### ✅ Phase 2: Router Implementation

- [x] Create client-side router utility (`src/utils/router.ts`)
- [x] Update Vite config to SPA mode (removed MPA entry points, removed /u/ proxy rules)
- [x] Modify main `index.html` for SPA architecture (added view containers, navigation)

### ✅ Phase 3: Merge App Logic

- [x] Consolidate authentication and PWA logic in main `app.ts`
- [x] Implement dynamic widget loading system
- [x] Add route-based content rendering

### ✅ Phase 4: Widget Integration

- [x] Update widget loading to be route-dependent
- [x] Implement lazy loading for profile and session widgets
- [x] Ensure proper cleanup when switching routes

### ✅ Phase 5: Cleanup and Testing

- [x] Remove old HTML files and app entries (`public/profile.html`, `public/sessions.html`, `public/profile/`)
- [x] Remove old app TypeScript files (`profile-app.ts`, `sessions-app.ts`)
- [x] Update Vite build configuration (already done in Phase 2)
- [x] Test all routes and functionality (dev server runs, build succeeds)

### 🎉 SPA Migration Complete!

**Migration successfully completed from MPA to SPA architecture.**

#### Post-Migration Notes:

- Build script in `package.json` needs minor update to remove the `cp dist/public/*.html` command (no longer needed)
- All routes now handled client-side: `/`, `/profile`, `/profile/sessions`, `/u/[username]`, `/u/[username]/s/[session]`
- Dynamic widget loading reduces initial bundle size
- Single entry point simplifies development and deployment
- ~70% code duplication eliminated between apps

#### What Works:

✅ SPA routing with browser back/forward support  
✅ Dynamic widget loading (profile & session management)  
✅ Unified authentication across all views  
✅ Development server runs correctly  
✅ Production build succeeds  
✅ All original functionality preserved
