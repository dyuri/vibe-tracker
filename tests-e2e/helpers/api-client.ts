/**
 * API client utilities for E2E tests
 * Provides a consistent interface for interacting with PocketBase API endpoints
 */

import { AuthTokenResponse } from './auth';

export interface ApiClientOptions {
  baseURL: string;
  authToken?: string;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

export class ApiClient {
  private baseURL: string;
  private authToken?: string;
  private timeout: number;

  constructor(options: ApiClientOptions) {
    this.baseURL = options.baseURL;
    this.authToken = options.authToken;
    this.timeout = options.timeout || 10000;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = undefined;
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: T | undefined;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        data = await response.json();
      }

      return {
        success: response.ok,
        data,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        status: 0,
      };
    }
  }

  /**
   * Authentication endpoints
   */
  async login(email: string, password: string): Promise<ApiResponse<AuthTokenResponse>> {
    return this.makeRequest<AuthTokenResponse>('/api/collections/users/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({
        identity: email,
        password: password,
      }),
    });
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    passwordConfirm: string;
  }): Promise<ApiResponse> {
    return this.makeRequest('/api/collections/users/records', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async refreshAuth(): Promise<ApiResponse<AuthTokenResponse>> {
    return this.makeRequest<AuthTokenResponse>('/api/collections/users/auth-refresh');
  }

  /**
   * User endpoints
   */
  async getCurrentUser(): Promise<ApiResponse> {
    return this.makeRequest('/api/collections/users/records/me');
  }

  async updateUser(userId: string, userData: any): Promise<ApiResponse> {
    return this.makeRequest(`/api/collections/users/records/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/collections/users/records/${userId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Session endpoints
   */
  async getSessions(filter?: string, sort?: string, page = 1, perPage = 30): Promise<ApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
    });

    if (filter) params.append('filter', filter);
    if (sort) params.append('sort', sort);

    return this.makeRequest(`/api/collections/sessions/records?${params}`);
  }

  async getSession(sessionId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/collections/sessions/records/${sessionId}`);
  }

  async createSession(sessionData: any): Promise<ApiResponse> {
    return this.makeRequest('/api/collections/sessions/records', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async updateSession(sessionId: string, sessionData: any): Promise<ApiResponse> {
    return this.makeRequest(`/api/collections/sessions/records/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(sessionData),
    });
  }

  async deleteSession(sessionId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/collections/sessions/records/${sessionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Location endpoints
   */
  async getLocations(filter?: string, sort?: string, page = 1, perPage = 30): Promise<ApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
    });

    if (filter) params.append('filter', filter);
    if (sort) params.append('sort', sort);

    return this.makeRequest(`/api/collections/locations/records?${params}`);
  }

  async getLocation(locationId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/collections/locations/records/${locationId}`);
  }

  async createLocation(locationData: any): Promise<ApiResponse> {
    return this.makeRequest('/api/collections/locations/records', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  }

  async updateLocation(locationId: string, locationData: any): Promise<ApiResponse> {
    return this.makeRequest(`/api/collections/locations/records/${locationId}`, {
      method: 'PATCH',
      body: JSON.stringify(locationData),
    });
  }

  async deleteLocation(locationId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/collections/locations/records/${locationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<ApiResponse> {
    return this.makeRequest('/health/liveness');
  }

  /**
   * Raw API request (for custom endpoints)
   */
  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, options);
  }
}

/**
 * Create an API client instance
 */
export function createApiClient(baseURL: string, authToken?: string): ApiClient {
  return new ApiClient({ baseURL, authToken });
}

/**
 * Create an authenticated API client from auth data
 */
export function createAuthenticatedApiClient(
  baseURL: string,
  authData: AuthTokenResponse
): ApiClient {
  return new ApiClient({ baseURL, authToken: authData.token });
}

/**
 * Utility functions for common API operations
 */
export const ApiUtils = {
  /**
   * Wait for a condition to be met by polling an API endpoint
   */
  async waitForCondition<T>(
    apiCall: () => Promise<ApiResponse<T>>,
    condition: (data: T) => boolean,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const { maxRetries = 10, retryDelay = 1000, timeout = 30000 } = options;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for condition after ${timeout}ms`);
      }

      const response = await apiCall();

      if (response.success && response.data && condition(response.data)) {
        return response.data;
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error(`Condition not met after ${maxRetries} attempts`);
  },

  /**
   * Create multiple records in batch
   */
  async createBatch<T>(apiClient: ApiClient, collection: string, records: any[]): Promise<T[]> {
    const results: T[] = [];

    for (const record of records) {
      const response = await apiClient.request<T>(`/api/collections/${collection}/records`, {
        method: 'POST',
        body: JSON.stringify(record),
      });

      if (response.success && response.data) {
        results.push(response.data);
      } else {
        throw new Error(`Failed to create ${collection} record: ${response.error}`);
      }
    }

    return results;
  },

  /**
   * Delete all records matching a filter
   */
  async deleteByFilter(apiClient: ApiClient, collection: string, filter: string): Promise<number> {
    let deletedCount = 0;

    // Get all matching records
    const response = await apiClient.request(
      `/api/collections/${collection}/records?filter=${encodeURIComponent(filter)}&perPage=500`
    );

    if (response.success && response.data?.items) {
      // Delete each record
      for (const item of response.data.items) {
        const deleteResponse = await apiClient.request(
          `/api/collections/${collection}/records/${item.id}`,
          {
            method: 'DELETE',
          }
        );

        if (deleteResponse.success) {
          deletedCount++;
        }
      }
    }

    return deletedCount;
  },
};

export default ApiClient;
