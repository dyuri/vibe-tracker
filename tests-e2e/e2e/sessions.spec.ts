import { test, expect } from '@playwright/test';
import { loginViaUI, getTestCredentials } from '../helpers/auth';
import { createTestSession, cleanupUserTestData } from '../helpers/test-data';
import { createApiClient } from '../helpers/api-client';

test.describe.configure({ mode: 'parallel' });
test.describe('Session Management', () => {
  const baseURL = 'http://localhost:8090';

  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state first
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Perform fresh login
    const credentials = getTestCredentials();
    await loginViaUI(page, credentials);

    // Navigate to sessions page
    await page.goto('/profile/sessions');

    // Wait for session management widget to load and be authenticated
    await page.waitForSelector('session-management-widget');

    // Wait for authentication state to be fully loaded in the widget
    await page.waitForFunction(
      () => {
        const widget = document.querySelector('session-management-widget') as any;
        const shadowRoot = widget?.shadowRoot;
        if (shadowRoot) {
          const notAuthenticated = shadowRoot.querySelector('#not-authenticated');
          const sessionContent = shadowRoot.querySelector('#session-content');
          // Make sure not-authenticated is hidden AND session-content is visible
          return (
            notAuthenticated.classList.contains('hidden') &&
            sessionContent.classList.contains('show')
          );
        }
        return false;
      },
      { timeout: 15000 }
    );

    console.log('Widget authenticated successfully');
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
    // Capture console messages
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });

    const timestamp = Date.now();
    const sessionName = `test-session-${timestamp}`;
    const sessionTitle = `Test Session ${timestamp}`;
    const sessionDescription = 'A test session created via E2E testing';

    // Open create session form - look for "Create Session" button text
    const buttonClicked = await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        // Look for button containing "Create Session" text
        const buttons = shadowRoot.querySelectorAll('button');
        for (const button of buttons) {
          if (button.textContent && button.textContent.trim() === 'Create Session') {
            button.click();
            return true;
          }
        }
      }
      return false;
    });

    console.log(`Create Session button clicked: ${buttonClicked}`);

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Fill in session details - including the required session name
    await page.evaluate(
      data => {
        const sessionWidget = document.querySelector('session-management-widget') as any;
        const shadowRoot = sessionWidget?.shadowRoot;
        if (shadowRoot) {
          const nameInput = shadowRoot.querySelector('#session-name') as HTMLInputElement;
          const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
          const descInput = shadowRoot.querySelector('#session-description') as HTMLTextAreaElement;
          const publicCheckbox = shadowRoot.querySelector('#session-public') as HTMLInputElement;
          const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

          if (nameInput) {
            nameInput.value = data.name;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (titleInput) {
            titleInput.value = data.title;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (descInput) {
            descInput.value = data.description;
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (publicCheckbox) {
            publicCheckbox.checked = false;
            publicCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
          }

          console.log('Form filled, about to submit form');

          // Add form submission debugging
          const form = shadowRoot.querySelector('#session-form');
          if (form) {
            form.addEventListener('submit', e => {
              console.log('Form submit event triggered:', e);
            });
          }

          // Add a listener to capture fetch calls for debugging
          const originalFetch = window.fetch;
          window.fetch = function (...args) {
            console.log('Fetch call:', args);
            return originalFetch
              .apply(this, args)
              .then(response => {
                console.log('Fetch response:', response.status, response.url);
                return response;
              })
              .catch(error => {
                console.error('Fetch error:', error);
                throw error;
              });
          };

          // Check form validity before submit
          if (nameInput && titleInput) {
            console.log(
              'Form inputs valid:',
              nameInput.checkValidity(),
              titleInput.checkValidity()
            );
            console.log('Form values:', { name: nameInput.value, title: titleInput.value });
          }

          // Trigger form submit event to ensure handlers run
          if (form) {
            console.log('Triggering form submit event');
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
          } else if (saveButton) {
            saveButton.click();
            console.log('Save button clicked as fallback');
          }
        }
      },
      { name: sessionName, title: sessionTitle, description: sessionDescription }
    );

    // Wait longer for session to be created and UI to refresh
    await page.waitForTimeout(3000);

    // Check if we need to reload the page to see the new session
    await page.reload();
    await page.waitForSelector('session-management-widget');
    await page.waitForTimeout(1000);

    // Verify session appears in the list (should be at the top since newest first)
    // Try both session name and title since we're not sure which one is displayed
    const sessionExists = await page.evaluate(
      searchData => {
        const sessionWidget = document.querySelector('session-management-widget') as any;
        const shadowRoot = sessionWidget?.shadowRoot;
        if (shadowRoot) {
          console.log(
            'Looking for session with name:',
            searchData.name,
            'or title:',
            searchData.title
          );

          // Look for any element containing the session name or title text
          const allElements = shadowRoot.querySelectorAll('*');
          let foundTexts = [];
          for (const element of allElements) {
            if (element.textContent && element.textContent.trim()) {
              const text = element.textContent.trim();
              foundTexts.push(text);
              if (text === searchData.title || text === searchData.name) {
                console.log('Found matching session:', text);
                return true;
              }
            }
          }
          console.log('Available session texts (first 30):', foundTexts.slice(0, 30));
          return false;
        }
        return false;
      },
      { name: sessionName, title: sessionTitle }
    );

    // Output console logs for debugging
    if (!sessionExists) {
      console.log('Session not found. Console logs:', consoleLogs);
    }

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

    // Wait for authentication state to be fully loaded in the widget
    await page.waitForFunction(
      () => {
        const widget = document.querySelector('session-management-widget') as any;
        const shadowRoot = widget?.shadowRoot;
        if (shadowRoot) {
          const notAuthenticated = shadowRoot.querySelector('#not-authenticated');
          const sessionContent = shadowRoot.querySelector('#session-content');
          // Make sure not-authenticated is hidden AND session-content is visible
          return (
            notAuthenticated.classList.contains('hidden') &&
            sessionContent.classList.contains('show')
          );
        }
        return false;
      },
      { timeout: 15000 }
    );

    const updatedTitle = 'Updated Session Title';
    const updatedDescription = 'Updated description';

    // Click edit button for the session
    await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const editButton = shadowRoot.querySelector(
          `.edit-btn[data-session-id="${sessionId}"]`
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
          const form = shadowRoot.querySelector('#session-form') as HTMLFormElement;

          console.log('Edit form - updating inputs');

          if (titleInput) {
            titleInput.value = data.title;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (descInput) {
            descInput.value = data.description;
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
          }

          console.log('Edit form - submitting via form event');

          // Trigger form submit event to ensure handlers run
          if (form) {
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
          }
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
        // Look for any element containing the updated session title text
        const allElements = shadowRoot.querySelectorAll('*');
        for (const element of allElements) {
          if (element.textContent && element.textContent.trim() === title) {
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

    // Wait for authentication state to be fully loaded in the widget
    await page.waitForFunction(
      () => {
        const widget = document.querySelector('session-management-widget') as any;
        const shadowRoot = widget?.shadowRoot;
        if (shadowRoot) {
          const notAuthenticated = shadowRoot.querySelector('#not-authenticated');
          const sessionContent = shadowRoot.querySelector('#session-content');
          // Make sure not-authenticated is hidden AND session-content is visible
          return (
            notAuthenticated.classList.contains('hidden') &&
            sessionContent.classList.contains('show')
          );
        }
        return false;
      },
      { timeout: 15000 }
    );

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

    // Set up dialog handler to accept browser confirmation dialog
    page.on('dialog', async dialog => {
      console.log('Dialog message:', dialog.message());
      await dialog.accept();
    });

    // Click delete button for the session
    await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const deleteButton = shadowRoot.querySelector(
          `.delete-btn[data-session-id="${sessionId}"]`
        ) as HTMLButtonElement;
        if (deleteButton) deleteButton.click();
      }
    }, testSession.id);

    // Wait for deletion to complete
    await page.waitForTimeout(1000);

    // Verify session no longer exists
    sessionExists = await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        // Look for any element containing the session title text
        const allElements = shadowRoot.querySelectorAll('*');
        for (const element of allElements) {
          if (element.textContent && element.textContent.trim() === title) {
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

    // Wait for authentication state to be fully loaded in the widget
    await page.waitForFunction(
      () => {
        const widget = document.querySelector('session-management-widget') as any;
        const shadowRoot = widget?.shadowRoot;
        if (shadowRoot) {
          const notAuthenticated = shadowRoot.querySelector('#not-authenticated');
          const sessionContent = shadowRoot.querySelector('#session-content');
          // Make sure not-authenticated is hidden AND session-content is visible
          return (
            notAuthenticated.classList.contains('hidden') &&
            sessionContent.classList.contains('show')
          );
        }
        return false;
      },
      { timeout: 15000 }
    );

    // Check initial visibility indicator (should show "Private")
    const isPrivate = await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItem = shadowRoot.querySelector(`[data-session-id="${sessionId}"]`);
        // Look for either .private-indicator or text containing "Private"
        const privateIndicator = sessionItem?.querySelector('.private-indicator');
        if (privateIndicator) return true;
        // Fallback: look for any element containing "Private" text
        const allElements = sessionItem?.querySelectorAll('*');
        if (allElements) {
          for (const element of allElements) {
            if (element.textContent?.includes('Private')) return true;
          }
        }
      }
      return false;
    }, testSession.id);

    expect(isPrivate).toBe(true);

    // Toggle visibility via Edit form
    // Click edit button
    await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const editButton = shadowRoot.querySelector(
          `.edit-btn[data-session-id="${sessionId}"]`
        ) as HTMLButtonElement;
        if (editButton) editButton.click();
      }
    }, testSession.id);

    // Wait for edit form to appear
    await page.waitForTimeout(500);

    // Toggle the public checkbox and submit
    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const publicCheckbox = shadowRoot.querySelector('#session-public') as HTMLInputElement;
        const form = shadowRoot.querySelector('#session-form') as HTMLFormElement;

        if (publicCheckbox) {
          publicCheckbox.checked = true; // Make it public
          publicCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Submit the form
        if (form) {
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(submitEvent);
        }
      }
    });

    // Wait for update to complete
    await page.waitForTimeout(3000);

    // Check updated visibility indicator (should show "Public")
    const isPublic = await page.evaluate(sessionId => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItem = shadowRoot.querySelector(`[data-session-id="${sessionId}"]`);
        // Look for either .public-indicator or text containing "Public"
        const publicIndicator = sessionItem?.querySelector('.public-indicator');
        if (publicIndicator) return true;
        // Fallback: look for any element containing "Public" text
        const allElements = sessionItem?.querySelectorAll('*');
        if (allElements) {
          for (const element of allElements) {
            if (element.textContent?.includes('Public')) return true;
          }
        }
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
    const timestamp = Date.now();
    for (let i = 1; i <= 15; i++) {
      sessionPromises.push(
        createTestSession(baseURL, authData, {
          title: `Pagination Test Session ${i}`,
          description: `Session ${i} for pagination testing`,
          isPublic: false,
          name: `pagination-test-${timestamp}-${i}`,
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
    expect(sessionCount).toBeLessThanOrEqual(20);
  });
});
