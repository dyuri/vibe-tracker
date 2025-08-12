export default class LocationWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: sans-serif;
        }
        #toggle-button {
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          font-size: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        #info-panel {
          display: none; /* Hidden by default */
          background-color: white;
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 25px 25px 15px 15px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          margin-top: 10px;
          position: relative;
        }
        #close-button {
          position: absolute;
          top: 5px;
          right: 10px;
          font-size: 20px;
          cursor: pointer;
          color: #888;
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
          & label {
            display: block;
            margin: 5px 0;
          }
        }
      </style>
      <div id="toggle-button">ℹ</div>
      <div id="info-panel">
        <span id="close-button">×</span>
        <div id="widget-content"></div>
        <div class="refresh-container">
          <label>
            <input type="checkbox" id="refresh-checkbox">
            Refresh
          </label>
          <label>
            <input type="checkbox" id="show-position-checkbox">
            Show my position
          </label>
          <label>
            <input type="checkbox" id="wake-lock-checkbox">
            Wake Lock
          </label>
        </div>
      </div>
    `;

    const refreshCheckbox = this.shadowRoot.getElementById("refresh-checkbox");
    refreshCheckbox.addEventListener("change", (e) => {
        localStorage.setItem("refresh-enabled", e.target.checked);
        const event = new CustomEvent("refresh-change", {
          detail: { checked: e.target.checked },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);
      });

    this.watchId = null;
    const showPositionCheckbox = this.shadowRoot.getElementById("show-position-checkbox");
    showPositionCheckbox.addEventListener("change", (e) => {
      localStorage.setItem("show-position-enabled", e.target.checked);
      if (e.target.checked) {
        this.watchId = navigator.geolocation.watchPosition(
          (position) => {
            const event = new CustomEvent("show-current-position", {
              detail: {
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                }
              },
              bubbles: true,
              composed: true,
            });
            this.dispatchEvent(event);
          },
          (error) => {
            console.error("Error getting position", error);
          },
          {
            enableHighAccuracy: true,
          }
        );
      } else {
        if (this.watchId) {
          navigator.geolocation.clearWatch(this.watchId);
          this.watchId = null;
          const event = new CustomEvent("hide-current-position", {
            bubbles: true,
            composed: true,
          });
          this.dispatchEvent(event);
        }
      }
    });

    // Restore settings
    const savedRefresh = localStorage.getItem("refresh-enabled");
    if (savedRefresh !== null) {
      refreshCheckbox.checked = savedRefresh === "true";
      refreshCheckbox.dispatchEvent(new Event('change'));
    }

    const savedShowPosition = localStorage.getItem("show-position-enabled");
    if (savedShowPosition !== null) {
      showPositionCheckbox.checked = savedShowPosition === "true";
      showPositionCheckbox.dispatchEvent(new Event('change'));
    }

    this.wakeLockSentinel = null;
    const wakeLockCheckbox = this.shadowRoot.getElementById("wake-lock-checkbox");

    wakeLockCheckbox.addEventListener("change", async (e) => {
      if (e.target.checked) {
        try {
          this.wakeLockSentinel = await navigator.wakeLock.request('screen');
          this.wakeLockSentinel.addEventListener('release', () => {
            console.log('Wake Lock was released');
            wakeLockCheckbox.checked = false;
          });
          console.log('Wake Lock is active');
        } catch (err) {
          console.error(`${err.name}, ${err.message}`);
          wakeLockCheckbox.checked = false;
        }
      } else {
        if (this.wakeLockSentinel) {
          this.wakeLockSentinel.release();
          this.wakeLockSentinel = null;
          console.log('Wake Lock was released manually');
        }
      }
    });

    const toggleButton = this.shadowRoot.getElementById("toggle-button");
    const infoPanel = this.shadowRoot.getElementById("info-panel");
    const closeButton = this.shadowRoot.getElementById("close-button");

    toggleButton.addEventListener("click", () => {
      infoPanel.style.display = "block";
      toggleButton.style.display = "none";
      localStorage.setItem("widget-open", "true");
    });

    closeButton.addEventListener("click", () => {
      infoPanel.style.display = "none";
      toggleButton.style.display = "flex"; // Use flex to center the 'i'
      localStorage.setItem("widget-open", "false");
    });

    // Restore widget open state
    const savedWidgetOpen = localStorage.getItem("widget-open");
    if (savedWidgetOpen === "true") {
      infoPanel.style.display = "block";
      toggleButton.style.display = "none";
    }
  }

  disconnectedCallback() {
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release();
      this.wakeLockSentinel = null;
      console.log('Wake Lock was released on disconnect');
    }

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
    // Do not set display here, it's controlled by toggle/close buttons
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
