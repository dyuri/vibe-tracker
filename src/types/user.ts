/**
 * User and Authentication types matching Go backend models
 */

// User representation
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  token?: string;
  created?: string;
  updated?: string;
}

// Authentication request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  username?: string;
  email?: string;
  password?: string;
  oldPassword?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Authentication response types
export interface LoginResponse {
  token: string;
  user: User;
}

export interface TokenResponse {
  token: string;
}

// Auth state for frontend
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

// Auth events for custom events
export interface AuthChangeEventDetail {
  isAuthenticated: boolean;
  user: User | null;
}

export interface AuthChangeEvent extends CustomEvent<AuthChangeEventDetail> {
  type: 'auth-change';
}

// AuthService interface
export interface AuthService {
  token: string | null;
  user: User | null;
  isAuthenticated(): boolean;
  getCurrentUser(): Promise<User>;
  login(email: string, password: string): Promise<LoginResponse>;
  logout(): void;
  updateProfile(data: UpdateProfileRequest): Promise<User>;
  uploadAvatar(file: File): Promise<User>;
  regenerateToken(): Promise<User>;
  dispatchAuthChange(): void;
}
