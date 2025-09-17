import type {
  WaypointsResponse,
  WaypointFeature,
  WaypointType,
  PositionConfidence,
  CreateWaypointRequest,
  WaypointManagerWidgetElement,
} from '@/types';
import styles from '@/styles/components/widgets/waypoint-manager-widget.css?inline';

/**
 * Waypoint Manager Widget Web Component
 * Manages CRUD operations for waypoints in a session
 */
export default class WaypointManagerWidget
  extends HTMLElement
  implements WaypointManagerWidgetElement
{
  private sessionId: string = '';
  private waypoints: WaypointFeature[] = [];
  private showingCreateForm: boolean = false;
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
    this.setupEventListeners();
  }

  connectedCallback(): void {
    // Widget is ready
  }

  /**
   * Loads waypoints for a specific session
   */
  loadWaypoints(sessionId: string): void {
    this.sessionId = sessionId;
    this.fetchWaypoints();
  }

  /**
   * Refreshes the waypoints list
   */
  refreshWaypoints(): void {
    if (this.sessionId) {
      this.fetchWaypoints();
    }
  }

  /**
   * Shows the create waypoint form
   */
  showCreateForm(): void {
    this.showingCreateForm = true;
    this.updateFormDisplay();
  }

  /**
   * Hides the create waypoint form
   */
  hideCreateForm(): void {
    this.showingCreateForm = false;
    this.updateFormDisplay();
    this.resetForm();
  }

  /**
   * Fetches waypoints from the API
   */
  private async fetchWaypoints(): Promise<void> {
    try {
      const container = this.shadowRoot!.querySelector('.waypoints-list') as HTMLElement;
      container.innerHTML = '<div class="loading">Loading waypoints...</div>';

      // This would be the actual API call - placeholder for now
      // const response = await this.apiService.getWaypoints(this.sessionId);

      // Mock data for demonstration
      const mockResponse: WaypointsResponse = {
        type: 'FeatureCollection',
        features: [],
      };

      this.waypoints = mockResponse.features;
      this.updateWaypointsList();
    } catch (error) {
      console.error('Failed to fetch waypoints:', error);
      const container = this.shadowRoot!.querySelector('.waypoints-list') as HTMLElement;
      container.innerHTML = '<div class="error">Failed to load waypoints</div>';
    }
  }

  /**
   * Updates the waypoints list display
   */
  private updateWaypointsList(): void {
    const container = this.shadowRoot!.querySelector('.waypoints-list') as HTMLElement;

    if (this.waypoints.length === 0) {
      container.innerHTML = '<div class="no-waypoints">No waypoints found</div>';
      return;
    }

    const waypointsHtml = this.waypoints
      .map(waypoint => this.renderWaypointItem(waypoint))
      .join('');
    container.innerHTML = waypointsHtml;
  }

  /**
   * Renders a single waypoint item
   */
  private renderWaypointItem(waypoint: WaypointFeature): string {
    const { name, type, description, altitude, source, position_confidence } = waypoint.properties;
    const coords = waypoint.geometry.coordinates;
    const icon = this.getWaypointIcon(type);
    const confidenceClass = this.getConfidenceClass(position_confidence);

    return `
      <div class="waypoint-item" data-waypoint-id="${waypoint.properties.id}">
        <div class="waypoint-header">
          <div class="waypoint-icon waypoint-type-${type}">${icon}</div>
          <div class="waypoint-info">
            <h4 class="waypoint-name">${name}</h4>
            <div class="waypoint-meta">
              <span class="waypoint-type">${type}</span>
              <span class="waypoint-confidence ${confidenceClass}">${position_confidence.replace('_', ' ')}</span>
              <span class="waypoint-source">${source}</span>
            </div>
          </div>
          <div class="waypoint-actions">
            <button class="action-btn edit-btn" data-action="edit" data-waypoint-id="${waypoint.properties.id}">
              ✏️
            </button>
            <button class="action-btn delete-btn" data-action="delete" data-waypoint-id="${waypoint.properties.id}">
              🗑️
            </button>
          </div>
        </div>
        ${description ? `<div class="waypoint-description">${description}</div>` : ''}
        <div class="waypoint-coordinates">
          📍 ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}${altitude ? ` (${altitude}m)` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Gets icon for waypoint type
   */
  private getWaypointIcon(type: WaypointType): string {
    const icons: Record<WaypointType, string> = {
      generic: '📍',
      food: '🍽️',
      water: '💧',
      shelter: '🏠',
      transition: '🚌',
      viewpoint: '👁️',
      camping: '⛺',
      parking: '🅿️',
      danger: '⚠️',
      medical: '🏥',
      fuel: '⛽',
    };
    return icons[type] || icons.generic;
  }

  /**
   * Gets CSS class for confidence level
   */
  private getConfidenceClass(confidence: PositionConfidence): string {
    const classes: Record<PositionConfidence, string> = {
      gps: 'confidence-high',
      time_matched: 'confidence-good',
      tracked: 'confidence-good',
      gpx_track: 'confidence-medium',
      last_known: 'confidence-low',
      manual: 'confidence-low',
    };
    return classes[confidence] || 'confidence-low';
  }

  /**
   * Updates the form display based on showingCreateForm state
   */
  private updateFormDisplay(): void {
    const form = this.shadowRoot!.querySelector('.create-form') as HTMLElement;
    const overlay = this.shadowRoot!.querySelector('.form-overlay') as HTMLElement;

    if (this.showingCreateForm) {
      form.style.display = 'block';
      overlay.style.display = 'block';
    } else {
      form.style.display = 'none';
      overlay.style.display = 'none';
    }
  }

  /**
   * Resets the create form
   */
  private resetForm(): void {
    const form = this.shadowRoot!.querySelector('#waypoint-form') as HTMLFormElement;
    if (form) {
      form.reset();
    }
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    this.shadowRoot!.addEventListener('click', this.handleClick.bind(this));
    this.shadowRoot!.addEventListener('submit', this.handleFormSubmit.bind(this));
  }

  /**
   * Handles click events
   */
  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;

    if (target.classList.contains('add-waypoint-btn')) {
      this.showCreateForm();
    } else if (
      target.classList.contains('cancel-btn') ||
      target.classList.contains('form-overlay')
    ) {
      this.hideCreateForm();
    } else if (target.dataset.action === 'edit') {
      this.handleEditWaypoint(target.dataset.waypointId!);
    } else if (target.dataset.action === 'delete') {
      this.handleDeleteWaypoint(target.dataset.waypointId!);
    }
  }

  /**
   * Handles form submission
   */
  private async handleFormSubmit(event: Event): Promise<void> {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const waypointData: CreateWaypointRequest = {
      name: formData.get('name') as string,
      type: formData.get('type') as WaypointType,
      description: (formData.get('description') as string) || undefined,
      latitude: parseFloat(formData.get('latitude') as string),
      longitude: parseFloat(formData.get('longitude') as string),
      altitude: formData.get('altitude')
        ? parseFloat(formData.get('altitude') as string)
        : undefined,
      session_id: this.sessionId,
      source: 'manual',
      position_confidence: 'manual',
    };

    try {
      await this.createWaypoint(waypointData);
      this.hideCreateForm();
      this.refreshWaypoints();
    } catch (error) {
      console.error('Failed to create waypoint:', error);
      // Show error message
    }
  }

  /**
   * Creates a new waypoint
   */
  private async createWaypoint(data: CreateWaypointRequest): Promise<void> {
    // This would be the actual API call
    // await this.apiService.createWaypoint(data);
    console.log('Creating waypoint:', data);
  }

  /**
   * Handles editing a waypoint
   */
  private handleEditWaypoint(waypointId: string): void {
    const waypoint = this.waypoints.find(w => w.properties.id === waypointId);
    if (waypoint) {
      // Populate form with existing data and show it
      this.populateFormForEdit(waypoint);
      this.showCreateForm();
    }
  }

  /**
   * Populates the form for editing
   */
  private populateFormForEdit(waypoint: WaypointFeature): void {
    const form = this.shadowRoot!.querySelector('#waypoint-form') as HTMLFormElement;
    const formData = waypoint.properties;
    const coords = waypoint.geometry.coordinates;

    (form.querySelector('[name="name"]') as HTMLInputElement).value = formData.name;
    (form.querySelector('[name="type"]') as HTMLSelectElement).value = formData.type;
    (form.querySelector('[name="description"]') as HTMLTextAreaElement).value =
      formData.description || '';
    (form.querySelector('[name="latitude"]') as HTMLInputElement).value = coords[1].toString();
    (form.querySelector('[name="longitude"]') as HTMLInputElement).value = coords[0].toString();
    if (formData.altitude) {
      (form.querySelector('[name="altitude"]') as HTMLInputElement).value =
        formData.altitude.toString();
    }
  }

  /**
   * Handles deleting a waypoint
   */
  private async handleDeleteWaypoint(waypointId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this waypoint?')) {
      try {
        await this.deleteWaypoint(waypointId);
        this.refreshWaypoints();
      } catch (error) {
        console.error('Failed to delete waypoint:', error);
      }
    }
  }

  /**
   * Deletes a waypoint
   */
  private async deleteWaypoint(waypointId: string): Promise<void> {
    // This would be the actual API call
    // await this.apiService.deleteWaypoint(waypointId);
    console.log('Deleting waypoint:', waypointId);
  }

  /**
   * Renders the widget HTML
   */
  private render(): void {
    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <div class="waypoint-manager-widget">
        <div class="widget-header">
          <h3>Waypoints</h3>
          <button class="add-waypoint-btn">+ Add Waypoint</button>
        </div>

        <div class="waypoints-list">
          <div class="no-session">Select a session to view waypoints</div>
        </div>

        <div class="form-overlay" style="display: none;"></div>

        <div class="create-form" style="display: none;">
          <div class="form-container">
            <div class="form-header">
              <h4>Add Waypoint</h4>
              <button class="cancel-btn">×</button>
            </div>

            <form id="waypoint-form">
              <div class="form-group">
                <label for="name">Name</label>
                <input type="text" id="name" name="name" required>
              </div>

              <div class="form-group">
                <label for="type">Type</label>
                <select id="type" name="type" required>
                  <option value="generic">Generic</option>
                  <option value="food">Food</option>
                  <option value="water">Water</option>
                  <option value="shelter">Shelter</option>
                  <option value="transition">Transition</option>
                  <option value="viewpoint">Viewpoint</option>
                  <option value="camping">Camping</option>
                  <option value="parking">Parking</option>
                  <option value="danger">Danger</option>
                  <option value="medical">Medical</option>
                  <option value="fuel">Fuel</option>
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="latitude">Latitude</label>
                  <input type="number" id="latitude" name="latitude" step="any" required>
                </div>
                <div class="form-group">
                  <label for="longitude">Longitude</label>
                  <input type="number" id="longitude" name="longitude" step="any" required>
                </div>
              </div>

              <div class="form-group">
                <label for="altitude">Altitude (m)</label>
                <input type="number" id="altitude" name="altitude" step="any">
              </div>

              <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" rows="3"></textarea>
              </div>

              <div class="form-actions">
                <button type="button" class="cancel-btn">Cancel</button>
                <button type="submit" class="submit-btn">Create Waypoint</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('waypoint-manager-widget', WaypointManagerWidget);
