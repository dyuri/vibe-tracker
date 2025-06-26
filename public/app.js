const map = L.map('map');
const mapEl = document.getElementById('map');
const errorMessage = document.getElementById('error-message');

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const session = urlParams.get('session');

if (username) {
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	let apiUrl;
	if (session) {
		apiUrl = `/api/session/${username}/${session}`;
	} else {
		apiUrl = `/api/location/${username}`;
		if (session) {
			apiUrl += `?session=${session}`;
		}
	}

	fetch(apiUrl)
		.then(response => {
			if (!response.ok) {
				throw new Error('User not found or no location data available.');
			}
			return response.json();
		})
		.then(data => {
			if (data.geometry.type === 'Point') {
				const [longitude, latitude, altitude] = data.geometry.coordinates;
				const { speed, heart_rate, timestamp, session } = data.properties;

				map.setView([latitude, longitude], 15);
				L.marker([latitude, longitude]).addTo(map)
					.bindPopup(`
						<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
						<b>Session:</b> ${session || 'N/A'}<br>
						<b>Altitude:</b> ${altitude} m<br>
						<b>Speed:</b> ${speed} km/h<br>
						<b>Heart Rate:</b> ${heart_rate} bpm
					`)
					.openPopup();
			} else if (data.geometry.type === 'LineString') {
				const geojsonLayer = L.geoJSON(data, {
					onEachFeature: function (feature, layer) {
						if (feature.properties && feature.properties.session) {
							const startTime = new Date(feature.properties.start_time * 1000).toLocaleString();
							const endTime = new Date(feature.properties.end_time * 1000).toLocaleString();
							layer.bindPopup(`
								<b>Session:</b> ${feature.properties.session}<br>
								<b>Start Time:</b> ${startTime}<br>
								<b>End Time:</b> ${endTime}
							`);
						}
					}
				}).addTo(map);

				map.fitBounds(geojsonLayer.getBounds());
			}
		})
		.catch(error => {
			mapEl.style.display = 'none';
			errorMessage.style.display = 'block';
			errorMessage.textContent = error.message;
		});
} else {
	mapEl.style.display = 'none';
	errorMessage.style.display = 'block';
	errorMessage.textContent = 'Username not provided in the URL. Please add ?username=your_username to the URL.';
}
