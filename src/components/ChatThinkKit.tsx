/**
 * ChatThinkKit — compact in-chat typing-bubble variant of the ThinkKit
 * view. Reads the same recorder selectors as <ThinkKitPanel/>, but
 * renders in the tight vertical space of a chat typing bubble.
 *
 * Pattern mirrors NEO's ChatFeed: users see "Running add(17, 25)..."
 * LIVE in the chat while the agent works — not only in a side panel.
 * When a domain app provides a humanizer
 * (`recorder.setHumanizer({...})`), phrases automatically reflect
 * domain-specific language ("Checking port status on switch-3"
 * instead of "Running influx_get_port_status").
 */
import React from 'react';
import type { AgentTimelineRecorder } from 'agentfootprint';

export interface ChatThinkKitProps {
  readonly recorder: AgentTimelineRecorder;
  /** Bump to force re-read of the selectors after each event. */
  readonly version?: number;
}

export function ChatThinkKit({ recorder, version }: ChatThinkKitProps) {
  void version;
  const status = recorder.selectStatus();
  const activities = recorder.selectActivities();

  // Show up to the last 3 activities for bubble compactness — older ones
  // are visible in the side ThinkKit panel anyway.
  const recent = activities.slice(-3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.06)',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <Dot kind={status.kind} />
        {status.text || 'Working…'}
      </div>
      {recent.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {recent.map((a) => (
            <li key={a.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, opacity: 0.92 }}>
              <span
                style={{
                  flex: '0 0 auto',
                  color: a.done ? '#7cbd5a' : 'var(--accent, #4a90e2)',
                  fontFamily: 'monospace',
                  width: 12,
                }}
                aria-hidden
              >
                {a.done ? '✓' : '◯'}
              </span>
              <span style={{ flex: 1 }}>
                {a.label}
                {a.meta && <span style={{ opacity: 0.6 }}> — {a.meta}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Dot({ kind }: { kind: 'llm' | 'tool' | 'turn' | 'idle' }) {
  const colors: Record<string, string> = {
    llm: '#4a90e2',
    tool: '#7cbd5a',
    turn: '#b07cd4',
    idle: '#888',
  };
  const color = colors[kind] ?? '#888';
  const pulsing = kind !== 'idle' && kind !== 'turn';
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: pulsing ? `0 0 6px ${color}` : 'none',
        animation: pulsing ? 'chat-thinkkit-pulse 1.2s ease-in-out infinite' : 'none',
        flex: '0 0 auto',
      }}
    />
  );
}

// Inject the pulse keyframes once per session (small, module-level).
if (typeof document !== 'undefined' && !document.getElementById('chat-thinkkit-keyframes')) {
  const el = document.createElement('style');
  el.id = 'chat-thinkkit-keyframes';
  el.textContent = `
@keyframes chat-thinkkit-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(1.35); }
}
  `;
  document.head.appendChild(el);
}
