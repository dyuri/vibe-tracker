// Import modules
import AuthService from './auth-service.js';
import './login-widget.js';
import './profile-widget.js';
import './theme-toggle.js';

// Initialize global auth service
window.authService = new AuthService();

// Get widget references
const loginWidget = document.getElementById('profile-login');
const _profileWidget = document.querySelector('profile-widget');

// Configure login widget to be open by default if not authenticated
function checkAuthAndConfigureLogin() {
  if (!window.authService.isAuthenticated()) {
    // Show the login panel by default for non-authenticated users
    if (loginWidget && loginWidget.showPanel) {
      setTimeout(() => loginWidget.showPanel(), 100);
    }
  }
}

// Initialize authentication state
document.addEventListener('auth-change', e => {
  console.log('Auth state changed in profile page:', e.detail);

  if (e.detail.isAuthenticated) {
    console.log('User logged in:', e.detail.user);
  } else {
    console.log('User logged out');
    // Show login panel again if user logs out
    setTimeout(() => {
      if (loginWidget && loginWidget.showPanel) {
        loginWidget.showPanel();
      }
    }, 100);
  }
});

// Dispatch initial auth state to ensure all widgets are properly initialized
// This fixes the issue where widgets don't get the initial auth state on page reload
setTimeout(() => {
  if (window.authService.isAuthenticated()) {
    window.authService.dispatchAuthChange();
  } else {
    checkAuthAndConfigureLogin();
  }
}, 0);
