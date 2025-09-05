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

  // Wait for login widget to be available
  await page.waitForSelector('login-widget', { timeout: 10000 });

  // Check if we're already logged in by looking for the toggle button state
  const isLoggedIn = await page.evaluate(() => {
    const loginWidget = document.querySelector('login-widget') as any;
    const shadowRoot = loginWidget?.shadowRoot;
    if (shadowRoot) {
      const toggleButton = shadowRoot.querySelector('#toggle-button');
      return toggleButton && !toggleButton.classList.contains('logged-out');
    }
    return false;
  });

  if (isLoggedIn) {
    console.log('Already logged in');
    return;
  }

  // Click the toggle button to open the login panel
  await page.evaluate(() => {
    const loginWidget = document.querySelector('login-widget') as any;
    const shadowRoot = loginWidget?.shadowRoot;
    if (shadowRoot) {
      const toggleButton = shadowRoot.querySelector('#toggle-button') as HTMLElement;
      if (toggleButton) toggleButton.click();
    }
  });

  // Wait for the login form to become visible
  await page.waitForFunction(
    () => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const authPanel = shadowRoot.querySelector('#auth-panel') as HTMLElement;
        return authPanel && !authPanel.classList.contains('hidden');
      }
      return false;
    },
    { timeout: 5000 }
  );

  // Fill login form (with small delays to avoid rate limiting)
  await page.evaluate(credentials => {
    const loginWidget = document.querySelector('login-widget') as any;
    const shadowRoot = loginWidget?.shadowRoot;
    if (shadowRoot) {
      const emailInput = shadowRoot.querySelector('#email') as HTMLInputElement;
      const passwordInput = shadowRoot.querySelector('#password') as HTMLInputElement;

      if (emailInput) emailInput.value = credentials.email;
      if (passwordInput) passwordInput.value = credentials.password;
    }
  }, testCredentials);

  // Small delay before clicking login button
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const loginWidget = document.querySelector('login-widget') as any;
    const shadowRoot = loginWidget?.shadowRoot;
    if (shadowRoot) {
      const loginButton = shadowRoot.querySelector('#login-button') as HTMLButtonElement;
      if (loginButton) loginButton.click();
    }
  });

  // Wait for login to complete - check if toggle button changes from 'logged-out' state
  await page.waitForFunction(
    () => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const toggleButton = shadowRoot.querySelector('#toggle-button');
        return toggleButton && !toggleButton.classList.contains('logged-out');
      }
      return false;
    },
    { timeout: 10000 }
  );

  console.log('Login completed via UI');
}

/**
 * Logout via UI
 */
export async function logoutViaUI(page: Page): Promise<void> {
  // Click toggle button to open the user menu first
  await page.evaluate(() => {
    const loginWidget = document.querySelector('login-widget') as any;
    const shadowRoot = loginWidget?.shadowRoot;
    if (shadowRoot) {
      const toggleButton = shadowRoot.querySelector('#toggle-button') as HTMLElement;
      if (toggleButton) toggleButton.click();
    }
  });

  // Wait for panel to open
  await page.waitForTimeout(500);

  // Click logout button
  await page.evaluate(() => {
    const loginWidget = document.querySelector('login-widget') as any;
    const shadowRoot = loginWidget?.shadowRoot;
    if (shadowRoot) {
      const logoutButton = shadowRoot.querySelector('#logout-button') as HTMLButtonElement;
      if (logoutButton) logoutButton.click();
    }
  });

  // Wait for logout to complete - toggle button should have 'logged-out' class
  await page.waitForFunction(
    () => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const toggleButton = shadowRoot.querySelector('#toggle-button');
        return toggleButton && toggleButton.classList.contains('logged-out');
      }
      return false;
    },
    { timeout: 5000 }
  );

  console.log('Logout completed via UI');
}

/**
 * Check if page is authenticated by examining login widget state
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const loginWidget = document.querySelector('login-widget') as any;
    const shadowRoot = loginWidget?.shadowRoot;
    if (shadowRoot) {
      const toggleButton = shadowRoot.querySelector('#toggle-button');
      return toggleButton && !toggleButton.classList.contains('logged-out');
    }
    return false;
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
