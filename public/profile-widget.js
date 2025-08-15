export default class ProfileWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.user = null;
    this.isAuthenticated = false;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: sans-serif;
          display: block;
          max-width: 600px;
          margin: 20px auto;
          padding: 20px;
        }
        .not-authenticated {
          text-align: center;
          padding: 40px;
          background-color: #f8f9fa;
          border-radius: 8px;
          color: #6c757d;
        }
        .profile-content {
          display: none;
        }
        .profile-content.show {
          display: block;
        }
        .profile-section {
          background-color: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #333;
          border-bottom: 2px solid #007bff;
          padding-bottom: 5px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: #555;
        }
        input[type="text"], 
        input[type="email"], 
        input[type="password"],
        input[type="file"] {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
          font-size: 14px;
        }
        input[type="file"] {
          padding: 6px;
        }
        button {
          background-color: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-right: 10px;
          margin-bottom: 10px;
        }
        button:hover {
          background-color: #0056b3;
        }
        button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        .btn-danger {
          background-color: #dc3545;
        }
        .btn-danger:hover {
          background-color: #c82333;
        }
        .btn-secondary {
          background-color: #6c757d;
        }
        .btn-secondary:hover {
          background-color: #5a6268;
        }
        .error {
          color: #dc3545;
          font-size: 14px;
          margin-top: 5px;
        }
        .success {
          color: #28a745;
          font-size: 14px;
          margin-top: 5px;
        }
        .avatar-section {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 15px;
        }
        .current-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f8f9fa;
          font-size: 24px;
          font-weight: bold;
          color: #6c757d;
          overflow: hidden;
        }
        .current-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .avatar-controls {
          flex: 1;
        }
        .token-display {
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px;
          font-family: monospace;
          font-size: 14px;
          word-break: break-all;
          margin-bottom: 10px;
        }
        .token-warning {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          padding: 10px;
          font-size: 14px;
          color: #856404;
          margin-top: 10px;
        }
        .current-info {
          background-color: #e9ecef;
          border-radius: 4px;
          padding: 8px;
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 10px;
        }
      </style>
      
      <div class="not-authenticated" id="not-authenticated">
        <h2>Please log in to view your profile</h2>
        <p>You need to be logged in to access your profile information and settings.</p>
      </div>
      
      <div class="profile-content" id="profile-content">
        <!-- Basic Information Section -->
        <div class="profile-section">
          <div class="section-title">Basic Information</div>
          
          <div class="form-group">
            <label for="username">Username</label>
            <div class="current-info" id="current-username"></div>
            <input type="text" id="username" placeholder="Enter new username">
          </div>
          
          <div class="form-group">
            <label for="email">Email</label>
            <div class="current-info" id="current-email"></div>
            <input type="email" id="email" placeholder="Enter new email">
          </div>
          
          <button id="update-basic" type="button">Update Basic Info</button>
          <div id="basic-message"></div>
        </div>
        
        <!-- Avatar Section -->
        <div class="profile-section">
          <div class="section-title">Profile Picture</div>
          
          <div class="avatar-section">
            <div class="current-avatar" id="current-avatar">
              <span id="avatar-placeholder">?</span>
            </div>
            <div class="avatar-controls">
              <div class="form-group">
                <label for="avatar-file">Upload new avatar</label>
                <input type="file" id="avatar-file" accept="image/*">
              </div>
              <button id="upload-avatar" type="button">Upload Avatar</button>
            </div>
          </div>
          
          <div id="avatar-message"></div>
        </div>
        
        <!-- Password Change Section -->
        <div class="profile-section">
          <div class="section-title">Change Password</div>
          
          <div class="form-group">
            <label for="old-password">Current Password</label>
            <input type="password" id="old-password" placeholder="Enter current password">
          </div>
          
          <div class="form-group">
            <label for="new-password">New Password</label>
            <input type="password" id="new-password" placeholder="Enter new password">
          </div>
          
          <div class="form-group">
            <label for="confirm-password">Confirm New Password</label>
            <input type="password" id="confirm-password" placeholder="Confirm new password">
          </div>
          
          <button id="change-password" type="button">Change Password</button>
          <div id="password-message"></div>
        </div>
        
        <!-- API Token Section -->
        <div class="profile-section">
          <div class="section-title">API Token</div>
          
          <div class="form-group">
            <label>Your API Token</label>
            <div class="token-display" id="token-display"></div>
            <button id="regenerate-token" type="button" class="btn-secondary">Regenerate Token</button>
            <div class="token-warning">
              <strong>Warning:</strong> Keep your API token secure. Anyone with this token can access your tracking data. 
              Regenerating will invalidate the current token.
            </div>
          </div>
          
          <div id="token-message"></div>
        </div>
      </div>
    `;

    this.setupElements();
    this.setupEventListeners();
    this.updateUI();

    // Listen for auth changes
    document.addEventListener('auth-change', (e) => {
      this.isAuthenticated = e.detail.isAuthenticated;
      this.user = e.detail.user;
      this.updateUI();
    });
  }

  setupElements() {
    // Auth state elements
    this.notAuthenticated = this.shadowRoot.getElementById("not-authenticated");
    this.profileContent = this.shadowRoot.getElementById("profile-content");
    
    // Basic info elements
    this.currentUsername = this.shadowRoot.getElementById("current-username");
    this.currentEmail = this.shadowRoot.getElementById("current-email");
    this.usernameInput = this.shadowRoot.getElementById("username");
    this.emailInput = this.shadowRoot.getElementById("email");
    this.updateBasicBtn = this.shadowRoot.getElementById("update-basic");
    this.basicMessage = this.shadowRoot.getElementById("basic-message");
    
    // Avatar elements
    this.currentAvatar = this.shadowRoot.getElementById("current-avatar");
    this.avatarPlaceholder = this.shadowRoot.getElementById("avatar-placeholder");
    this.avatarFileInput = this.shadowRoot.getElementById("avatar-file");
    this.uploadAvatarBtn = this.shadowRoot.getElementById("upload-avatar");
    this.avatarMessage = this.shadowRoot.getElementById("avatar-message");
    
    // Password elements
    this.oldPasswordInput = this.shadowRoot.getElementById("old-password");
    this.newPasswordInput = this.shadowRoot.getElementById("new-password");
    this.confirmPasswordInput = this.shadowRoot.getElementById("confirm-password");
    this.changePasswordBtn = this.shadowRoot.getElementById("change-password");
    this.passwordMessage = this.shadowRoot.getElementById("password-message");
    
    // Token elements
    this.tokenDisplay = this.shadowRoot.getElementById("token-display");
    this.regenerateTokenBtn = this.shadowRoot.getElementById("regenerate-token");
    this.tokenMessage = this.shadowRoot.getElementById("token-message");
  }

  setupEventListeners() {
    this.updateBasicBtn.addEventListener("click", () => this.handleUpdateBasicInfo());
    this.uploadAvatarBtn.addEventListener("click", () => this.handleUploadAvatar());
    this.changePasswordBtn.addEventListener("click", () => this.handleChangePassword());
    this.regenerateTokenBtn.addEventListener("click", () => this.handleRegenerateToken());
    
    // Enable enter key for password fields
    [this.oldPasswordInput, this.newPasswordInput, this.confirmPasswordInput].forEach(input => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.handleChangePassword();
        }
      });
    });
  }

  connectedCallback() {
    // Initialize with current auth state
    this.initializeAuthState();
  }

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

  updateUI() {
    if (this.isAuthenticated && this.user) {
      this.notAuthenticated.style.display = "none";
      this.profileContent.classList.add("show");
      this.populateUserInfo();
    } else {
      this.notAuthenticated.style.display = "block";
      this.profileContent.classList.remove("show");
    }
  }

  populateUserInfo() {
    if (!this.user) return;
    
    // Update current info displays
    this.currentUsername.textContent = `Current: ${this.user.username || 'Not set'}`;
    this.currentEmail.textContent = `Current: ${this.user.email || 'Not set'}`;
    
    // Update avatar
    this.updateAvatarDisplay();
    
    // Update token display
    this.tokenDisplay.textContent = this.user.token || 'No token available';
    
    // Clear input fields
    this.usernameInput.value = "";
    this.emailInput.value = "";
    this.clearPasswordFields();
  }

  updateAvatarDisplay() {
    // Clear existing content
    this.currentAvatar.innerHTML = '<span id="avatar-placeholder">?</span>';
    this.avatarPlaceholder = this.shadowRoot.getElementById("avatar-placeholder");
    
    if (this.user.avatar) {
      const img = document.createElement('img');
      img.src = `/api/files/users/${this.user.id}/${this.user.avatar}`;
      img.alt = 'User avatar';
      img.onerror = () => {
        this.avatarPlaceholder.textContent = this.user.username ? this.user.username.charAt(0).toUpperCase() : "?";
      };
      this.currentAvatar.appendChild(img);
      this.avatarPlaceholder.style.display = 'none';
    } else {
      this.avatarPlaceholder.textContent = this.user.username ? this.user.username.charAt(0).toUpperCase() : "?";
    }
  }

  async handleUpdateBasicInfo() {
    const username = this.usernameInput.value.trim();
    const email = this.emailInput.value.trim();
    
    if (!username && !email) {
      this.showMessage(this.basicMessage, "Please enter a username or email to update", "error");
      return;
    }
    
    this.updateBasicBtn.disabled = true;
    this.updateBasicBtn.textContent = "Updating...";
    
    try {
      const updatedUser = await window.authService.updateProfile({ username, email });
      this.user = updatedUser;
      this.populateUserInfo();
      this.showMessage(this.basicMessage, "Basic information updated successfully!", "success");
    } catch (error) {
      this.showMessage(this.basicMessage, error.message || "Failed to update profile", "error");
    } finally {
      this.updateBasicBtn.disabled = false;
      this.updateBasicBtn.textContent = "Update Basic Info";
    }
  }

  async handleUploadAvatar() {
    const file = this.avatarFileInput.files[0];
    if (!file) {
      this.showMessage(this.avatarMessage, "Please select an image file", "error");
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.showMessage(this.avatarMessage, "Please select a valid image file", "error");
      return;
    }
    
    this.uploadAvatarBtn.disabled = true;
    this.uploadAvatarBtn.textContent = "Uploading...";
    
    try {
      const updatedUser = await window.authService.uploadAvatar(file);
      this.user = updatedUser;
      this.updateAvatarDisplay();
      this.avatarFileInput.value = "";
      this.showMessage(this.avatarMessage, "Avatar uploaded successfully!", "success");
    } catch (error) {
      this.showMessage(this.avatarMessage, error.message || "Failed to upload avatar", "error");
    } finally {
      this.uploadAvatarBtn.disabled = false;
      this.uploadAvatarBtn.textContent = "Upload Avatar";
    }
  }

  async handleChangePassword() {
    const oldPassword = this.oldPasswordInput.value;
    const newPassword = this.newPasswordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;
    
    if (!oldPassword || !newPassword || !confirmPassword) {
      this.showMessage(this.passwordMessage, "Please fill in all password fields", "error");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      this.showMessage(this.passwordMessage, "New passwords do not match", "error");
      return;
    }
    
    if (newPassword.length < 6) {
      this.showMessage(this.passwordMessage, "New password must be at least 6 characters long", "error");
      return;
    }
    
    this.changePasswordBtn.disabled = true;
    this.changePasswordBtn.textContent = "Changing...";
    
    try {
      await window.authService.updateProfile({ 
        password: newPassword, 
        oldPassword: oldPassword 
      });
      this.clearPasswordFields();
      this.showMessage(this.passwordMessage, "Password changed successfully!", "success");
    } catch (error) {
      this.showMessage(this.passwordMessage, error.message || "Failed to change password", "error");
    } finally {
      this.changePasswordBtn.disabled = false;
      this.changePasswordBtn.textContent = "Change Password";
    }
  }

  async handleRegenerateToken() {
    if (!confirm("Are you sure you want to regenerate your API token? This will invalidate the current token.")) {
      return;
    }
    
    this.regenerateTokenBtn.disabled = true;
    this.regenerateTokenBtn.textContent = "Regenerating...";
    
    try {
      const updatedUser = await window.authService.regenerateToken();
      this.user = updatedUser;
      this.tokenDisplay.textContent = updatedUser.token;
      this.showMessage(this.tokenMessage, "API token regenerated successfully!", "success");
    } catch (error) {
      this.showMessage(this.tokenMessage, error.message || "Failed to regenerate token", "error");
    } finally {
      this.regenerateTokenBtn.disabled = false;
      this.regenerateTokenBtn.textContent = "Regenerate Token";
    }
  }

  clearPasswordFields() {
    this.oldPasswordInput.value = "";
    this.newPasswordInput.value = "";
    this.confirmPasswordInput.value = "";
  }

  showMessage(element, message, type) {
    element.textContent = message;
    element.className = type;
    
    // Clear message after 5 seconds
    setTimeout(() => {
      element.textContent = "";
      element.className = "";
    }, 5000);
  }
}

customElements.define("profile-widget", ProfileWidget);