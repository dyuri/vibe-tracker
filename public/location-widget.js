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
          background-color: var(--color-primary);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--border-radius-full);
          width: 40px;
          height: 40px;
          font-size: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          box-shadow: var(--shadow-heavy);
        }
        #info-panel {
          display: none; /* Hidden by default */
          background-color: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md) var(--spacing-md);
          box-shadow: var(--shadow-medium);
          margin-top: var(--spacing-sm);
          position: relative;
        }
        #close-button {
          position: absolute;
          top: var(--spacing-xs);
          right: var(--spacing-sm);
          font-size: 20px;
          cursor: pointer;
          color: var(--text-muted);
        }
        .property {
          margin-bottom: var(--spacing-xs);
          color: var(--text-primary);
        }
        .label {
          font-weight: var(--font-weight-bold);
          color: var(--text-secondary);
        }
        .refresh-container {
          margin-top: var(--spacing-sm);
          border-top: 1px solid var(--border-color);
          padding-top: var(--spacing-sm);
          & label {
            display: block;
            margin: var(--spacing-xs) 0;
            color: var(--text-primary);
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
            <input type="checkbox" id="dark-theme-checkbox">
            Dark theme
          </label>
          <label>
            <input type="checkbox" id="dark-map-checkbox">
            Dark map
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

    // Dark theme toggle
    const darkThemeCheckbox = this.shadowRoot.getElementById("dark-theme-checkbox");
    darkThemeCheckbox.addEventListener("change", (e) => {
      const newTheme = e.target.checked ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      
      // Apply theme to document
      document.documentElement.setAttribute('data-theme', newTheme);
      
      // Dispatch theme change event for other components
      const event = new CustomEvent('theme-change', {
        detail: { theme: newTheme },
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(event);
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

    // Initialize dark theme checkbox based on current theme
    const initializeThemeCheckbox = () => {
      // Check multiple sources for theme state
      const documentTheme = document.documentElement.getAttribute('data-theme');
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      let currentTheme;
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        currentTheme = savedTheme;
      } else if (documentTheme) {
        currentTheme = documentTheme;
      } else {
        currentTheme = prefersDark ? 'dark' : 'light';
      }
      
      darkThemeCheckbox.checked = currentTheme === 'dark';
    };
    
    // Initialize immediately and also after a short delay to ensure theme is loaded
    initializeThemeCheckbox();
    setTimeout(initializeThemeCheckbox, 100);
    
    // Listen for theme changes from other sources (like theme-toggle button)
    document.addEventListener('theme-change', (e) => {
      darkThemeCheckbox.checked = e.detail.theme === 'dark';
    });

    // Dark map toggle
    const darkMapCheckbox = this.shadowRoot.getElementById("dark-map-checkbox");
    darkMapCheckbox.addEventListener("change", (e) => {
      localStorage.setItem('dark-map-enabled', e.target.checked);
      
      // Find the map widget and set/remove the attribute
      const mapWidget = document.querySelector('map-widget');
      if (mapWidget) {
        if (e.target.checked) {
          mapWidget.setAttribute('data-map-theme', 'dark');
        } else {
          mapWidget.removeAttribute('data-map-theme');
        }
      }
    });

    // Initialize dark map checkbox from localStorage
    const savedDarkMap = localStorage.getItem("dark-map-enabled");
    if (savedDarkMap !== null) {
      darkMapCheckbox.checked = savedDarkMap === "true";
      // Apply the setting to map widget
      const mapWidget = document.querySelector('map-widget');
      if (mapWidget) {
        if (darkMapCheckbox.checked) {
          mapWidget.setAttribute('data-map-theme', 'dark');
        } else {
          mapWidget.removeAttribute('data-map-theme');
        }
      }
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
