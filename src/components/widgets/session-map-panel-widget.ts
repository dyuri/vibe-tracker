import styles from '@/styles/components/widgets/session-map-panel-widget.css?inline';

// Import widgets
import './chart-widget';
import './track-comparison-widget';
import './gpx-upload-widget';
import './waypoint-manager-widget';

import type {
  SessionMapPanelWidgetElement,
  ChartWidgetElement,
  TrackComparisonWidgetElement,
  WaypointManagerWidgetElement,
  LocationsResponse,
  LocationResponse,
  GpxTrackPointsResponse,
  WaypointsResponse,
  User,
} from '@/types/dom';

interface TabConfig {
  id: string;
  label: string;
  visible: (isOwner: boolean, hasSession: boolean) => boolean;
  component: string;
}

interface SessionData {
  username: string;
  sessionName: string;
  sessionId: string;
  title?: string;
  description?: string;
  public?: boolean;
  created?: string;
  updated?: string;
  gpx_track?: string;
  track_name?: string;
  track_description?: string;
}

interface LocationControls {
  watchId: number | null;
  wakeLockSentinel: WakeLockSentinel | null;
}

export default class SessionMapPanelWidget
  extends HTMLElement
  implements SessionMapPanelWidgetElement
{
  private currentUser: User | null = null;
  private currentSessionData: SessionData | null = null;
  private currentLocationData: LocationsResponse | null = null;
  private activeTab: string = 'overview';
  private isCollapsed: boolean = false;
  private locationControls: LocationControls = {
    watchId: null,
    wakeLockSentinel: null,
  };

  // Tab configuration
  private tabs: TabConfig[] = [
    {
      id: 'overview',
      label: 'Overview',
      visible: () => true, // Always visible for controls and location data
      component: 'session-overview',
    },
    {
      id: 'chart',
      label: 'Chart',
      visible: (_, hasSession) => hasSession,
      component: 'chart-display',
    },
    {
      id: 'comparison',
      label: 'Comparison',
      visible: (_, hasSession) => hasSession,
      component: 'track-comparison',
    },
    {
      id: 'edit',
      label: 'Edit',
      visible: (isOwner, hasSession) => isOwner && hasSession,
      component: 'session-edit',
    },
    {
      id: 'gpx',
      label: 'GPX Track',
      visible: (isOwner, hasSession) => isOwner && hasSession,
      component: 'gpx-upload',
    },
    {
      id: 'waypoints',
      label: 'Waypoints',
      visible: (isOwner, hasSession) => isOwner && hasSession,
      component: 'waypoint-manager',
    },
    {
      id: 'profile',
      label: 'Profile',
      visible: () => true, // Always visible (global tab)
      component: 'profile-panel',
    },
  ];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
    this.setupEventListeners();
  }

  connectedCallback(): void {
    // Listen for auth changes
    document.addEventListener('auth-change', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.currentUser = customEvent.detail.user;
      this.updateTabVisibility();
      this.updateProfileTab();
    });

    // Initialize auth state
    if (window.authService) {
      this.currentUser = window.authService.user;
      this.updateProfileTab();
    }
  }

  /**
   * Set session data and update the interface
   */
  setSessionData(sessionData: SessionData): void {
    this.currentSessionData = sessionData;
    this.updateTabVisibility();
    this.updateSessionOverview();

    // If no active tab is visible, switch to first visible tab
    if (!this.isTabVisible(this.activeTab)) {
      const firstVisibleTab = this.getVisibleTabs()[0];
      if (firstVisibleTab) {
        this.switchTab(firstVisibleTab.id);
      }
    }
  }

  /**
   * Display location data (used by chart and comparison widgets)
   */
  displayData(data: LocationsResponse | LocationResponse): void {
    this.currentLocationData = data.type === 'FeatureCollection' ? data : null;

    // Pass data to chart widget
    const chartWidget = this.shadowRoot!.querySelector('chart-widget') as ChartWidgetElement;
    if (chartWidget) {
      chartWidget.displayData(data);
    }

    // Update comparison widget if it has location data
    this.updateTrackComparison();
  }

  /**
   * Display GPX track data
   */
  displayGpxTrack(data: GpxTrackPointsResponse): void {
    // Update comparison widget with GPX data
    const comparisonWidget = this.shadowRoot!.querySelector(
      'track-comparison-widget'
    ) as TrackComparisonWidgetElement;
    if (comparisonWidget) {
      comparisonWidget.setPlannedTrack(data);
    }
  }

  /**
   * Display waypoints data
   */
  displayWaypoints(_data: WaypointsResponse): void {
    // Pass to waypoint manager if it exists
    const waypointWidget = this.shadowRoot!.querySelector(
      'waypoint-manager-widget'
    ) as WaypointManagerWidgetElement;
    if (waypointWidget) {
      waypointWidget.loadWaypoints(this.currentSessionData?.sessionId || '');
    }
  }

  /**
   * Highlight a point (used by map-chart interaction)
   */
  highlightPoint(index: number): void {
    const chartWidget = this.shadowRoot!.querySelector('chart-widget') as ChartWidgetElement;
    if (chartWidget) {
      chartWidget.highlightPoint(index);
    }
  }

  /**
   * Clear highlighted point
   */
  clearHighlight(): void {
    const chartWidget = this.shadowRoot!.querySelector('chart-widget') as ChartWidgetElement;
    if (chartWidget) {
      chartWidget.clearHighlight();
    }
  }

  private render(): void {
    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <div class="session-map-panel ${this.isCollapsed ? 'collapsed' : ''}">
        <div class="panel-header">
          <div class="panel-tabs" id="panel-tabs">
            <!-- Tabs will be rendered dynamically -->
          </div>
          <div class="panel-controls">
            <button class="collapse-btn" id="collapse-btn">
              ${this.isCollapsed ? '↑' : '↓'}
            </button>
          </div>
        </div>
        <div class="panel-content" id="panel-content">
          <!-- Overview Tab -->
          <div class="tab-content active" data-tab="overview">
            <div class="session-overview">
              <div class="overview-stats" id="overview-stats">
                <div class="no-session-message">
                  <p>Welcome to Vibe Tracker</p>
                  <p class="subtitle">Use the controls below to manage location tracking and display settings</p>
                </div>
              </div>

              <!-- Location Controls Section -->
              <div class="location-controls-section">
                <h5>Location & Display Controls</h5>
                <div class="controls-grid">
                  <label class="control-item">
                    <input type="checkbox" id="overview-refresh-checkbox">
                    <span>Auto Refresh</span>
                  </label>
                  <label class="control-item">
                    <input type="checkbox" id="overview-show-position-checkbox">
                    <span>Show My Position</span>
                  </label>
                  <label class="control-item">
                    <input type="checkbox" id="overview-dark-theme-checkbox">
                    <span>Dark Theme</span>
                  </label>
                  <label class="control-item">
                    <input type="checkbox" id="overview-dark-map-checkbox">
                    <span>Dark Map</span>
                  </label>
                  <label class="control-item">
                    <input type="checkbox" id="overview-wake-lock-checkbox">
                    <span>Wake Lock</span>
                  </label>
                </div>
              </div>

              <!-- Location Data Display -->
              <div class="location-data-section" id="overview-location-data">
                <h5>Location Data</h5>
                <div class="location-properties" id="overview-location-content">
                  <p class="no-data">Select a point on the map to view location details</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Chart Tab -->
          <div class="tab-content" data-tab="chart">
            <chart-widget></chart-widget>
          </div>

          <!-- Track Comparison Tab -->
          <div class="tab-content" data-tab="comparison">
            <track-comparison-widget></track-comparison-widget>
          </div>

          <!-- Session Edit Tab -->
          <div class="tab-content" data-tab="edit">
            <div class="session-edit">
              <h4>Edit Session</h4>
              <form id="edit-session-form" class="session-edit-form">
                <div class="form-group">
                  <label for="edit-session-title">Session Title</label>
                  <input type="text" id="edit-session-title" placeholder="e.g., Morning Run 2024">
                </div>

                <div class="form-group">
                  <label for="edit-session-description">Description</label>
                  <textarea id="edit-session-description" placeholder="Optional description..."></textarea>
                </div>

                <div class="form-group">
                  <div class="checkbox-group">
                    <input type="checkbox" id="edit-session-public">
                    <label for="edit-session-public">Make this session public</label>
                  </div>
                </div>

                <div class="form-actions">
                  <button type="submit" class="btn-primary">Save Changes</button>
                  <button type="button" class="btn-secondary" id="cancel-edit-btn">Cancel</button>
                </div>

                <div id="edit-form-message"></div>
              </form>
            </div>
          </div>

          <!-- GPX Track Tab -->
          <div class="tab-content" data-tab="gpx">
            <gpx-upload-widget></gpx-upload-widget>
          </div>

          <!-- Waypoints Tab -->
          <div class="tab-content" data-tab="waypoints">
            <waypoint-manager-widget></waypoint-manager-widget>
          </div>

          <!-- Profile Tab -->
          <div class="tab-content" data-tab="profile">
            <div class="profile-panel">
              <div id="profile-login-form" class="profile-login-section">
                <h4>Login</h4>
                <form class="login-form">
                  <div class="form-group">
                    <label for="profile-email">Email:</label>
                    <input type="email" id="profile-email" required>
                  </div>
                  <div class="form-group">
                    <label for="profile-password">Password:</label>
                    <input type="password" id="profile-password" required>
                  </div>
                  <button type="button" id="profile-login-btn" class="btn-primary">Login</button>
                  <div id="profile-error-message" class="error-message"></div>
                </form>
              </div>

              <div id="profile-user-menu" class="profile-user-section hidden">
                <div class="user-info-card">
                  <div class="user-avatar" id="profile-user-avatar">
                    <span class="user-initial" id="profile-user-initial">?</span>
                  </div>
                  <div class="user-details">
                    <h4 id="profile-user-name" class="username"></h4>
                    <div id="profile-user-email" class="email"></div>
                  </div>
                  <button id="profile-logout-btn" class="btn-secondary logout-button">Logout</button>
                </div>

                <div class="navigation-menu">
                  <h5>Navigation</h5>
                  <ul class="nav-menu">
                    <li><a href="/" data-route="/">Home</a></li>
                    <li><a href="/u/" data-route="/u/" id="profile-nav-my-map">My Map</a></li>
                    <li><a href="/profile" data-route="/profile">Profile</a></li>
                    <li><a href="/profile/sessions" data-route="/profile/sessions">Sessions</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.updateTabVisibility();
    this.updateSessionOverview();
  }

  private setupEventListeners(): void {
    // Tab switching
    this.shadowRoot!.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tab-btn')) {
        const tabId = target.dataset.tab;
        if (tabId) {
          this.switchTab(tabId);
        }
      }
    });

    // Collapse/expand
    const collapseBtn = this.shadowRoot!.getElementById('collapse-btn');
    collapseBtn?.addEventListener('click', () => {
      this.toggleCollapse();
    });

    // Session edit form
    const editForm = this.shadowRoot!.getElementById('edit-session-form') as HTMLFormElement;
    editForm?.addEventListener('submit', (e: Event) => {
      this.handleEditSubmit(e);
    });

    const cancelBtn = this.shadowRoot!.getElementById('cancel-edit-btn');
    cancelBtn?.addEventListener('click', () => {
      this.cancelEdit();
    });

    // Profile tab authentication
    const profileLoginBtn = this.shadowRoot!.getElementById('profile-login-btn');
    profileLoginBtn?.addEventListener('click', () => {
      this.handleProfileLogin();
    });

    const profileLogoutBtn = this.shadowRoot!.getElementById('profile-logout-btn');
    profileLogoutBtn?.addEventListener('click', () => {
      this.handleProfileLogout();
    });

    // Allow Enter key to submit profile login form
    const profileEmailInput = this.shadowRoot!.getElementById('profile-email') as HTMLInputElement;
    const profilePasswordInput = this.shadowRoot!.getElementById(
      'profile-password'
    ) as HTMLInputElement;
    [profileEmailInput, profilePasswordInput].forEach(input => {
      input?.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleProfileLogin();
        }
      });
    });

    // Location controls event listeners
    this.setupLocationControls();

    // Forward chart events
    const chartWidget = this.shadowRoot!.querySelector('chart-widget') as ChartWidgetElement;
    if (chartWidget) {
      chartWidget.addEventListener('chart-hover', (e: Event) => {
        this.dispatchEvent(new CustomEvent('chart-hover', { detail: (e as CustomEvent).detail }));
      });
      chartWidget.addEventListener('chart-hover-out', (e: Event) => {
        this.dispatchEvent(
          new CustomEvent('chart-hover-out', { detail: (e as CustomEvent).detail })
        );
      });
      chartWidget.addEventListener('chart-click', (e: Event) => {
        this.dispatchEvent(new CustomEvent('chart-click', { detail: (e as CustomEvent).detail }));
      });
    }
  }

  private updateTabVisibility(): void {
    const tabsContainer = this.shadowRoot!.getElementById('panel-tabs');
    if (!tabsContainer) {
      return;
    }

    const visibleTabs = this.getVisibleTabs();

    // Render visible tabs
    tabsContainer.innerHTML = visibleTabs
      .map(
        tab => `
        <button class="tab-btn ${tab.id === this.activeTab ? 'active' : ''}"
                data-tab="${tab.id}">
          ${tab.label}
        </button>
      `
      )
      .join('');

    // Always show the panel - it contains global controls even without session
    const panel = this.shadowRoot!.querySelector('.session-map-panel') as HTMLElement;
    if (panel) {
      panel.style.display = 'block';
    }
  }

  private getVisibleTabs(): TabConfig[] {
    const isOwner = this.isSessionOwner();
    const hasSession = !!this.currentSessionData;

    return this.tabs.filter(tab => tab.visible(isOwner, hasSession));
  }

  private isTabVisible(tabId: string): boolean {
    return this.getVisibleTabs().some(tab => tab.id === tabId);
  }

  private isSessionOwner(): boolean {
    if (!this.currentUser || !this.currentSessionData) {
      return false;
    }
    return this.currentUser.username === this.currentSessionData.username;
  }

  private switchTab(tabId: string): void {
    this.activeTab = tabId;

    // Update tab buttons
    this.shadowRoot!.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tabId);
    });

    // Update tab content
    this.shadowRoot!.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', (content as HTMLElement).dataset.tab === tabId);
    });

    // Load data for specific tabs
    if (tabId === 'comparison') {
      this.updateTrackComparison();
    }
  }

  private toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    const panel = this.shadowRoot!.querySelector('.session-map-panel') as HTMLElement;
    const collapseBtn = this.shadowRoot!.getElementById('collapse-btn') as HTMLElement;

    panel.classList.toggle('collapsed', this.isCollapsed);
    collapseBtn.textContent = this.isCollapsed ? '↑' : '↓';
  }

  private updateSessionOverview(): void {
    const overviewStats = this.shadowRoot!.getElementById('overview-stats');
    if (!overviewStats) {
      return;
    }

    if (!this.currentSessionData) {
      // No session loaded - show welcome message
      overviewStats.innerHTML = `
        <div class="no-session-message">
          <p>Welcome to Vibe Tracker</p>
          <p class="subtitle">Use the controls below to manage location tracking and display settings</p>
        </div>
      `;
      return;
    }

    // Session loaded - show session details
    const {
      sessionName,
      title,
      description,
      created,
      updated,
      public: isPublic,
      track_name,
    } = this.currentSessionData;

    overviewStats.innerHTML = `
      <div class="overview-grid">
        <div class="overview-card">
          <h4>Session Information</h4>
          <div class="info-row">
            <span class="label">Name:</span>
            <span class="value">${sessionName}</span>
          </div>
          ${
            title
              ? `
            <div class="info-row">
              <span class="label">Title:</span>
              <span class="value">${title}</span>
            </div>
          `
              : ''
          }
          ${
            description
              ? `
            <div class="info-row">
              <span class="label">Description:</span>
              <span class="value">${description}</span>
            </div>
          `
              : ''
          }
          <div class="info-row">
            <span class="label">Visibility:</span>
            <span class="value ${isPublic ? 'public' : 'private'}">${isPublic ? 'Public' : 'Private'}</span>
          </div>
        </div>

        <div class="overview-card">
          <h4>Session Details</h4>
          ${
            created
              ? `
            <div class="info-row">
              <span class="label">Created:</span>
              <span class="value">${new Date(created).toLocaleDateString()}</span>
            </div>
          `
              : ''
          }
          ${
            updated
              ? `
            <div class="info-row">
              <span class="label">Updated:</span>
              <span class="value">${new Date(updated).toLocaleDateString()}</span>
            </div>
          `
              : ''
          }
          ${
            track_name
              ? `
            <div class="info-row">
              <span class="label">GPX Track:</span>
              <span class="value">✅ ${track_name}</span>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  private updateTrackComparison(): void {
    const comparisonWidget = this.shadowRoot!.querySelector(
      'track-comparison-widget'
    ) as TrackComparisonWidgetElement;
    if (!comparisonWidget) {
      return;
    }

    // Set actual track data if available
    if (this.currentLocationData) {
      comparisonWidget.setActualTrack(this.currentLocationData);
    }
  }

  private async handleEditSubmit(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.currentSessionData) {
      return;
    }

    const form = e.target as HTMLFormElement;
    const _formData = new FormData(form);
    const title = (
      this.shadowRoot!.getElementById('edit-session-title') as HTMLInputElement
    ).value.trim();
    const description = (
      this.shadowRoot!.getElementById('edit-session-description') as HTMLTextAreaElement
    ).value.trim();
    const isPublic = (this.shadowRoot!.getElementById('edit-session-public') as HTMLInputElement)
      .checked;

    try {
      const response = await fetch(
        `/api/sessions/${this.currentSessionData.username}/${this.currentSessionData.sessionName}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({ title, description, public: isPublic }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update session: ${response.statusText}`);
      }

      // Update current session data
      this.currentSessionData.title = title;
      this.currentSessionData.description = description;
      this.currentSessionData.public = isPublic;

      // Update overview display
      this.updateSessionOverview();

      // Show success message
      this.showEditMessage('Session updated successfully!', 'success');
    } catch (error: any) {
      this.showEditMessage(error.message || 'Failed to update session', 'error');
    }
  }

  private cancelEdit(): void {
    if (!this.currentSessionData) {
      return;
    }

    // Reset form fields
    (this.shadowRoot!.getElementById('edit-session-title') as HTMLInputElement).value =
      this.currentSessionData.title || '';
    (this.shadowRoot!.getElementById('edit-session-description') as HTMLTextAreaElement).value =
      this.currentSessionData.description || '';
    (this.shadowRoot!.getElementById('edit-session-public') as HTMLInputElement).checked =
      this.currentSessionData.public || false;

    // Clear message
    this.showEditMessage('', '');
  }

  private showEditMessage(message: string, type: string): void {
    const messageElement = this.shadowRoot!.getElementById('edit-form-message');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.className = type;

      if (message && type === 'success') {
        setTimeout(() => {
          messageElement.textContent = '';
          messageElement.className = '';
        }, 3000);
      }
    }
  }

  /**
   * Update the Profile tab based on authentication state
   */
  private updateProfileTab(): void {
    const loginSection = this.shadowRoot!.getElementById('profile-login-form');
    const userSection = this.shadowRoot!.getElementById('profile-user-menu');

    if (!loginSection || !userSection) {
      return;
    }

    if (this.currentUser) {
      // User is logged in - show user menu
      loginSection.classList.add('hidden');
      userSection.classList.remove('hidden');

      // Update user info
      this.updateProfileUserInfo();
    } else {
      // User is logged out - show login form
      loginSection.classList.remove('hidden');
      userSection.classList.add('hidden');

      // Clear any login form data
      this.clearProfileForm();
    }
  }

  /**
   * Update user information in the Profile tab
   */
  private updateProfileUserInfo(): void {
    if (!this.currentUser) {
      return;
    }

    const userName = this.shadowRoot!.getElementById('profile-user-name');
    const userEmail = this.shadowRoot!.getElementById('profile-user-email');
    const userInitial = this.shadowRoot!.getElementById('profile-user-initial');
    const userAvatar = this.shadowRoot!.getElementById('profile-user-avatar');
    const navMyMap = this.shadowRoot!.getElementById('profile-nav-my-map') as HTMLAnchorElement;

    if (userName) {
      userName.textContent = this.currentUser.username || 'User';
    }
    if (userEmail) {
      userEmail.textContent = this.currentUser.email || '';
    }
    if (userInitial) {
      userInitial.textContent = this.currentUser.username
        ? this.currentUser.username.charAt(0).toUpperCase()
        : 'U';
    }

    // Update navigation link
    if (navMyMap && this.currentUser.username) {
      navMyMap.href = `/u/${this.currentUser.username}`;
      navMyMap.setAttribute('data-route', `/u/${this.currentUser.username}`);
    }

    // Handle avatar if available
    if (userAvatar && this.currentUser.avatar) {
      // Clear existing avatar image
      const existingImg = userAvatar.querySelector('.avatar-image');
      if (existingImg) {
        existingImg.remove();
      }

      const avatarUrl = `/api/files/users/${this.currentUser.id}/${this.currentUser.avatar}`;
      const img = document.createElement('img');
      img.className = 'avatar-image';
      img.src = avatarUrl;
      img.alt = 'User avatar';

      img.onerror = () => {
        img.remove();
        if (userInitial) {
          userInitial.style.display = 'block';
        }
      };

      img.onload = () => {
        if (userInitial) {
          userInitial.style.display = 'none';
        }
      };

      userAvatar.appendChild(img);
    }

    // Set dynamic background color for avatar based on username
    if (userAvatar && this.currentUser.username) {
      const userColor = this.generateUserColor(this.currentUser.username);
      if (userColor) {
        userAvatar.style.setProperty('--user-bg-color', userColor);
      }
    }
  }

  /**
   * Handle profile login
   */
  private async handleProfileLogin(): Promise<void> {
    const emailInput = this.shadowRoot!.getElementById('profile-email') as HTMLInputElement;
    const passwordInput = this.shadowRoot!.getElementById('profile-password') as HTMLInputElement;
    const loginBtn = this.shadowRoot!.getElementById('profile-login-btn') as HTMLButtonElement;
    const errorMessage = this.shadowRoot!.getElementById('profile-error-message');

    if (!emailInput || !passwordInput) {
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      this.showProfileError('Please enter both email and password');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    if (errorMessage) {
      errorMessage.textContent = '';
    }

    try {
      await window.authService.login(email, password);
      // Auth change event will trigger updateProfileTab
    } catch (error: any) {
      this.showProfileError(error.message || 'Login failed');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  }

  /**
   * Handle profile logout
   */
  private async handleProfileLogout(): Promise<void> {
    try {
      await window.authService.logout();
      // Auth change event will trigger updateProfileTab
    } catch (error: any) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      window.authService.logout();
    }
  }

  /**
   * Clear profile login form
   */
  private clearProfileForm(): void {
    const emailInput = this.shadowRoot!.getElementById('profile-email') as HTMLInputElement;
    const passwordInput = this.shadowRoot!.getElementById('profile-password') as HTMLInputElement;
    const errorMessage = this.shadowRoot!.getElementById('profile-error-message');

    if (emailInput) {
      emailInput.value = '';
    }
    if (passwordInput) {
      passwordInput.value = '';
    }
    if (errorMessage) {
      errorMessage.textContent = '';
    }
  }

  /**
   * Show error message in profile tab
   */
  private showProfileError(message: string): void {
    const errorMessage = this.shadowRoot!.getElementById('profile-error-message');
    if (errorMessage) {
      errorMessage.textContent = message;
    }
  }

  /**
   * Generate user color based on username (copied from login-widget utils)
   */
  private generateUserColor(username: string): string {
    // Simple hash function to generate consistent color
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      const char = username.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Generate HSL color with good saturation and lightness
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Setup location controls event listeners and state
   */
  private setupLocationControls(): void {
    // Auto refresh control
    const refreshCheckbox = this.shadowRoot!.getElementById(
      'overview-refresh-checkbox'
    ) as HTMLInputElement;
    refreshCheckbox?.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      localStorage.setItem('refresh-enabled', target.checked.toString());
      const event = new CustomEvent('refresh-change', {
        detail: { checked: target.checked },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);
    });

    // Show position control
    const showPositionCheckbox = this.shadowRoot!.getElementById(
      'overview-show-position-checkbox'
    ) as HTMLInputElement;
    showPositionCheckbox?.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      localStorage.setItem('show-position-enabled', target.checked.toString());
      if (target.checked) {
        this.locationControls.watchId = navigator.geolocation.watchPosition(
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
        if (this.locationControls.watchId) {
          navigator.geolocation.clearWatch(this.locationControls.watchId);
          this.locationControls.watchId = null;
          const event = new CustomEvent('hide-current-position', {
            bubbles: true,
            composed: true,
          });
          this.dispatchEvent(event);
        }
      }
    });

    // Dark theme control
    const darkThemeCheckbox = this.shadowRoot!.getElementById(
      'overview-dark-theme-checkbox'
    ) as HTMLInputElement;
    darkThemeCheckbox?.addEventListener('change', (e: Event) => {
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

    // Dark map control
    const darkMapCheckbox = this.shadowRoot!.getElementById(
      'overview-dark-map-checkbox'
    ) as HTMLInputElement;
    darkMapCheckbox?.addEventListener('change', (e: Event) => {
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

    // Wake lock control
    const wakeLockCheckbox = this.shadowRoot!.getElementById(
      'overview-wake-lock-checkbox'
    ) as HTMLInputElement;
    wakeLockCheckbox?.addEventListener('change', async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        try {
          this.locationControls.wakeLockSentinel = await navigator.wakeLock.request('screen');
          this.locationControls.wakeLockSentinel.addEventListener('release', () => {
            console.log('Wake Lock was released');
            wakeLockCheckbox.checked = false;
          });
          console.log('Wake Lock is active');
        } catch (err: any) {
          console.error(`${err.name}, ${err.message}`);
          wakeLockCheckbox.checked = false;
        }
      } else {
        if (this.locationControls.wakeLockSentinel) {
          this.locationControls.wakeLockSentinel.release();
          this.locationControls.wakeLockSentinel = null;
          console.log('Wake Lock was released manually');
        }
      }
    });

    // Initialize control states from localStorage
    this.initializeLocationControlStates();
  }

  /**
   * Initialize location control states from localStorage
   */
  private initializeLocationControlStates(): void {
    // Auto refresh
    const refreshCheckbox = this.shadowRoot!.getElementById(
      'overview-refresh-checkbox'
    ) as HTMLInputElement;
    const savedRefresh = localStorage.getItem('refresh-enabled');
    if (savedRefresh !== null && refreshCheckbox) {
      refreshCheckbox.checked = savedRefresh === 'true';
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

    // Show position
    const showPositionCheckbox = this.shadowRoot!.getElementById(
      'overview-show-position-checkbox'
    ) as HTMLInputElement;
    const savedShowPosition = localStorage.getItem('show-position-enabled');
    if (savedShowPosition !== null && showPositionCheckbox) {
      showPositionCheckbox.checked = savedShowPosition === 'true';
      showPositionCheckbox.dispatchEvent(new Event('change'));
    }

    // Dark theme
    const darkThemeCheckbox = this.shadowRoot!.getElementById(
      'overview-dark-theme-checkbox'
    ) as HTMLInputElement;
    if (darkThemeCheckbox) {
      const initializeThemeCheckbox = () => {
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

      initializeThemeCheckbox();
      setTimeout(initializeThemeCheckbox, 100);

      // Listen for theme changes from other sources
      document.addEventListener('theme-change', (e: Event) => {
        const customEvent = e as CustomEvent;
        darkThemeCheckbox.checked = customEvent.detail.theme === 'dark';
      });
    }

    // Dark map
    const darkMapCheckbox = this.shadowRoot!.getElementById(
      'overview-dark-map-checkbox'
    ) as HTMLInputElement;
    const savedDarkMap = localStorage.getItem('dark-map-enabled');
    if (savedDarkMap !== null && darkMapCheckbox) {
      darkMapCheckbox.checked = savedDarkMap === 'true';
      const mapWidget = document.querySelector('map-widget');
      if (mapWidget) {
        if (darkMapCheckbox.checked) {
          mapWidget.setAttribute('data-map-theme', 'dark');
        } else {
          mapWidget.removeAttribute('data-map-theme');
        }
      }
    }
  }

  /**
   * Update location data display (replaces location-widget functionality)
   */
  updateLocationData(feature: any): void {
    const locationContent = this.shadowRoot!.getElementById('overview-location-content');
    if (!locationContent) {
      return;
    }

    // Clear existing content
    locationContent.innerHTML = '';

    if (feature && feature.properties) {
      const { speed, heart_rate, timestamp, session, session_title } = feature.properties;
      const altitude = feature.geometry.coordinates[2];
      const sessionDisplay =
        session_title && session_title !== session
          ? `${session_title} (${session})`
          : session || 'N/A';

      this.showLocationProperty(
        locationContent,
        'Time',
        new Date(timestamp * 1000).toLocaleString()
      );
      this.showLocationProperty(locationContent, 'Session', sessionDisplay);
      this.showLocationProperty(locationContent, 'Altitude', `${altitude.toFixed(2)} m`);
      this.showLocationProperty(locationContent, 'Speed', `${speed.toFixed(2)} km/h`);
      this.showLocationProperty(locationContent, 'Heart Rate', `${heart_rate} bpm`);
    } else {
      locationContent.innerHTML =
        '<p class="no-data">Select a point on the map to view location details</p>';
    }
  }

  /**
   * Display a location property in the Overview tab
   */
  private showLocationProperty(container: HTMLElement, label: string, value: string): void {
    const property = document.createElement('div');
    property.classList.add('location-property');
    property.innerHTML = `<span class="label">${label}:</span> <span class="value">${value}</span>`;
    container.appendChild(property);
  }

  /**
   * Cleanup location controls when element is removed
   */
  disconnectedCallback(): void {
    if (this.locationControls.watchId) {
      navigator.geolocation.clearWatch(this.locationControls.watchId);
      this.locationControls.watchId = null;
    }

    if (this.locationControls.wakeLockSentinel) {
      this.locationControls.wakeLockSentinel.release();
      this.locationControls.wakeLockSentinel = null;
      console.log('Wake Lock was released on disconnect');
    }
  }
}

// Register the custom element
customElements.define('session-map-panel-widget', SessionMapPanelWidget);
