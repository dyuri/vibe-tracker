import type {
  WaypointsResponse,
  WaypointFeature,
  WaypointType,
  PositionConfidence,
  CreateWaypointRequest,
  WaypointManagerWidgetElement,
  PhotoWaypointUploadWidgetElement,
} from '@/types';
import { waypointService } from '@/services/waypoint-service';
import styles from '@/styles/components/widgets/waypoint-manager-widget.css?inline';

// Import the photo upload widget
import './photo-waypoint-upload-widget';

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
  private isLoading: boolean = false;
  private errorMessage: string = '';
  private isSelectingFromMap: boolean = false;
  private editingWaypointId: string | null = null;
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
   * Loads waypoints from provided data (optimized - no API call)
   */
  loadWaypointsFromData(sessionId: string, waypointsData: WaypointsResponse): void {
    this.sessionId = sessionId;
    this.waypoints = waypointsData.features || [];
    this.updateWaypointsList();
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
    this.editingWaypointId = null; // Reset editing mode
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
   * Shows the photo upload dialog
   */
  showPhotoUploadDialog(): void {
    const photoWidget = this.shadowRoot!.querySelector(
      'photo-waypoint-upload-widget'
    ) as PhotoWaypointUploadWidgetElement;
    if (photoWidget) {
      photoWidget.setSessionId(this.sessionId);
      photoWidget.show();
    }
  }

  /**
   * Fetches waypoints from the API
   */
  private async fetchWaypoints(): Promise<void> {
    console.log('fetchWaypoints called with sessionId:', this.sessionId);

    if (!this.sessionId) {
      console.warn('No session ID provided for waypoint fetch');
      return;
    }

    this.setLoading(true);
    this.clearError();

    try {
      console.log('About to call waypointService.getWaypoints with sessionId:', this.sessionId);
      const response = await waypointService.getWaypoints(this.sessionId);
      console.log('waypointService.getWaypoints response:', response);
      console.log('response.features:', response.features);
      console.log('response.features length:', response.features?.length);

      this.waypoints = response.features || [];
      console.log('Set this.waypoints to:', this.waypoints);
      console.log('this.waypoints length:', this.waypoints.length);

      this.updateWaypointsList();
      console.log('Called updateWaypointsList()');
    } catch (error) {
      console.error('Failed to fetch waypoints:', error);
      this.setError('Failed to load waypoints. Please try again.');
      this.waypoints = [];
      this.updateWaypointsList();
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Updates the waypoints list display
   */
  private updateWaypointsList(): void {
    const container = this.shadowRoot!.querySelector('.waypoints-list') as HTMLElement;

    if (this.isLoading) {
      container.innerHTML = '<div class="loading">Loading waypoints...</div>';
      return;
    }

    if (this.errorMessage) {
      container.innerHTML = `<div class="error">${this.errorMessage}</div>`;
      return;
    }

    if (this.waypoints.length === 0) {
      const noWaypointsMessage = this.sessionId
        ? 'No waypoints found for this session'
        : 'Select a session to view waypoints';
      container.innerHTML = `<div class="no-waypoints">${noWaypointsMessage}</div>`;
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
            <button class="action-btn center-btn" data-action="center" data-waypoint-id="${waypoint.properties.id}" data-lat="${coords[1]}" data-lng="${coords[0]}" title="Center on map">
              🎯
            </button>
            <button class="action-btn edit-btn" data-action="edit" data-waypoint-id="${waypoint.properties.id}" title="Edit waypoint">
              ✏️
            </button>
            <button class="action-btn delete-btn" data-action="delete" data-waypoint-id="${waypoint.properties.id}" title="Delete waypoint">
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
    const overlay = this.shadowRoot!.querySelector('.form-overlay') as HTMLElement;

    if (this.showingCreateForm) {
      overlay.style.display = 'flex';
    } else {
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
      // Remove photo display if present
      const photoDisplay = form.querySelector('.waypoint-photo-display');
      if (photoDisplay) {
        photoDisplay.remove();
      }
    }
    this.editingWaypointId = null;

    // Reset form title and button text
    const formTitle = this.shadowRoot!.querySelector('.form-header h4');
    if (formTitle) {
      formTitle.textContent = 'Create New Waypoint';
    }

    const submitBtn = this.shadowRoot!.querySelector('.submit-btn') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.textContent = 'Create Waypoint';
    }
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    this.shadowRoot!.addEventListener('click', this.handleClick.bind(this));
    this.shadowRoot!.addEventListener('submit', this.handleFormSubmit.bind(this));
    this.shadowRoot!.addEventListener('change', this.handleChange.bind(this));

    // Set up photo upload widget event listeners
    this.setupPhotoUploadListeners();
  }

  /**
   * Sets up event listeners for the photo upload widget
   */
  private setupPhotoUploadListeners(): void {
    const photoWidget = this.shadowRoot!.querySelector(
      'photo-waypoint-upload-widget'
    ) as PhotoWaypointUploadWidgetElement;

    if (photoWidget) {
      // Listen for successful waypoint creation from photo
      photoWidget.addEventListener('waypoint-created', (event: CustomEvent) => {
        console.log('Photo waypoint created:', event.detail);

        // Refresh the waypoints list to show the new photo waypoint
        this.fetchWaypoints();

        // Emit the same event up to parent components (like map widget)
        this.dispatchEvent(
          new CustomEvent('waypoint-created', {
            detail: event.detail,
            bubbles: true,
          })
        );
      });

      // Listen for location picking requests
      photoWidget.addEventListener('pick-location', (_event: CustomEvent) => {
        console.log('Photo widget requesting location pick');

        // Forward the pick-location event to parent components
        this.dispatchEvent(
          new CustomEvent('pick-location-for-photo', {
            bubbles: true,
            composed: true,
          })
        );
      });
    }
  }

  /**
   * Sets manual location for photo waypoint (called from map integration)
   */
  setPhotoWaypointLocation(latitude: number, longitude: number): void {
    const photoWidget = this.shadowRoot!.querySelector(
      'photo-waypoint-upload-widget'
    ) as PhotoWaypointUploadWidgetElement;
    if (photoWidget) {
      photoWidget.setManualLocation(latitude, longitude);
    }
  }

  /**
   * Handles click events
   */
  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;

    if (target.classList.contains('add-waypoint-btn')) {
      this.showCreateForm();
    } else if (target.classList.contains('add-photo-waypoint-btn')) {
      this.showPhotoUploadDialog();
    } else if (
      target.classList.contains('cancel-btn') ||
      target.classList.contains('form-overlay')
    ) {
      this.hideCreateForm();
    } else if (target.dataset.action === 'center') {
      this.handleCenterOnMap(
        parseFloat(target.dataset.lat!),
        parseFloat(target.dataset.lng!),
        target.dataset.waypointId!
      );
    } else if (target.dataset.action === 'edit') {
      this.handleEditWaypoint(target.dataset.waypointId!);
    } else if (target.dataset.action === 'delete') {
      this.handleDeleteWaypoint(target.dataset.waypointId!);
    } else if (target.classList.contains('pick-from-map-btn')) {
      this.handlePickFromMap();
    } else if (target.classList.contains('cancel-map-selection-btn')) {
      this.handleCancelMapSelection();
    }
  }

  /**
   * Handles change events
   */
  private handleChange(_event: Event): void {
    // No change handlers currently needed
  }

  /**
   * Handles form submission
   */
  private async handleFormSubmit(event: Event): Promise<void> {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    // Validate session ID
    if (!this.sessionId) {
      this.setError('No session selected. Please select a session first.');
      return;
    }

    // Validate required fields
    const name = formData.get('name') as string;
    const type = formData.get('type') as WaypointType;
    const latStr = formData.get('latitude') as string;
    const lngStr = formData.get('longitude') as string;

    if (!name?.trim()) {
      this.setError('Name is required.');
      return;
    }

    if (!type) {
      this.setError('Type is required.');
      return;
    }

    if (!latStr || !lngStr) {
      this.setError(
        'Coordinates are required. Please enter latitude and longitude or pick from map.'
      );
      return;
    }

    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lngStr);

    if (isNaN(latitude) || isNaN(longitude)) {
      this.setError('Invalid coordinates. Please enter valid numbers.');
      return;
    }

    if (latitude < -90 || latitude > 90) {
      this.setError('Latitude must be between -90 and 90.');
      return;
    }

    if (longitude < -180 || longitude > 180) {
      this.setError('Longitude must be between -180 and 180.');
      return;
    }

    const waypointData: CreateWaypointRequest = {
      name: name.trim(),
      type: type,
      description: (formData.get('description') as string)?.trim() || undefined,
      latitude: latitude,
      longitude: longitude,
      session_id: this.sessionId,
      source: 'manual',
      position_confidence: 'manual',
    };

    try {
      if (this.editingWaypointId) {
        await this.updateWaypoint(this.editingWaypointId, waypointData);
      } else {
        await this.createWaypoint(waypointData);
      }
      this.hideCreateForm();
    } catch (error) {
      console.error('Form submission failed:', error);
    }
  }

  /**
   * Creates a new waypoint
   */
  private async createWaypoint(data: CreateWaypointRequest): Promise<void> {
    this.setLoading(true);
    this.clearError();

    try {
      const waypoint = await waypointService.createWaypoint(data);
      console.log('Created waypoint:', waypoint);

      // Re-fetch all waypoints to ensure consistency
      await this.fetchWaypoints();

      // Emit event to notify other components (like map widget)
      this.dispatchEvent(
        new CustomEvent('waypoint-created', {
          detail: { waypoint },
          bubbles: true,
        })
      );
    } catch (error) {
      console.error('Failed to create waypoint:', error);
      this.setError('Failed to create waypoint. Please try again.');
      throw error; // Re-throw to handle in form submission
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Updates an existing waypoint
   */
  private async updateWaypoint(waypointId: string, data: CreateWaypointRequest): Promise<void> {
    this.setLoading(true);
    this.clearError();

    try {
      const updatedWaypoint = await waypointService.updateWaypoint(waypointId, data);
      console.log('Updated waypoint:', updatedWaypoint);

      // Re-fetch all waypoints to ensure consistency
      await this.fetchWaypoints();

      // Emit event to notify other components (like map widget)
      this.dispatchEvent(
        new CustomEvent('waypoint-updated', {
          detail: { waypoint: updatedWaypoint },
          bubbles: true,
        })
      );
    } catch (error) {
      console.error('Failed to update waypoint:', error);
      this.setError('Failed to update waypoint. Please try again.');
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Handles editing a waypoint
   */
  private handleEditWaypoint(waypointId: string): void {
    const waypoint = this.waypoints.find(w => w.properties.id === waypointId);
    if (waypoint) {
      // Show form first (without resetting editing ID)
      this.showingCreateForm = true;
      this.updateFormDisplay();
      // Then populate form with existing data
      this.populateFormForEdit(waypoint);
    }
  }

  /**
   * Populates the form for editing
   */
  private populateFormForEdit(waypoint: WaypointFeature): void {
    this.editingWaypointId = waypoint.properties.id;
    const form = this.shadowRoot!.querySelector('#waypoint-form') as HTMLFormElement;
    const formData = waypoint.properties;
    const coords = waypoint.geometry.coordinates;

    (form.querySelector('[name="name"]') as HTMLInputElement).value = formData.name;
    (form.querySelector('[name="type"]') as HTMLSelectElement).value = formData.type;
    (form.querySelector('[name="description"]') as HTMLTextAreaElement).value =
      formData.description || '';
    (form.querySelector('[name="latitude"]') as HTMLInputElement).value = coords[1].toString();
    (form.querySelector('[name="longitude"]') as HTMLInputElement).value = coords[0].toString();

    // Update form title
    const formTitle = this.shadowRoot!.querySelector('.form-header h4');
    if (formTitle) {
      formTitle.textContent = 'Edit Waypoint';
    }

    // Update submit button text
    const submitBtn = this.shadowRoot!.querySelector('.submit-btn') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.textContent = 'Update Waypoint';
    }

    // Display photo if available
    this.displayWaypointPhoto(waypoint);
  }

  /**
   * Displays waypoint photo in the edit form
   */
  private displayWaypointPhoto(waypoint: WaypointFeature): void {
    const photo = waypoint.properties.photo;
    const form = this.shadowRoot!.querySelector('#waypoint-form') as HTMLFormElement;

    // Remove existing photo display if any
    const existingPhotoDisplay = form.querySelector('.waypoint-photo-display');
    if (existingPhotoDisplay) {
      existingPhotoDisplay.remove();
    }

    // Add photo display if waypoint has a photo
    if (photo) {
      const photoUrl = `/api/files/waypoints/${waypoint.properties.id}/${photo}`;
      const thumbnailUrl = `${photoUrl}?thumb=200x200`;

      const photoDisplay = document.createElement('div');
      photoDisplay.className = 'waypoint-photo-display';
      photoDisplay.innerHTML = `
        <div class="form-group">
          <label>Photo</label>
          <div class="photo-preview">
            <a href="${photoUrl}" target="_blank" rel="noopener noreferrer">
              <img src="${thumbnailUrl}" alt="${waypoint.properties.name}" />
            </a>
          </div>
        </div>
      `;

      // Insert after the type field
      const typeGroup = form.querySelector('[name="type"]')?.closest('.form-group');
      if (typeGroup) {
        typeGroup.after(photoDisplay);
      }
    }
  }

  /**
   * Handles deleting a waypoint
   */
  private async handleDeleteWaypoint(waypointId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this waypoint?')) {
      try {
        await this.deleteWaypoint(waypointId);
        // No need to refresh as deleteWaypoint already updates the UI
      } catch (error) {
        // Error already handled in deleteWaypoint method
        console.error('Delete operation failed:', error);
      }
    }
  }

  /**
   * Centers the map on a waypoint's location
   */
  private handleCenterOnMap(latitude: number, longitude: number, waypointId: string): void {
    // Dispatch event to center map on waypoint location
    this.dispatchEvent(
      new CustomEvent('center-on-waypoint', {
        detail: { latitude, longitude, waypointId },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Deletes a waypoint
   */
  private async deleteWaypoint(waypointId: string): Promise<void> {
    this.setLoading(true);
    this.clearError();

    try {
      await waypointService.deleteWaypoint(waypointId);
      console.log('Deleted waypoint:', waypointId);

      // Re-fetch all waypoints to ensure consistency
      await this.fetchWaypoints();

      // Emit event to notify other components (like map widget)
      this.dispatchEvent(
        new CustomEvent('waypoint-deleted', {
          detail: { waypointId },
          bubbles: true,
        })
      );
    } catch (error) {
      console.error('Failed to delete waypoint:', error);
      this.setError('Failed to delete waypoint. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Sets loading state
   */
  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.updateWaypointsList();

    // Disable form buttons during loading
    const submitBtn = this.shadowRoot!.querySelector('.submit-btn') as HTMLButtonElement;
    const addBtn = this.shadowRoot!.querySelector('.add-waypoint-btn') as HTMLButtonElement;
    const addPhotoBtn = this.shadowRoot!.querySelector(
      '.add-photo-waypoint-btn'
    ) as HTMLButtonElement;

    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Creating...' : 'Create Waypoint';
    }

    if (addBtn) {
      addBtn.disabled = loading;
    }

    if (addPhotoBtn) {
      addPhotoBtn.disabled = loading;
    }
  }

  /**
   * Sets error message
   */
  private setError(message: string): void {
    this.errorMessage = message;
    this.updateWaypointsList();

    // Auto-clear error after 5 seconds
    setTimeout(() => {
      if (this.errorMessage === message) {
        this.clearError();
      }
    }, 5000);
  }

  /**
   * Clears error message
   */
  private clearError(): void {
    this.errorMessage = '';
    this.updateWaypointsList();
  }

  /**
   * Handle "Pick from Map" button click
   */
  private handlePickFromMap(): void {
    this.isSelectingFromMap = true;
    this.updatePickFromMapUI();

    // Hide form overlay during map selection
    const overlay = this.shadowRoot!.querySelector('.form-overlay') as HTMLElement;

    if (overlay) {
      overlay.style.display = 'none';
    }

    // Get map widget and start selection mode
    const mapWidget = document.querySelector('map-widget') as any;
    if (mapWidget && mapWidget.startWaypointSelection) {
      mapWidget.startWaypointSelection();

      // Listen for waypoint selection
      const handleWaypointSelected = (event: CustomEvent) => {
        const { latitude, longitude } = event.detail;
        this.handleMapSelection(latitude, longitude);

        // Clean up listener
        mapWidget.removeEventListener('waypoint-selected', handleWaypointSelected);

        // Restore form overlay
        if (overlay) {
          overlay.style.display = 'flex';
        }
      };

      mapWidget.addEventListener('waypoint-selected', handleWaypointSelected);
    } else {
      console.warn('Map widget not found or selection not supported');
      this.setError('Map selection not available');
      this.isSelectingFromMap = false;
      this.updatePickFromMapUI();

      // Restore form overlay on error
      if (overlay) {
        overlay.style.display = 'flex';
      }
    }
  }

  /**
   * Handle canceling map selection
   */
  private handleCancelMapSelection(): void {
    this.isSelectingFromMap = false;
    this.updatePickFromMapUI();

    // Stop map selection mode
    const mapWidget = document.querySelector('map-widget') as any;
    if (mapWidget && mapWidget.stopWaypointSelection) {
      mapWidget.stopWaypointSelection();
    }

    // Restore form overlay
    const overlay = this.shadowRoot!.querySelector('.form-overlay') as HTMLElement;

    if (overlay) {
      overlay.style.display = 'flex';
    }
  }

  /**
   * Handle coordinates selected from map
   */
  private handleMapSelection(latitude: number, longitude: number): void {
    // Update form fields with selected coordinates
    const latInput = this.shadowRoot!.querySelector('[name="latitude"]') as HTMLInputElement;
    const lngInput = this.shadowRoot!.querySelector('[name="longitude"]') as HTMLInputElement;

    if (latInput) {
      latInput.value = latitude.toFixed(6);
    }
    if (lngInput) {
      lngInput.value = longitude.toFixed(6);
    }

    // Exit map selection mode
    this.isSelectingFromMap = false;
    this.updatePickFromMapUI();

    // Stop map selection mode
    const mapWidget = document.querySelector('map-widget') as any;
    if (mapWidget && mapWidget.stopWaypointSelection) {
      mapWidget.stopWaypointSelection();
    }

    console.log('Selected waypoint coordinates from map:', latitude, longitude);
  }

  /**
   * Update Pick from Map UI state
   */
  private updatePickFromMapUI(): void {
    const pickBtn = this.shadowRoot!.querySelector('.pick-from-map-btn') as HTMLButtonElement;
    const cancelBtn = this.shadowRoot!.querySelector(
      '.cancel-map-selection-btn'
    ) as HTMLButtonElement;
    const coordinateInputs = this.shadowRoot!.querySelectorAll(
      '.coordinate-input'
    ) as NodeListOf<HTMLInputElement>;

    if (pickBtn) {
      pickBtn.style.display = this.isSelectingFromMap ? 'none' : 'inline-block';
      pickBtn.disabled = this.isSelectingFromMap;
    }

    if (cancelBtn) {
      cancelBtn.style.display = this.isSelectingFromMap ? 'inline-block' : 'none';
    }

    // Disable coordinate inputs during map selection
    coordinateInputs.forEach(input => {
      input.disabled = this.isSelectingFromMap;
      if (this.isSelectingFromMap) {
        input.placeholder = 'Select from map...';
      } else {
        input.placeholder = '';
      }
    });
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
          <div class="header-controls">
            <button class="add-waypoint-btn">+ Add Waypoint</button>
            <button class="add-photo-waypoint-btn">📷 Add from Photo</button>
          </div>
        </div>

        <div class="waypoints-list">
          <div class="no-session">Select a session to view waypoints</div>
        </div>

        <div class="form-overlay overlay" style="display: none;">
          <div class="create-form overlay-content overlay-md">
            <div class="form-header overlay-header">
              <h4>Add Waypoint</h4>
              <button type="button" class="cancel-btn overlay-close">×</button>
            </div>

            <form id="waypoint-form">
              <div class="form-container overlay-body">
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

                <div class="coordinates-section">
                  <div class="coordinates-header">
                    <h5>Location</h5>
                    <div class="coordinate-actions">
                      <button type="button" class="pick-from-map-btn">📍 Pick from Map</button>
                      <button type="button" class="cancel-map-selection-btn" style="display: none;">Cancel Selection</button>
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="latitude">Latitude</label>
                      <input type="number" class="coordinate-input" id="latitude" name="latitude" step="any" required>
                    </div>
                    <div class="form-group">
                      <label for="longitude">Longitude</label>
                      <input type="number" class="coordinate-input" id="longitude" name="longitude" step="any" required>
                    </div>
                  </div>
                </div>

                <div class="form-group">
                  <label for="description">Description</label>
                  <textarea id="description" name="description" rows="3"></textarea>
                </div>
              </div>

              <div class="form-actions overlay-footer">
                <button type="button" class="cancel-btn">Cancel</button>
                <button type="submit" class="submit-btn">Create Waypoint</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Photo Waypoint Upload Widget -->
        <photo-waypoint-upload-widget></photo-waypoint-upload-widget>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('waypoint-manager-widget', WaypointManagerWidget);
