import { test, expect } from '@playwright/test';
import {
  loginViaUI,
  logoutViaUI,
  isAuthenticated,
  getCurrentUser,
  getTestCredentials,
} from '../helpers/auth';
import { createApiClient } from '../helpers/api-client';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean slate
    await page.goto('/');
  });

  test('should display login form when not authenticated', async ({ page }) => {
    // Check that login widget is visible
    await expect(page.locator('login-widget')).toBeVisible();

    // Check that login form is displayed within shadow DOM
    const isFormVisible = await page.evaluate(() => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const loginForm = shadowRoot.querySelector('#login-form') as HTMLElement;
        return loginForm && loginForm.style.display !== 'none';
      }
      return false;
    });

    expect(isFormVisible).toBe(true);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const credentials = getTestCredentials();

    // Perform login
    await loginViaUI(page, credentials);

    // Verify user is authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Verify user data is stored
    const user = await getCurrentUser(page);
    expect(user).toBeTruthy();
    expect(user.email).toBe(credentials.email);
  });

  test('should show error message with invalid credentials', async ({ page }) => {
    const invalidCredentials = {
      email: 'invalid@example.com',
      password: 'wrongpassword',
    };

    // Attempt login with invalid credentials
    await page.evaluate(credentials => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const emailInput = shadowRoot.querySelector('#email') as HTMLInputElement;
        const passwordInput = shadowRoot.querySelector('#password') as HTMLInputElement;
        const loginButton = shadowRoot.querySelector('#login-btn') as HTMLButtonElement;

        if (emailInput) emailInput.value = credentials.email;
        if (passwordInput) passwordInput.value = credentials.password;
        if (loginButton) loginButton.click();
      }
    }, invalidCredentials);

    // Wait for error message to appear
    await page.waitForTimeout(2000);

    // Check that login form is still visible (login failed)
    const isFormVisible = await page.evaluate(() => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const loginForm = shadowRoot.querySelector('#login-form') as HTMLElement;
        return loginForm && loginForm.style.display !== 'none';
      }
      return false;
    });

    expect(isFormVisible).toBe(true);

    // Verify user is not authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);
  });

  test('should logout successfully', async ({ page }) => {
    const credentials = getTestCredentials();

    // Login first
    await loginViaUI(page, credentials);
    expect(await isAuthenticated(page)).toBe(true);

    // Logout
    await logoutViaUI(page);

    // Verify user is no longer authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);

    // Verify login form is visible again
    const isFormVisible = await page.evaluate(() => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const loginForm = shadowRoot.querySelector('#login-form') as HTMLElement;
        return loginForm && loginForm.style.display !== 'none';
      }
      return false;
    });

    expect(isFormVisible).toBe(true);
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    const credentials = getTestCredentials();

    // Login
    await loginViaUI(page, credentials);
    expect(await isAuthenticated(page)).toBe(true);

    // Reload page
    await page.reload();

    // Wait for page to load
    await page.waitForSelector('login-widget');

    // Verify user is still authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Verify user data is still available
    const user = await getCurrentUser(page);
    expect(user).toBeTruthy();
    expect(user.email).toBe(credentials.email);
  });

  test('should handle token refresh', async ({ page }) => {
    const credentials = getTestCredentials();
    const baseURL = 'http://localhost:8090';

    // Login to get initial token
    await loginViaUI(page, credentials);
    expect(await isAuthenticated(page)).toBe(true);

    const initialUser = await getCurrentUser(page);
    const initialToken = await page.evaluate(() => localStorage.getItem('auth_token'));

    // Create API client and refresh token
    const apiClient = createApiClient(baseURL, initialToken!);
    const refreshResponse = await apiClient.refreshAuth();

    console.log('Refresh response after fix:', JSON.stringify(refreshResponse, null, 2));
    expect(refreshResponse.success).toBe(true);
    expect(refreshResponse.data?.data?.token).toBeTruthy();

    // Update token in localStorage
    if (refreshResponse.data?.data?.token) {
      await page.evaluate(newToken => {
        localStorage.setItem('auth_token', newToken);
      }, refreshResponse.data.data.token);
    }

    // Verify user is still authenticated with new token
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    const currentUser = await getCurrentUser(page);
    expect(currentUser.id).toBe(initialUser.id);
  });
});
