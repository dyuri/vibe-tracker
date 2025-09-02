import type { User, ProfileWidgetElement } from '@/types';
import styles from '@/styles/components/widgets/profile-widget.css?inline';

export default class ProfileWidget extends HTMLElement implements ProfileWidgetElement {
  private user: User | null = null;
  private isAuthenticated: boolean = false;

  // Auth state elements
  private notAuthenticated!: HTMLElement;
  private profileContent!: HTMLElement;

  // Basic info elements
  private currentUsername!: HTMLElement;
  private currentEmail!: HTMLElement;
  private usernameInput!: HTMLInputElement;
  private emailInput!: HTMLInputElement;
  private updateBasicBtn!: HTMLButtonElement;
  private basicMessage!: HTMLElement;

  // Avatar elements
  private currentAvatar!: HTMLElement;
  private avatarPlaceholder!: HTMLElement;
  private avatarFileInput!: HTMLInputElement;
  private uploadAvatarBtn!: HTMLButtonElement;
  private avatarMessage!: HTMLElement;

  // Password elements
  private oldPasswordInput!: HTMLInputElement;
  private newPasswordInput!: HTMLInputElement;
  private confirmPasswordInput!: HTMLInputElement;
  private changePasswordBtn!: HTMLButtonElement;
  private passwordMessage!: HTMLElement;

  // Token elements
  private tokenDisplay!: HTMLElement;
  private regenerateTokenBtn!: HTMLButtonElement;
  private tokenMessage!: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
<style>${styles}</style>
      
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
        
        <!-- Navigation Section -->
        <div class="profile-section">
          <div class="section-title">Session Management</div>
          
          <div class="form-group">
            <p>Manage your tracking sessions, create new ones, and organize your location data.</p>
            <a href="/profile/sessions" class="button-link">
              Manage Sessions →
            </a>
          </div>
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
    document.addEventListener('auth-change', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.isAuthenticated = customEvent.detail.isAuthenticated;
      this.user = customEvent.detail.user;
      this.updateUI();
    });
  }

  setupElements(): void {
    // Auth state elements
    this.notAuthenticated = this.shadowRoot!.getElementById('not-authenticated')!;
    this.profileContent = this.shadowRoot!.getElementById('profile-content')!;

    // Basic info elements
    this.currentUsername = this.shadowRoot!.getElementById('current-username')!;
    this.currentEmail = this.shadowRoot!.getElementById('current-email')!;
    this.usernameInput = this.shadowRoot!.getElementById('username')! as HTMLInputElement;
    this.emailInput = this.shadowRoot!.getElementById('email')! as HTMLInputElement;
    this.updateBasicBtn = this.shadowRoot!.getElementById('update-basic')! as HTMLButtonElement;
    this.basicMessage = this.shadowRoot!.getElementById('basic-message')!;

    // Avatar elements
    this.currentAvatar = this.shadowRoot!.getElementById('current-avatar')!;
    this.avatarPlaceholder = this.shadowRoot!.getElementById('avatar-placeholder')!;
    this.avatarFileInput = this.shadowRoot!.getElementById('avatar-file')! as HTMLInputElement;
    this.uploadAvatarBtn = this.shadowRoot!.getElementById('upload-avatar')! as HTMLButtonElement;
    this.avatarMessage = this.shadowRoot!.getElementById('avatar-message')!;

    // Password elements
    this.oldPasswordInput = this.shadowRoot!.getElementById('old-password')! as HTMLInputElement;
    this.newPasswordInput = this.shadowRoot!.getElementById('new-password')! as HTMLInputElement;
    this.confirmPasswordInput = this.shadowRoot!.getElementById(
      'confirm-password'
    )! as HTMLInputElement;
    this.changePasswordBtn = this.shadowRoot!.getElementById(
      'change-password'
    )! as HTMLButtonElement;
    this.passwordMessage = this.shadowRoot!.getElementById('password-message')!;

    // Token elements
    this.tokenDisplay = this.shadowRoot!.getElementById('token-display')!;
    this.regenerateTokenBtn = this.shadowRoot!.getElementById(
      'regenerate-token'
    )! as HTMLButtonElement;
    this.tokenMessage = this.shadowRoot!.getElementById('token-message')!;
  }

  setupEventListeners(): void {
    this.updateBasicBtn.addEventListener('click', () => this.handleUpdateBasicInfo());
    this.uploadAvatarBtn.addEventListener('click', () => this.handleUploadAvatar());
    this.changePasswordBtn.addEventListener('click', () => this.handleChangePassword());
    this.regenerateTokenBtn.addEventListener('click', () => this.handleRegenerateToken());

    // Enable enter key for password fields
    [this.oldPasswordInput, this.newPasswordInput, this.confirmPasswordInput].forEach(input => {
      input.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleChangePassword();
        }
      });
    });
  }

  connectedCallback(): void {
    // Initialize with current auth state
    this.initializeAuthState();
  }

  initializeAuthState(): void {
    if (window.authService) {
      this.isAuthenticated = window.authService.isAuthenticated();
      this.user = window.authService.user;
      this.updateUI();
    } else {
      // Retry after a short delay if AuthService isn't ready yet
      setTimeout(() => this.initializeAuthState(), 10);
    }
  }

  updateUI(): void {
    if (this.isAuthenticated && this.user) {
      this.notAuthenticated.style.display = 'none';
      this.profileContent.classList.add('show');
      this.populateUserInfo();
    } else {
      this.notAuthenticated.style.display = 'block';
      this.profileContent.classList.remove('show');
    }
  }

  populateUserInfo(): void {
    if (!this.user) {
      return;
    }

    // Update current info displays
    this.currentUsername.textContent = `Current: ${this.user.username || 'Not set'}`;
    this.currentEmail.textContent = `Current: ${this.user.email || 'Not set'}`;

    // Update avatar
    this.updateAvatarDisplay();

    // Update token display
    this.tokenDisplay.textContent = this.user.token || 'No token available';

    // Clear input fields
    this.usernameInput.value = '';
    this.emailInput.value = '';
    this.clearPasswordFields();
  }

  updateAvatarDisplay(): void {
    // Clear existing content
    this.currentAvatar.innerHTML = '<span id="avatar-placeholder">?</span>';
    this.avatarPlaceholder = this.shadowRoot!.getElementById('avatar-placeholder')!;

    if (this.user!.avatar) {
      const img = document.createElement('img');
      img.src = `/api/files/users/${this.user!.id}/${this.user!.avatar}`;
      img.alt = 'User avatar';
      img.onerror = () => {
        this.avatarPlaceholder.textContent = this.user!.username
          ? this.user!.username.charAt(0).toUpperCase()
          : '?';
      };
      this.currentAvatar.appendChild(img);
      this.avatarPlaceholder.style.display = 'none';
    } else {
      this.avatarPlaceholder.textContent = this.user!.username
        ? this.user!.username.charAt(0).toUpperCase()
        : '?';
    }
  }

  async handleUpdateBasicInfo(): Promise<void> {
    const username = this.usernameInput.value.trim();
    const email = this.emailInput.value.trim();

    if (!username && !email) {
      this.showMessage(this.basicMessage, 'Please enter a username or email to update', 'error');
      return;
    }

    this.updateBasicBtn.disabled = true;
    this.updateBasicBtn.textContent = 'Updating...';

    try {
      const updatedUser = await window.authService.updateProfile({ username, email });
      this.user = updatedUser;
      this.populateUserInfo();
      this.showMessage(this.basicMessage, 'Basic information updated successfully!', 'success');
    } catch (error: any) {
      this.showMessage(this.basicMessage, error.message || 'Failed to update profile', 'error');
    } finally {
      this.updateBasicBtn.disabled = false;
      this.updateBasicBtn.textContent = 'Update Basic Info';
    }
  }

  async handleUploadAvatar(): Promise<void> {
    const file = this.avatarFileInput.files?.[0];
    if (!file) {
      this.showMessage(this.avatarMessage, 'Please select an image file', 'error');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.showMessage(this.avatarMessage, 'Please select a valid image file', 'error');
      return;
    }

    this.uploadAvatarBtn.disabled = true;
    this.uploadAvatarBtn.textContent = 'Uploading...';

    try {
      const updatedUser = await window.authService.uploadAvatar(file);
      this.user = updatedUser;
      this.updateAvatarDisplay();
      this.avatarFileInput.value = '';
      this.showMessage(this.avatarMessage, 'Avatar uploaded successfully!', 'success');
    } catch (error: any) {
      this.showMessage(this.avatarMessage, error.message || 'Failed to upload avatar', 'error');
    } finally {
      this.uploadAvatarBtn.disabled = false;
      this.uploadAvatarBtn.textContent = 'Upload Avatar';
    }
  }

  async handleChangePassword(): Promise<void> {
    const oldPassword = this.oldPasswordInput.value;
    const newPassword = this.newPasswordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;

    if (!oldPassword || !newPassword || !confirmPassword) {
      this.showMessage(this.passwordMessage, 'Please fill in all password fields', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showMessage(this.passwordMessage, 'New passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 6) {
      this.showMessage(
        this.passwordMessage,
        'New password must be at least 6 characters long',
        'error'
      );
      return;
    }

    this.changePasswordBtn.disabled = true;
    this.changePasswordBtn.textContent = 'Changing...';

    try {
      await window.authService.updateProfile({
        password: newPassword,
        oldPassword: oldPassword,
      });
      this.clearPasswordFields();
      this.showMessage(this.passwordMessage, 'Password changed successfully!', 'success');
    } catch (error: any) {
      this.showMessage(this.passwordMessage, error.message || 'Failed to change password', 'error');
    } finally {
      this.changePasswordBtn.disabled = false;
      this.changePasswordBtn.textContent = 'Change Password';
    }
  }

  async handleRegenerateToken(): Promise<void> {
    if (
      !confirm(
        'Are you sure you want to regenerate your API token? This will invalidate the current token.'
      )
    ) {
      return;
    }

    this.regenerateTokenBtn.disabled = true;
    this.regenerateTokenBtn.textContent = 'Regenerating...';

    try {
      const updatedUser = await window.authService.regenerateToken();
      this.user = updatedUser;
      this.tokenDisplay.textContent = updatedUser.token;
      this.showMessage(this.tokenMessage, 'API token regenerated successfully!', 'success');
    } catch (error: any) {
      this.showMessage(this.tokenMessage, error.message || 'Failed to regenerate token', 'error');
    } finally {
      this.regenerateTokenBtn.disabled = false;
      this.regenerateTokenBtn.textContent = 'Regenerate Token';
    }
  }

  clearPasswordFields(): void {
    this.oldPasswordInput.value = '';
    this.newPasswordInput.value = '';
    this.confirmPasswordInput.value = '';
  }

  showMessage(element: HTMLElement, message: string, type: string): void {
    element.textContent = message;
    element.className = type;

    // Clear message after 5 seconds
    setTimeout(() => {
      element.textContent = '';
      element.className = '';
    }, 5000);
  }
}

customElements.define('profile-widget', ProfileWidget);
