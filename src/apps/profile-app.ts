import type { AuthChangeEventDetail, LoginWidgetElement, ProfileWidgetElement } from '@/types';
import { AuthService } from '@/services';
import '@/components/widgets/login-widget';
import '@/components/widgets/profile-widget';
import '@/components/widgets/theme-toggle';

// Initialize global auth service
window.authService = new AuthService();

// Get widget references
const loginWidget = document.getElementById('profile-login') as LoginWidgetElement | null;
const _profileWidget = document.querySelector('profile-widget') as ProfileWidgetElement | null;

/**
 * Configure login widget to be open by default if not authenticated
 */
function checkAuthAndConfigureLogin(): void {
  if (!window.authService.isAuthenticated()) {
    // Show the login panel by default for non-authenticated users
    if (loginWidget && loginWidget.showPanel) {
      setTimeout(() => loginWidget.showPanel(), 100);
    }
  }
}

// Initialize authentication state
document.addEventListener('auth-change', (e: Event) => {
  const customEvent = e as CustomEvent<AuthChangeEventDetail>;
  console.log('Auth state changed in profile page:', customEvent.detail);

  if (customEvent.detail.isAuthenticated) {
    console.log('User logged in:', customEvent.detail.user);
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
