/**
 * Background sync utilities for offline functionality
 * Handles queuing and syncing of failed requests when connection is restored
 */

export interface SyncQueueItem {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'medium' | 'low';
}

export interface SyncOptions {
  maxRetries?: number;
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
  retryDelay?: number;
}

/**
 * Background sync manager for offline functionality
 */
class BackgroundSyncManager {
  private static instance: BackgroundSyncManager;
  private queue: SyncQueueItem[] = [];
  private isOnline = navigator.onLine;
  private isProcessing = false;
  private readonly STORAGE_KEY = 'vibe_sync_queue';
  private readonly MAX_QUEUE_SIZE = 100;

  private constructor() {
    this.initializeSync();
    this.loadQueueFromStorage();
  }

  static getInstance(): BackgroundSyncManager {
    if (!BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance = new BackgroundSyncManager();
    }
    return BackgroundSyncManager.instance;
  }

  /**
   * Initialize background sync functionality
   */
  private initializeSync(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored, processing sync queue');
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('📵 Connection lost, queuing requests for sync');
      this.isOnline = false;
    });

    // Process queue on visibility change (when tab becomes active)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline && this.queue.length > 0) {
        this.processQueue();
      }
    });

    // Register service worker sync if available
    this.registerServiceWorkerSync();
  }

  /**
   * Register service worker background sync
   */
  private async registerServiceWorkerSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const _registration = await navigator.serviceWorker.ready;

        // Listen for sync events from service worker
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data && event.data.type === 'BACKGROUND_SYNC') {
            console.log('📡 Service worker background sync triggered');
            this.processQueue();
          }
        });

        console.log('📡 Background sync registered with service worker');
      } catch (error) {
        console.warn('Failed to register service worker sync:', error);
      }
    }
  }

  /**
   * Add request to sync queue
   */
  async queueRequest(url: string, options: RequestInit & SyncOptions = {}): Promise<string> {
    const { method = 'GET', headers = {}, body, maxRetries = 3, priority = 'medium' } = options;

    const item: SyncQueueItem = {
      id: this.generateId(),
      url,
      method,
      headers: this.sanitizeHeaders(headers),
      body: body ? String(body) : undefined,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
      priority,
    };

    // Add to queue
    this.queue.push(item);
    this.queue.sort(
      (a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority)
    );

    // Limit queue size
    if (this.queue.length > this.MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(0, this.MAX_QUEUE_SIZE);
    }

    // Save to storage
    this.saveQueueToStorage();

    console.log(`📤 Request queued for sync: ${method} ${url}`);

    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    } else {
      // Register for background sync with service worker
      this.requestBackgroundSync();
    }

    return item.id;
  }

  /**
   * Process the sync queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || !this.isOnline) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing sync queue (${this.queue.length} items)`);

    const itemsToProcess = [...this.queue];
    const processedItems: string[] = [];
    const failedItems: SyncQueueItem[] = [];

    for (const item of itemsToProcess) {
      try {
        const success = await this.processQueueItem(item);
        if (success) {
          processedItems.push(item.id);
          console.log(`✅ Sync successful: ${item.method} ${item.url}`);
        } else {
          item.retryCount++;
          if (item.retryCount < item.maxRetries) {
            failedItems.push(item);
            console.log(
              `⚠️ Sync failed, retrying: ${item.method} ${item.url} (${item.retryCount}/${item.maxRetries})`
            );
          } else {
            console.error(`❌ Sync failed permanently: ${item.method} ${item.url}`);
            this.handlePermanentFailure(item);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing sync item: ${item.method} ${item.url}`, error);
        item.retryCount++;
        if (item.retryCount < item.maxRetries) {
          failedItems.push(item);
        }
      }
    }

    // Remove processed items from queue
    this.queue = this.queue.filter(item => !processedItems.includes(item.id));

    // Re-add failed items that haven't exceeded retry limit
    this.queue.push(...failedItems);

    this.saveQueueToStorage();
    this.isProcessing = false;

    if (processedItems.length > 0) {
      console.log(`✅ Processed ${processedItems.length} sync items successfully`);
    }

    // Dispatch sync completion event
    window.dispatchEvent(
      new CustomEvent('sync-queue-processed', {
        detail: {
          processed: processedItems.length,
          failed: failedItems.length,
          remaining: this.queue.length,
        },
      })
    );
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: SyncQueueItem): Promise<boolean> {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok) {
        // Dispatch success event for the specific item
        window.dispatchEvent(
          new CustomEvent('sync-item-success', {
            detail: {
              id: item.id,
              url: item.url,
              method: item.method,
              response: await response
                .clone()
                .json()
                .catch(() => null),
            },
          })
        );
        return true;
      } else {
        console.warn(`Sync item failed with status ${response.status}: ${item.method} ${item.url}`);
        return false;
      }
    } catch (error) {
      console.warn(`Network error for sync item: ${item.method} ${item.url}`, error);
      return false;
    }
  }

  /**
   * Handle permanent sync failure
   */
  private handlePermanentFailure(item: SyncQueueItem): void {
    // Store failed items for debugging
    try {
      const failedItems = this.getFailedItems();
      failedItems.push({
        ...item,
        failedAt: Date.now(),
      });

      // Keep only last 20 failed items
      if (failedItems.length > 20) {
        failedItems.splice(0, failedItems.length - 20);
      }

      localStorage.setItem('vibe_sync_failed', JSON.stringify(failedItems));
    } catch (error) {
      console.warn('Failed to store failed sync item:', error);
    }

    // Dispatch failure event
    window.dispatchEvent(
      new CustomEvent('sync-item-failed', {
        detail: {
          id: item.id,
          url: item.url,
          method: item.method,
          retryCount: item.retryCount,
          maxRetries: item.maxRetries,
        },
      })
    );
  }

  /**
   * Request background sync from service worker
   */
  private async requestBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Type assertion for sync API which may not be in TypeScript definitions
        await (registration as any).sync.register('background-sync');
      } catch (_error) {
        console.warn('Failed to register background sync:', _error);
      }
    }
  }

  /**
   * Load queue from local storage
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`📋 Loaded ${this.queue.length} items from sync queue storage`);
      }
    } catch (_error) {
      console.warn('Failed to load sync queue from storage:', _error);
      this.queue = [];
    }
  }

  /**
   * Save queue to local storage
   */
  private saveQueueToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('Failed to save sync queue to storage:', error);
    }
  }

  /**
   * Generate unique ID for queue items
   */
  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize headers for storage
   */
  private sanitizeHeaders(headers: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {};

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        result[key] = value;
      });
    } else if (headers) {
      Object.assign(result, headers);
    }

    return result;
  }

  /**
   * Get priority value for sorting
   */
  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 2;
    }
  }

  /**
   * Get failed sync items
   */
  getFailedItems(): any[] {
    try {
      const stored = localStorage.getItem('vibe_sync_failed');
      return stored ? JSON.parse(stored) : [];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    total: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    isProcessing: boolean;
    isOnline: boolean;
  } {
    return {
      total: this.queue.length,
      highPriority: this.queue.filter(item => item.priority === 'high').length,
      mediumPriority: this.queue.filter(item => item.priority === 'medium').length,
      lowPriority: this.queue.filter(item => item.priority === 'low').length,
      isProcessing: this.isProcessing,
      isOnline: this.isOnline,
    };
  }

  /**
   * Clear all sync queues
   */
  clearAllQueues(): void {
    this.queue = [];
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('vibe_sync_failed');
    console.log('🗑️ All sync queues cleared');
  }

  /**
   * Retry specific item
   */
  async retryItem(itemId: string): Promise<boolean> {
    const item = this.queue.find(i => i.id === itemId);
    if (!item) {
      return false;
    }

    item.retryCount = 0; // Reset retry count
    if (this.isOnline) {
      return await this.processQueueItem(item);
    }
    return false;
  }
}

/**
 * Enhanced fetch function with automatic background sync
 */
export async function fetchWithSync(
  url: string,
  options: RequestInit & SyncOptions = {}
): Promise<Response> {
  const syncManager = BackgroundSyncManager.getInstance();

  try {
    // Try to make the request normally first
    const response = await fetch(url, options);

    if (response.ok) {
      return response;
    }

    // If request fails and we're offline, queue for sync
    if (!navigator.onLine) {
      await syncManager.queueRequest(url, options);
      throw new Error('Request queued for sync due to network error');
    }

    return response;
  } catch (error) {
    // If fetch fails (network error), queue for sync
    if (!navigator.onLine || error.message.includes('fetch')) {
      await syncManager.queueRequest(url, options);
      throw new Error('Request queued for sync due to network error');
    }

    throw error;
  }
}

/**
 * Initialize background sync
 */
export function initializeBackgroundSync(): void {
  BackgroundSyncManager.getInstance();
  console.log('🔄 Background sync initialized');
}

/**
 * Get sync manager instance
 */
export function getSyncManager(): BackgroundSyncManager {
  return BackgroundSyncManager.getInstance();
}

/**
 * Queue request for background sync
 */
export function queueForSync(url: string, options?: RequestInit & SyncOptions): Promise<string> {
  return BackgroundSyncManager.getInstance().queueRequest(url, options);
}

/**
 * Get sync queue status
 */
export function getSyncQueueStatus() {
  return BackgroundSyncManager.getInstance().getQueueStatus();
}

/**
 * Clear sync queues
 */
export function clearSyncQueues(): void {
  BackgroundSyncManager.getInstance().clearAllQueues();
}

/**
 * Get failed sync items for debugging
 */
export function getFailedSyncItems(): any[] {
  return BackgroundSyncManager.getInstance().getFailedItems();
}
