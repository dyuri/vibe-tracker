const map = L.map('map').setView([0, 0], 2);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);

		fetch('/api/collections/locations/records?sort=-created')
			.then(response => response.json())
			.then(data => {
				if (data.items && data.items.length > 0) {
					const lastLocation = data.items[0];
					const { latitude, longitude, altitude, speed, heart_rate } = lastLocation;
					map.setView([latitude, longitude], 15);
					L.marker([latitude, longitude]).addTo(map)
						.bindPopup(`
							<b>Altitude:</b> ${altitude} m<br>
							<b>Speed:</b> ${speed} km/h<br>
							<b>Heart Rate:</b> ${heart_rate} bpm
						`)
						.openPopup();
				}
			});