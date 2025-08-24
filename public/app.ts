import type {
  AuthChangeEventDetail,
  LocationUpdateEventDetail,
  LocationResponse,
  LocationsResponse,
  MapWidgetElement,
  LocationWidgetElement,
} from '../src/types/index.ts';

// Import modules
import AuthService from './auth-service.ts';
import './login-widget.ts';
import './location-widget.ts';
import './map-widget.ts';
import './theme-init.ts';

// Initialize global auth service
window.authService = new AuthService();

// Dispatch initial auth state to ensure all widgets are properly initialized
// This fixes the issue where widgets don't get the initial auth state on page reload
// Use setTimeout to ensure DOM elements are fully initialized before dispatching
setTimeout(() => {
  if (window.authService.isAuthenticated()) {
    window.authService.dispatchAuthChange();
  }
}, 0);

// Get widget references
const mapWidget = document.querySelector('map-widget') as MapWidgetElement | null;
const errorMessage = document.getElementById('error-message') as HTMLDivElement | null;
const locationWidget = document.querySelector('location-widget') as LocationWidgetElement | null;
const pageHeader = document.getElementById('page-header') as HTMLElement | null;
const pageTitle = document.getElementById('page-title') as HTMLElement | null;
const pageSubtitle = document.getElementById('page-subtitle') as HTMLElement | null;

let username: string | null;
let session: string | null;

// Try to parse the new path-based format first
const path = window.location.pathname;
const match = path.match(/^\/u\/([^/]+)(?:\/s\/([^/]+))?$/);

if (match) {
  username = match[1];
  session = match[2];
} else {
  // Fallback to URL parameters for backward compatibility
  const urlParams = new URLSearchParams(window.location.search);
  username = urlParams.get('username');
  session = urlParams.get('session');
}

/** Timer ID for refresh interval */
let refreshIntervalId: number | null = null;
/** Track the latest timestamp for delta fetching */
let latestTimestamp: number | null = null;

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

// Initialize authentication
document.addEventListener('auth-change', (e: Event) => {
  const customEvent = e as CustomEvent<AuthChangeEventDetail>;
  console.log('Auth state changed:', customEvent.detail);

  // You can add logic here to handle authentication state changes
  // For example, showing/hiding certain features based on login status
  if (customEvent.detail.isAuthenticated) {
    console.log('User logged in:', customEvent.detail.user);
  } else {
    console.log('User logged out');
  }
});

/**
 * Fetch location data from API
 * @param isInitialLoad - Whether this is the initial data load
 * @param useDelta - Whether to use delta fetching for incremental updates
 */
function fetchData(isInitialLoad: boolean = false, useDelta: boolean = false): void {
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
    .then((response: LocationsResponse | LocationResponse) => {
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
        // Update latest timestamp
        const timestamps = data.features.map(f => f.properties.timestamp);
        latestTimestamp = Math.max(...timestamps);
      } else {
        // Initial load or full refresh - display all data
        if (mapWidget) {
          mapWidget.displayData(data);
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
      if (isInitialLoad && mapWidget && errorMessage) {
        mapWidget.style.display = 'none';
        errorMessage.style.display = 'block';
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

// Update the page header based on the current view
updatePageHeader();

if (username) {
  // User-specific view - enable all features
  locationWidget?.addEventListener('refresh-change', (e: Event) => {
    const customEvent = e as CustomEvent<{ checked: boolean }>;
    if (customEvent.detail.checked) {
      fetchData(); // Initial fetch
      refreshIntervalId = setInterval(fetchDeltaData, 30000); // Use delta fetching for subsequent refreshes
    } else {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
      }
    }
  });

  locationWidget?.addEventListener('show-current-position', (e: Event) => {
    const customEvent = e as CustomEvent<{ coords: GeolocationCoordinates }>;
    if (mapWidget) {
      mapWidget.showCurrentPosition(customEvent.detail.coords);
    }
  });

  locationWidget?.addEventListener('hide-current-position', (_e: Event) => {
    if (mapWidget) {
      mapWidget.hideCurrentPosition();
    }
  });

  mapWidget?.addEventListener('location-update', (e: Event) => {
    const customEvent = e as CustomEvent<LocationUpdateEventDetail>;
    if (locationWidget) {
      locationWidget.update(customEvent.detail);
    }
  });

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
  refreshIntervalId = setInterval(() => fetchData(false, false), 5 * 60 * 1000);
}
