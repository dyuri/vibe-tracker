/**
 * Background sync handler for service worker
 * This file is imported by the generated service worker
 */
/* eslint-env serviceworker */
/* global self */

// Handle background sync events
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(handleBackgroundSync());
  }
});

// Handle messages from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Handle background sync process
 */
async function handleBackgroundSync() {
  try {
    // Notify main thread that background sync is starting
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        status: 'started',
      });
    });

    console.log('Service Worker: Background sync completed');

    // Notify completion
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        status: 'completed',
      });
    });
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);

    // Notify failure
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        status: 'failed',
        error: error.message,
      });
    });
  }
}

// Handle periodic sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'background-sync-periodic') {
      console.log('Service Worker: Periodic sync triggered');
      event.waitUntil(handleBackgroundSync());
    }
  });
}

console.log('Service Worker: Background sync handler loaded');
