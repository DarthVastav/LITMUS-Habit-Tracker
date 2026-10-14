import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // Importing a name a module doesn't export ships `undefined` and
        // explodes at runtime — that's a failure, not a warning.
        if (warning.code === 'MISSING_EXPORT') {
          throw new Error(warning.message);
        }
        defaultHandler(warning);
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
});
