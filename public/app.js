const map = L.map("map");
const mapEl = document.getElementById("map");
const errorMessage = document.getElementById("error-message");
const locationWidget = document.querySelector("location-widget");
const dataLayerGroup = L.layerGroup().addTo(map);

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get("username");
const session = urlParams.get("session");
let refreshIntervalId = null;

function displayFeatureCollection(data) {
  dataLayerGroup.clearLayers();
  const geoJsonLayer = L.geoJSON(data, {
    onEachFeature: function (feature, layer) {
      if (feature.properties) {
        if (feature.geometry.type === "LineString") {
          const startTime = new Date(
            feature.properties.start_time * 1000,
          ).toLocaleString();
          const endTime = new Date(
            feature.properties.end_time * 1000,
          ).toLocaleString();
          layer.bindPopup(`
						<b>Session:</b> ${feature.properties.session}<br>
						<b>Start Time:</b> ${startTime}<br>
						<b>End Time:</b> ${endTime}
					`);
        } else if (feature.geometry.type === "Point") {
          const [longitude, latitude, altitude] = feature.geometry.coordinates;
          const { speed, heart_rate, timestamp, session } = feature.properties;
          layer.bindPopup(`
						<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
						<b>Session:</b> ${session || "N/A"}<br>
						<b>Altitude:</b> ${altitude} m<br>
						<b>Speed:</b> ${speed} km/h<br>
						<b>Heart Rate:</b> ${heart_rate} bpm
					`);
        }
      }
    },
  });
  dataLayerGroup.addLayer(geoJsonLayer);
  map.fitBounds(geoJsonLayer.getBounds());

  const latestPoint = data.features.find((f) => f.geometry.type === "Point");
  if (latestPoint) {
    locationWidget.update(latestPoint);
  }
}

function displayPoint(data) {
  dataLayerGroup.clearLayers();
  const [longitude, latitude, altitude] = data.geometry.coordinates;
  const { speed, heart_rate, timestamp, session } = data.properties;

  map.setView([latitude, longitude], 15);
  const marker = L.marker([latitude, longitude])
    .bindPopup(
      `
            <b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
            <b>Session:</b> ${session || "N/A"}<br>
            <b>Altitude:</b> ${altitude} m<br>
            <b>Speed:</b> ${speed} km/h<br>
            <b>Heart Rate:</b> ${heart_rate} bpm
        `,
    )
    .openPopup();
  dataLayerGroup.addLayer(marker);

  locationWidget.update(data);
}

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
      if (data.type === "FeatureCollection") {
        displayFeatureCollection(data);
      } else {
        displayPoint(data);
      }
    })
    .catch((error) => {
      console.error(error);
      if (isInitialLoad) {
        mapEl.style.display = "none";
        errorMessage.style.display = "block";
        errorMessage.textContent = error.message;
      }
    });
}

if (username) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

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

  fetchData(true);
} else {
  mapEl.style.display = "none";
  errorMessage.style.display = "block";
  errorMessage.textContent =
    "Username not provided in the URL. Please add ?username=your_username to the URL.";
}
