import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
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
        '3d': path.resolve(__dirname, 'index-3d.html'),
        camera: path.resolve(__dirname, 'index-camera.html'),
        editor: path.resolve(__dirname, 'index-editor.html'),
      },
    },
  },
});
