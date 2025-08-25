import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { workboxPlugin } from './vite-plugin-workbox';

// Backend URL configuration
const BACKEND_URL = 'http://localhost:8090';

export default defineConfig({
  root: '.', // Serve from project root
  build: {
    outDir: 'dist', // Build to dist/ directory
    emptyOutDir: true, // Clean dist directory on build
    rollupOptions: {
      input: {
        main: 'index.html', // Development entry point
        profile: 'public/profile.html',
        sessions: 'public/sessions.html',
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': BACKEND_URL, // Proxy API calls to Go backend
      '/health': BACKEND_URL,
      '/swagger': BACKEND_URL,
      // Proxy only user routes to Go backend, not static files
      '^/u/[^/]+$': BACKEND_URL,
      '^/u/[^/]+/s/[^/]+$': BACKEND_URL,
    },
    fs: {
      // Allow serving files from src/ directory
      allow: ['.'],
    },
  },
  appType: 'mpa', // Multi-page application
  resolve: {
    alias: {
      '@': '/src',
      '@/components': '/src/components',
      '@/types': '/src/types',
      '@/styles': '/src/styles',
      '@/services': '/src/services',
      '@/utils': '/src/utils',
      '@/apps': '/src/apps',
    },
  },
  esbuild: {
    // Ensure TypeScript files are transformed properly
    target: 'es2020',
    // Allow TypeScript syntax in .js files
    include: /\.(ts|js)$/,
    loader: 'ts',
  },
  plugins: [
    // Workbox service worker generation
    workboxPlugin(),
    // Bundle analyzer - only run when BUILD_ANALYZE is set
    ...(process.env.BUILD_ANALYZE
      ? [
          visualizer({
            filename: 'dist/bundle-analysis.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
});
