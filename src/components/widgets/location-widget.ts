import type { LocationWidgetElement, GeoJSONFeature } from '../../types/index';
import styles from '../../styles/components/widgets/location-widget.css?inline';

/**
 * Location Widget for managing geolocation tracking
 */
export default class LocationWidget extends HTMLElement implements LocationWidgetElement {
  private watchId: number | null = null;
  private wakeLockSentinel: WakeLockSentinel | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
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

    const refreshCheckbox = this.shadowRoot!.getElementById('refresh-checkbox') as HTMLInputElement;
    refreshCheckbox.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      localStorage.setItem('refresh-enabled', target.checked.toString());
      const event = new CustomEvent('refresh-change', {
        detail: { checked: target.checked },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);
    });

    const showPositionCheckbox = this.shadowRoot!.getElementById(
      'show-position-checkbox'
    ) as HTMLInputElement;
    showPositionCheckbox.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      localStorage.setItem('show-position-enabled', target.checked.toString());
      if (target.checked) {
        this.watchId = navigator.geolocation.watchPosition(
          (position: GeolocationPosition) => {
            const event = new CustomEvent('show-current-position', {
              detail: {
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                },
              },
              bubbles: true,
              composed: true,
            });
            this.dispatchEvent(event);
          },
          (error: GeolocationPositionError) => {
            console.error('Error getting position', error);
          },
          {
            enableHighAccuracy: true,
          }
        );
      } else {
        if (this.watchId) {
          navigator.geolocation.clearWatch(this.watchId);
          this.watchId = null;
          const event = new CustomEvent('hide-current-position', {
            bubbles: true,
            composed: true,
          });
          this.dispatchEvent(event);
        }
      }
    });

    // Dark theme toggle
    const darkThemeCheckbox = this.shadowRoot!.getElementById(
      'dark-theme-checkbox'
    ) as HTMLInputElement;
    darkThemeCheckbox.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const newTheme = target.checked ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);

      // Apply theme to document
      document.documentElement.setAttribute('data-theme', newTheme);

      // Dispatch theme change event for other components
      const event = new CustomEvent('theme-change', {
        detail: { theme: newTheme },
        bubbles: true,
        composed: true,
      });
      document.dispatchEvent(event);
    });

    // Restore settings
    const savedRefresh = localStorage.getItem('refresh-enabled');
    if (savedRefresh !== null) {
      refreshCheckbox.checked = savedRefresh === 'true';
      // Dispatch the custom event that app.js listens for, with a small delay to ensure listeners are ready
      if (refreshCheckbox.checked) {
        setTimeout(() => {
          const event = new CustomEvent('refresh-change', {
            detail: { checked: true },
            bubbles: true,
            composed: true,
          });
          this.dispatchEvent(event);
        }, 100);
      }
    }

    const savedShowPosition = localStorage.getItem('show-position-enabled');
    if (savedShowPosition !== null) {
      showPositionCheckbox.checked = savedShowPosition === 'true';
      showPositionCheckbox.dispatchEvent(new Event('change'));
    }

    // Initialize dark theme checkbox based on current theme
    const initializeThemeCheckbox = () => {
      // Check multiple sources for theme state
      const documentTheme = document.documentElement.getAttribute('data-theme');
      const savedTheme = localStorage.getItem('theme');
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

      let currentTheme: string;
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
    document.addEventListener('theme-change', (e: Event) => {
      const customEvent = e as CustomEvent;
      darkThemeCheckbox.checked = customEvent.detail.theme === 'dark';
    });

    // Dark map toggle
    const darkMapCheckbox = this.shadowRoot!.getElementById(
      'dark-map-checkbox'
    ) as HTMLInputElement;
    darkMapCheckbox.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      localStorage.setItem('dark-map-enabled', target.checked.toString());

      // Find the map widget and set/remove the attribute
      const mapWidget = document.querySelector('map-widget');
      if (mapWidget) {
        if (target.checked) {
          mapWidget.setAttribute('data-map-theme', 'dark');
        } else {
          mapWidget.removeAttribute('data-map-theme');
        }
      }
    });

    // Initialize dark map checkbox from localStorage
    const savedDarkMap = localStorage.getItem('dark-map-enabled');
    if (savedDarkMap !== null) {
      darkMapCheckbox.checked = savedDarkMap === 'true';
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

    const wakeLockCheckbox = this.shadowRoot!.getElementById(
      'wake-lock-checkbox'
    ) as HTMLInputElement;

    wakeLockCheckbox.addEventListener('change', async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        try {
          this.wakeLockSentinel = await navigator.wakeLock.request('screen');
          this.wakeLockSentinel.addEventListener('release', () => {
            console.log('Wake Lock was released');
            wakeLockCheckbox.checked = false;
          });
          console.log('Wake Lock is active');
        } catch (err: any) {
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

    const toggleButton = this.shadowRoot!.getElementById('toggle-button') as HTMLButtonElement;
    const infoPanel = this.shadowRoot!.getElementById('info-panel') as HTMLDivElement;
    const closeButton = this.shadowRoot!.getElementById('close-button') as HTMLSpanElement;

    toggleButton.addEventListener('click', () => {
      infoPanel.style.display = 'block';
      toggleButton.style.display = 'none';
      localStorage.setItem('widget-open', 'true');
    });

    closeButton.addEventListener('click', () => {
      infoPanel.style.display = 'none';
      toggleButton.style.display = 'flex'; // Use flex to center the 'i'
      localStorage.setItem('widget-open', 'false');
    });

    // Restore widget open state
    const savedWidgetOpen = localStorage.getItem('widget-open');
    if (savedWidgetOpen === 'true') {
      infoPanel.style.display = 'block';
      toggleButton.style.display = 'none';
    }
  }

  /**
   * Cleanup when element is removed from DOM
   */
  disconnectedCallback(): void {
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release();
      this.wakeLockSentinel = null;
      console.log('Wake Lock was released on disconnect');
    }
  }

  /**
   * Update location display with GeoJSON feature data
   */
  update(feature: GeoJSONFeature): void {
    this.clear();
    if (feature && feature.properties) {
      const { speed, heart_rate, timestamp, session, session_title } = feature.properties;
      const altitude = feature.geometry.coordinates[2];
      const sessionDisplay =
        session_title && session_title !== session
          ? `${session_title} (${session})`
          : session || 'N/A';
      this.showProperty('Time', new Date(timestamp * 1000).toLocaleString());
      this.showProperty('Session', sessionDisplay);
      this.showProperty('Altitude', `${altitude.toFixed(2)} m`);
      this.showProperty('Speed', `${speed.toFixed(2)} km/h`);
      this.showProperty('Heart Rate', `${heart_rate} bpm`);
    }
    // Do not set display here, it's controlled by toggle/close buttons
  }

  /**
   * Display a property in the widget content
   */
  showProperty(label: string, value: string): void {
    const content = this.shadowRoot!.getElementById('widget-content')!;
    const property = document.createElement('div');
    property.classList.add('property');
    property.innerHTML = `<span class="label">${label}:</span> <span class="value">${value}</span>`;
    content.appendChild(property);
  }

  /**
   * Clear all displayed location data
   */
  clear(): void {
    this.shadowRoot!.getElementById('widget-content')!.innerHTML = '';
  }
}

customElements.define('location-widget', LocationWidget);
