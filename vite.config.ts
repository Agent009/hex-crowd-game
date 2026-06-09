import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/phaser/')) return 'phaser';
          if (id.includes('/@supabase/')) return 'supabase';
              if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
                return 'react-vendor';
              }
          if (id.includes('/lucide-react/')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
