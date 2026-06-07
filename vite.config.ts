import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/agent-playground/',
  resolve: {
    // Force a SINGLE copy of React (+ react-dom + @xyflow/react) across the
    // symlinked workspace packages (lens / explainable-ui each carry their own
    // node_modules copy). Without this, a fresh dep-optimization can hand
    // @xyflow/react a second React → "Invalid hook call / useState of null"
    // and the Lens crashes into its error boundary. dedupe pins them to the
    // playground's copy.
    dedupe: ['react', 'react-dom', '@xyflow/react'],
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
