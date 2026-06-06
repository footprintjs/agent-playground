/**
 * Modal — a focused full-screen overlay for on-demand content (Code /
 * Explain / Flowchart) that doesn't earn a permanent panel.
 *
 * Self-contained (inline styles, no global.css dependency): a dimmed
 * backdrop + a centered panel with a header slot (tabs) and a close
 * button. Closes on ✕, backdrop click, or Esc. Renders nothing when
 * `open` is false.
 */

import React, { useEffect } from 'react';

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Header content — typically a tab strip. Rendered left of the ✕. */
  readonly header?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly ariaLabel?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, header, children, ariaLabel }) => {
  // Esc closes. Bind only while open so we don't leak a global listener.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(2, 6, 23, 0.62)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(12px, 4vh, 48px)',
      }}
    >
      {/* Stop propagation so clicks inside the panel don't close it. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1100px, 94vw)',
          height: 'min(820px, 90vh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--lens-bg-elevated, #0f172a)',
          color: 'var(--lens-text, #e2e8f0)',
          border: '1px solid var(--lens-stroke-dim, #334155)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 10px 8px 12px',
            borderBottom: '1px solid var(--lens-stroke-dim, #334155)',
            flex: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {header}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            style={{
              flex: 'none',
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--lens-stroke-dim, #334155)',
              background: 'transparent',
              color: 'inherit',
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
