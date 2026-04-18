/**
 * ViewerPage — paste an `AgentfootprintTrace` JSON and explore it visually.
 *
 * Thin shell over `<TraceViewer>` from `footprint-explainable-ui` (0.17+).
 * The viewer component handles parse + validation + rendering. This page
 * adds the playground's UX chrome: privacy warnings, file load, status
 * sidebar, "What now?" empty state.
 *
 * Privacy: this page is **client-side only**. Pasted traces never leave
 * the browser. Trace JSON may contain PII — configure `setRedactionPolicy`
 * upstream so `sharedState` arrives scrubbed before sharing externally.
 */
import React, { useState } from 'react';
import { TraceViewer } from 'footprint-explainable-ui';
import type { TraceParseError } from 'footprint-explainable-ui';

export function ViewerPage() {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<TraceParseError | null>(null);
  const [meta, setMeta] = useState<{ schemaVersion?: number; exportedAt?: string; redacted?: boolean } | null>(null);

  const onPasteFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRaw(await file.text());
  };

  // Parse a meta header from the input for the sidebar (purely informational —
  // TraceViewer does its own validation independently). Best-effort, fail-quiet.
  React.useEffect(() => {
    if (!raw.trim()) {
      setMeta(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setMeta({
          schemaVersion: parsed.schemaVersion,
          exportedAt: parsed.exportedAt,
          redacted: parsed.redacted,
        });
      }
    } catch {
      setMeta(null);
    }
  }, [raw]);

  const isInvalidPaste = !!error && raw.trim().length > 0;
  const showRedactionWarning = meta?.redacted === false;

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: '#0d1117' }}>
      <header
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #30363d',
          color: '#c9d1d9',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <strong>Trace Viewer</strong>
        <span style={{ fontSize: 12, color: '#8b949e' }}>
          Paste an <code>exportTrace()</code> JSON to explore. Client-side only — nothing is uploaded.
        </span>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: input area */}
        <div
          style={{
            width: 360,
            borderRight: '1px solid #30363d',
            display: 'flex',
            flexDirection: 'column',
            padding: 12,
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, color: '#8b949e' }}>
            <strong>Privacy:</strong> Trace JSON may contain PII. Use{' '}
            <code>setRedactionPolicy</code> + <code>exportTrace</code> with the default
            <code> redact: true </code>before sharing.
          </div>
          <label style={{ fontSize: 12, color: '#c9d1d9' }}>
            Load from file
            <input
              type="file"
              accept=".json,application/json"
              onChange={onPasteFile}
              style={{ display: 'block', marginTop: 4, color: '#c9d1d9' }}
            />
          </label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder='Paste trace JSON here, e.g.\n{ "schemaVersion": 1, "snapshot": ..., "narrative": [...] }'
            style={{
              flex: 1,
              minHeight: 0,
              fontFamily: 'monospace',
              fontSize: 12,
              padding: 8,
              background: '#161b22',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: 4,
              resize: 'none',
            }}
          />
          {isInvalidPaste && (
            <div
              style={{
                background: '#3a1d1d',
                color: '#ff7b72',
                padding: 8,
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {error!.message}
            </div>
          )}
          {showRedactionWarning && (
            <div
              style={{
                background: '#3a2f1a',
                color: '#f0b67f',
                padding: 8,
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {'\u26A0\uFE0F'} Trace is NOT redacted. Configure setRedactionPolicy
              upstream and re-export before sharing externally.
            </div>
          )}
          {meta && !isInvalidPaste && (
            <div style={{ fontSize: 11, color: '#8b949e' }}>
              {meta.schemaVersion !== undefined && <div>schemaVersion: {meta.schemaVersion}</div>}
              {meta.exportedAt && <div>exportedAt: {meta.exportedAt}</div>}
              {meta.redacted !== undefined && <div>redacted: {String(meta.redacted)}</div>}
            </div>
          )}
          <button
            type="button"
            onClick={() => setRaw('')}
            disabled={!raw}
            style={{
              padding: '6px 12px',
              background: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: 4,
              cursor: raw ? 'pointer' : 'not-allowed',
              fontSize: 12,
            }}
          >
            Clear
          </button>
        </div>

        {/* Right: drop in the viewer component — it does parse + render */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'auto' }}>
          <TraceViewer
            trace={raw}
            onError={setError}
            fallback={<EmptyState />}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        color: '#8b949e',
        padding: 40,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <p>Capture a trace in your code:</p>
      <pre
        style={{
          background: '#161b22',
          padding: 12,
          borderRadius: 4,
          fontSize: 12,
          color: '#c9d1d9',
        }}
      >
        {`import { Agent, exportTrace, anthropic } from 'agentfootprint';

const agent = Agent.create({ provider: anthropic('claude-sonnet-4') })
  .system('...')
  .build();

await agent.run('hello');

const trace = exportTrace(agent);
console.log(JSON.stringify(trace));   // copy this`}
      </pre>
      <p>Then paste the JSON in the textarea on the left.</p>
    </div>
  );
}
