// Import modules
import AuthService from './auth-service.js';
import './login-widget.js';
import './location-widget.js';
import './map-widget.js';

// Initialize global auth service
window.authService = new AuthService();

// Get widget references
const mapWidget = document.querySelector('map-widget');
const errorMessage = document.getElementById("error-message");
const locationWidget = document.querySelector("location-widget");
const loginWidget = document.querySelector("login-widget");

let username, session;

// Try to parse the new path-based format first
const path = window.location.pathname;
const match = path.match(/^\/u\/([^\/]+)(?:\/s\/([^\/]+))?$/);

if (match) {
  username = match[1];
  session = match[2];
} else {
  // Fallback to URL parameters for backward compatibility
  const urlParams = new URLSearchParams(window.location.search);
  username = urlParams.get("username");
  session = urlParams.get("session");
}

let refreshIntervalId = null;

// Initialize authentication
document.addEventListener('auth-change', (e) => {
  console.log('Auth state changed:', e.detail);
  
  // You can add logic here to handle authentication state changes
  // For example, showing/hiding certain features based on login status
  if (e.detail.isAuthenticated) {
    console.log('User logged in:', e.detail.user);
  } else {
    console.log('User logged out');
  }
});

function fetchData(isInitialLoad = false) {
  let apiUrl;
  if (session) {
    apiUrl = `/api/session/${username}/${session}`;
  } else {
    apiUrl = `/api/session/${username}/_latest`;
  }

  fetch(apiUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error("User not found or no location data available.");
      }
      return response.json();
    })
    .then((data) => {
      mapWidget.displayData(data);
    })
    .catch((error) => {
      console.error(error);
      if (isInitialLoad) {
        mapWidget.style.display = "none";
        errorMessage.style.display = "block";
        errorMessage.textContent = error.message;
      }
    });
}

if (username) {
  locationWidget.addEventListener("refresh-change", (e) => {
    if (e.detail.checked) {
      fetchData();
      refreshIntervalId = setInterval(fetchData, 30000);
    } else {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
      }
    }
  });

  locationWidget.addEventListener("show-current-position", (e) => {
    mapWidget.showCurrentPosition(e.detail.coords);
  });

  locationWidget.addEventListener("hide-current-position", (e) => {
    mapWidget.hideCurrentPosition();
  });

  mapWidget.addEventListener('location-update', (e) => {
    locationWidget.update(e.detail);
  });


  fetchData(true);
} else {
  mapWidget.style.display = "none";
  errorMessage.style.display = "block";
  errorMessage.textContent =
    "Username not provided. Use the format /u/your_username or ?username=your_username in the URL.";
}