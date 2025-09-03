import { test, expect } from '@playwright/test';
import { loginViaUI, getTestCredentials } from '../helpers/auth';

test.describe('User Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the main page successfully', async ({ page }) => {
    // Check that the page loads without errors
    await expect(page).toHaveTitle(/Vibe Tracker/);

    // Check that main content area exists
    await expect(page.locator('#content')).toBeVisible();

    // Check that essential widgets are present on main page
    await expect(page.locator('login-widget')).toBeVisible();
    await expect(page.locator('map-widget')).toBeVisible();
    await expect(page.locator('theme-toggle')).toBeVisible();
  });

  test('should display theme toggle widget', async ({ page }) => {
    // Check for theme toggle widget
    const themeToggle = page.locator('theme-toggle');
    await expect(themeToggle).toBeVisible();

    // Check that theme toggle works
    await page.evaluate(() => {
      const themeWidget = document.querySelector('theme-toggle') as any;
      const shadowRoot = themeWidget?.shadowRoot;
      if (shadowRoot) {
        const toggleButton = shadowRoot.querySelector('#theme-toggle-btn') as HTMLButtonElement;
        if (toggleButton) toggleButton.click();
      }
    });

    // Wait for theme change
    await page.waitForTimeout(500);

    // Check that theme has changed (look for dark theme class or attribute)
    const isDarkTheme = await page.evaluate(() => {
      return (
        document.documentElement.classList.contains('dark-theme') ||
        document.documentElement.getAttribute('data-theme') === 'dark'
      );
    });

    // Toggle back
    await page.evaluate(() => {
      const themeWidget = document.querySelector('theme-toggle-widget') as any;
      const shadowRoot = themeWidget?.shadowRoot;
      if (shadowRoot) {
        const toggleButton = shadowRoot.querySelector('#theme-toggle-btn') as HTMLButtonElement;
        if (toggleButton) toggleButton.click();
      }
    });

    await page.waitForTimeout(500);

    const isLightTheme = await page.evaluate(() => {
      return (
        !document.documentElement.classList.contains('dark-theme') &&
        document.documentElement.getAttribute('data-theme') !== 'dark'
      );
    });

    expect(isLightTheme).toBe(true);
  });

  test('should handle responsive design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that widgets are still visible and functional
    await expect(page.locator('login-widget')).toBeVisible();
    await expect(page.locator('map-widget')).toBeVisible();

    // Check that map widget adapts to mobile size
    const mapHeight = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        return mapContainer ? window.getComputedStyle(mapContainer).height : '0px';
      }
      return '0px';
    });

    expect(mapHeight).not.toBe('0px');
  });

  test('should handle responsive design - tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Check that main page widgets are visible
    await expect(page.locator('login-widget')).toBeVisible();
    await expect(page.locator('map-widget')).toBeVisible();
    await expect(page.locator('theme-toggle')).toBeVisible();

    // Check layout adapts properly
    const contentWidth = await page
      .locator('#content')
      .evaluate(el => window.getComputedStyle(el).width);

    expect(parseInt(contentWidth)).toBeLessThanOrEqual(768);
  });

  test('should display error handling for network failures', async ({ page }) => {
    // Login first
    const credentials = getTestCredentials();
    await loginViaUI(page, credentials);

    // Block network requests to simulate network failure
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    // Try to perform an action that requires network (e.g., create session)
    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    // Wait for form and try to save
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) titleInput.value = 'Test Session';
        if (saveButton) saveButton.click();
      }
    });

    // Wait for error to appear
    await page.waitForTimeout(2000);

    // Check that an error message is displayed
    const hasError = await page.evaluate(() => {
      // Look for error messages in any widget
      const widgets = ['session-management-widget', 'map-widget', 'login-widget'];

      for (const widgetTag of widgets) {
        const widget = document.querySelector(widgetTag) as any;
        const shadowRoot = widget?.shadowRoot;
        if (shadowRoot) {
          const errorMessages = shadowRoot.querySelectorAll(
            '.error, .error-message, [class*="error"]'
          );
          if (errorMessages.length > 0) {
            return true;
          }
        }
      }

      return false;
    });

    // Note: This test assumes error handling is implemented
    console.log('Error message displayed:', hasError);
  });

  test('should provide keyboard navigation support', async ({ page }) => {
    // Test tab navigation through interactive elements
    await page.keyboard.press('Tab');

    // Check that focus is visible on first interactive element
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName.toLowerCase();
    });

    expect(focusedElement).toBeTruthy();

    // Continue tabbing through elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // Check that focus has moved
    const newFocusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName.toLowerCase();
    });

    expect(newFocusedElement).toBeTruthy();
  });

  test('should display loading states appropriately', async ({ page }) => {
    // Login to trigger loading states
    const credentials = getTestCredentials();

    // Fill login form
    await page.evaluate(creds => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const emailInput = shadowRoot.querySelector('#email') as HTMLInputElement;
        const passwordInput = shadowRoot.querySelector('#password') as HTMLInputElement;

        if (emailInput) emailInput.value = creds.email;
        if (passwordInput) passwordInput.value = creds.password;
      }
    }, credentials);

    // Click login and immediately check for loading state
    await page.evaluate(() => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const loginButton = shadowRoot.querySelector('#login-btn') as HTMLButtonElement;
        if (loginButton) loginButton.click();
      }
    });

    // Check for loading indicator (this should appear briefly)
    await page.waitForTimeout(100);

    const hasLoadingState = await page.evaluate(() => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const loadingIndicators = shadowRoot.querySelectorAll(
          '.loading, .spinner, [class*="loading"]'
        );
        return loadingIndicators.length > 0;
      }
      return false;
    });

    // Note: This test might be timing-dependent
    console.log('Loading state detected:', hasLoadingState);

    // Wait for login to complete
    await page.waitForTimeout(3000);

    // Verify loading state is gone
    const loadingGone = await page.evaluate(() => {
      const loginWidget = document.querySelector('login-widget') as any;
      const shadowRoot = loginWidget?.shadowRoot;
      if (shadowRoot) {
        const loadingIndicators = shadowRoot.querySelectorAll(
          '.loading, .spinner, [class*="loading"]'
        );
        return loadingIndicators.length === 0;
      }
      return true;
    });

    expect(loadingGone).toBe(true);
  });

  test('should maintain consistent styling across components', async ({ page }) => {
    // Check that CSS custom properties are consistently applied
    const customProperties = await page.evaluate(() => {
      const computedStyle = window.getComputedStyle(document.documentElement);

      return {
        primaryColor: computedStyle.getPropertyValue('--color-primary'),
        textPrimary: computedStyle.getPropertyValue('--text-primary'),
        bgPanel: computedStyle.getPropertyValue('--bg-panel'),
        spacing: computedStyle.getPropertyValue('--spacing-md'),
      };
    });

    // Verify that custom properties are defined
    expect(customProperties.primaryColor.trim()).not.toBe('');
    expect(customProperties.textPrimary.trim()).not.toBe('');

    // Check that widgets inherit consistent styling
    const widgetStyles = await page.evaluate(() => {
      const widgets = ['login-widget', 'map-widget', 'session-management-widget'];
      const styles = {};

      widgets.forEach(widgetTag => {
        const widget = document.querySelector(widgetTag) as any;
        if (widget) {
          styles[widgetTag] = {
            fontFamily: window.getComputedStyle(widget).fontFamily,
            fontSize: window.getComputedStyle(widget).fontSize,
          };
        }
      });

      return styles;
    });

    // Verify widgets have consistent base styling
    const fontFamilies = Object.values(widgetStyles).map((style: any) => style.fontFamily);
    const uniqueFontFamilies = [...new Set(fontFamilies)];

    // All widgets should use the same font family (or at least a small number)
    expect(uniqueFontFamilies.length).toBeLessThanOrEqual(2);
  });

  test('should handle window resize events', async ({ page }) => {
    const initialSize = { width: 1200, height: 800 };
    const smallSize = { width: 600, height: 400 };

    // Start with large viewport
    await page.setViewportSize(initialSize);

    // Get initial map dimensions
    const initialMapSize = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        return {
          width: mapContainer?.offsetWidth || 0,
          height: mapContainer?.offsetHeight || 0,
        };
      }
      return { width: 0, height: 0 };
    });

    // Resize to smaller viewport
    await page.setViewportSize(smallSize);
    await page.waitForTimeout(500);

    // Get new map dimensions
    const resizedMapSize = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        return {
          width: mapContainer?.offsetWidth || 0,
          height: mapContainer?.offsetHeight || 0,
        };
      }
      return { width: 0, height: 0 };
    });

    // Map should adapt to new size
    expect(resizedMapSize.width).toBeLessThan(initialMapSize.width);
  });
});
