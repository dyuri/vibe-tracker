/**
 * Test data management utilities for E2E tests
 */

import { AuthTokenResponse } from './auth';

export interface TestSession {
  id?: string;
  title: string;
  description?: string;
  isPublic: boolean;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export interface TestLocation {
  id?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
  sessionId?: string;
  session?: string;
  userId?: string;
  isPublic?: boolean;
  created?: string;
  updated?: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

/**
 * Create a test user via API
 */
export async function createTestUser(
  baseURL: string,
  userData?: Partial<CreateUserData>
): Promise<any> {
  const defaultUserData: CreateUserData = {
    username: `testuser_${Date.now()}`,
    email: `testuser_${Date.now()}@example.com`,
    password: 'testpassword123',
    passwordConfirm: 'testpassword123',
    ...userData,
  };

  const response = await fetch(`${baseURL}/api/collections/users/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(defaultUserData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create test user with status ${response.status}: ${errorText}`);
  }

  const user = await response.json();
  console.log(`Created test user: ${user.username} (${user.email})`);
  return user;
}

/**
 * Create a test session via API
 */
export async function createTestSession(
  baseURL: string,
  authData: AuthTokenResponse,
  sessionData?: Partial<TestSession>
): Promise<TestSession> {
  const sessionName = `test-session-${Date.now()}`;
  // Extract isPublic from sessionData and map to public field
  const { isPublic, ...restSessionData } = sessionData || {};
  const defaultSessionData = {
    name: sessionName,
    title: `Test Session ${Date.now()}`,
    description: 'A test session created for E2E testing',
    public: isPublic || false,
    ...restSessionData,
  };

  const response = await fetch(`${baseURL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authData.token}`,
    },
    body: JSON.stringify(defaultSessionData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create test session with status ${response.status}: ${errorText}`);
  }

  const responseData = await response.json();
  const session: TestSession = responseData.data || responseData;
  console.log(`Created test session: ${session.title} (${session.id})`);
  return session;
}

/**
 * Create a test location via API
 */
export async function createTestLocation(
  baseURL: string,
  authData: AuthTokenResponse,
  locationData?: Partial<TestLocation>
): Promise<TestLocation> {
  const defaultLocationData = {
    latitude: 47.6062 + (Math.random() - 0.5) * 0.01, // Seattle area with small random offset
    longitude: -122.3321 + (Math.random() - 0.5) * 0.01,
    altitude: 50,
    speed: 0,
    timestamp: Date.now(),
    session: locationData?.session || undefined,
    ...locationData,
  };

  // Format as GeoJSON LocationRequest
  const geoJsonData = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [
        defaultLocationData.longitude,
        defaultLocationData.latitude,
        defaultLocationData.altitude,
      ],
    },
    properties: {
      timestamp: defaultLocationData.timestamp,
      speed: defaultLocationData.speed,
      session: defaultLocationData.session,
    },
  };

  const response = await fetch(`${baseURL}/api/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authData.token}`,
    },
    body: JSON.stringify(geoJsonData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create test location with status ${response.status}: ${errorText}`);
  }

  const responseData = await response.json();
  // Convert API response back to TestLocation format
  const location: TestLocation = {
    id: responseData.id || 'test-location',
    latitude: defaultLocationData.latitude,
    longitude: defaultLocationData.longitude,
    altitude: defaultLocationData.altitude,
    speed: defaultLocationData.speed,
    heading: 0,
    accuracy: 10,
    timestamp: new Date(defaultLocationData.timestamp).toISOString(),
    isPublic: false,
    session: defaultLocationData.session,
  };
  console.log(
    `Created test location: ${location.latitude}, ${location.longitude} (${location.id})`
  );
  return location;
}

/**
 * Create multiple test locations for a session
 */
export async function createTestLocationsForSession(
  baseURL: string,
  authData: AuthTokenResponse,
  sessionName: string,
  count: number = 5
): Promise<TestLocation[]> {
  console.log(`Creating ${count} test locations for session ${sessionName}`);

  const locations: TestLocation[] = [];
  const baseLatitude = 47.6062;
  const baseLongitude = -122.3321;

  for (let i = 0; i < count; i++) {
    const locationData: Partial<TestLocation> = {
      latitude: baseLatitude + i * 0.001 + (Math.random() - 0.5) * 0.0005,
      longitude: baseLongitude + i * 0.001 + (Math.random() - 0.5) * 0.0005,
      session: sessionName,
      timestamp: new Date(Date.now() + i * 60000).toISOString(), // 1 minute intervals
    };

    const location = await createTestLocation(baseURL, authData, locationData);
    locations.push(location);
  }

  return locations;
}

/**
 * Delete a test record via API
 */
export async function deleteTestRecord(
  baseURL: string,
  authData: AuthTokenResponse,
  collection: string,
  recordId: string
): Promise<void> {
  const response = await fetch(`${baseURL}/api/collections/${collection}/records/${recordId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${authData.token}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(
      `Failed to delete ${collection} record ${recordId} with status ${response.status}: ${errorText}`
    );
  }

  console.log(`Deleted ${collection} record: ${recordId}`);
}

/**
 * Clean up test data for a user
 */
export async function cleanupUserTestData(
  baseURL: string,
  authData: AuthTokenResponse
): Promise<void> {
  console.log(`Cleaning up test data for user ${authData.record.id}`);

  try {
    // Delete all user's locations
    const locationsResponse = await fetch(
      `${baseURL}/api/collections/locations/records?filter=(userId='${authData.record.id}')`,
      {
        headers: { Authorization: `Bearer ${authData.token}` },
      }
    );

    if (locationsResponse.ok) {
      const locationsData = await locationsResponse.json();
      for (const location of locationsData.items || []) {
        await deleteTestRecord(baseURL, authData, 'locations', location.id);
      }
    }

    // Delete all user's sessions
    const sessionsResponse = await fetch(
      `${baseURL}/api/collections/sessions/records?filter=(createdBy='${authData.record.id}')`,
      {
        headers: { Authorization: `Bearer ${authData.token}` },
      }
    );

    if (sessionsResponse.ok) {
      const sessionsData = await sessionsResponse.json();
      for (const session of sessionsData.items || []) {
        await deleteTestRecord(baseURL, authData, 'sessions', session.id);
      }
    }

    console.log('Test data cleanup completed');
  } catch (error) {
    console.warn('Some test data cleanup failed:', error);
  }
}

/**
 * Create a complete test scenario (user, session, locations)
 */
export async function createTestScenario(
  baseURL: string,
  authData: AuthTokenResponse,
  options?: {
    sessionCount?: number;
    locationsPerSession?: number;
    publicSessions?: boolean;
  }
): Promise<{
  sessions: TestSession[];
  locations: TestLocation[];
}> {
  const { sessionCount = 2, locationsPerSession = 5, publicSessions = false } = options || {};

  console.log(
    `Creating test scenario: ${sessionCount} sessions, ${locationsPerSession} locations each`
  );

  const sessions: TestSession[] = [];
  const locations: TestLocation[] = [];

  for (let i = 0; i < sessionCount; i++) {
    // Create session
    const session = await createTestSession(baseURL, authData, {
      title: `Test Session ${i + 1}`,
      description: `Test session ${i + 1} created for E2E testing`,
      isPublic: publicSessions,
    });
    sessions.push(session);

    // Create locations for this session
    const sessionLocations = await createTestLocationsForSession(
      baseURL,
      authData,
      session.name!,
      locationsPerSession
    );
    locations.push(...sessionLocations);
  }

  console.log(
    `Test scenario created: ${sessions.length} sessions, ${locations.length} total locations`
  );
  return { sessions, locations };
}

/**
 * Sample test data for fixtures
 */
export const SAMPLE_TEST_DATA = {
  users: [
    {
      username: 'testuser1',
      email: 'testuser1@example.com',
      password: 'testpassword123',
    },
    {
      username: 'testuser2',
      email: 'testuser2@example.com',
      password: 'testpassword123',
    },
  ],
  sessions: [
    {
      title: 'Seattle Walking Tour',
      description: 'A walking tour around downtown Seattle',
      isPublic: true,
    },
    {
      title: 'Private Hike',
      description: 'Personal hiking session',
      isPublic: false,
    },
  ],
  locations: [
    // Pike Place Market
    { latitude: 47.6085, longitude: -122.3421 },
    // Space Needle
    { latitude: 47.6205, longitude: -122.3493 },
    // Waterfront
    { latitude: 47.6062, longitude: -122.3321 },
    // Pioneer Square
    { latitude: 47.6014, longitude: -122.332 },
  ],
};

export default {
  createTestUser,
  createTestSession,
  createTestLocation,
  createTestLocationsForSession,
  deleteTestRecord,
  cleanupUserTestData,
  createTestScenario,
  SAMPLE_TEST_DATA,
};
