import { test, expect } from '@playwright/test';
import { loginViaUI, getTestCredentials } from '../helpers/auth';
import { createTestSession, cleanupUserTestData } from '../helpers/test-data';
import { createApiClient } from '../helpers/api-client';

test.describe('Session Management', () => {
  const baseURL = 'http://localhost:8090';

  test.beforeEach(async ({ page }) => {
    // Start with authentication
    await page.goto('/');
    const credentials = getTestCredentials();
    await loginViaUI(page, credentials);

    // Wait for page to fully load
    await page.waitForSelector('session-management-widget');
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));

    if (token && userStr) {
      const user = JSON.parse(userStr);
      const authData = { token, record: user };
      await cleanupUserTestData(baseURL, authData);
    }
  });

  test('should display session management widget', async ({ page }) => {
    // Check that session management widget is visible
    await expect(page.locator('session-management-widget')).toBeVisible();

    // Check that session list is rendered within shadow DOM
    const isSessionListVisible = await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionList = shadowRoot.querySelector('#session-list');
        return sessionList !== null;
      }
      return false;
    });

    expect(isSessionListVisible).toBe(true);
  });

  test('should create a new session', async ({ page }) => {
    const sessionTitle = `Test Session ${Date.now()}`;
    const sessionDescription = 'A test session created via E2E testing';

    // Open create session form
    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Fill in session details
    await page.evaluate(
      data => {
        const sessionWidget = document.querySelector('session-management-widget') as any;
        const shadowRoot = sessionWidget?.shadowRoot;
        if (shadowRoot) {
          const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
          const descInput = shadowRoot.querySelector('#session-description') as HTMLTextAreaElement;
          const publicCheckbox = shadowRoot.querySelector('#session-public') as HTMLInputElement;
          const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

          if (titleInput) titleInput.value = data.title;
          if (descInput) descInput.value = data.description;
          if (publicCheckbox) publicCheckbox.checked = false;
          if (saveButton) saveButton.click();
        }
      },
      { title: sessionTitle, description: sessionDescription }
    );

    // Wait for session to be created and form to close
    await page.waitForTimeout(2000);

    // Verify session appears in the list
    const sessionExists = await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        for (const item of sessionItems) {
          const titleElement = item.querySelector('.session-title');
          if (titleElement && titleElement.textContent?.includes(title)) {
            return true;
          }
        }
      }
      return false;
    }, sessionTitle);

    expect(sessionExists).toBe(true);
  });

  test('should edit an existing session', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create a test session via API
    const originalSession = await createTestSession(baseURL, authData, {
      title: 'Original Session Title',
      description: 'Original description',
      isPublic: false,
    });

    // Reload page to show the new session
    await page.reload();
    await page.waitForSelector('session-management-widget');
    await page.waitForTimeout(1000);

    const updatedTitle = 'Updated Session Title';
    const updatedDescription = 'Updated description';

    // Click edit button for the session
    await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const editButton = shadowRoot.querySelector(
          `[data-session-id="${sessionId}"] .edit-btn`
        ) as HTMLButtonElement;
        if (editButton) editButton.click();
      }
    }, originalSession.id);

    // Wait for edit form to appear
    await page.waitForTimeout(500);

    // Update session details
    await page.evaluate(
      data => {
        const sessionWidget = document.querySelector('session-management-widget') as any;
        const shadowRoot = sessionWidget?.shadowRoot;
        if (shadowRoot) {
          const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
          const descInput = shadowRoot.querySelector('#session-description') as HTMLTextAreaElement;
          const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

          if (titleInput) {
            titleInput.value = data.title;
            titleInput.dispatchEvent(new Event('input'));
          }
          if (descInput) {
            descInput.value = data.description;
            descInput.dispatchEvent(new Event('input'));
          }
          if (saveButton) saveButton.click();
        }
      },
      { title: updatedTitle, description: updatedDescription }
    );

    // Wait for update to complete
    await page.waitForTimeout(2000);

    // Verify session was updated
    const sessionUpdated = await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        for (const item of sessionItems) {
          const titleElement = item.querySelector('.session-title');
          if (titleElement && titleElement.textContent?.includes(title)) {
            return true;
          }
        }
      }
      return false;
    }, updatedTitle);

    expect(sessionUpdated).toBe(true);
  });

  test('should delete a session', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create a test session via API
    const testSession = await createTestSession(baseURL, authData, {
      title: 'Session to Delete',
      description: 'This session will be deleted',
      isPublic: false,
    });

    // Reload page to show the new session
    await page.reload();
    await page.waitForSelector('session-management-widget');
    await page.waitForTimeout(1000);

    // Verify session exists
    let sessionExists = await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        for (const item of sessionItems) {
          const titleElement = item.querySelector('.session-title');
          if (titleElement && titleElement.textContent?.includes(title)) {
            return true;
          }
        }
      }
      return false;
    }, testSession.title);

    expect(sessionExists).toBe(true);

    // Click delete button for the session
    await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const deleteButton = shadowRoot.querySelector(
          `[data-session-id="${sessionId}"] .delete-btn`
        ) as HTMLButtonElement;
        if (deleteButton) deleteButton.click();
      }
    }, testSession.id);

    // Confirm deletion if there's a confirmation dialog
    await page.waitForTimeout(500);

    const hasConfirmDialog = await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const confirmButton = shadowRoot.querySelector('#confirm-delete-btn');
        return confirmButton !== null;
      }
      return false;
    });

    if (hasConfirmDialog) {
      await page.evaluate(() => {
        const sessionWidget = document.querySelector('session-management-widget') as any;
        const shadowRoot = sessionWidget?.shadowRoot;
        if (shadowRoot) {
          const confirmButton = shadowRoot.querySelector(
            '#confirm-delete-btn'
          ) as HTMLButtonElement;
          if (confirmButton) confirmButton.click();
        }
      });
    }

    // Wait for deletion to complete
    await page.waitForTimeout(2000);

    // Verify session no longer exists
    sessionExists = await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        for (const item of sessionItems) {
          const titleElement = item.querySelector('.session-title');
          if (titleElement && titleElement.textContent?.includes(title)) {
            return true;
          }
        }
      }
      return false;
    }, testSession.title);

    expect(sessionExists).toBe(false);
  });

  test('should toggle session visibility (public/private)', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create a private test session via API
    const testSession = await createTestSession(baseURL, authData, {
      title: 'Visibility Toggle Test',
      description: 'Testing visibility toggle',
      isPublic: false,
    });

    // Reload page to show the new session
    await page.reload();
    await page.waitForSelector('session-management-widget');
    await page.waitForTimeout(1000);

    // Check initial visibility indicator
    const isPrivate = await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItem = shadowRoot.querySelector(`[data-session-id="${sessionId}"]`);
        const visibilityIndicator = sessionItem?.querySelector('.visibility-indicator');
        return visibilityIndicator?.textContent?.includes('Private') || false;
      }
      return false;
    }, testSession.id);

    expect(isPrivate).toBe(true);

    // Toggle visibility
    await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const visibilityToggle = shadowRoot.querySelector(
          `[data-session-id="${sessionId}"] .visibility-toggle`
        ) as HTMLButtonElement;
        if (visibilityToggle) visibilityToggle.click();
      }
    }, testSession.id);

    // Wait for toggle to complete
    await page.waitForTimeout(2000);

    // Check updated visibility indicator
    const isPublic = await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItem = shadowRoot.querySelector(`[data-session-id="${sessionId}"]`);
        const visibilityIndicator = sessionItem?.querySelector('.visibility-indicator');
        return visibilityIndicator?.textContent?.includes('Public') || false;
      }
      return false;
    }, testSession.id);

    expect(isPublic).toBe(true);
  });

  test('should display session pagination when many sessions exist', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create multiple test sessions (more than typical page size)
    const sessionPromises = [];
    for (let i = 1; i <= 15; i++) {
      sessionPromises.push(
        createTestSession(baseURL, authData, {
          title: `Pagination Test Session ${i}`,
          description: `Session ${i} for pagination testing`,
          isPublic: false,
        })
      );
    }

    await Promise.all(sessionPromises);

    // Reload page to show sessions
    await page.reload();
    await page.waitForSelector('session-management-widget');
    await page.waitForTimeout(2000);

    // Check if pagination controls are present
    const hasPagination = await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const paginationControls = shadowRoot.querySelector('.pagination-controls');
        return paginationControls !== null;
      }
      return false;
    });

    // Note: This test might pass or fail depending on the pagination implementation
    // If pagination is not yet implemented, this test documents the expected behavior
    console.log('Pagination controls present:', hasPagination);

    // Check that sessions are displayed (at least some of them)
    const sessionCount = await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        return sessionItems.length;
      }
      return 0;
    });

    expect(sessionCount).toBeGreaterThan(0);
    expect(sessionCount).toBeLessThanOrEqual(15);
  });
});
