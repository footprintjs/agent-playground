import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/agent-playground/',
  resolve: {
    alias: {
      '@samples': path.resolve(__dirname, '../agent-samples/examples'),
    },
  },
  server: {
    fs: {
      // Allow serving files from agent-samples (sibling directory)
      allow: ['..'],
    },
  },
});
