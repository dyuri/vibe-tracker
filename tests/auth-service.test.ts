import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthService from '../public/auth-service.ts';

// Mock fetch
global.fetch = vi.fn();

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage as any).getItem.mockReturnValue(null);
    authService = new AuthService();
  });

  describe('constructor', () => {
    it('should initialize with no token and user when localStorage is empty', () => {
      expect(authService.token).toBeNull();
      expect(authService.user).toBeNull();
    });

    it('should restore token and user from localStorage', () => {
      const mockToken = 'test-token';
      const mockUser = { id: '1', username: 'testuser', email: 'test@example.com' };

      (localStorage as any).getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') {
          return mockToken;
        }
        if (key === 'user') {
          return JSON.stringify(mockUser);
        }
        return null;
      });

      const newAuthService = new AuthService();
      expect(newAuthService.token).toBe(mockToken);
      expect(newAuthService.user).toEqual(mockUser);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token or user', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return false when only token exists', () => {
      authService.token = 'test-token';
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return false when only user exists', () => {
      authService.user = { id: '1', username: 'testuser', email: 'test@example.com' };
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return true when both token and user exist', () => {
      authService.token = 'test-token';
      authService.user = { id: '1', username: 'testuser', email: 'test@example.com' };
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('getAuthHeaders', () => {
    it('should return empty object when no token', () => {
      expect(authService.getAuthHeaders()).toEqual({});
    });

    it('should return authorization header when token exists', () => {
      authService.token = 'test-token';
      expect(authService.getAuthHeaders()).toEqual({
        Authorization: 'Bearer test-token',
      });
    });
  });

  describe('logout', () => {
    it('should clear token, user, and localStorage', () => {
      // Set up initial state
      authService.token = 'test-token';
      authService.user = { id: '1', username: 'testuser', email: 'test@example.com' };
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('user', JSON.stringify(authService.user));

      authService.logout();

      expect(authService.token).toBeNull();
      expect(authService.user).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('setAuthData', () => {
    it('should set token, user, and localStorage', () => {
      const mockToken = 'new-token';
      const mockUser = { id: '1', username: 'newuser', email: 'new@example.com' };

      authService.setAuthData(mockToken, mockUser);

      expect(authService.token).toBe(mockToken);
      expect(authService.user).toBe(mockUser);
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', mockToken);
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
    });
  });
});
