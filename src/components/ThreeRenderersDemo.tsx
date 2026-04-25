/**
 * ThreeRenderersDemo — placeholder post Lens v2 migration.
 *
 * Previously showed the same execution through three v1 Lens views
 * (engineer / analyst / user). v1 Lens is removed; Lens v2 exposes
 * selectors (`selectRunTree`, `selectEventLog`, `selectSummary`) that
 * drive the same visual differentiation through one `<Lens>` component
 * with a `view` prop. This file is kept as a stub so existing imports
 * compile — the SamplePage no longer renders it.
 */

import React from 'react';

export interface ThreeRenderersDemoProps {
  readonly recorder?: unknown;
  readonly version?: number;
}

export const ThreeRenderersDemo: React.FC<ThreeRenderersDemoProps> = () => (
  <div style={{ padding: 16, color: 'var(--text-muted)' }}>
    3-renderers demo pending Lens v2 selector rewrite.
  </div>
);
