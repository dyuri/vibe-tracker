// Import modules
import AuthService from './auth-service.js';
import './login-widget.js';
import './location-widget.js';
import './map-widget.js';
import './theme-init.js';

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
const mapWidget = document.querySelector('map-widget');
const errorMessage = document.getElementById('error-message');
const locationWidget = document.querySelector('location-widget');
const _loginWidget = document.querySelector('login-widget');
const pageHeader = document.getElementById('page-header');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const _content = document.getElementById('content');

let username, session;

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

let refreshIntervalId = null;
let latestTimestamp = null; // Track the latest timestamp for delta fetching

function updatePageHeader() {
  if (!username) {
    // Public locations view
    document.title = 'Vibe Tracker - Public Locations';
    pageTitle.textContent = 'Public Locations';
    pageSubtitle.textContent = 'Latest locations from users with public sessions';
    pageHeader.style.display = 'block';
  } else if (session && session !== '_latest') {
    // Specific session view
    document.title = `Vibe Tracker - ${username}/${session}`;
    pageTitle.textContent = `${username} - ${session}`;
    pageSubtitle.textContent = 'Session tracking data';
    pageHeader.style.display = 'block';
  } else {
    // User's latest session view
    document.title = `Vibe Tracker - ${username}`;
    pageTitle.textContent = username;
    pageSubtitle.textContent = 'Latest session tracking';
    pageHeader.style.display = 'block';
  }
}

// Initialize authentication
document.addEventListener('auth-change', e => {
  console.log('Auth state changed:', e.detail);

  // You can add logic here to handle authentication state changes
  // For example, showing/hiding certain features based on login status
  if (e.detail.isAuthenticated) {
    console.log('User logged in:', e.detail.user);
  } else {
    console.log('User logged out');
  }
});

function fetchData(isInitialLoad = false, useDelta = false) {
  let apiUrl;

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
    .then(response => {
      // Handle standardized response format - extract actual data
      const data = response.data || response;

      if (username && useDelta && data.features && data.features.length === 0) {
        // No new data, just return
        return;
      }

      if (username && useDelta && data.features && data.features.length > 0) {
        // Append new data to existing track
        mapWidget.appendData(data);
        // Update latest timestamp
        const timestamps = data.features.map(f => f.properties.timestamp);
        latestTimestamp = Math.max(...timestamps);
      } else {
        // Initial load or full refresh - display all data
        mapWidget.displayData(data);
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
    .catch(error => {
      console.error(error);
      if (isInitialLoad) {
        mapWidget.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.textContent = error.message;
      }
    });
}

function fetchDeltaData() {
  fetchData(false, true);
}

// Update the page header based on the current view
updatePageHeader();

if (username) {
  // User-specific view - enable all features
  locationWidget.addEventListener('refresh-change', e => {
    if (e.detail.checked) {
      fetchData(); // Initial fetch
      refreshIntervalId = setInterval(fetchDeltaData, 30000); // Use delta fetching for subsequent refreshes
    } else {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
      }
    }
  });

  locationWidget.addEventListener('show-current-position', e => {
    mapWidget.showCurrentPosition(e.detail.coords);
  });

  locationWidget.addEventListener('hide-current-position', _e => {
    mapWidget.hideCurrentPosition();
  });

  mapWidget.addEventListener('location-update', e => {
    locationWidget.update(e.detail);
  });

  // Only do initial fetch if refresh is not already enabled (to avoid duplicate fetches)
  const savedRefresh = localStorage.getItem('refresh-enabled');
  if (savedRefresh !== 'true') {
    fetchData(true);
  }
} else {
  // Public locations view - limited features
  // Hide location widget controls since we're not tracking a specific user
  locationWidget.style.display = 'none';

  // Do initial fetch of public locations
  fetchData(true);

  // Set up periodic refresh for public view (every 5 minutes)
  refreshIntervalId = setInterval(() => fetchData(false, false), 5 * 60 * 1000);
}
