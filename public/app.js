const map = L.map("map");
const mapEl = document.getElementById("map");
const errorMessage = document.getElementById("error-message");
const locationWidget = document.querySelector("location-widget");
const dataLayerGroup = L.layerGroup().addTo(map);
const currentPositionLayerGroup = L.layerGroup().addTo(map);

function interpolateColor(ratio, colorStops) {
  const numStops = colorStops.length;
  if (ratio <= 0) return colorStops[0];
  if (ratio >= 1) return colorStops[numStops - 1];

  const segment = 1 / (numStops - 1);
  const segmentIndex = Math.floor(ratio / segment);
  const localRatio = (ratio % segment) / segment;

  const color1 = colorStops[segmentIndex];
  const color2 = colorStops[Math.min(segmentIndex + 1, numStops - 1)];

  const r = Math.round(color1[0] + (color2[0] - color1[0]) * localRatio);
  const g = Math.round(color1[1] + (color2[1] - color1[1]) * localRatio);
  const b = Math.round(color1[2] + (color2[2] - color1[2]) * localRatio);

  return [r, g, b];
}

const colorScale = [
  [0, 0, 255],    // Blue
  [0, 255, 0],    // Green
  [255, 255, 0],  // Yellow
  [255, 165, 0],  // Orange
  [255, 0, 0]     // Red
];

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

  // Create black outlines first
  for (let i = 0; i < points.length - 1; i++) {
    const startPoint = points[i];
    const endPoint = points[i+1];
    const outline = L.polyline([[startPoint.geometry.coordinates[1], startPoint.geometry.coordinates[0]], [endPoint.geometry.coordinates[1], endPoint.geometry.coordinates[0]]], { color: 'black', weight: 7 });
    dataLayerGroup.addLayer(outline);
  }

  // Create colored lines on top
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
  const rgb = interpolateColor(ratio, colorScale);
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

  locationWidget.addEventListener("show-current-position", (e) => {
    currentPositionLayerGroup.clearLayers();
    const { latitude, longitude, accuracy } = e.detail.coords;
    const marker = L.circleMarker([latitude, longitude], {
      radius: 4,
      color: "#ff901e",
      fillColor: "#ff901e",
      fillOpacity: 1,
    });
    const circle = L.circle([latitude, longitude], {
      radius: accuracy,
      color: "#ff901e",
      fillColor: "#ff901e",
      fillOpacity: 0.2,
    });
    currentPositionLayerGroup.addLayer(marker);
    currentPositionLayerGroup.addLayer(circle);
  });

  locationWidget.addEventListener("hide-current-position", (e) => {
    currentPositionLayerGroup.clearLayers();
  });


  fetchData(true);
} else {
  mapEl.style.display = "none";
  errorMessage.style.display = "block";
  errorMessage.textContent =
    "Username not provided in the URL. Please add ?username=your_username to the URL.";
}
