import { test, expect } from '@playwright/test';
import { loginViaUI, getTestCredentials } from '../helpers/auth';
import { createTestSession, createTestLocation, cleanupUserTestData } from '../helpers/test-data';
import { createApiClient } from '../helpers/api-client';

test.describe('Location Tracking', () => {
  const baseURL = 'http://localhost:8090';

  test.beforeEach(async ({ page }) => {
    // Start with authentication
    await page.goto('/');
    const credentials = getTestCredentials();
    await loginViaUI(page, credentials);
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

  test('should display map widget', async ({ page }) => {
    // Check that map widget is visible
    await expect(page.locator('map-widget')).toBeVisible();

    // Wait for map to initialize
    await page.waitForTimeout(2000);

    // Check that Leaflet map is initialized within shadow DOM
    const isMapInitialized = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        return mapContainer && mapContainer.children.length > 0;
      }
      return false;
    });

    expect(isMapInitialized).toBe(true);
  });

  test('should create location via API and display on map', async ({ page }) => {
    // Wait for map to be ready
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(2000);

    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create a test session first
    const apiClient = createApiClient(baseURL, token!);
    const sessionName = `manual-test-${Date.now()}`;
    const session = await createTestSession(baseURL, authData, {
      title: 'Manual Location Test',
      isPublic: false,
      name: sessionName,
    });

    // Navigate to the session-specific page first
    const username = authData.record.username;
    await page.goto(`/u/${username}/s/${sessionName}`);
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(2000);

    // Create a location via API
    await createTestLocation(baseURL, authData, {
      latitude: 47.6062,
      longitude: -122.3321,
      accuracy: 10,
      session: sessionName,
    });

    // Reload the page to show the new location
    await page.goto(`/u/${username}/s/${sessionName}`);
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Verify location was created by checking the map shows 1 marker
    const markerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        const markers = mapContainer?.querySelectorAll('.leaflet-marker-icon');
        return markers?.length || 0;
      }
      return 0;
    });

    expect(markerCount).toBe(1);
  });

  test('should display existing locations on map', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create test session and locations - define session name explicitly
    const sessionName = `test-session-${Date.now()}`;
    const session = await createTestSession(baseURL, authData, {
      title: 'Display Locations Test',
      isPublic: false,
      name: sessionName,
    });

    const testLocations = [
      { latitude: 47.6062, longitude: -122.3321 },
      { latitude: 47.6085, longitude: -122.3421 },
      { latitude: 47.6205, longitude: -122.3493 },
    ];

    // Create locations via API
    for (const loc of testLocations) {
      await createTestLocation(baseURL, authData, {
        ...loc,
        session: sessionName,
      });
    }

    // Navigate to session-specific page to see the locations
    const username = authData.record.username;
    await page.goto(`/u/${username}/s/${sessionName}`);
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Check that one marker (latest position) and a track line are displayed
    const markerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        const markers = mapContainer?.querySelectorAll('.leaflet-marker-icon');
        return markers?.length || 0;
      }
      return 0;
    });

    // Should see 1 marker (latest position) for the session
    expect(markerCount).toBe(1);

    // Check that a track line exists (polyline)
    const hasTrackLine = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        const polylines = mapContainer?.querySelectorAll('.leaflet-interactive[fill="none"]');
        return polylines?.length > 0;
      }
      return false;
    });

    expect(hasTrackLine).toBe(true);
  });

  test('should handle public vs private locations', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create public session and location
    const publicSessionName = `public-test-${Date.now()}`;
    const publicSession = await createTestSession(baseURL, authData, {
      title: 'Public Session Test',
      isPublic: true,
      name: publicSessionName,
    });

    const publicLocation = await createTestLocation(baseURL, authData, {
      latitude: 47.6062,
      longitude: -122.3321,
      session: publicSessionName,
    });

    // Create private session and location
    const privateSessionName = `private-test-${Date.now()}`;
    const privateSession = await createTestSession(baseURL, authData, {
      title: 'Private Session Test',
      isPublic: false,
      name: privateSessionName,
    });

    const privateLocation = await createTestLocation(baseURL, authData, {
      latitude: 47.6085,
      longitude: -122.3421,
      session: privateSessionName,
    });

    // Test public session visibility on main page
    await page.goto('/');
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Only public location should be visible on public page
    const publicMarkerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        const markers = mapContainer?.querySelectorAll('.leaflet-marker-icon');
        return markers?.length || 0;
      }
      return 0;
    });

    // Should see at least 1 marker from public session (there might be other public locations)
    expect(publicMarkerCount).toBeGreaterThanOrEqual(1);

    // Test private session is not visible - navigate to specific private session as non-owner would fail
    // But as owner, check the private session directly
    const username = authData.record.username;
    await page.goto(`/u/${username}/s/${privateSessionName}`);
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(2000);

    // Private session should have 1 location when viewed by owner
    const privateMarkerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        const markers = mapContainer?.querySelectorAll('.leaflet-marker-icon');
        return markers?.length || 0;
      }
      return 0;
    });

    expect(privateMarkerCount).toBe(1);
  });

  test('should display location popup with details', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create test session and location
    const sessionName = `popup-test-${Date.now()}`;
    const session = await createTestSession(baseURL, authData, {
      title: 'Popup Test Session',
      isPublic: false,
      name: sessionName,
    });

    const testLocation = await createTestLocation(baseURL, authData, {
      latitude: 47.6062,
      longitude: -122.3321,
      session: sessionName,
    });

    // Navigate to session-specific page to display location
    const username = authData.record.username;
    await page.goto(`/u/${username}/s/${sessionName}`);
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Click on the marker to open popup
    await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const marker = shadowRoot.querySelector('.leaflet-marker-icon');
        if (marker) {
          marker.click();
        }
      }
    });

    // Wait for popup to appear
    await page.waitForTimeout(1000);

    // Check that popup is visible
    const isPopupVisible = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const popup = shadowRoot.querySelector('.leaflet-popup');
        return popup && popup.style.display !== 'none';
      }
      return false;
    });

    expect(isPopupVisible).toBe(true);
  });

  test('should filter locations by session', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create two test sessions with locations
    const session1Name = `session1-${Date.now()}`;
    const session1 = await createTestSession(baseURL, authData, {
      title: 'Session 1',
      isPublic: false,
      name: session1Name,
    });

    const session2Name = `session2-${Date.now()}`;
    const session2 = await createTestSession(baseURL, authData, {
      title: 'Session 2',
      isPublic: false,
      name: session2Name,
    });

    // Create locations for each session
    await createTestLocation(baseURL, authData, {
      latitude: 47.6062,
      longitude: -122.3321,
      session: session1Name,
    });

    await createTestLocation(baseURL, authData, {
      latitude: 47.6085,
      longitude: -122.3421,
      session: session2Name,
    });

    // Navigate to main page where both sessions' locations should be visible
    await page.goto('/');
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Navigate to the user's map where all sessions should be visible
    const username = authData.record.username;
    await page.goto(`/u/${username}`);
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Check initial marker count (may show latest session only)
    let markerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        const markers = mapContainer?.querySelectorAll('.leaflet-marker-icon');
        return markers?.length || 0;
      }
      return 0;
    });

    // User route only shows latest session, so we should see 1 marker
    expect(markerCount).toBeGreaterThanOrEqual(1);

    // Navigate to first session specifically
    await page.goto(`/u/${username}/s/${session1Name}`);
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(2000);

    // Should see only session1's location
    markerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        const markers = mapContainer?.querySelectorAll('.leaflet-marker-icon');
        return markers?.length || 0;
      }
      return 0;
    });

    expect(markerCount).toBe(1);

    // Navigate to second session specifically
    await page.goto(`/u/${username}/s/${session2Name}`);
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(2000);

    // Should see only session2's location
    markerCount = await page.evaluate(() => {
      const mapWidget = document.querySelector('map-widget') as any;
      const shadowRoot = mapWidget?.shadowRoot;
      if (shadowRoot) {
        const mapContainer = shadowRoot.querySelector('#map');
        const markers = mapContainer?.querySelectorAll('.leaflet-marker-icon');
        return markers?.length || 0;
      }
      return 0;
    });

    expect(markerCount).toBe(1);
  });
});
