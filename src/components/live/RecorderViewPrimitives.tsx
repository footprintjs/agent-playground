import React from 'react';

// ── Empty state ───────────────────────────────────────────

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rv-panel rv-empty">
      <div className="rv-empty-text">{message}</div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────

export function Stat({ value, label, accent }: { value: string | number; label: string; accent?: 'error' }) {
  return (
    <div className={`rv-stat ${accent ? `rv-stat--${accent}` : ''}`}>
      <span className="rv-stat-value">{value}</span>
      <span className="rv-stat-label">{label}</span>
    </div>
  );
}
