import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Base URL: GitHub Pages en production, racine pour Capacitor mobile
  base: process.env.CAPACITOR_PLATFORM ? '/' : (process.env.NODE_ENV === 'production' ? '/Schmitt/' : '/'),
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@models': path.resolve(__dirname, './src/models'),
      '@managers': path.resolve(__dirname, './src/managers'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 3000,
    host: true, // Permet l'accès depuis le réseau local (mobile testing)
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimisations pour mobile
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
      },
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        legacy: path.resolve(__dirname, 'index-legacy.html'),
        '3d': path.resolve(__dirname, 'index-3d.html'),
        new: path.resolve(__dirname, 'index-new.html'),
        editor: path.resolve(__dirname, 'index-editor.html'),
      },
      output: {
        // Optimisation des chunks pour mobile
        manualChunks: {
          'vendor': ['@capacitor/core', '@capacitor/app'],
          'plugins': [
            '@capacitor/camera',
            '@capacitor/geolocation',
            '@capacitor/push-notifications',
            '@capacitor/preferences'
          ],
        },
      },
    },
    // Taille de chunk optimale pour mobile
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [
      '@capacitor/core',
      '@capacitor/app',
      '@capacitor/camera',
      '@capacitor/geolocation',
      '@capacitor/push-notifications',
      '@capacitor/preferences'
    ],
  },
});
