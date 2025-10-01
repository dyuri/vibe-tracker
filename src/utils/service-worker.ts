/**
 * Service Worker registration and management utilities
 */

export interface ServiceWorkerUpdateEvent extends Event {
  readonly waiting: ServiceWorker | null;
}

/**
 * Register service worker with update handling
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    console.log('Service Worker registered successfully:', registration);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available, notify user
            showUpdateAvailable(registration);
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Show update available notification
 */
function showUpdateAvailable(registration: ServiceWorkerRegistration): void {
  // Create a simple update notification
  const updateBanner = document.createElement('div');
  updateBanner.id = 'update-banner';
  updateBanner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: var(--color-primary, #007bff);
    color: var(--text-inverse, white);
    padding: var(--spacing-sm, 10px) var(--spacing-md, 15px);
    text-align: center;
    z-index: 10000;
    font-family: var(--font-family-base, sans-serif);
    font-size: var(--font-size-base, 14px);
  `;

  updateBanner.innerHTML = `
    <span>New version available!</span>
    <button id="update-button" style="
      margin-left: var(--spacing-md, 15px);
      padding: var(--spacing-xs, 5px) var(--spacing-sm, 10px);
      background: var(--text-inverse, white);
      color: var(--color-primary, #007bff);
      border: none;
      border-radius: var(--border-radius-sm, 4px);
      cursor: pointer;
      font-size: var(--font-size-base, 14px);
    ">Update Now</button>
    <button id="dismiss-button" style="
      margin-left: var(--spacing-xs, 5px);
      padding: var(--spacing-xs, 5px) var(--spacing-sm, 10px);
      background: transparent;
      color: var(--text-inverse, white);
      border: 1px solid var(--text-inverse, white);
      border-radius: var(--border-radius-sm, 4px);
      cursor: pointer;
      font-size: var(--font-size-base, 14px);
    ">Later</button>
  `;

  document.body.appendChild(updateBanner);

  // Handle update button click
  const updateButton = updateBanner.querySelector('#update-button');
  const dismissButton = updateBanner.querySelector('#dismiss-button');

  updateButton?.addEventListener('click', () => {
    const waitingWorker = registration.waiting;
    if (waitingWorker) {
      // Send skip waiting message (in case SW supports it)
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });

      // Listen for the controlling service worker change
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Fallback: reload after a short delay if controllerchange doesn't fire
      setTimeout(() => {
        if (!refreshing) {
          window.location.reload();
        }
      }, 100);
    } else {
      // No waiting worker, just reload
      window.location.reload();
    }
  });

  dismissButton?.addEventListener('click', () => {
    updateBanner.remove();
  });

  // Auto-dismiss after 10 seconds if no action
  setTimeout(() => {
    if (updateBanner.parentNode) {
      updateBanner.remove();
    }
  }, 10000);
}

/**
 * Check if app is running in standalone mode (PWA installed)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Show install prompt for PWA
 */
export function setupInstallPrompt(): void {
  let deferredPrompt: any = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;

    // Store the prompt for potential manual triggering later
    // No automatic banner shown
    console.log('PWA install prompt available');
  });

  // Track successful installation
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    deferredPrompt = null;
  });

  // Make install prompt available globally for manual triggering
  (window as any).triggerInstallPrompt = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Install prompt outcome:', outcome);
      deferredPrompt = null;
      return outcome;
    }
    return null;
  };
}

/**
 * Initialize all service worker and PWA features
 */
export async function initializePWA(): Promise<void> {
  // Register service worker
  await registerServiceWorker();

  // Setup install prompt
  setupInstallPrompt();

  // Initialize Web Vitals monitoring
  try {
    const { initializeWebVitals } = await import('./web-vitals');
    await initializeWebVitals();
  } catch (error) {
    console.warn('Failed to initialize Web Vitals:', error);
  }

  // Initialize error handling
  try {
    const { initializeErrorHandling } = await import('./error-boundary');
    initializeErrorHandling();
  } catch (error) {
    console.warn('Failed to initialize error handling:', error);
  }

  // Initialize background sync
  try {
    const { initializeBackgroundSync } = await import('./background-sync');
    initializeBackgroundSync();
  } catch (error) {
    console.warn('Failed to initialize background sync:', error);
  }

  // Initialize security features
  try {
    const { initializeSecurity } = await import('./security');
    initializeSecurity();
  } catch (error) {
    console.warn('Failed to initialize security features:', error);
  }

  // Log PWA status
  console.log('PWA initialized:', {
    standalone: isStandalone(),
    serviceWorkerSupported: 'serviceWorker' in navigator,
  });
}
