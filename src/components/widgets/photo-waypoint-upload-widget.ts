import type { WaypointType, PhotoWaypointUploadWidgetElement } from '@/types';
import { waypointService, type PhotoWaypointMetadata } from '@/services/waypoint-service';
import styles from '@/styles/components/widgets/photo-waypoint-upload-widget.css?inline';

interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  camera?: string;
  location?: string;
}

interface PhotoWaypointUploadState {
  isUploading: boolean;
  selectedFile: File | null;
  previewUrl: string | null;
  exifData: ExifData | null;
  detectedLocation: [number, number] | null;
  manualLocation: [number, number] | null;
  waypointName: string;
  waypointType: WaypointType;
  description: string;
  error: string | null;
}

/**
 * Photo Waypoint Upload Widget Web Component
 * Allows users to create waypoints by uploading photos with EXIF location data
 */
export default class PhotoWaypointUploadWidget
  extends HTMLElement
  implements PhotoWaypointUploadWidgetElement
{
  private sessionId: string = '';
  private isVisible = false;
  private state: PhotoWaypointUploadState = {
    isUploading: false,
    selectedFile: null,
    previewUrl: null,
    exifData: null,
    detectedLocation: null,
    manualLocation: null,
    waypointName: '',
    waypointType: 'generic',
    description: '',
    error: null,
  };

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
   * Sets the session ID for waypoint creation
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Shows the photo upload dialog
   */
  show(): void {
    this.isVisible = true;
    const dialog = this.shadowRoot!.querySelector('.upload-dialog') as HTMLElement;
    if (dialog) {
      dialog.style.display = 'block';
    }
  }

  /**
   * Hides the photo upload dialog
   */
  hide(): void {
    this.isVisible = false;
    const dialog = this.shadowRoot!.querySelector('.upload-dialog') as HTMLElement;
    if (dialog) {
      dialog.style.display = 'none';
    }
    this.resetState();
  }

  /**
   * Resets the upload state
   */
  private resetState(): void {
    if (this.state.previewUrl) {
      URL.revokeObjectURL(this.state.previewUrl);
    }

    this.state = {
      isUploading: false,
      selectedFile: null,
      previewUrl: null,
      exifData: null,
      detectedLocation: null,
      manualLocation: null,
      waypointName: '',
      waypointType: 'generic',
      description: '',
      error: null,
    };

    this.updateUI();
  }

  /**
   * Handles file selection
   */
  private async handleFileSelect(file: File): Promise<void> {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.setError('Please select a valid image file');
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.setError('File size must be less than 10MB');
      return;
    }

    this.state.selectedFile = file;
    this.state.error = null;

    // Create preview URL
    if (this.state.previewUrl) {
      URL.revokeObjectURL(this.state.previewUrl);
    }
    this.state.previewUrl = URL.createObjectURL(file);

    // Extract EXIF data (simplified - would use proper EXIF library in real implementation)
    await this.extractExifData(file);

    // Auto-generate waypoint name from filename
    if (!this.state.waypointName) {
      this.state.waypointName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    }

    this.updateUI();
  }

  /**
   * Extracts EXIF data from the image file (simplified implementation)
   */
  private async extractExifData(_file: File): Promise<void> {
    // This is a simplified implementation
    // In a real implementation, you would use a proper EXIF library
    // For now, we'll simulate EXIF data extraction

    try {
      // Simulate EXIF processing delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Simulate some EXIF data (this would be real data from the image)
      const hasGPS = Math.random() > 0.5; // 50% chance of having GPS data

      if (hasGPS) {
        // Simulate GPS coordinates (would be extracted from actual EXIF)
        this.state.exifData = {
          latitude: 47.6062 + (Math.random() - 0.5) * 0.1,
          longitude: -122.3321 + (Math.random() - 0.5) * 0.1,
          timestamp: new Date().toISOString(),
          camera: 'iPhone 12 Pro',
          location: 'Seattle, WA',
        };

        this.state.detectedLocation = [this.state.exifData.latitude, this.state.exifData.longitude];
      } else {
        this.state.exifData = {
          timestamp: new Date().toISOString(),
          camera: 'iPhone 12 Pro',
        };
      }
    } catch (error) {
      console.warn('Failed to extract EXIF data:', error);
      this.state.exifData = null;
    }
  }

  /**
   * Handles the upload process
   */
  private async handleUpload(): Promise<void> {
    if (!this.state.selectedFile || !this.sessionId) {
      this.setError('Missing file or session ID');
      return;
    }

    if (!this.state.waypointName.trim()) {
      this.setError('Please enter a name for the waypoint');
      return;
    }

    this.state.isUploading = true;
    this.state.error = null;
    this.updateUI();

    try {
      // Prepare metadata for the waypoint service
      const metadata: PhotoWaypointMetadata = {
        name: this.state.waypointName.trim(),
        type: this.state.waypointType,
        description: this.state.description.trim(),
        sessionId: this.sessionId,
        manualLocation: this.state.manualLocation
          ? {
              latitude: this.state.manualLocation[0],
              longitude: this.state.manualLocation[1],
            }
          : undefined,
      };

      // Use the waypoint service to create the photo waypoint
      const waypoint = await waypointService.createWaypointFromPhoto(
        this.state.selectedFile,
        metadata
      );

      // Emit success event
      this.dispatchEvent(
        new CustomEvent('waypoint-created', {
          detail: { waypoint },
          bubbles: true,
          composed: true,
        })
      );

      // Hide dialog and reset
      this.hide();
    } catch (error) {
      console.error('Photo waypoint upload failed:', error);
      this.setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      this.state.isUploading = false;
      this.updateUI();
    }
  }

  /**
   * Sets an error message
   */
  private setError(message: string): void {
    this.state.error = message;
    this.updateUI();
  }

  /**
   * Updates the UI based on current state
   */
  private updateUI(): void {
    this.render();
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    this.shadowRoot!.addEventListener('click', this.handleClick.bind(this));
    this.shadowRoot!.addEventListener('change', this.handleChange.bind(this));
    this.shadowRoot!.addEventListener('dragover', this.handleDragOver.bind(this));
    this.shadowRoot!.addEventListener('drop', this.handleDrop.bind(this));
    this.shadowRoot!.addEventListener('submit', this.handleSubmit.bind(this));
  }

  /**
   * Handles click events
   */
  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;

    if (target.classList.contains('close-btn') || target.classList.contains('cancel-btn')) {
      this.hide();
    } else if (target.classList.contains('file-input-trigger')) {
      console.log('!!! CLICK !!!');
      const fileInput = this.shadowRoot!.querySelector('#photo-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    } else if (target.classList.contains('pick-location-btn')) {
      this.handlePickLocation();
    }
  }

  /**
   * Handles change events
   */
  private handleChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

    if (target.id === 'photo-file-input') {
      const files = (target as HTMLInputElement).files;
      if (files && files[0]) {
        this.handleFileSelect(files[0]);
      }
    } else if (target.id === 'waypoint-name') {
      this.state.waypointName = target.value;
    } else if (target.id === 'waypoint-type') {
      this.state.waypointType = target.value as WaypointType;
    } else if (target.id === 'waypoint-description') {
      this.state.description = target.value;
    }
  }

  /**
   * Handles drag over events
   */
  private handleDragOver(event: DragEvent): void {
    event.preventDefault();
    const dropZone = this.shadowRoot!.querySelector('.drop-zone');
    dropZone?.classList.add('drag-over');
  }

  /**
   * Handles drop events
   */
  private handleDrop(event: DragEvent): void {
    event.preventDefault();
    const dropZone = this.shadowRoot!.querySelector('.drop-zone');
    dropZone?.classList.remove('drag-over');

    const files = event.dataTransfer?.files;
    if (files && files[0]) {
      this.handleFileSelect(files[0]);
    }
  }

  /**
   * Handles form submission
   */
  private handleSubmit(event: Event): void {
    event.preventDefault();
    this.handleUpload();
  }

  /**
   * Handles location picking from map
   */
  private handlePickLocation(): void {
    // Hide dialog during map selection
    const dialog = this.shadowRoot!.querySelector('.upload-dialog') as HTMLElement;
    if (dialog) {
      dialog.style.display = 'none';
    }

    // Get map widget and start selection mode
    const mapWidget = document.querySelector('map-widget') as any;
    if (mapWidget && mapWidget.startWaypointSelection) {
      mapWidget.startWaypointSelection();

      // Listen for waypoint selection
      const handleWaypointSelected = (event: CustomEvent) => {
        const { latitude, longitude } = event.detail;
        this.setManualLocation(latitude, longitude);

        // Clean up listener
        mapWidget.removeEventListener('waypoint-selected', handleWaypointSelected);

        // Restore dialog
        if (dialog && this.isVisible) {
          dialog.style.display = 'block';
        }
      };

      mapWidget.addEventListener('waypoint-selected', handleWaypointSelected);
    } else {
      console.warn('Map widget not found or selection not supported');
      this.setError('Map selection not available');

      // Restore dialog on error
      if (dialog && this.isVisible) {
        dialog.style.display = 'block';
      }
    }
  }

  /**
   * Sets manual location coordinates
   */
  setManualLocation(latitude: number, longitude: number): void {
    this.state.manualLocation = [latitude, longitude];
    this.updateUI();
  }

  /**
   * Renders the widget HTML
   */
  private render(): void {
    const displayStyle = this.isVisible ? 'block' : 'none';
    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <div class="upload-dialog" style="display: ${displayStyle};">
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
          <div class="dialog-header">
            <h3>Create Waypoint from Photo</h3>
            <button class="close-btn" type="button">×</button>
          </div>

          <form class="upload-form">
            ${this.renderDropZone()}
            ${this.renderPreview()}
            ${this.renderForm()}
            ${this.renderError()}
            ${this.renderActions()}
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Renders the drop zone area
   */
  private renderDropZone(): string {
    if (this.state.selectedFile) {
      return '';
    }

    return `
      <div class="drop-zone-container">
        <div class="drop-zone">
          <div class="drop-zone-content">
            <div class="drop-zone-icon">📷</div>
            <div class="drop-zone-text">
              <p>Drag and drop a photo here</p>
            </div>
          </div>
        </div>
        <div class="file-select-section">
          <p>or</p>
          <button type="button" class="file-input-trigger">Choose a file</button>
        </div>
        <input type="file" id="photo-file-input" accept="image/*" style="display: none;">
      </div>
    `;
  }

  /**
   * Renders the photo preview and EXIF data
   */
  private renderPreview(): string {
    if (!this.state.selectedFile || !this.state.previewUrl) {
      return '';
    }

    return `
      <div class="photo-preview">
        <div class="preview-image">
          <img src="${this.state.previewUrl}" alt="Photo preview">
        </div>
        <div class="preview-info">
          ${this.renderExifInfo()}
          ${this.renderLocationInfo()}
        </div>
      </div>
    `;
  }

  /**
   * Renders EXIF information
   */
  private renderExifInfo(): string {
    if (!this.state.exifData) {
      return '<p class="no-exif">No metadata available</p>';
    }

    return `
      <div class="exif-info">
        <h4>Photo Information</h4>
        ${this.state.exifData.camera ? `<p><strong>Camera:</strong> ${this.state.exifData.camera}</p>` : ''}
        ${this.state.exifData.timestamp ? `<p><strong>Taken:</strong> ${new Date(this.state.exifData.timestamp).toLocaleString()}</p>` : ''}
        ${this.state.exifData.location ? `<p><strong>Location:</strong> ${this.state.exifData.location}</p>` : ''}
      </div>
    `;
  }

  /**
   * Renders location information
   */
  private renderLocationInfo(): string {
    const hasDetected = this.state.detectedLocation;
    const hasManual = this.state.manualLocation;

    return `
      <div class="location-info">
        <h4>Location</h4>
        ${
          hasDetected
            ? `
          <p class="detected-location">
            <strong>📍 Detected:</strong>
            ${this.state.detectedLocation![0].toFixed(6)}, ${this.state.detectedLocation![1].toFixed(6)}
          </p>
        `
            : '<p class="no-location">⚠️ No GPS data in photo</p>'
        }

        ${
          hasManual
            ? `
          <p class="manual-location">
            <strong>📌 Manual:</strong>
            ${this.state.manualLocation![0].toFixed(6)}, ${this.state.manualLocation![1].toFixed(6)}
          </p>
        `
            : ''
        }

        <button type="button" class="pick-location-btn">
          ${hasManual ? 'Change Location' : 'Pick Location from Map'}
        </button>
      </div>
    `;
  }

  /**
   * Renders the waypoint form fields
   */
  private renderForm(): string {
    if (!this.state.selectedFile) {
      return '';
    }

    return `
      <div class="form-fields">
        <div class="form-group">
          <label for="waypoint-name">Name *</label>
          <input
            type="text"
            id="waypoint-name"
            value="${this.state.waypointName}"
            required
            placeholder="Enter waypoint name"
          >
        </div>

        <div class="form-group">
          <label for="waypoint-type">Type</label>
          <select id="waypoint-type">
            <option value="generic" ${this.state.waypointType === 'generic' ? 'selected' : ''}>Generic</option>
            <option value="food" ${this.state.waypointType === 'food' ? 'selected' : ''}>Food</option>
            <option value="water" ${this.state.waypointType === 'water' ? 'selected' : ''}>Water</option>
            <option value="shelter" ${this.state.waypointType === 'shelter' ? 'selected' : ''}>Shelter</option>
            <option value="viewpoint" ${this.state.waypointType === 'viewpoint' ? 'selected' : ''}>Viewpoint</option>
            <option value="camping" ${this.state.waypointType === 'camping' ? 'selected' : ''}>Camping</option>
            <option value="parking" ${this.state.waypointType === 'parking' ? 'selected' : ''}>Parking</option>
            <option value="danger" ${this.state.waypointType === 'danger' ? 'selected' : ''}>Danger</option>
            <option value="medical" ${this.state.waypointType === 'medical' ? 'selected' : ''}>Medical</option>
            <option value="fuel" ${this.state.waypointType === 'fuel' ? 'selected' : ''}>Fuel</option>
          </select>
        </div>

        <div class="form-group">
          <label for="waypoint-description">Description</label>
          <textarea
            id="waypoint-description"
            rows="3"
            placeholder="Optional description"
          >${this.state.description}</textarea>
        </div>
      </div>
    `;
  }

  /**
   * Renders error message
   */
  private renderError(): string {
    if (!this.state.error) {
      return '';
    }

    return `
      <div class="error-message">
        <p>⚠️ ${this.state.error}</p>
      </div>
    `;
  }

  /**
   * Renders action buttons
   */
  private renderActions(): string {
    if (!this.state.selectedFile) {
      return '';
    }

    return `
      <div class="form-actions">
        <button type="button" class="cancel-btn" ${this.state.isUploading ? 'disabled' : ''}>
          Cancel
        </button>
        <button type="submit" class="submit-btn" ${this.state.isUploading ? 'disabled' : ''}>
          ${this.state.isUploading ? 'Creating Waypoint...' : 'Create Waypoint'}
        </button>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('photo-waypoint-upload-widget', PhotoWaypointUploadWidget);
