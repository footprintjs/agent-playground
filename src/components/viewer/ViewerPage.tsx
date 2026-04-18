/**
 * ViewerPage — paste an `AgentfootprintTrace` JSON and explore it visually.
 *
 * Production users capture traces with `agentfootprint.exportTrace(runner)`,
 * paste the JSON here, and see the same Behind-the-Scenes view they'd get
 * from running the agent live — flowchart topology, narrative timeline,
 * snapshot state, recorder data — without re-executing anything.
 *
 * Privacy: this page is **client-side only**. Pasted traces never leave the
 * browser. Trace JSON contains scope state which may include PII; users
 * should configure `setRedactionPolicy` upstream so `sharedState` arrives
 * as 'REDACTED' in the export. Default `exportTrace(runner)` requests the
 * redacted mirror — but only works if the runner had a policy set.
 */
import React, { useMemo, useState } from 'react';
import { BTSPanel } from '../live/BTSPanel';
import type { CapturedExecution } from '../../runner/executeCode';

interface AgentfootprintTrace {
  schemaVersion: number;
  exportedAt?: string;
  redacted?: boolean;
  snapshot?: unknown;
  narrativeEntries?: unknown[];
  narrative?: string[];
  spec?: unknown;
}

type ParseResult =
  | { ok: true; trace: AgentfootprintTrace; warnings: string[] }
  | { ok: false; error: string };

function parseTrace(raw: string): ParseResult {
  if (!raw.trim()) return { ok: false, error: 'Paste a trace JSON to begin.' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: `Not valid JSON: ${(err as Error).message}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Trace must be a JSON object, not a primitive or array.' };
  }

  const t = parsed as AgentfootprintTrace;
  const warnings: string[] = [];

  if (typeof t.schemaVersion !== 'number') {
    return {
      ok: false,
      error: 'Missing required field: `schemaVersion`. Did you paste an exportTrace() output?',
    };
  }
  if (t.schemaVersion !== 1) {
    return {
      ok: false,
      error: `Unsupported schemaVersion: ${t.schemaVersion}. This viewer renders schemaVersion 1.`,
    };
  }

  if (t.redacted === false) {
    warnings.push(
      'Trace is NOT redacted (sharedState contains raw values). Configure setRedactionPolicy upstream and re-export before sharing externally.',
    );
  }
  if (!t.snapshot && !t.narrative && !t.narrativeEntries && !t.spec) {
    warnings.push('Trace has no snapshot, narrative, or spec — nothing to render. Was the run empty?');
  }

  return { ok: true, trace: t, warnings };
}

export function ViewerPage() {
  const [raw, setRaw] = useState('');
  const parsed = useMemo(() => parseTrace(raw), [raw]);

  const execution: CapturedExecution | null = useMemo(() => {
    if (!parsed.ok) return null;
    return {
      snapshot: parsed.trace.snapshot,
      narrativeEntries: parsed.trace.narrativeEntries,
      narrative: parsed.trace.narrative,
      spec: parsed.trace.spec,
    };
  }, [parsed]);

  const onPasteFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRaw(text);
  };

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
          {!parsed.ok && raw.trim() && (
            <div
              style={{
                background: '#3a1d1d',
                color: '#ff7b72',
                padding: 8,
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {parsed.error}
            </div>
          )}
          {parsed.ok && parsed.warnings.length > 0 && (
            <div
              style={{
                background: '#3a2f1a',
                color: '#f0b67f',
                padding: 8,
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {parsed.warnings.map((w, i) => (
                <div key={i}>{'\u26A0\uFE0F'} {w}</div>
              ))}
            </div>
          )}
          {parsed.ok && (
            <div style={{ fontSize: 11, color: '#8b949e' }}>
              <div>schemaVersion: {parsed.trace.schemaVersion}</div>
              {parsed.trace.exportedAt && <div>exportedAt: {parsed.trace.exportedAt}</div>}
              <div>redacted: {String(parsed.trace.redacted ?? false)}</div>
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

        {/* Right: BTS view */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {execution ? (
            <BTSPanel
              execution={execution}
              collapsed={false}
              onToggleCollapse={() => {
                /* always-open in viewer mode */
              }}
              style={{ height: '100%', borderLeft: 'none' }}
            />
          ) : (
            <div
              style={{
                color: '#8b949e',
                padding: 40,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <p>
                Capture a trace in your code:
              </p>
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
console.log(JSON.stringify(trace));   // copy this
// or: fs.writeFileSync('trace.json', JSON.stringify(trace, null, 2));`}
              </pre>
              <p>Then paste the JSON in the textarea on the left.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
