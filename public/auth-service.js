export default class AuthService {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    this.refreshTimer = null;
    
    // Setup auto-refresh if we have a token
    if (this.token) {
      this.setupAutoRefresh();
    }
  }

  async login(email, password) {
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

      const data = await response.json();
      this.setAuthData(data.token, data.user);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout() {
    this.clearAuthData();
    this.dispatchAuthChange();
  }

  async refreshToken() {
    if (!this.token) {
      throw new Error('No token to refresh');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Token refresh failed');
      }

      const data = await response.json();
      this.setAuthData(data.token, data.user);
      return data;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.logout(); // Clear invalid token
      throw error;
    }
  }

  async getCurrentUser() {
    if (!this.token) {
      throw new Error('No token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get user info');
      }

      const user = await response.json();
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  getAuthHeaders() {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }

  setAuthData(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.setupAutoRefresh();
    this.dispatchAuthChange();
  }

  clearAuthData() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  setupAutoRefresh() {
    if (!this.token) return;

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
        }, refreshTime);
      }
    } catch (error) {
      console.error('Failed to parse token for auto-refresh:', error);
    }
  }

  dispatchAuthChange() {
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
  async updateProfile(data) {
    try {
      const response = await this.fetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      this.user = updatedUser;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.dispatchAuthChange();
      return updatedUser;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  async uploadAvatar(file) {
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

      const updatedUser = await response.json();
      this.user = updatedUser;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.dispatchAuthChange();
      return updatedUser;
    } catch (error) {
      console.error('Upload avatar error:', error);
      throw error;
    }
  }

  async regenerateToken() {
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
  async fetch(url, options = {}) {
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