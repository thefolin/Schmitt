import { defineConfig } from 'vite';
import path from 'path';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // Base URL: GitHub Pages en production, racine pour Capacitor mobile
  base: process.env.CAPACITOR_PLATFORM ? '/' : (process.env.NODE_ENV === 'production' ? '/Schmitt/' : '/'),
  publicDir: 'public',
  // HTTPS SUR DEMANDE (`npm run dev:https`), pour essayer la liaison entre
  // deux appareils (épique 8) : sur http://192.168…, le téléphone refuse la
  // caméra, donc le scan des QR. Le certificat est auto-signé — le navigateur
  // demandera une fois de passer outre. Sans la variable, rien ne change.
  plugins: process.env.DEV_HTTPS ? [basicSsl()] : [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
        editor: path.resolve(__dirname, 'index-editor.html'),
        // Aperçu du rendu 3D, le temps de la refonte. Page à part : le jeu
        // continue de tourner sur le rendu CSS tant que le nouveau n'est pas
        // au niveau.
        preview3d: path.resolve(__dirname, 'index-3d.html'),
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
