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

  test('should post location manually', async ({ page }) => {
    // Wait for map to be ready
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(2000);

    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create a test session first
    const apiClient = createApiClient(baseURL, token!);
    const session = await createTestSession(baseURL, authData, {
      title: 'Manual Location Test',
      isPublic: false,
    });

    // Simulate posting a location via the map widget
    const testLocation = {
      latitude: 47.6062,
      longitude: -122.3321,
      accuracy: 10,
      sessionId: session.id,
    };

    await page.evaluate(location => {
      const mapWidget = document.querySelector('map-widget') as any;
      if (mapWidget && mapWidget.postLocation) {
        mapWidget.postLocation(location.latitude, location.longitude, location.accuracy);
      }
    }, testLocation);

    // Wait for location to be posted
    await page.waitForTimeout(2000);

    // Verify location was created via API
    const locationsResponse = await apiClient.getLocations(`sessionId='${session.id}'`);
    expect(locationsResponse.success).toBe(true);
    expect(locationsResponse.data?.items?.length).toBeGreaterThan(0);

    const postedLocation = locationsResponse.data.items[0];
    expect(Math.abs(postedLocation.latitude - testLocation.latitude)).toBeLessThan(0.001);
    expect(Math.abs(postedLocation.longitude - testLocation.longitude)).toBeLessThan(0.001);
  });

  test('should display existing locations on map', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create test session and locations
    const session = await createTestSession(baseURL, authData, {
      title: 'Display Locations Test',
      isPublic: false,
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
        sessionId: session.id,
      });
    }

    // Reload page to display locations
    await page.reload();
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Check that markers are displayed on the map
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

    expect(markerCount).toBe(testLocations.length);
  });

  test('should handle public vs private locations', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create public session and location
    const publicSession = await createTestSession(baseURL, authData, {
      title: 'Public Session Test',
      isPublic: true,
    });

    const publicLocation = await createTestLocation(baseURL, authData, {
      latitude: 47.6062,
      longitude: -122.3321,
      sessionId: publicSession.id,
      isPublic: true,
    });

    // Create private session and location
    const privateSession = await createTestSession(baseURL, authData, {
      title: 'Private Session Test',
      isPublic: false,
    });

    const privateLocation = await createTestLocation(baseURL, authData, {
      latitude: 47.6085,
      longitude: -122.3421,
      sessionId: privateSession.id,
      isPublic: false,
    });

    // Reload page to display locations
    await page.reload();
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Both locations should be visible to the owner
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

    expect(markerCount).toBe(2);
  });

  test('should display location popup with details', async ({ page }) => {
    // Get current user for API calls
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const authData = { token: token!, record: JSON.parse(userStr!) };

    // Create test session and location
    const session = await createTestSession(baseURL, authData, {
      title: 'Popup Test Session',
      isPublic: false,
    });

    const testLocation = await createTestLocation(baseURL, authData, {
      latitude: 47.6062,
      longitude: -122.3321,
      sessionId: session.id,
    });

    // Reload page to display location
    await page.reload();
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
    const session1 = await createTestSession(baseURL, authData, {
      title: 'Session 1',
      isPublic: false,
    });

    const session2 = await createTestSession(baseURL, authData, {
      title: 'Session 2',
      isPublic: false,
    });

    // Create locations for each session
    await createTestLocation(baseURL, authData, {
      latitude: 47.6062,
      longitude: -122.3321,
      sessionId: session1.id,
    });

    await createTestLocation(baseURL, authData, {
      latitude: 47.6085,
      longitude: -122.3421,
      sessionId: session2.id,
    });

    // Reload page
    await page.reload();
    await page.waitForSelector('map-widget');
    await page.waitForTimeout(3000);

    // Initially, all locations should be visible
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

    expect(markerCount).toBe(2);

    // Filter by first session
    await page.evaluate(sessionId => {
      const mapWidget = document.querySelector('map-widget') as any;
      if (mapWidget && mapWidget.filterBySession) {
        mapWidget.filterBySession(sessionId);
      }
    }, session1.id);

    await page.waitForTimeout(1000);

    // Only one location should be visible
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
