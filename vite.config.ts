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
    // Exclude linked/symlinked workspace packages from Vite's dep pre-bundling.
    // Otherwise Vite snapshots a bundled copy and won't pick up source changes
    // even after the target package rebuilds — manifests as stale API refs
    // like "recorder.selectAgent is not a function" after v2 rewrites.
    exclude: [
      'footprintjs',
      'agentfootprint',
      'agentfootprint-lens',
      'footprint-explainable-ui',
      'agent-explainable-ui',
    ],
  },
});
