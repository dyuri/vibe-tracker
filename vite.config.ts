import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  root: 'public', // Serve from existing public/ directory
  build: {
    outDir: '../dist', // Build to separate dist/ directory initially
    emptyOutDir: true, // Clean dist directory on build
    rollupOptions: {
      input: {
        main: 'public/index.html',
        profile: 'public/profile.html',
        sessions: 'public/sessions.html',
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8090', // Proxy API calls to Go backend
      '/health': 'http://localhost:8090',
      '/swagger': 'http://localhost:8090',
      // Proxy only user routes to Go backend, not static files
      '^/u/[^/]+$': 'http://localhost:8090',
      '^/u/[^/]+/s/[^/]+$': 'http://localhost:8090',
    },
    fs: {
      // Allow serving files from outside root for src/types
      allow: ['..'],
    },
  },
  appType: 'mpa', // Multi-page application
  resolve: {
    alias: {
      '@': '/src',
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
