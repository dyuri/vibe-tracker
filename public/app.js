const map = L.map('map');
const mapEl = document.getElementById('map');
const errorMessage = document.getElementById('error-message');

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const session = urlParams.get('session');

function displayFeatureCollection(data) {
	L.geoJSON(data, {
		onEachFeature: function (feature, layer) {
			if (feature.properties) {
				if (feature.geometry.type === 'LineString') {
					const startTime = new Date(feature.properties.start_time * 1000).toLocaleString();
					const endTime = new Date(feature.properties.end_time * 1000).toLocaleString();
					layer.bindPopup(`
									<b>Session:</b> ${feature.properties.session}<br>
									<b>Start Time:</b> ${startTime}<br>
									<b>End Time:</b> ${endTime}
								`);
				} else if (feature.geometry.type === 'Point') {
					const [longitude, latitude, altitude] = feature.geometry.coordinates;
					const { speed, heart_rate, timestamp, session } = feature.properties;
					layer.bindPopup(`
									<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
									<b>Session:</b> ${session || 'N/A'}<br>
									<b>Altitude:</b> ${altitude} m<br>
									<b>Speed:</b> ${speed} km/h<br>
									<b>Heart Rate:</b> ${heart_rate} bpm
								`);
				}
			}
		}
	}).addTo(map);
	map.fitBounds(L.geoJSON(data).getBounds());
}

if (username) {
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	let apiUrl;
	if (session) {
		apiUrl = `/api/session/${username}/${session}`;
	} else {
		apiUrl = `/api/location/${username}`;
	}

	fetch(apiUrl)
		.then(response => {
			if (!response.ok) {
				throw new Error('User not found or no location data available.');
			}
			return response.json();
		})
		.then(data => {
			if (data.type === 'FeatureCollection') {
				displayFeatureCollection(data);
			} else if (data.geometry.type === 'Point') {
				const { session } = data.properties;
				if (session) {
					fetch(`/api/session/${username}/${session}`)
						.then(response => {
							if (!response.ok) {
								throw new Error('Could not fetch session data.');
							}
							return response.json();
						})
						.then(sessionData => displayFeatureCollection(sessionData))
						.catch(error => {
							// Fallback to showing just the point if session fetch fails
							const [longitude, latitude, altitude] = data.geometry.coordinates;
							const { speed, heart_rate, timestamp } = data.properties;

							map.setView([latitude, longitude], 15);
							L.marker([latitude, longitude]).addTo(map)
								.bindPopup(`
									<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
									<b>Session:</b> ${session} (could not load full session)<br>
									<b>Altitude:</b> ${altitude} m<br>
									<b>Speed:</b> ${speed} km/h<br>
									<b>Heart Rate:</b> ${heart_rate} bpm
								`)
								.openPopup();
						});
				} else {
					// No session, just show the point
					const [longitude, latitude, altitude] = data.geometry.coordinates;
					const { speed, heart_rate, timestamp } = data.properties;

					map.setView([latitude, longitude], 15);
					L.marker([latitude, longitude]).addTo(map)
						.bindPopup(`
							<b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}<br>
							<b>Session:</b> N/A<br>
							<b>Altitude:</b> ${altitude} m<br>
							<b>Speed:</b> ${speed} km/h<br>
							<b>Heart Rate:</b> ${heart_rate} bpm
						`)
						.openPopup();
				}
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
