import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // El mapa (MapLibre con React) pesa ~960 kB solo; separado, el navegador lo guarda en caché.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          mapa: ['maplibre-gl', 'react-map-gl/maplibre'],
          deck: ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/react', '@deck.gl/extensions'],
          graficas: ['recharts'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
