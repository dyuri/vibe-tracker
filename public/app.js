const mapWidget = document.querySelector('map-widget');
const errorMessage = document.getElementById("error-message");
const locationWidget = document.querySelector("location-widget");

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get("username");
const session = urlParams.get("session");
let refreshIntervalId = null;

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
    "Username not provided in the URL. Please add ?username=your_username to the URL.";
}