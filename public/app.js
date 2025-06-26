const map = L.map('map');
const mapEl = document.getElementById('map');
const errorMessage = document.getElementById('error-message');

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');

if (username) {
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	fetch(`/api/location/${username}`)
		.then(response => {
			if (!response.ok) {
				throw new Error('User not found or no location data available.');
			}
			return response.json();
		})
		.then(data => {
			const { latitude, longitude, altitude, speed, heart_rate } = data;
			map.setView([latitude, longitude], 15);
			L.marker([latitude, longitude]).addTo(map)
				.bindPopup(`
					<b>Altitude:</b> ${altitude} m<br>
					<b>Speed:</b> ${speed} km/h<br>
					<b>Heart Rate:</b> ${heart_rate} bpm
				`)
				.openPopup();
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
