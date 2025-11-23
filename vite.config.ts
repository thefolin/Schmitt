import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Important pour GitHub Pages - remplacez 'Schmitt' par le nom exact de votre repo
  base: process.env.NODE_ENV === 'production' ? '/Schmitt/' : '/',
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
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        legacy: path.resolve(__dirname, 'index-legacy.html'),
        '3d': path.resolve(__dirname, 'index-3d.html'),
        new: path.resolve(__dirname, 'index-new.html'),
        editor: path.resolve(__dirname, 'index-editor.html'),
      },
    },
  },
});
