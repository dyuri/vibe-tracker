import type { User, LoginResponse, UpdateProfileRequest } from '../types/index';

export default class AuthService {
  private baseUrl: string;
  public token: string | null;
  public user: User | null;
  private refreshTimer: number | null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    this.refreshTimer = null;

    // Setup auto-refresh if we have a token
    if (this.token) {
      this.setupAutoRefresh();
    }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const result = await response.json();
      // Handle standardized response format
      const data = result.data || result;
      this.setAuthData(data.token, data.user);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.clearAuthData();
    this.dispatchAuthChange();
  }

  async refreshToken(): Promise<LoginResponse> {
    if (!this.token) {
      throw new Error('No token to refresh');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Token refresh failed');
      }

      const result = await response.json();
      // Handle standardized response format
      const data = result.data || result;
      this.setAuthData(data.token, data.user);
      return data;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.logout(); // Clear invalid token
      throw error;
    }
  }

  async getCurrentUser(): Promise<User> {
    if (!this.token) {
      throw new Error('No token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/me`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get user info');
      }

      const result = await response.json();
      // Handle standardized response format
      const user = result.data || result;
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  getAuthHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  setAuthData(token: string, user: User): void {
    this.token = token;
    this.user = user;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.setupAutoRefresh();
    this.dispatchAuthChange();
  }

  clearAuthData(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  setupAutoRefresh(): void {
    if (!this.token) {
      return;
    }

    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Parse JWT to get expiration (simplified, assumes standard JWT structure)
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      const expTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expTime - now;

      // Refresh 5 minutes (300000ms) before expiry
      const refreshTime = Math.max(0, timeUntilExpiry - 300000);

      if (refreshTime > 0) {
        this.refreshTimer = setTimeout(async () => {
          try {
            await this.refreshToken();
          } catch (error) {
            console.error('Auto refresh failed:', error);
          }
        }, refreshTime) as unknown as number;
      }
    } catch (error) {
      console.error('Failed to parse token for auto-refresh:', error);
    }
  }

  dispatchAuthChange(): void {
    // Dispatch custom event for components to listen to
    const event = new CustomEvent('auth-change', {
      detail: {
        isAuthenticated: this.isAuthenticated(),
        user: this.user,
      },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  // Profile management methods
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    try {
      const response = await this.fetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      const result = await response.json();
      // Handle standardized response format
      const updatedUser = result.data || result;
      this.user = updatedUser;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.dispatchAuthChange();
      return updatedUser;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  async uploadAvatar(file: File): Promise<User> {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${this.baseUrl}/api/profile/avatar`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload avatar');
      }

      const result = await response.json();
      // Handle standardized response format
      const updatedUser = result.data || result;
      this.user = updatedUser;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.dispatchAuthChange();
      return updatedUser;
    } catch (error) {
      console.error('Upload avatar error:', error);
      throw error;
    }
  }

  async regenerateToken(): Promise<User> {
    try {
      const response = await this.fetch('/api/profile/regenerate-token', {
        method: 'PUT',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to regenerate token');
      }

      const updatedUser = await response.json();
      this.user = updatedUser;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.dispatchAuthChange();
      return updatedUser;
    } catch (error) {
      console.error('Regenerate token error:', error);
      throw error;
    }
  }

  // Helper method for making authenticated API calls
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      ...this.getAuthHeaders(),
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers,
    });

    // If token expired, try to refresh once
    if (response.status === 401 && this.token) {
      try {
        await this.refreshToken();
        // Retry with new token
        return await fetch(`${this.baseUrl}${url}`, {
          ...options,
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
      } catch (refreshError) {
        // Refresh failed, logout user
        this.logout();
        throw refreshError;
      }
    }

    return response;
  }
}
