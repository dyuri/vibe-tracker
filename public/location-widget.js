class LocationWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
			<style>
				:host {
					display: none;
          font-family: sans-serif;
				}
				.property {
					margin-bottom: 5px;
				}
				.label {
					font-weight: bold;
				}
        .refresh-container {
          margin-top: 10px;
          border-top: 1px solid #ccc;
          padding-top: 10px;
        }
			</style>
			<div id="widget-content"></div>
        <div class="refresh-container">
          <label>
            <input type="checkbox" id="refresh-checkbox">
            Refresh
          </label>
        </div>
		`;

    this.shadowRoot
      .getElementById("refresh-checkbox")
      .addEventListener("change", (e) => {
        const event = new CustomEvent("refresh-change", {
          detail: { checked: e.target.checked },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);
      });
  }

  update(feature) {
    this.clear();
    if (feature && feature.properties) {
      const { speed, heart_rate, timestamp, session } = feature.properties;
      const altitude = feature.geometry.coordinates[2];
      this.showProperty("Time", new Date(timestamp * 1000).toLocaleString());
      this.showProperty("Session", session || "N/A");
      this.showProperty("Altitude", `${altitude.toFixed(2)} m`);
      this.showProperty("Speed", `${speed.toFixed(2)} km/h`);
      this.showProperty("Heart Rate", `${heart_rate} bpm`);
    }
    this.style.display = "block";
  }

  showProperty(label, value) {
    const content = this.shadowRoot.getElementById("widget-content");
    const property = document.createElement("div");
    property.classList.add("property");
    property.innerHTML = `<span class="label">${label}:</span> <span class="value">${value}</span>`;
    content.appendChild(property);
  }

  clear() {
    this.shadowRoot.getElementById("widget-content").innerHTML = "";
  }
}
customElements.define("location-widget", LocationWidget);
