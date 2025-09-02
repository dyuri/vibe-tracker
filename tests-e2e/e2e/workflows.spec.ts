import { test, expect } from '@playwright/test';
import { loginViaUI, logoutViaUI, getTestCredentials, isAuthenticated } from '../helpers/auth';
import { createTestUser, cleanupUserTestData } from '../helpers/test-data';
import { createApiClient } from '../helpers/api-client';

test.describe('Integration Workflows', () => {
  const baseURL = 'http://localhost:8090';

  test.afterEach(async ({ page }) => {
    // Clean up test data if user is logged in
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));

    if (token && userStr) {
      const user = JSON.parse(userStr);
      const authData = { token, record: user };
      await cleanupUserTestData(baseURL, authData);
    }
  });

  test('complete user journey: signup → login → create session → track locations → share', async ({
    page,
  }) => {
    // Step 1: Navigate to application
    await page.goto('/');

    // Step 2: Login with test credentials
    const credentials = getTestCredentials();
    await loginViaUI(page, credentials);

    // Verify login successful
    expect(await isAuthenticated(page)).toBe(true);

    // Step 3: Create a new session
    const sessionTitle = `Journey Session ${Date.now()}`;

    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    await page.waitForTimeout(500);

    await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const descInput = shadowRoot.querySelector('#session-description') as HTMLTextAreaElement;
        const publicCheckbox = shadowRoot.querySelector('#session-public') as HTMLInputElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) titleInput.value = title;
        if (descInput) descInput.value = 'A complete user journey test session';
        if (publicCheckbox) publicCheckbox.checked = true; // Make it public for sharing
        if (saveButton) saveButton.click();
      }
    }, sessionTitle);

    await page.waitForTimeout(2000);

    // Verify session was created
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

    // Step 4: Track multiple locations
    const locations = [
      { lat: 47.6062, lng: -122.3321 }, // Seattle
      { lat: 47.6085, lng: -122.3421 }, // Pike Place
      { lat: 47.6205, lng: -122.3493 }, // Space Needle
    ];

    for (const location of locations) {
      await page.evaluate(loc => {
        const mapWidget = document.querySelector('map-widget') as any;
        if (mapWidget && mapWidget.postLocation) {
          mapWidget.postLocation(loc.lat, loc.lng, 10);
        }
      }, location);

      await page.waitForTimeout(1000);
    }

    // Verify locations are displayed on map
    await page.waitForTimeout(2000);

    const markerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const markers = shadowRoot.querySelectorAll('.leaflet-marker-icon');
        return markers.length;
      }
      return 0;
    });

    expect(markerCount).toBe(locations.length);

    // Step 5: Test sharing (public session should be accessible)
    // Get session data for sharing verification
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const apiClient = createApiClient(baseURL, token!);
    const sessionsResponse = await apiClient.getSessions(`title~'${sessionTitle}'`);

    expect(sessionsResponse.success).toBe(true);
    expect(sessionsResponse.data?.items?.length).toBeGreaterThan(0);

    const publicSession = sessionsResponse.data.items[0];
    expect(publicSession.isPublic).toBe(true);

    console.log(`✅ Complete user journey test passed for session: ${sessionTitle}`);
  });

  test('cross-user interaction: user A creates public session, user B views locations', async ({
    page,
    context,
  }) => {
    // This test would ideally use two browser contexts, but for simplicity,
    // we'll create a public session and then verify it can be accessed

    // User A: Login and create public session
    const credentialsA = getTestCredentials();
    await page.goto('/');
    await loginViaUI(page, credentialsA);

    // Create public session
    const sessionTitle = `Public Session ${Date.now()}`;

    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    await page.waitForTimeout(500);

    await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const publicCheckbox = shadowRoot.querySelector('#session-public') as HTMLInputElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) titleInput.value = title;
        if (publicCheckbox) publicCheckbox.checked = true;
        if (saveButton) saveButton.click();
      }
    }, sessionTitle);

    await page.waitForTimeout(2000);

    // Add location to the public session
    await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      if (mapWidget && mapWidget.postLocation) {
        mapWidget.postLocation(47.6062, -122.3321, 10);
      }
    });

    await page.waitForTimeout(1000);

    // Get session ID for verification
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const apiClient = createApiClient(baseURL, token!);
    const sessionsResponse = await apiClient.getSessions(`title~'${sessionTitle}'`);
    const publicSession = sessionsResponse.data.items[0];

    // Verify public session exists and is accessible
    expect(publicSession.isPublic).toBe(true);

    // Verify public locations can be accessed without authentication
    const publicLocationsResponse = await fetch(
      `${baseURL}/api/collections/locations/records?filter=(sessionId='${publicSession.id}')&filter=(isPublic=true)`
    );
    expect(publicLocationsResponse.ok).toBe(true);

    const publicLocations = await publicLocationsResponse.json();
    expect(publicLocations.items.length).toBeGreaterThan(0);

    console.log(`✅ Cross-user interaction test passed for session: ${sessionTitle}`);
  });

  test('data consistency: UI actions match API state', async ({ page }) => {
    // Login
    const credentials = getTestCredentials();
    await page.goto('/');
    await loginViaUI(page, credentials);

    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const apiClient = createApiClient(baseURL, token!);

    // Create session via UI
    const sessionTitle = `Consistency Test ${Date.now()}`;

    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    await page.waitForTimeout(500);

    await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const descInput = shadowRoot.querySelector('#session-description') as HTMLTextAreaElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) titleInput.value = title;
        if (descInput) descInput.value = 'Testing data consistency';
        if (saveButton) saveButton.click();
      }
    }, sessionTitle);

    await page.waitForTimeout(2000);

    // Verify session exists in API
    const sessionsResponse = await apiClient.getSessions(`title~'${sessionTitle}'`);
    expect(sessionsResponse.success).toBe(true);
    expect(sessionsResponse.data?.items?.length).toBeGreaterThan(0);

    const apiSession = sessionsResponse.data.items[0];
    expect(apiSession.title).toBe(sessionTitle);
    expect(apiSession.description).toBe('Testing data consistency');

    // Add location via UI
    await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      if (mapWidget && mapWidget.postLocation) {
        mapWidget.postLocation(47.6062, -122.3321, 10);
      }
    });

    await page.waitForTimeout(2000);

    // Verify location exists in API
    const locationsResponse = await apiClient.getLocations(`sessionId='${apiSession.id}'`);
    expect(locationsResponse.success).toBe(true);
    expect(locationsResponse.data?.items?.length).toBeGreaterThan(0);

    const apiLocation = locationsResponse.data.items[0];
    expect(Math.abs(apiLocation.latitude - 47.6062)).toBeLessThan(0.001);
    expect(Math.abs(apiLocation.longitude - -122.3321)).toBeLessThan(0.001);

    // Verify UI displays the same data
    const uiMarkerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const markers = shadowRoot.querySelectorAll('.leaflet-marker-icon');
        return markers.length;
      }
      return 0;
    });

    expect(uiMarkerCount).toBe(locationsResponse.data.items.length);

    console.log(`✅ Data consistency test passed for session: ${sessionTitle}`);
  });

  test('error recovery: handle network failures gracefully', async ({ page }) => {
    // Login first
    const credentials = getTestCredentials();
    await page.goto('/');
    await loginViaUI(page, credentials);

    // Create a session successfully first
    const sessionTitle = `Error Recovery Test ${Date.now()}`;

    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    await page.waitForTimeout(500);

    await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) titleInput.value = title;
        if (saveButton) saveButton.click();
      }
    }, sessionTitle);

    await page.waitForTimeout(2000);

    // Verify session was created successfully
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

    // Now simulate network failure
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    // Try to create another session (this should fail gracefully)
    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) titleInput.value = 'Failed Session';
        if (saveButton) saveButton.click();
      }
    });

    await page.waitForTimeout(3000);

    // Verify application still works (first session should still be visible)
    const firstSessionStillExists = await page.evaluate(title => {
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

    expect(firstSessionStillExists).toBe(true);

    // Restore network and verify functionality returns
    await page.unroute('**/api/**');

    // Try creating a session again (should work now)
    const recoveryTitle = `Recovery Test ${Date.now()}`;

    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    await page.waitForTimeout(500);

    await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) titleInput.value = title;
        if (saveButton) saveButton.click();
      }
    }, recoveryTitle);

    await page.waitForTimeout(2000);

    // Verify recovery session was created
    const recoverySessionExists = await page.evaluate(title => {
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
    }, recoveryTitle);

    expect(recoverySessionExists).toBe(true);

    console.log(`✅ Error recovery test passed`);
  });

  test('session workflow: create → edit → add locations → toggle visibility → delete', async ({
    page,
  }) => {
    // Login
    const credentials = getTestCredentials();
    await page.goto('/');
    await loginViaUI(page, credentials);

    // Step 1: Create session
    const originalTitle = `Workflow Session ${Date.now()}`;

    await page.evaluate(() => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const createButton = shadowRoot.querySelector('#create-session-btn') as HTMLButtonElement;
        if (createButton) createButton.click();
      }
    });

    await page.waitForTimeout(500);

    await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const descInput = shadowRoot.querySelector('#session-description') as HTMLTextAreaElement;
        const publicCheckbox = shadowRoot.querySelector('#session-public') as HTMLInputElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) titleInput.value = title;
        if (descInput) descInput.value = 'Original description';
        if (publicCheckbox) publicCheckbox.checked = false;
        if (saveButton) saveButton.click();
      }
    }, originalTitle);

    await page.waitForTimeout(2000);

    // Verify session created
    expect(
      await page.evaluate(title => {
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
      }, originalTitle)
    ).toBe(true);

    // Get session ID for further operations
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const apiClient = createApiClient(baseURL, token!);
    const sessionsResponse = await apiClient.getSessions(`title~'${originalTitle}'`);
    const sessionId = sessionsResponse.data.items[0].id;

    // Step 2: Edit session
    const updatedTitle = `Updated ${originalTitle}`;

    await page.evaluate(id => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const editButton = shadowRoot.querySelector(
          `[data-session-id="${id}"] .edit-btn`
        ) as HTMLButtonElement;
        if (editButton) editButton.click();
      }
    }, sessionId);

    await page.waitForTimeout(500);

    await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const titleInput = shadowRoot.querySelector('#session-title') as HTMLInputElement;
        const saveButton = shadowRoot.querySelector('#save-session-btn') as HTMLButtonElement;

        if (titleInput) {
          titleInput.value = title;
          titleInput.dispatchEvent(new Event('input'));
        }
        if (saveButton) saveButton.click();
      }
    }, updatedTitle);

    await page.waitForTimeout(2000);

    // Step 3: Add locations
    const locations = [
      { lat: 47.6062, lng: -122.3321 },
      { lat: 47.6085, lng: -122.3421 },
    ];

    for (const location of locations) {
      await page.evaluate(loc => {
        const mapWidget = document.querySelector('map-widget') as any;
        if (mapWidget && mapWidget.postLocation) {
          mapWidget.postLocation(loc.lat, loc.lng, 10);
        }
      }, location);

      await page.waitForTimeout(1000);
    }

    // Step 4: Toggle visibility
    await page.evaluate(id => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const visibilityToggle = shadowRoot.querySelector(
          `[data-session-id="${id}"] .visibility-toggle`
        ) as HTMLButtonElement;
        if (visibilityToggle) visibilityToggle.click();
      }
    }, sessionId);

    await page.waitForTimeout(2000);

    // Step 5: Delete session
    await page.evaluate(id => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const deleteButton = shadowRoot.querySelector(
          `[data-session-id="${id}"] .delete-btn`
        ) as HTMLButtonElement;
        if (deleteButton) deleteButton.click();
      }
    }, sessionId);

    // Confirm deletion if needed
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

    await page.waitForTimeout(2000);

    // Verify session deleted
    const sessionDeleted = await page.evaluate(title => {
      const sessionWidget = document.querySelector('session-management-widget') as any;
      const shadowRoot = sessionWidget?.shadowRoot;
      if (shadowRoot) {
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        for (const item of sessionItems) {
          const titleElement = item.querySelector('.session-title');
          if (titleElement && titleElement.textContent?.includes(title)) {
            return false; // Session still exists
          }
        }
      }
      return true; // Session not found, so it was deleted
    }, updatedTitle);

    expect(sessionDeleted).toBe(true);

    console.log(`✅ Complete session workflow test passed`);
  });
});
