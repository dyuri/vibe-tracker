/* eslint-env node */
/* global module */
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{html,js,css,png,svg,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'],
  swDest: 'dist/sw.js',
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/unpkg\.com\/leaflet/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'leaflet-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
        cacheKeyWillBeUsed: async ({ request }) => {
          return `${request.url}?v=1.9.4`; // Version the cache key
        },
      },
    },
    {
      urlPattern: /^http:\/\/localhost:8090\/api\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
        networkTimeoutSeconds: 3,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /\/api\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache-production',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
        networkTimeoutSeconds: 3,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images-cache',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
  ],
  // Don't cache API endpoints or dynamic content
  navigateFallback: null,
  // Don't precache large files or sensitive content
  dontCacheBustURLsMatching: /\.\w{8}\./,

  // Workbox plugins for enhanced functionality
  plugins: [
    // Background sync for failed API requests
    {
      cacheKeyWillBeUsed: async ({ request }) => {
        // Custom cache key logic if needed
        return request.url;
      },
    },
  ],
};
