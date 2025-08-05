const map = L.map("map");
const mapEl = document.getElementById("map");
const errorMessage = document.getElementById("error-message");
const locationWidget = document.querySelector("location-widget");
const dataLayerGroup = L.layerGroup().addTo(map);

// Using the Cubehelix color formula
// https://gist.github.com/gka/1654896
function cubehelix(t, start, rotations, hue, gamma) {
  const cos = Math.cos;
  const sin = Math.sin;
  const PI2 = Math.PI * 2;

  const a = hue * t * (1 - t) / 2;
  const r = t + a * (-0.14861 * cos(PI2 * (start / 3 + rotations * t + 2 / 3)));
  const g = t + a * (-0.29227 * cos(PI2 * (start / 3 + rotations * t + 1 / 3)));
  const b = t + a * (1.97294 * cos(PI2 * (start / 3 + rotations * t)));

  return [
    Math.max(0, Math.min(255, 255 * Math.pow(r, gamma))),
    Math.max(0, Math.min(255, 255 * Math.pow(g, gamma))),
    Math.max(0, Math.min(255, 255 * Math.pow(b, gamma))),
  ];
}

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get("username");
const session = urlParams.get("session");
let refreshIntervalId = null;

function displayFeatureCollection(data) {
  dataLayerGroup.clearLayers();

  const points = data.features;
  if (points.length === 0) {
    return;
  }

  // Find min and max heart rate for color scaling
  const heartRates = points.map((p) => p.properties.heart_rate).filter(hr => hr !== null && hr !== undefined);
  const minHeartRate = Math.min(...heartRates);
  const maxHeartRate = Math.max(...heartRates);

  // Create a multi-colored line
  for (let i = 0; i < points.length - 1; i++) {
    const startPoint = points[i];
    const endPoint = points[i+1];
    const heartRate = startPoint.properties.heart_rate;
    const color = getHeartRateColor(heartRate, minHeartRate, maxHeartRate);
    const line = L.polyline([[startPoint.geometry.coordinates[1], startPoint.geometry.coordinates[0]], [endPoint.geometry.coordinates[1], endPoint.geometry.coordinates[0]]], { color: color, weight: 5 });
    dataLayerGroup.addLayer(line);
  }

  const latestPoint = points[points.length - 1];

  // Create a transparent, clickable line
  const clickableLine = L.polyline(points.map(p => [p.geometry.coordinates[1], p.geometry.coordinates[0]]), { opacity: 0, weight: 10 });
  clickableLine.on('click', function (e) {
    let closestPoint = null;
    let minDistance = Infinity;

    points.forEach(p => {
      const latlng = L.latLng(p.geometry.coordinates[1], p.geometry.coordinates[0]);
      const distance = e.latlng.distanceTo(latlng);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = p;
      }
    });

    if (closestPoint) {
      const { speed, heart_rate, timestamp, session } = closestPoint.properties;
      const altitude = closestPoint.geometry.coordinates[2];
      const popupContent = `
						<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
						<b>Session:</b> ${session || "N/A"}<br>
						<b>Altitude:</b> ${altitude} m<br>
						<b>Speed:</b> ${speed} km/h<br>
						<b>Heart Rate:</b> ${heart_rate} bpm
					`;
      L.popup()
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(map);
    }
  });
  dataLayerGroup.addLayer(clickableLine);

  // Add only the latest point as a marker
  const [longitude, latitude, altitude] = latestPoint.geometry.coordinates;
  const marker = L.marker([latitude, longitude]);
  const { speed, heart_rate, timestamp, session } = latestPoint.properties;
  const popupContent = `
						<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
						<b>Session:</b> ${session || "N/A"}<br>
						<b>Altitude:</b> ${altitude} m<br>
						<b>Speed:</b> ${speed} km/h<br>
						<b>Heart Rate:</b> ${heart_rate} bpm
					`;
  marker.bindPopup(popupContent);
  dataLayerGroup.addLayer(marker);

  map.fitBounds(L.geoJSON(data).getBounds());

  if (latestPoint) {
    locationWidget.update(latestPoint);
  }
}

function getHeartRateColor(heartRate, min, max) {
  if (heartRate === null || heartRate === undefined || max == min) {
    return "#808080"; // Grey for no data
  }
  const ratio = (heartRate - min) / (max - min);
  const rgb = cubehelix(ratio, 0.5, -1.5, 1, 1);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
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
