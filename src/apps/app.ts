import type {
  AuthChangeEventDetail,
  LocationUpdateEventDetail,
  LocationResponse,
  LocationsResponse,
  MapWidgetElement,
  LocationWidgetElement,
  LoginWidgetElement,
  ProfileWidgetElement,
  SessionManagementWidgetElement,
  ChartWidgetElement,
} from '@/types';

// Import modules
import { AuthService } from '@/services';
import { initializePWA } from '@/utils/service-worker';
import { Router } from '@/utils/router';
import '@/components/widgets/chart-widget';
import '@/components/widgets/login-widget';
import '@/components/widgets/location-widget';
import '@/components/widgets/map-widget';
import '@/components/widgets/theme-toggle';
import '@/apps/theme-init';
import '@/styles/transitions.css';

// Initialize global auth service
window.authService = new AuthService();

// Initialize PWA functionality
initializePWA().catch(error => {
  console.error('Failed to initialize PWA:', error);
});

// Initialize router
const router = new Router();

// View elements
const profileView = document.getElementById('profile-view') as HTMLElement | null;
const sessionsView = document.getElementById('sessions-view') as HTMLElement | null;

// Widget containers for dynamic loading
const profileWidgetContainer = document.getElementById(
  'profile-widget-container'
) as HTMLElement | null;
const sessionWidgetContainer = document.getElementById(
  'session-widget-container'
) as HTMLElement | null;

// Track loaded widgets to avoid duplicate loading
let profileWidgetLoaded = false;
let sessionWidgetLoaded = false;

/**
 * Show a specific view and hide others
 * Main view is always visible as background, overlays are shown/hidden
 */
function showView(viewName: 'main' | 'profile' | 'sessions'): void {
  // Hide all overlay views
  if (profileView) {
    profileView.classList.add('hidden');
  }
  if (sessionsView) {
    sessionsView.classList.add('hidden');
  }

  // Show the requested overlay view (main view is always visible)
  switch (viewName) {
    case 'main':
      // Main view is always visible, just ensure overlays are hidden (already done above)
      break;
    case 'profile':
      if (profileView) {
        profileView.classList.remove('hidden');
      }
      break;
    case 'sessions':
      if (sessionsView) {
        sessionsView.classList.remove('hidden');
      }
      break;
  }
}

/**
 * Dynamically load and initialize the profile widget
 */
async function loadProfileWidget(): Promise<void> {
  if (profileWidgetLoaded || !profileWidgetContainer) {
    return;
  }

  try {
    // Dynamic import of profile widget
    await import('@/components/widgets/profile-widget');

    // Create and append profile widget
    const profileWidget = document.createElement('profile-widget') as ProfileWidgetElement;
    profileWidgetContainer.appendChild(profileWidget);

    profileWidgetLoaded = true;
  } catch (error) {
    console.error('Failed to load profile widget:', error);
  }
}

/**
 * Dynamically load and initialize the session management widget
 */
async function loadSessionWidget(): Promise<void> {
  if (sessionWidgetLoaded || !sessionWidgetContainer) {
    return;
  }

  try {
    // Dynamic import of session management widget
    await import('@/components/widgets/session-management-widget');

    // Create and append session widget
    const sessionWidget = document.createElement(
      'session-management-widget'
    ) as SessionManagementWidgetElement;
    sessionWidgetContainer.appendChild(sessionWidget);

    sessionWidgetLoaded = true;
  } catch (error) {
    console.error('Failed to load session widget:', error);
  }
}

/**
 * Check authentication and configure global login widget
 */
function checkAuthAndConfigureLogin(): void {
  const loginWidget = document.getElementById('global-login') as LoginWidgetElement | null;
  if (!loginWidget) {
    return;
  }

  if (!window.authService.isAuthenticated()) {
    setTimeout(() => {
      try {
        loginWidget.showPanel();
      } catch (error) {
        console.warn('Could not show login panel:', error);
      }
    }, 100);
  }
}

// Get widget references
const mapWidget = document.querySelector('map-widget') as MapWidgetElement | null;
const errorMessage = document.getElementById('error-message') as HTMLDivElement | null;
const locationWidget = document.querySelector('location-widget') as LocationWidgetElement | null;
const chartWidget = document.querySelector('chart-widget') as ChartWidgetElement | null;
const pageHeader = document.getElementById('page-header') as HTMLElement | null;
const pageTitle = document.getElementById('page-title') as HTMLElement | null;
const pageSubtitle = document.getElementById('page-subtitle') as HTMLElement | null;

// Router setup - define routes and their handlers with async support
router.addRoute('/', async () => {
  showView('main');
  handleMainRoute();
});

router.addRoute('/profile', async () => {
  // Clear any running intervals when leaving main view
  clearRefreshInterval();

  // Reset main view initialization since we're leaving it
  isInitialized = false;

  showView('profile');

  // Show loading state during widget load
  if (profileView) {
    profileView.classList.add('view-transition-loading');
  }

  try {
    await loadProfileWidget();
    checkAuthAndConfigureLogin();
  } finally {
    if (profileView) {
      profileView.classList.remove('view-transition-loading');
    }
  }
});

router.addRoute('/profile/sessions', async () => {
  // Clear any running intervals when leaving main view
  clearRefreshInterval();

  // Reset main view initialization since we're leaving it
  isInitialized = false;

  showView('sessions');

  // Show loading state during widget load
  if (sessionsView) {
    sessionsView.classList.add('view-transition-loading');
  }

  try {
    await loadSessionWidget();
    checkAuthAndConfigureLogin();
  } finally {
    if (sessionsView) {
      sessionsView.classList.remove('view-transition-loading');
    }
  }
});

router.addRoute('/u/[username]', async params => {
  showView('main');
  handleMainRoute(params.username, null);
});

router.addRoute('/u/[username]/s/[session]', async params => {
  showView('main');
  handleMainRoute(params.username, params.session);
});

// Variables for main route handling
let username: string | null;
let session: string | null;

/**
 * Handle main route (map view) with optional username and session
 */
function handleMainRoute(routeUsername?: string, routeSession?: string): void {
  // Check if this is actually a different route
  const newUsername =
    routeUsername !== undefined
      ? routeUsername
      : new URLSearchParams(window.location.search).get('username');
  const newSession =
    routeUsername !== undefined
      ? routeSession || null
      : new URLSearchParams(window.location.search).get('session');

  // Reset initialization if the route parameters have actually changed
  if (username !== newUsername || session !== newSession) {
    console.log(`Route changed from ${username}/${session} to ${newUsername}/${newSession}`);
    isInitialized = false;
  }

  // Set username and session from route parameters or fallback to URL params
  if (routeUsername !== undefined) {
    username = routeUsername;
    session = routeSession || null;
  } else {
    // Fallback to URL parameters for backward compatibility
    const urlParams = new URLSearchParams(window.location.search);
    username = urlParams.get('username');
    session = urlParams.get('session');
  }

  // Initialize the main view
  initializeMainView();
}

/** Timer ID for refresh interval */
let refreshIntervalId: number | null = null;
/** Track the latest timestamp for delta fetching */
let latestTimestamp: number | null = null;
/** Track last request time to prevent excessive API calls */
let lastRequestTime: number = 0;
/** Minimum interval between API requests (in ms) */
const MIN_REQUEST_INTERVAL = 5000; // 5 seconds
/** Track if initial data has been loaded to prevent multiple initial fetches */
let isInitialized: boolean = false;
/** Store current chart data for delta updates */
let currentChartData: LocationsResponse | null = null;

/**
 * Update page header based on current username and session
 */
function updatePageHeader(): void {
  if (!username) {
    // Public locations view
    document.title = 'Vibe Tracker - Public Locations';
    if (pageTitle) {
      pageTitle.textContent = 'Public Locations';
    }
    if (pageSubtitle) {
      pageSubtitle.textContent = 'Latest locations from users with public sessions';
    }
    if (pageHeader) {
      pageHeader.style.display = 'block';
    }
  } else if (session && session !== '_latest') {
    // Specific session view
    document.title = `Vibe Tracker - ${username}/${session}`;
    if (pageTitle) {
      pageTitle.textContent = `${username} - ${session}`;
    }
    if (pageSubtitle) {
      pageSubtitle.textContent = 'Session tracking data';
    }
    if (pageHeader) {
      pageHeader.style.display = 'block';
    }
  } else {
    // User's latest session view
    document.title = `Vibe Tracker - ${username}`;
    if (pageTitle) {
      pageTitle.textContent = username;
    }
    if (pageSubtitle) {
      pageSubtitle.textContent = 'Latest session tracking';
    }
    if (pageHeader) {
      pageHeader.style.display = 'block';
    }
  }
}

// Initialize authentication - unified handler
document.addEventListener('auth-change', (e: Event) => {
  const customEvent = e as CustomEvent<AuthChangeEventDetail>;
  console.log('Auth state changed:', customEvent.detail);

  if (customEvent.detail.isAuthenticated) {
    console.log('User logged in:', customEvent.detail.user);
  } else {
    console.log('User logged out');

    // If user logs out from profile or sessions view, show login panel again
    const currentRoute = router.getCurrentRoute();
    if (currentRoute === '/profile' || currentRoute === '/profile/sessions') {
      setTimeout(() => checkAuthAndConfigureLogin(), 100);
    }
  }
});

/**
 * Fetch location data from API
 * @param isInitialLoad - Whether this is the initial data load
 * @param useDelta - Whether to use delta fetching for incremental updates
 */
function fetchData(isInitialLoad: boolean = false, useDelta: boolean = false): void {
  const now = Date.now();

  // Throttle API requests to prevent rate limiting (except for initial loads)
  if (!isInitialLoad && now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    console.log('Throttling API request, too soon since last request');
    return;
  }

  lastRequestTime = now;
  let apiUrl: string;

  if (!username) {
    // No username provided - fetch public locations
    apiUrl = `/api/public-locations`;
  } else if (session) {
    apiUrl = `/api/session/${username}/${session}`;
  } else {
    apiUrl = `/api/session/${username}/_latest`;
  }

  // Add since parameter for delta fetching (only for user-specific views)
  if (username && useDelta && latestTimestamp) {
    apiUrl += `?since=${latestTimestamp}`;
  }

  fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        if (!username) {
          throw new Error('No public location data available.');
        } else {
          throw new Error('User not found or no location data available.');
        }
      }
      return response.json();
    })
    .then((response: LocationsResponse | LocationResponse | any) => {
      // Handle standardized response format - extract actual data
      const data = response.data || response;

      if (username && useDelta && data.features && data.features.length === 0) {
        // No new data, just return
        return;
      }

      if (username && useDelta && data.features && data.features.length > 0) {
        // Append new data to existing track
        if (mapWidget) {
          mapWidget.appendData(data);
        }
        // For chart widget, merge new data with existing data and refresh
        if (chartWidget && currentChartData) {
          // Merge new features with existing ones
          const mergedFeatures = [...currentChartData.features, ...data.features];
          const mergedData: LocationsResponse = {
            type: 'FeatureCollection',
            features: mergedFeatures,
          };
          currentChartData = mergedData;
          chartWidget.displayData(mergedData);
        }
        // Update latest timestamp
        const timestamps = data.features.map(f => f.properties.timestamp);
        latestTimestamp = Math.max(...timestamps);
      } else {
        // Initial load or full refresh - display all data
        if (mapWidget) {
          mapWidget.displayData(data);
        }
        // Update chart widget with the same data and store it
        if (chartWidget && data.features && data.features.length > 0) {
          currentChartData = data;
          chartWidget.displayData(data);
        }
        // Extract and store the latest timestamp (only for user-specific views)
        if (username && data.features && data.features.length > 0) {
          const timestamps = data.features.map(f => f.properties.timestamp);
          latestTimestamp = Math.max(...timestamps);
        } else if (username && data.properties && data.properties.timestamp) {
          // Single point data
          latestTimestamp = data.properties.timestamp;
        }
      }
    })
    .catch((error: Error) => {
      console.error(error);
      if (isInitialLoad && errorMessage) {
        errorMessage.classList.remove('hidden');
        errorMessage.textContent = error.message;
      }
    });
}

/**
 * Fetch incremental location data using delta updates
 */
function fetchDeltaData(): void {
  fetchData(false, true);
}

/**
 * Clear any existing refresh interval
 */
function clearRefreshInterval(): void {
  if (refreshIntervalId) {
    console.log('Clearing refresh interval:', refreshIntervalId);
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

/**
 * Initialize the main view (map) based on username and session
 */
function initializeMainView(): void {
  // Prevent multiple initializations
  if (isInitialized) {
    console.log('MainView already initialized, skipping...');
    return;
  }

  console.log('Initializing main view...');
  isInitialized = true;

  // Clear any existing refresh intervals
  clearRefreshInterval();

  // Update the page header based on the current view
  updatePageHeader();

  if (username) {
    // User-specific view - enable all features
    // Show location widget
    if (locationWidget) {
      locationWidget.style.display = 'block';
    }

    // Remove existing event listeners to prevent duplicates
    locationWidget?.removeEventListener('refresh-change', handleRefreshChange);
    locationWidget?.removeEventListener('show-current-position', handleShowCurrentPosition);
    locationWidget?.removeEventListener('hide-current-position', handleHideCurrentPosition);
    mapWidget?.removeEventListener('location-update', handleLocationUpdate);
    chartWidget?.removeEventListener('chart-hover', handleChartHover);
    chartWidget?.removeEventListener('chart-click', handleChartClick);

    // Add event listeners
    locationWidget?.addEventListener('refresh-change', handleRefreshChange);
    locationWidget?.addEventListener('show-current-position', handleShowCurrentPosition);
    locationWidget?.addEventListener('hide-current-position', handleHideCurrentPosition);
    mapWidget?.addEventListener('location-update', handleLocationUpdate);
    chartWidget?.addEventListener('chart-hover', handleChartHover);
    chartWidget?.addEventListener('chart-click', handleChartClick);

    // Only do initial fetch if refresh is not already enabled (to avoid duplicate fetches)
    const savedRefresh = localStorage.getItem('refresh-enabled');
    if (savedRefresh !== 'true') {
      fetchData(true);
    }
  } else {
    // Public locations view - limited features
    // Hide location widget controls since we're not tracking a specific user
    if (locationWidget) {
      locationWidget.style.display = 'none';
    }

    // Do initial fetch of public locations
    fetchData(true);

    // Set up periodic refresh for public view (every 5 minutes)
    refreshIntervalId = setInterval(
      () => fetchData(false, false),
      5 * 60 * 1000
    ) as unknown as number;
  }
}

// Event handlers for location widget
function handleRefreshChange(e: Event): void {
  const customEvent = e as CustomEvent<{ checked: boolean }>;
  if (customEvent.detail.checked) {
    // Clear any existing interval first
    clearRefreshInterval();

    fetchData(true); // Initial fetch

    // Increase interval to 60 seconds to reduce API load
    console.log('Starting refresh interval (60s)');
    refreshIntervalId = setInterval(fetchDeltaData, 60000) as unknown as number;
  } else {
    clearRefreshInterval();
  }
}

function handleShowCurrentPosition(e: Event): void {
  const customEvent = e as CustomEvent<{ coords: GeolocationCoordinates }>;
  if (mapWidget) {
    mapWidget.showCurrentPosition(customEvent.detail.coords);
  }
}

function handleHideCurrentPosition(_e: Event): void {
  if (mapWidget) {
    mapWidget.hideCurrentPosition();
  }
}

function handleLocationUpdate(e: Event): void {
  const customEvent = e as CustomEvent<LocationUpdateEventDetail>;
  if (locationWidget) {
    locationWidget.update(customEvent.detail);
  }
}

function handleChartHover(e: Event): void {
  const customEvent = e as CustomEvent<{ feature: any; index: number }>;
  // TODO: Show temporary marker on map at the hovered point
  // For now, just log the event
  console.log('Chart hover:', customEvent.detail);
}

function handleChartClick(e: Event): void {
  const customEvent = e as CustomEvent<{ feature: any; index: number }>;
  const feature = customEvent.detail.feature;

  if (feature && feature.geometry && feature.geometry.coordinates) {
    const [longitude, latitude] = feature.geometry.coordinates;

    // Center map on the clicked point
    if (mapWidget) {
      // TODO: Add a method to center map on coordinates
      console.log('Chart click - center map on:', latitude, longitude);
    }

    // Update location widget with the selected point data
    if (locationWidget) {
      locationWidget.update(feature);
    }
  }
}

// SPA Navigation: Handle clicks on navigation links
document.addEventListener('click', (e: Event) => {
  const target = e.target as HTMLElement;
  const routeLink = target.closest('[data-route]') as HTMLElement;

  if (routeLink) {
    e.preventDefault();
    const route = routeLink.getAttribute('data-route');
    if (route) {
      router.navigate(route);
    }
  }
});

// Dispatch initial auth state to ensure all widgets are properly initialized
// This fixes the issue where widgets don't get the initial auth state on page reload
// Use setTimeout to ensure DOM elements are fully initialized before dispatching
setTimeout(() => {
  if (window.authService.isAuthenticated()) {
    window.authService.dispatchAuthChange();
  }
}, 0);

// Start the router
router.start();
