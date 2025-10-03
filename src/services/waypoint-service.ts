/**
 * Waypoint API Service
 * Handles all waypoint-related API operations
 */

import type { WaypointsResponse, WaypointFeature, CreateWaypointRequest } from '@/types';

export interface UpdateWaypointRequest extends Partial<CreateWaypointRequest> {
  id?: string;
}

export interface PhotoWaypointMetadata {
  name: string;
  type: string;
  description?: string;
  sessionId: string;
  manualLocation?: {
    latitude: number;
    longitude: number;
  };
}

export class WaypointService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Get all waypoints for a session
   */
  async getWaypoints(sessionId: string): Promise<WaypointsResponse> {
    try {
      // We need to get the current username and session name to call the correct endpoint
      // For now, let's try to get waypoints by making a call that works with our current session
      // The backend expects /api/waypoints/{username}?session={sessionName}
      // But we only have sessionId, so we'll need to get this info from the session context

      // TODO: This is a temporary approach - ideally we should have username and session name available
      // For now, let's create a simple response format that matches our expected interface
      const response = await fetch(`${this.baseUrl}/api/waypoints/by-session/${sessionId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        // If the endpoint doesn't exist, return empty waypoints list
        if (response.status === 404) {
          return {
            type: 'FeatureCollection',
            features: [],
          };
        }
        throw new Error(`Failed to fetch waypoints: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();

      // Backend wraps the GeoJSON in a success response wrapper
      // Extract the actual GeoJSON data from the wrapper
      if (responseData.status === 'success' && responseData.data) {
        return responseData.data;
      }

      // Fallback: if response is already in GeoJSON format
      return responseData;
    } catch (error) {
      console.error('Error fetching waypoints:', error);
      // Return empty list on error so the UI doesn't break
      return {
        type: 'FeatureCollection',
        features: [],
      };
    }
  }

  /**
   * Create a new waypoint
   */
  async createWaypoint(data: CreateWaypointRequest): Promise<WaypointFeature> {
    try {
      const response = await fetch(`${this.baseUrl}/api/waypoints`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          `Failed to create waypoint: ${response.status} ${response.statusText}`;
        console.error('Waypoint creation error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorMessage);
      }

      const waypoint = await response.json();
      return waypoint;
    } catch (error) {
      console.error('Error creating waypoint:', error);
      throw error;
    }
  }

  /**
   * Update an existing waypoint
   */
  async updateWaypoint(id: string, data: UpdateWaypointRequest): Promise<WaypointFeature> {
    try {
      const response = await fetch(`${this.baseUrl}/api/waypoints/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to update waypoint: ${response.status} ${response.statusText}`
        );
      }

      const waypoint = await response.json();
      return waypoint;
    } catch (error) {
      console.error('Error updating waypoint:', error);
      throw error;
    }
  }

  /**
   * Delete a waypoint
   */
  async deleteWaypoint(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/waypoints/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to delete waypoint: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error('Error deleting waypoint:', error);
      throw error;
    }
  }

  /**
   * Upload photo for a waypoint
   */
  async uploadWaypointPhoto(waypointId: string, file: File): Promise<{ url: string }> {
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch(`${this.baseUrl}/api/waypoints/${waypointId}/photo`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...this.getAuthHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to upload photo: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading waypoint photo:', error);
      throw error;
    }
  }

  /**
   * Get waypoints by user (for public waypoints)
   */
  async getUserWaypoints(username: string, limit?: number): Promise<WaypointsResponse> {
    try {
      const params = new URLSearchParams();
      if (limit) {
        params.set('limit', limit.toString());
      }

      const url = `${this.baseUrl}/api/waypoints/user/${username}${
        params.toString() ? `?${params.toString()}` : ''
      }`;

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch user waypoints: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user waypoints:', error);
      throw error;
    }
  }

  /**
   * Create a waypoint from a photo with EXIF data extraction
   */
  async createWaypointFromPhoto(
    file: File,
    metadata: PhotoWaypointMetadata
  ): Promise<WaypointFeature> {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('session_id', metadata.sessionId);
      formData.append('name', metadata.name);
      formData.append('type', metadata.type);

      if (metadata.description) {
        formData.append('description', metadata.description);
      }

      // If manual location is provided, include it
      if (metadata.manualLocation) {
        formData.append('latitude', metadata.manualLocation.latitude.toString());
        formData.append('longitude', metadata.manualLocation.longitude.toString());
      }

      const response = await fetch(`${this.baseUrl}/api/waypoints/photo`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          // Don't set Content-Type header - let browser set it with boundary for FormData
          ...this.getAuthHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          `Failed to create waypoint from photo: ${response.status} ${response.statusText}`;
        console.error('Photo waypoint creation error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorMessage);
      }

      const waypoint = await response.json();
      return waypoint;
    } catch (error) {
      console.error('Error creating waypoint from photo:', error);
      throw error;
    }
  }

  /**
   * Get photo URL for a waypoint
   */
  getPhotoUrl(waypointId: string): string {
    return `${this.baseUrl}/api/waypoints/${waypointId}/photo`;
  }

  /**
   * Generate thumbnail URL for a photo waypoint
   * This could be enhanced with server-side thumbnail generation
   */
  getThumbnailUrl(waypointId: string, size: 'small' | 'medium' | 'large' = 'small'): string {
    return `${this.baseUrl}/api/waypoints/${waypointId}/photo?thumbnail=${size}`;
  }

  /**
   * Generate thumbnail from photo URL using Canvas API (client-side)
   */
  async generateThumbnail(photoUrl: string, maxSize: number = 150): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Calculate thumbnail dimensions while maintaining aspect ratio
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw the thumbnail
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to data URL
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(thumbnailUrl);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for thumbnail generation'));
      };

      img.src = photoUrl;
    });
  }

  /**
   * Check if a waypoint has a photo
   */
  async hasPhoto(waypointId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/waypoints/${waypointId}/photo`, {
        method: 'HEAD',
        credentials: 'include',
        headers: {
          ...this.getAuthHeaders(),
        },
      });

      return response.ok;
    } catch (error) {
      console.warn('Error checking waypoint photo:', error);
      return false;
    }
  }

  /**
   * Delete photo from a waypoint
   */
  async deleteWaypointPhoto(waypointId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/waypoints/${waypointId}/photo`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to delete waypoint photo: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error('Error deleting waypoint photo:', error);
      throw error;
    }
  }

  /**
   * Get photo metadata (EXIF data, dimensions, etc.)
   */
  async getPhotoMetadata(waypointId: string): Promise<{
    size: number;
    dimensions: { width: number; height: number };
    exif?: any;
    mimeType: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/waypoints/${waypointId}/photo-metadata`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get photo metadata: ${response.status} ${response.statusText}`);
      }

      const metadata = await response.json();
      return metadata;
    } catch (error) {
      console.error('Error getting photo metadata:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const waypointService = new WaypointService();
