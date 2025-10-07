/**
 * Authentication utilities for E2E tests
 */

import { Page, BrowserContext } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  username?: string;
  id?: string;
}

export interface AuthTokenResponse {
  token: string;
  record: {
    id: string;
    username: string;
    email: string;
    verified: boolean;
    avatar?: string;
  };
}

/**
 * Get test credentials from environment variables
 */
export function getTestCredentials(): TestUser {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD environment variables must be set');
  }

  return { email, password };
}

/**
 * Login via API and return authentication data
 */
export async function loginViaAPI(
  baseURL: string,
  credentials: TestUser
): Promise<AuthTokenResponse> {
  const response = await fetch(`${baseURL}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identity: credentials.email,
      password: credentials.password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API login failed with status ${response.status}: ${errorText}`);
  }

  const authData: AuthTokenResponse = await response.json();
  return authData;
}

/**
 * Create a browser context with authentication storage state
 */
export async function createAuthenticatedContext(
  context: BrowserContext,
  baseURL: string,
  credentials?: TestUser
): Promise<{ context: BrowserContext; authData: AuthTokenResponse }> {
  const testCredentials = credentials || getTestCredentials();

  // Login via API to get auth token
  const authData = await loginViaAPI(baseURL, testCredentials);

  // Set up storage state in the context
  await context.addInitScript(authData => {
    localStorage.setItem('auth_token', authData.token);
    localStorage.setItem('user', JSON.stringify(authData.record));
  }, authData);

  return { context, authData };
}

/**
 * Login via UI (for testing login flow itself)
 */
export async function loginViaUI(page: Page, credentials?: TestUser): Promise<void> {
  const testCredentials = credentials || getTestCredentials();

  // Navigate to login page/form
  await page.goto('/');

  // Wait for session-map-panel widget to be available
  await page.waitForSelector('session-map-panel-widget', { timeout: 10000 });

  // Check if we're already logged in by checking auth state
  const isLoggedIn = await page.evaluate(() => {
    const authToken = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    return !!(authToken && user);
  });

  if (isLoggedIn) {
    console.log('Already logged in');
    return;
  }

  // Click the Profile tab to access login form
  await page.evaluate(() => {
    const panel = document.querySelector('session-map-panel-widget') as any;
    const shadowRoot = panel?.shadowRoot;
    if (shadowRoot) {
      const profileTab = shadowRoot.querySelector('[data-tab="profile"]') as HTMLElement;
      if (profileTab) profileTab.click();
    }
  });

  // Wait for the profile tab content to be visible
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('session-map-panel-widget') as any;
      const shadowRoot = panel?.shadowRoot;
      if (shadowRoot) {
        const profileContent = shadowRoot.querySelector(
          '[data-tab="profile"].tab-content'
        ) as HTMLElement;
        return profileContent && profileContent.classList.contains('active');
      }
      return false;
    },
    { timeout: 5000 }
  );

  // Fill login form (with small delays to avoid rate limiting)
  await page.evaluate(credentials => {
    const panel = document.querySelector('session-map-panel-widget') as any;
    const shadowRoot = panel?.shadowRoot;
    if (shadowRoot) {
      const emailInput = shadowRoot.querySelector('#profile-email') as HTMLInputElement;
      const passwordInput = shadowRoot.querySelector('#profile-password') as HTMLInputElement;

      if (emailInput) emailInput.value = credentials.email;
      if (passwordInput) passwordInput.value = credentials.password;
    }
  }, testCredentials);

  // Small delay before clicking login button
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const panel = document.querySelector('session-map-panel-widget') as any;
    const shadowRoot = panel?.shadowRoot;
    if (shadowRoot) {
      const loginButton = shadowRoot.querySelector('#profile-login-btn') as HTMLButtonElement;
      if (loginButton) loginButton.click();
    }
  });

  // Wait for login to complete - check for auth token in localStorage
  await page.waitForFunction(
    () => {
      const authToken = localStorage.getItem('auth_token');
      const user = localStorage.getItem('user');
      return !!(authToken && user);
    },
    { timeout: 10000 }
  );

  console.log('Login completed via UI');
}

/**
 * Logout via UI
 */
export async function logoutViaUI(page: Page): Promise<void> {
  // Click Profile tab to access logout button
  await page.evaluate(() => {
    const panel = document.querySelector('session-map-panel-widget') as any;
    const shadowRoot = panel?.shadowRoot;
    if (shadowRoot) {
      const profileTab = shadowRoot.querySelector('[data-tab="profile"]') as HTMLElement;
      if (profileTab) profileTab.click();
    }
  });

  // Wait for panel content to be visible
  await page.waitForTimeout(500);

  // Click logout button
  await page.evaluate(() => {
    const panel = document.querySelector('session-map-panel-widget') as any;
    const shadowRoot = panel?.shadowRoot;
    if (shadowRoot) {
      const logoutButton = shadowRoot.querySelector('#profile-logout-btn') as HTMLButtonElement;
      if (logoutButton) logoutButton.click();
    }
  });

  // Wait for logout to complete - check localStorage is cleared
  await page.waitForFunction(
    () => {
      const authToken = localStorage.getItem('auth_token');
      const user = localStorage.getItem('user');
      return !authToken && !user;
    },
    { timeout: 5000 }
  );

  console.log('Logout completed via UI');
}

/**
 * Check if page is authenticated by examining auth state
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const authToken = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    return !!(authToken && user);
  });
}

/**
 * Get current user data from the page
 */
export async function getCurrentUser(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  });
}

/**
 * Clear authentication state
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  });
}

/**
 * Save storage state to file for reuse across tests
 */
export async function saveStorageState(context: BrowserContext, filePath: string): Promise<void> {
  await context.storageState({ path: filePath });
  console.log(`Storage state saved to: ${filePath}`);
}

/**
 * Create a reusable authenticated context from storage state file
 */
export async function createContextFromStorageState(
  context: BrowserContext,
  filePath: string
): Promise<BrowserContext> {
  // Note: This would typically be done during context creation with storageState option
  // This function is more for documentation of the pattern
  console.log(`Loading storage state from: ${filePath}`);
  return context;
}
