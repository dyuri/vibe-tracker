class LocationWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 20px;
          right: 20px;
          font-family: sans-serif;
          z-index: 1000;
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
            <input type="checkbox" id="wake-lock-checkbox">
            Wake Lock
          </label>
        </div>
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
    });

    closeButton.addEventListener("click", () => {
      infoPanel.style.display = "none";
      toggleButton.style.display = "flex"; // Use flex to center the 'i'
    });
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
