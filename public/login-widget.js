import { generateUserColor } from './utils.js';

/**
 * @typedef {import('../src/types/index.js').User} User
 * @typedef {import('../src/types/index.js').AuthChangeEventDetail} AuthChangeEventDetail
 */

/**
 * Login Widget Web Component
 * Displays user authentication status and provides login/logout functionality
 * @extends {HTMLElement}
 */
export default class LoginWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {User|null} */
    this.user = null;

    /** @type {boolean} */
    this.isAuthenticated = false;

    /** @type {HTMLElement|null} */
    this.toggleButton = null;

    /** @type {HTMLElement|null} */
    this.authPanel = null;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: var(--font-family-base, sans-serif);
        }
        #toggle-button {
          background-color: var(--user-bg-color, var(--color-success));
          color: var(--text-inverse);
          border: none;
          border-radius: var(--border-radius-full);
          width: 40px;
          height: 40px;
          font-size: var(--font-size-large);
          font-weight: var(--font-weight-bold);
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          box-shadow: var(--shadow-heavy);
          text-transform: uppercase;
          padding: var(--spacing-xs);
          box-sizing: border-box;
        }
        #toggle-button .avatar-image {
          width: 30px;
          height: 30px;
          border-radius: var(--border-radius-full);
          object-fit: cover;
          display: block;
        }
        #toggle-button .initial-text {
          display: block;
        }
        #toggle-button.logged-out {
          background-color: var(--color-logged-out);
        }
        #auth-panel {
          display: none;
          background-color: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md) var(--spacing-md);
          box-shadow: var(--shadow-medium);
          margin-top: var(--spacing-sm);
          position: relative;
          min-width: 250px;
        }
        #close-button {
          position: absolute;
          top: var(--spacing-xs);
          right: var(--spacing-sm);
          font-size: 20px;
          cursor: pointer;
          color: var(--text-muted);
        }
        .form-group {
          margin-bottom: var(--spacing-md);
        }
        label {
          display: block;
          margin-bottom: var(--spacing-xs);
          font-weight: var(--font-weight-bold);
          color: var(--text-primary);
        }
        input[type="email"], input[type="password"] {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          box-sizing: border-box;
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        button {
          background-color: var(--color-primary);
          color: var(--text-inverse);
          border: none;
          padding: var(--spacing-sm) var(--spacing-lg);
          border-radius: var(--border-radius-sm);
          cursor: pointer;
          width: 100%;
          font-size: var(--font-size-base);
        }
        button:hover {
          background-color: var(--color-primary-hover);
        }
        button:disabled {
          background-color: var(--color-logged-out);
          cursor: not-allowed;
        }
        .error {
          color: var(--color-danger);
          font-size: var(--font-size-base);
          margin-top: var(--spacing-xs);
        }
        .user-info {
          text-align: center;
          margin-bottom: var(--spacing-md);
        }
        .username {
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-large);
          margin-bottom: var(--spacing-xs);
          color: var(--text-primary);
          text-decoration: none;
          display: block;
        }
        .username:hover {
          color: var(--color-primary);
          text-decoration: underline;
        }
        .email {
          color: var(--text-muted);
          font-size: var(--font-size-base);
        }
        .logout-button {
          background-color: var(--color-danger);
        }
        .logout-button:hover {
          background-color: var(--color-danger-hover);
        }
        .nav-menu {
          list-style: none;
          padding: 0;
          margin: 0 0 var(--spacing-md) 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }
        .nav-menu li {
          margin: 0;
        }
        .nav-menu a {
          display: block;
          padding: var(--spacing-xs) var(--spacing-sm);
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          text-decoration: none;
          border-radius: var(--border-radius-sm);
          border: 1px solid var(--border-light);
          transition: var(--transition-base);
          font-size: var(--font-size-base);
          text-align: center;
        }
        .nav-menu a:hover {
          background-color: var(--color-primary);
          color: var(--text-inverse);
          border-color: var(--color-primary);
        }
      </style>
      <div id="toggle-button" class="logged-out">
        <span class="initial-text">?</span>
      </div>
      <div id="auth-panel">
        <span id="close-button">×</span>
        <div id="login-form">
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" required>
          </div>
          <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" required>
          </div>
          <button id="login-button">Login</button>
          <div id="error-message" class="error"></div>
        </div>
        <div id="user-menu" style="display: none;">
          <div class="user-info">
            <a href="/profile" class="username" id="user-name"></a>
            <div class="email" id="user-email"></div>
          </div>
          <ul class="nav-menu">
            <li><a href="/">Home</a></li>
            <li><a href="/u/" id="nav-my-map">My Map</a></li>
            <li><a href="/profile">Profile</a></li>
            <li><a href="/profile/sessions">Sessions</a></li>
          </ul>
          <button id="logout-button" class="logout-button">Logout</button>
        </div>
      </div>
    `;

    // Get DOM elements
    this.toggleButton = this.shadowRoot.getElementById('toggle-button');
    this.authPanel = this.shadowRoot.getElementById('auth-panel');
    this.closeButton = this.shadowRoot.getElementById('close-button');
    this.loginForm = this.shadowRoot.getElementById('login-form');
    this.userMenu = this.shadowRoot.getElementById('user-menu');
    this.emailInput = this.shadowRoot.getElementById('email');
    this.passwordInput = this.shadowRoot.getElementById('password');
    this.loginButton = this.shadowRoot.getElementById('login-button');
    this.logoutButton = this.shadowRoot.getElementById('logout-button');
    this.errorMessage = this.shadowRoot.getElementById('error-message');
    this.userName = this.shadowRoot.getElementById('user-name');
    this.userEmail = this.shadowRoot.getElementById('user-email');
    this.initialText = this.shadowRoot.querySelector('.initial-text');

    this.setupEventListeners();
    this.updateUI();

    // Listen for auth changes
    document.addEventListener('auth-change', e => {
      this.isAuthenticated = e.detail.isAuthenticated;
      this.user = e.detail.user;
      this.updateUI();
    });
  }

  /**
   * Called when the element is connected to the DOM
   */
  connectedCallback() {
    // Initialize with current auth state
    this.initializeAuthState();

    // Check if we should show panel by default
    if (this.hasAttribute('open-by-default')) {
      setTimeout(() => {
        if (!this.isAuthenticated) {
          this.showPanel();
        }
      }, 100);
    }
  }

  /**
   * Initializes the authentication state from the global auth service
   * @private
   */
  initializeAuthState() {
    if (window.authService) {
      this.isAuthenticated = window.authService.isAuthenticated();
      this.user = window.authService.user;
      this.updateUI();
    } else {
      // Retry after a short delay if AuthService isn't ready yet
      setTimeout(() => this.initializeAuthState(), 10);
    }
  }

  /**
   * Sets up event listeners for UI interactions
   * @private
   */
  setupEventListeners() {
    this.toggleButton.addEventListener('click', () => {
      this.showPanel();
    });

    this.closeButton.addEventListener('click', () => {
      this.hidePanel();
    });

    this.loginButton.addEventListener('click', e => {
      e.preventDefault();
      this.handleLogin();
    });

    this.logoutButton.addEventListener('click', () => {
      this.handleLogout();
    });

    // Allow Enter key to submit login form
    [this.emailInput, this.passwordInput].forEach(input => {
      input.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleLogin();
        }
      });
    });
  }

  showPanel() {
    this.authPanel.style.display = 'block';
    this.toggleButton.style.display = 'none';

    if (!this.isAuthenticated) {
      this.emailInput.focus();
    }
  }

  hidePanel() {
    this.authPanel.style.display = 'none';
    this.toggleButton.style.display = 'flex';
    this.clearForm();
  }

  clearForm() {
    this.emailInput.value = '';
    this.passwordInput.value = '';
    this.errorMessage.textContent = '';
  }

  /**
   * Updates the UI based on current authentication state
   * @private
   */
  updateUI() {
    if (this.isAuthenticated && this.user) {
      // Logged in state
      this.toggleButton.classList.remove('logged-out');

      // Set dynamic background color based on username
      const userColor = generateUserColor(this.user.username);
      if (userColor) {
        this.toggleButton.style.setProperty('--user-bg-color', userColor);
      }

      // Clear any existing content
      this.clearButtonContent();

      // Check if user has an avatar
      if (this.user.avatar) {
        this.showAvatarImage(this.user.avatar);
      } else {
        this.showInitialText(this.user.username ? this.user.username.charAt(0).toUpperCase() : 'U');
      }

      this.loginForm.style.display = 'none';
      this.userMenu.style.display = 'block';

      this.userName.textContent = this.user.username || 'User';
      this.userEmail.textContent = this.user.email || '';

      // Update navigation links
      const navMyMap = this.shadowRoot.getElementById('nav-my-map');
      if (navMyMap && this.user.username) {
        navMyMap.href = `/u/${this.user.username}`;
      }
    } else {
      // Logged out state
      this.toggleButton.classList.add('logged-out');

      // Clear the dynamic color variable (falls back to logged-out gray)
      this.toggleButton.style.removeProperty('--user-bg-color');

      this.clearButtonContent();
      this.showInitialText('?');

      this.loginForm.style.display = 'block';
      this.userMenu.style.display = 'none';
    }
  }

  async handleLogin() {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    if (!email || !password) {
      this.showError('Please enter both email and password');
      return;
    }

    this.loginButton.disabled = true;
    this.loginButton.textContent = 'Logging in...';
    this.errorMessage.textContent = '';

    try {
      await window.authService.login(email, password);
      this.hidePanel();
    } catch (error) {
      this.showError(error.message || 'Login failed');
    } finally {
      this.loginButton.disabled = false;
      this.loginButton.textContent = 'Login';
    }
  }

  async handleLogout() {
    try {
      await window.authService.logout();
      this.hidePanel();
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      window.authService.logout();
      this.hidePanel();
    }
  }

  clearButtonContent() {
    // Remove any existing avatar images
    const existingAvatar = this.toggleButton.querySelector('.avatar-image');
    if (existingAvatar) {
      existingAvatar.remove();
    }

    // Hide initial text
    if (this.initialText) {
      this.initialText.style.display = 'none';
    }
  }

  showAvatarImage(avatarFilename) {
    // Construct PocketBase file URL: /api/files/{collection}/{record_id}/{filename}
    const avatarUrl = `/api/files/users/${this.user.id}/${avatarFilename}`;

    const img = document.createElement('img');
    img.className = 'avatar-image';
    img.src = avatarUrl;
    img.alt = 'User avatar';

    // Handle image loading errors - fallback to initials
    img.onerror = () => {
      img.remove();
      const fallbackText = this.user.username ? this.user.username.charAt(0).toUpperCase() : 'U';
      this.showInitialText(fallbackText);
    };

    this.toggleButton.appendChild(img);
  }

  showInitialText(text) {
    if (this.initialText) {
      this.initialText.textContent = text;
      this.initialText.style.display = 'block';
    }
  }

  /**
   * Shows an error message in the login form
   * @param {string} message - The error message to display
   */
  showError(message) {
    this.errorMessage.textContent = message;
  }
}

customElements.define('login-widget', LoginWidget);
