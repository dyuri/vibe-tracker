import type { GpxUploadWidgetElement } from '@/types';
import styles from '@/styles/components/widgets/gpx-upload-widget.css?inline';

/**
 * GPX Upload Widget Web Component
 * Handles GPX file upload with progress tracking and validation
 */
export default class GpxUploadWidget extends HTMLElement implements GpxUploadWidgetElement {
  private selectedFile: File | null = null;
  private fileSelectedCallback: ((file: File) => void) | null = null;
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
   * Sets callback for when a file is selected
   */
  onFileSelected(callback: (file: File) => void): void {
    this.fileSelectedCallback = callback;
  }

  /**
   * Shows upload progress
   */
  showUploadProgress(progress: number): void {
    const progressBar = this.shadowRoot!.querySelector('.progress-bar') as HTMLElement;
    const progressFill = this.shadowRoot!.querySelector('.progress-fill') as HTMLElement;
    const progressText = this.shadowRoot!.querySelector('.progress-text') as HTMLElement;
    const uploadButton = this.shadowRoot!.querySelector('.upload-btn') as HTMLButtonElement;

    progressBar.style.display = 'block';
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Uploading... ${Math.round(progress)}%`;
    uploadButton.disabled = true;
    uploadButton.textContent = 'Uploading...';
  }

  /**
   * Shows upload success message
   */
  showUploadSuccess(message: string): void {
    const statusDiv = this.shadowRoot!.querySelector('.upload-status') as HTMLElement;
    const progressBar = this.shadowRoot!.querySelector('.progress-bar') as HTMLElement;
    const uploadButton = this.shadowRoot!.querySelector('.upload-btn') as HTMLButtonElement;

    progressBar.style.display = 'none';
    statusDiv.innerHTML = `<div class="success-message">✅ ${message}</div>`;
    uploadButton.disabled = false;
    uploadButton.textContent = 'Upload GPX';

    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      statusDiv.innerHTML = '';
    }, 5000);
  }

  /**
   * Shows upload error message
   */
  showUploadError(error: string): void {
    const statusDiv = this.shadowRoot!.querySelector('.upload-status') as HTMLElement;
    const progressBar = this.shadowRoot!.querySelector('.progress-bar') as HTMLElement;
    const uploadButton = this.shadowRoot!.querySelector('.upload-btn') as HTMLButtonElement;

    progressBar.style.display = 'none';
    statusDiv.innerHTML = `<div class="error-message">❌ ${error}</div>`;
    uploadButton.disabled = false;
    uploadButton.textContent = 'Upload GPX';
  }

  /**
   * Resets the widget to initial state
   */
  reset(): void {
    this.selectedFile = null;
    const fileInput = this.shadowRoot!.querySelector('#gpx-file-input') as HTMLInputElement;
    const fileName = this.shadowRoot!.querySelector('.file-name') as HTMLElement;
    const uploadButton = this.shadowRoot!.querySelector('.upload-btn') as HTMLButtonElement;
    const statusDiv = this.shadowRoot!.querySelector('.upload-status') as HTMLElement;
    const progressBar = this.shadowRoot!.querySelector('.progress-bar') as HTMLElement;
    const fileInfo = this.shadowRoot!.querySelector('.file-info') as HTMLElement;

    fileInput.value = '';
    fileName.textContent = 'No file selected';
    uploadButton.disabled = true;
    uploadButton.textContent = 'Upload GPX';
    statusDiv.innerHTML = '';
    progressBar.style.display = 'none';
    fileInfo.style.display = 'none';
  }

  /**
   * Validates GPX file
   */
  private validateGpxFile(file: File): { isValid: boolean; error?: string } {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { isValid: false, error: 'File size must be less than 5MB' };
    }

    // Check file extension
    const validExtensions = ['.gpx', '.xml'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return { isValid: false, error: 'Please select a valid GPX file (.gpx or .xml)' };
    }

    // Check MIME type
    const validMimeTypes = ['application/gpx+xml', 'text/xml', 'application/xml', 'text/plain'];

    if (!validMimeTypes.includes(file.type) && file.type !== '') {
      return { isValid: false, error: 'Invalid file type. Please select a GPX file.' };
    }

    return { isValid: true };
  }

  /**
   * Formats file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Updates file info display
   */
  private updateFileInfo(file: File): void {
    const fileInfo = this.shadowRoot!.querySelector('.file-info') as HTMLElement;
    const fileName = this.shadowRoot!.querySelector('.file-name') as HTMLElement;
    const fileSize = this.shadowRoot!.querySelector('.file-size') as HTMLElement;
    const fileType = this.shadowRoot!.querySelector('.file-type') as HTMLElement;

    fileName.textContent = file.name;
    fileSize.textContent = this.formatFileSize(file.size);
    fileType.textContent = file.type || 'Unknown';
    fileInfo.style.display = 'block';
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    const fileInput = this.shadowRoot!.querySelector('#gpx-file-input') as HTMLInputElement;
    const dropZone = this.shadowRoot!.querySelector('.drop-zone') as HTMLElement;
    const uploadButton = this.shadowRoot!.querySelector('.upload-btn') as HTMLButtonElement;
    const clearButton = this.shadowRoot!.querySelector('.clear-btn') as HTMLButtonElement;

    // File input change
    fileInput.addEventListener('change', event => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        this.handleFileSelection(target.files[0]);
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', event => {
      event.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', event => {
      event.preventDefault();
      dropZone.classList.remove('drag-over');

      const files = event.dataTransfer?.files;
      if (files && files[0]) {
        this.handleFileSelection(files[0]);
        fileInput.files = files;
      }
    });

    // Click on drop zone to open file picker
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    // Upload button
    uploadButton.addEventListener('click', () => {
      if (this.selectedFile) {
        this.handleUpload();
      }
    });

    // Clear button
    clearButton.addEventListener('click', () => {
      this.reset();
    });
  }

  /**
   * Handles file selection
   */
  private handleFileSelection(file: File): void {
    const validation = this.validateGpxFile(file);
    const statusDiv = this.shadowRoot!.querySelector('.upload-status') as HTMLElement;
    const uploadButton = this.shadowRoot!.querySelector('.upload-btn') as HTMLButtonElement;

    if (!validation.isValid) {
      statusDiv.innerHTML = `<div class="error-message">❌ ${validation.error}</div>`;
      uploadButton.disabled = true;
      return;
    }

    this.selectedFile = file;
    this.updateFileInfo(file);
    uploadButton.disabled = false;
    statusDiv.innerHTML = '';

    // Notify callback
    if (this.fileSelectedCallback) {
      this.fileSelectedCallback(file);
    }
  }

  /**
   * Handles file upload
   */
  private async handleUpload(): Promise<void> {
    if (!this.selectedFile) {
      return;
    }

    try {
      this.showUploadProgress(0);

      // Get current session info from session management widget
      const sessionInfo = this.getCurrentSession();
      if (!sessionInfo) {
        this.showUploadError('No active session. Please select a session first.');
        return;
      }

      await this.uploadGpxFile(this.selectedFile, sessionInfo);
    } catch (error) {
      console.error('Upload failed:', error);
      this.showUploadError('Upload failed. Please try again.');
    }
  }

  /**
   * Uploads GPX file to the server
   */
  private async uploadGpxFile(file: File, sessionInfo: any): Promise<void> {
    // Get auth token
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Create form data
    const formData = new FormData();
    formData.append('gpx_file', file);

    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    // Set up progress tracking
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        this.showUploadProgress(Math.round(percentComplete));
      }
    };

    // Create promise for the upload
    const uploadPromise = new Promise<any>((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (_error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.message || `HTTP ${xhr.status}: Upload failed`));
          } catch (_error) {
            reject(new Error(`HTTP ${xhr.status}: Upload failed`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload timeout'));
      };
    });

    // Start the upload
    const uploadUrl = `/api/sessions/${sessionInfo.username}/${sessionInfo.sessionName}/gpx`;
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 60000; // 60 second timeout
    xhr.send(formData);

    // Wait for upload to complete
    const response = await uploadPromise;

    this.showUploadSuccess(
      `GPX track "${response.data?.track_name || file.name}" uploaded successfully!`
    );

    // Dispatch success event with response data
    this.dispatchEvent(
      new CustomEvent('gpx-uploaded', {
        detail: {
          file,
          response: response.data,
          sessionInfo,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Gets current session information from parent session management widget
   */
  private getCurrentSession(): { username: string; sessionName: string; sessionId: string } | null {
    // Try to find the current session data from the session management widget
    const sessionManagementWidget = document.querySelector('session-management-widget') as any;
    if (sessionManagementWidget && sessionManagementWidget.getCurrentSession) {
      return sessionManagementWidget.getCurrentSession();
    }

    // Fallback: try to get from URL or other sources
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) {
      return null;
    }

    // Try to extract session name from URL
    const pathParts = window.location.pathname.split('/');
    const userIndex = pathParts.findIndex(part => part === user.username);
    if (userIndex !== -1 && pathParts[userIndex + 1]) {
      return {
        username: user.username,
        sessionName: pathParts[userIndex + 1],
        sessionId: pathParts[userIndex + 1], // For now, using session name as ID
      };
    }

    return null;
  }

  /**
   * Renders the widget HTML
   */
  private render(): void {
    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <div class="gpx-upload-widget">
        <div class="upload-header">
          <h3>📁 Upload GPX Track</h3>
          <p>Upload a GPX file to add a planned route to your session</p>
        </div>

        <div class="drop-zone">
          <div class="drop-zone-content">
            <div class="upload-icon">📁</div>
            <div class="drop-zone-text">
              <strong>Drop your GPX file here</strong>
              <br>or click to select a file
            </div>
            <div class="file-requirements">
              Supports .gpx and .xml files (max 5MB)
            </div>
          </div>
          <input type="file" id="gpx-file-input" accept=".gpx,.xml,application/gpx+xml,text/xml,application/xml" hidden>
        </div>

        <div class="file-info" style="display: none;">
          <div class="file-details">
            <div class="file-detail">
              <span class="label">Name:</span>
              <span class="file-name">No file selected</span>
            </div>
            <div class="file-detail">
              <span class="label">Size:</span>
              <span class="file-size">-</span>
            </div>
            <div class="file-detail">
              <span class="label">Type:</span>
              <span class="file-type">-</span>
            </div>
          </div>
        </div>

        <div class="progress-bar" style="display: none;">
          <div class="progress-fill"></div>
          <div class="progress-text">Preparing upload...</div>
        </div>

        <div class="upload-actions">
          <button class="upload-btn" disabled>Upload GPX</button>
          <button class="clear-btn">Clear</button>
        </div>

        <div class="upload-status"></div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('gpx-upload-widget', GpxUploadWidget);
