/**
 * Vite plugin for Workbox integration
 * Generates service worker during build process
 */
import { Plugin } from 'vite';
import { generateSW } from 'workbox-build';
import path from 'path';

export function workboxPlugin(): Plugin {
  return {
    name: 'workbox',
    apply: 'build', // Only run during build, not dev
    writeBundle: {
      sequential: true,
      async handler(options) {
        try {
          console.log('🔧 Generating service worker with Workbox...');

          const { count, size, warnings } = await generateSW({
            globDirectory: path.resolve(options.dir || 'dist'),
            globPatterns: ['**/*.{html,js,css,png,svg,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'],
            swDest: path.resolve(options.dir || 'dist', 'sw.js'),
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
                },
              },
              {
                urlPattern: /\/api\//,
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
                urlPattern: /\.(png|jpg|jpeg|svg|gif)$/,
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
            dontCacheBustURLsMatching: /\.\w{8}\./,
          });

          console.log(`✅ Service worker generated successfully:`);
          console.log(`   📁 Precached ${count} files, totaling ${size} bytes`);

          if (warnings.length > 0) {
            console.warn('⚠️  Workbox warnings:');
            warnings.forEach(warning => console.warn(`   ${warning}`));
          }
        } catch (error) {
          console.error('❌ Failed to generate service worker:', error);
          throw error;
        }
      },
    },
  };
}
