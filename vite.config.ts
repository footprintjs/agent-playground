import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/agent-playground/',
  resolve: {
    alias: {
      // Single source of truth: examples live in the agentfootprint library itself.
      // Mirrors footprint-playground's pattern (which symlinks into footPrint/examples).
      '@samples': path.resolve(__dirname, '../agentfootprint/examples'),
    },
  },
  server: {
    fs: {
      // Allow serving files from agentfootprint (sibling directory)
      allow: ['..'],
    },
  },
  optimizeDeps: {
    exclude: ['footprintjs', 'agentfootprint', 'footprint-explainable-ui', 'agent-explainable-ui'],
  },
});
