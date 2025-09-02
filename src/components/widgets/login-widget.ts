import type { User, LoginWidgetElement } from '@/types';
import { generateUserColor } from '@/utils';
import styles from '@/styles/components/widgets/login-widget.css?inline';

/**
 * Login Widget Web Component
 * Displays user authentication status and provides login/logout functionality
 */
export default class LoginWidget extends HTMLElement implements LoginWidgetElement {
  private user: User | null = null;
  private isAuthenticated: boolean = false;
  private toggleButton!: HTMLElement;
  private authPanel!: HTMLElement;
  private closeButton!: HTMLElement;
  private loginForm!: HTMLElement;
  private userMenu!: HTMLElement;
  private emailInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;
  private loginButton!: HTMLButtonElement;
  private logoutButton!: HTMLButtonElement;
  private errorMessage!: HTMLElement;
  private userName!: HTMLElement;
  private userEmail!: HTMLElement;
  private initialText!: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
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
            <a href="/profile" data-route="/profile" class="username" id="user-name"></a>
            <div class="email" id="user-email"></div>
          </div>
          <ul class="nav-menu">
            <li><a href="/" data-route="/">Home</a></li>
            <li><a href="/u/" data-route="/u/" id="nav-my-map">My Map</a></li>
            <li><a href="/profile" data-route="/profile">Profile</a></li>
            <li><a href="/profile/sessions" data-route="/profile/sessions">Sessions</a></li>
          </ul>
          <button id="logout-button" class="logout-button">Logout</button>
        </div>
      </div>
    `;

    // Get DOM elements
    this.toggleButton = this.shadowRoot!.getElementById('toggle-button')!;
    this.authPanel = this.shadowRoot!.getElementById('auth-panel')!;
    this.closeButton = this.shadowRoot!.getElementById('close-button')!;
    this.loginForm = this.shadowRoot!.getElementById('login-form')!;
    this.userMenu = this.shadowRoot!.getElementById('user-menu')!;
    this.emailInput = this.shadowRoot!.getElementById('email')! as HTMLInputElement;
    this.passwordInput = this.shadowRoot!.getElementById('password')! as HTMLInputElement;
    this.loginButton = this.shadowRoot!.getElementById('login-button')! as HTMLButtonElement;
    this.logoutButton = this.shadowRoot!.getElementById('logout-button')! as HTMLButtonElement;
    this.errorMessage = this.shadowRoot!.getElementById('error-message')!;
    this.userName = this.shadowRoot!.getElementById('user-name')!;
    this.userEmail = this.shadowRoot!.getElementById('user-email')!;
    this.initialText = this.shadowRoot!.querySelector('.initial-text')!;

    this.setupEventListeners();
    this.updateUI();

    // Listen for auth changes
    document.addEventListener('auth-change', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.isAuthenticated = customEvent.detail.isAuthenticated;
      this.user = customEvent.detail.user;
      this.updateUI();
    });
  }

  /**
   * Called when the element is connected to the DOM
   */
  connectedCallback(): void {
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
   */
  private initializeAuthState(): void {
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
   */
  private setupEventListeners(): void {
    this.toggleButton.addEventListener('click', () => {
      this.showPanel();
    });

    this.closeButton.addEventListener('click', () => {
      this.hidePanel();
    });

    this.loginButton.addEventListener('click', (e: Event) => {
      e.preventDefault();
      this.handleLogin();
    });

    this.logoutButton.addEventListener('click', () => {
      this.handleLogout();
    });

    // Allow Enter key to submit login form
    [this.emailInput, this.passwordInput].forEach(input => {
      input.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleLogin();
        }
      });
    });
  }

  showPanel(): void {
    this.authPanel.style.display = 'block';
    this.toggleButton.style.display = 'none';

    if (!this.isAuthenticated) {
      this.emailInput.focus();
    }
  }

  hidePanel(): void {
    this.authPanel.style.display = 'none';
    this.toggleButton.style.display = 'flex';
    this.clearForm();
  }

  clearForm(): void {
    this.emailInput.value = '';
    this.passwordInput.value = '';
    this.errorMessage.textContent = '';
  }

  /**
   * Updates the UI based on current authentication state
   */
  private updateUI(): void {
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
      const navMyMap = this.shadowRoot!.getElementById('nav-my-map') as HTMLAnchorElement;
      if (navMyMap && this.user.username) {
        navMyMap.href = `/u/${this.user.username}`;
        navMyMap.setAttribute('data-route', `/u/${this.user.username}`);
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

  async handleLogin(): Promise<void> {
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
    } catch (error: any) {
      this.showError(error.message || 'Login failed');
    } finally {
      this.loginButton.disabled = false;
      this.loginButton.textContent = 'Login';
    }
  }

  async handleLogout(): Promise<void> {
    try {
      await window.authService.logout();
      this.hidePanel();
    } catch (error: any) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      window.authService.logout();
      this.hidePanel();
    }
  }

  clearButtonContent(): void {
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

  showAvatarImage(avatarFilename: string): void {
    // Construct PocketBase file URL: /api/files/{collection}/{record_id}/{filename}
    const avatarUrl = `/api/files/users/${this.user!.id}/${avatarFilename}`;

    const img = document.createElement('img');
    img.className = 'avatar-image';
    img.src = avatarUrl;
    img.alt = 'User avatar';

    // Handle image loading errors - fallback to initials
    img.onerror = () => {
      img.remove();
      const fallbackText = this.user!.username ? this.user!.username.charAt(0).toUpperCase() : 'U';
      this.showInitialText(fallbackText);
    };

    this.toggleButton.appendChild(img);
  }

  showInitialText(text: string): void {
    if (this.initialText) {
      this.initialText.textContent = text;
      this.initialText.style.display = 'block';
    }
  }

  /**
   * Shows an error message in the login form
   */
  showError(message: string): void {
    this.errorMessage.textContent = message;
  }
}

customElements.define('login-widget', LoginWidget);
