import { generateUserColor } from './utils.js';

export default class LoginWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.user = null;
    this.isAuthenticated = false;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: sans-serif;
        }
        #toggle-button {
          background-color: var(--user-bg-color, #28a745);
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          font-size: 16px;
          font-weight: bold;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          text-transform: uppercase;
        }
        #toggle-button.logged-out {
          background-color: #6c757d;
        }
        #auth-panel {
          display: none;
          background-color: white;
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 25px 25px 15px 15px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          margin-top: 10px;
          position: relative;
          min-width: 250px;
        }
        #close-button {
          position: absolute;
          top: 5px;
          right: 10px;
          font-size: 20px;
          cursor: pointer;
          color: #888;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        input[type="email"], input[type="password"] {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
        }
        button {
          background-color: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
        }
        button:hover {
          background-color: #0056b3;
        }
        button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        .error {
          color: #dc3545;
          font-size: 14px;
          margin-top: 5px;
        }
        .user-info {
          text-align: center;
          margin-bottom: 15px;
        }
        .username {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 5px;
        }
        .email {
          color: #666;
          font-size: 14px;
        }
        .logout-button {
          background-color: #dc3545;
        }
        .logout-button:hover {
          background-color: #c82333;
        }
      </style>
      <div id="toggle-button" class="logged-out">?</div>
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
            <div class="username" id="user-name"></div>
            <div class="email" id="user-email"></div>
          </div>
          <button id="logout-button" class="logout-button">Logout</button>
        </div>
      </div>
    `;

    // Get DOM elements
    this.toggleButton = this.shadowRoot.getElementById("toggle-button");
    this.authPanel = this.shadowRoot.getElementById("auth-panel");
    this.closeButton = this.shadowRoot.getElementById("close-button");
    this.loginForm = this.shadowRoot.getElementById("login-form");
    this.userMenu = this.shadowRoot.getElementById("user-menu");
    this.emailInput = this.shadowRoot.getElementById("email");
    this.passwordInput = this.shadowRoot.getElementById("password");
    this.loginButton = this.shadowRoot.getElementById("login-button");
    this.logoutButton = this.shadowRoot.getElementById("logout-button");
    this.errorMessage = this.shadowRoot.getElementById("error-message");
    this.userName = this.shadowRoot.getElementById("user-name");
    this.userEmail = this.shadowRoot.getElementById("user-email");

    this.setupEventListeners();
    this.updateUI();

    // Listen for auth changes
    document.addEventListener('auth-change', (e) => {
      this.isAuthenticated = e.detail.isAuthenticated;
      this.user = e.detail.user;
      this.updateUI();
    });
  }

  connectedCallback() {
    // Initialize with current auth state
    if (window.authService) {
      this.isAuthenticated = window.authService.isAuthenticated();
      this.user = window.authService.user;
      this.updateUI();
    }
  }

  setupEventListeners() {
    this.toggleButton.addEventListener("click", () => {
      this.showPanel();
    });

    this.closeButton.addEventListener("click", () => {
      this.hidePanel();
    });

    this.loginButton.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    this.logoutButton.addEventListener("click", () => {
      this.handleLogout();
    });

    // Allow Enter key to submit login form
    [this.emailInput, this.passwordInput].forEach(input => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.handleLogin();
        }
      });
    });
  }

  showPanel() {
    this.authPanel.style.display = "block";
    this.toggleButton.style.display = "none";
    
    if (!this.isAuthenticated) {
      this.emailInput.focus();
    }
  }

  hidePanel() {
    this.authPanel.style.display = "none";
    this.toggleButton.style.display = "flex";
    this.clearForm();
  }

  clearForm() {
    this.emailInput.value = "";
    this.passwordInput.value = "";
    this.errorMessage.textContent = "";
  }

  updateUI() {
    if (this.isAuthenticated && this.user) {
      // Logged in state
      this.toggleButton.textContent = this.user.username ? this.user.username.charAt(0).toUpperCase() : "U";
      this.toggleButton.classList.remove("logged-out");
      
      // Set dynamic background color based on username
      const userColor = generateUserColor(this.user.username);
      if (userColor) {
        this.toggleButton.style.setProperty('--user-bg-color', userColor);
      }
      
      this.loginForm.style.display = "none";
      this.userMenu.style.display = "block";
      
      this.userName.textContent = this.user.username || "User";
      this.userEmail.textContent = this.user.email || "";
    } else {
      // Logged out state
      this.toggleButton.textContent = "?";
      this.toggleButton.classList.add("logged-out");
      
      // Clear the dynamic color variable (falls back to logged-out gray)
      this.toggleButton.style.removeProperty('--user-bg-color');
      
      this.loginForm.style.display = "block";
      this.userMenu.style.display = "none";
    }
  }

  async handleLogin() {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    if (!email || !password) {
      this.showError("Please enter both email and password");
      return;
    }

    this.loginButton.disabled = true;
    this.loginButton.textContent = "Logging in...";
    this.errorMessage.textContent = "";

    try {
      await window.authService.login(email, password);
      this.hidePanel();
    } catch (error) {
      this.showError(error.message || "Login failed");
    } finally {
      this.loginButton.disabled = false;
      this.loginButton.textContent = "Login";
    }
  }

  async handleLogout() {
    try {
      await window.authService.logout();
      this.hidePanel();
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout even if there's an error
      window.authService.logout();
      this.hidePanel();
    }
  }

  showError(message) {
    this.errorMessage.textContent = message;
  }
}

customElements.define("login-widget", LoginWidget);