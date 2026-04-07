/**
 * Recorder Views — progressive time-travel tabs for ExplainableShell.
 *
 * All 3 tabs (Tokens, Tools, Explain) are always visible.
 * Each updates progressively with the time-travel slider — showing
 * cumulative data up to the selected stage, not the final state.
 *
 * The same progressive pattern as Narrative, abstracted for all recorder data.
 *
 * Single entry point: createRecorderViews(recorders, byStage) → RecorderView[]
 */
import React from 'react';
import type { RecorderView } from 'footprint-explainable-ui';
import { estimateTotalCost, formatCost } from '../../utils/estimateCost';
import type { RecorderSnapshot } from '../../runner/executeCode';

// ── Single entry point ────────────────────────────────────

export function createRecorderViews(
  final?: RecorderSnapshot,
  byStage?: RecorderSnapshot[],
): RecorderView[] {
  return [
    tokensView(final, byStage),
    toolsView(final, byStage),
    explainView(final, byStage),
  ];
}

// ── Resolve snapshot for current index ────────────────────

function resolveSnapshot(
  final: RecorderSnapshot | undefined,
  byStage: RecorderSnapshot[] | undefined,
  selectedIndex: number,
): RecorderSnapshot | undefined {
  // -1 or beyond array = final state
  if (!byStage || selectedIndex < 0 || selectedIndex >= byStage.length) {
    return final;
  }
  return byStage[selectedIndex];
}

// ── Empty state ───────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rv-panel rv-empty">
      <div className="rv-empty-text">{message}</div>
    </div>
  );
}

// ── Tokens ────────────────────────────────────────────────

function tokensView(final?: RecorderSnapshot, byStage?: RecorderSnapshot[]): RecorderView {
  return {
    id: 'tokens',
    name: 'Tokens',
    render: ({ selectedIndex }) => {
      const rec = resolveSnapshot(final, byStage, selectedIndex);
      const tokens = rec?.tokens;

      if (!tokens || tokens.totalCalls === 0) {
        return <EmptyState message="No LLM calls recorded yet." />;
      }

      const calls = tokens.calls ?? [];
      const cost = rec?.cost ?? (calls.length > 0 ? estimateTotalCost(calls) : 0);

      return (
        <div className="rv-panel">
          <div className="rv-stats">
            <Stat value={tokens.totalCalls} label="LLM Calls" />
            <Stat value={tokens.totalInputTokens.toLocaleString()} label="Input Tokens" />
            <Stat value={tokens.totalOutputTokens.toLocaleString()} label="Output Tokens" />
            <Stat
              value={(tokens.totalInputTokens + tokens.totalOutputTokens).toLocaleString()}
              label="Total Tokens"
            />
            {cost > 0 && <Stat value={formatCost(cost)} label="Est. Cost" />}
          </div>

          {calls.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-title">Per LLM Call</div>
              <div className="rv-calls-table">
                {calls.map((call, i) => {
                  const total = call.inputTokens + call.outputTokens;
                  const maxTokens = Math.max(...calls.map((c) => c.inputTokens + c.outputTokens), 1);
                  const pct = Math.round((total / maxTokens) * 100);
                  return (
                    <div key={i} className="rv-call-row">
                      <div className="rv-call-header">
                        <span className="rv-call-label">Call {i + 1}</span>
                        <span className="rv-call-tokens">
                          {call.inputTokens.toLocaleString()} in / {call.outputTokens.toLocaleString()} out
                        </span>
                      </div>
                      <div className="rv-bar">
                        <div className="rv-bar-input" style={{ flex: call.inputTokens || 1 }} />
                        <div className="rv-bar-output" style={{ flex: call.outputTokens || 1 }} />
                      </div>
                      <div className="rv-bar-bg" style={{ width: `${pct}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="rv-legend">
                <span className="rv-legend-item">
                  <span className="rv-legend-swatch rv-legend-swatch--input" /> Input
                </span>
                <span className="rv-legend-item">
                  <span className="rv-legend-swatch rv-legend-swatch--output" /> Output
                </span>
              </div>
            </div>
          )}
        </div>
      );
    },
  };
}

// ── Tools ─────────────────────────────────────────────────

function toolsView(final?: RecorderSnapshot, byStage?: RecorderSnapshot[]): RecorderView {
  return {
    id: 'tools',
    name: 'Tools',
    render: ({ selectedIndex }) => {
      const rec = resolveSnapshot(final, byStage, selectedIndex);
      const tools = rec?.tools;

      if (!tools || tools.totalCalls === 0) {
        return <EmptyState message="No tool calls recorded yet." />;
      }

      const totalErrors = Object.values(tools.byTool).reduce((s, t) => s + t.errors, 0);

      return (
        <div className="rv-panel">
          <div className="rv-stats">
            <Stat value={tools.totalCalls} label="Total Calls" />
            <Stat value={Object.keys(tools.byTool).length} label="Unique Tools" />
            <Stat value={totalErrors} label="Errors" accent={totalErrors > 0 ? 'error' : undefined} />
          </div>

          <div className="rv-section">
            <div className="rv-section-title">Per Tool</div>
            <div className="rv-tool-list">
              {Object.entries(tools.byTool).map(([name, stats]) => (
                <div key={name} className="rv-tool-item">
                  <div className="rv-tool-header">
                    <span className="rv-tool-name">{name}</span>
                    <span className="rv-tool-calls">{stats.calls}x</span>
                  </div>
                  <div className="rv-tool-meta">
                    {stats.averageLatencyMs != null && (
                      <span className="rv-tool-latency">avg {Math.round(stats.averageLatencyMs)}ms</span>
                    )}
                    {stats.errors > 0 && (
                      <span className="rv-tool-errors">
                        {stats.errors} error{stats.errors > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="rv-tool-bar">
                    <div
                      className="rv-tool-bar-fill"
                      style={{ width: `${Math.round((stats.calls / tools.totalCalls) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    },
  };
}

// ── Explain ───────────────────────────────────────────────

function explainView(final?: RecorderSnapshot, byStage?: RecorderSnapshot[]): RecorderView {
  return {
    id: 'explain',
    name: 'Explain',
    render: ({ selectedIndex }) => {
      const rec = resolveSnapshot(final, byStage, selectedIndex);
      const explain = rec?.explain;

      if (!explain || (explain.sources.length === 0 && explain.claims.length === 0)) {
        return <EmptyState message="No grounding data yet. Step forward to see sources and claims accumulate." />;
      }

      return (
        <div className="rv-panel">
          <div className="rv-stats">
            <Stat value={explain.sources.length} label="Sources" />
            <Stat value={explain.claims.length} label="Claims" />
            <Stat value={explain.decisions.length} label="Decisions" />
          </div>

          <div className="rv-section">
            <div className="rv-section-title rv-explain-summary">{explain.summary}</div>
          </div>

          {explain.sources.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-title">Sources (tool results — ground truth)</div>
              <div className="rv-tool-list">
                {explain.sources.map((s, i) => (
                  <div key={i} className="rv-tool-item">
                    <div className="rv-tool-header">
                      <span className="rv-tool-name">{s.toolName}</span>
                      {s.turnNumber != null && <span className="rv-tool-calls">turn {s.turnNumber}</span>}
                    </div>
                    <div className="rv-explain-content">{s.result}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {explain.claims.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-title">Claims (LLM output — to verify)</div>
              <div className="rv-tool-list">
                {explain.claims.map((c, i) => (
                  <div key={i} className="rv-tool-item">
                    <div className="rv-tool-header">
                      <span className="rv-tool-name">Claim {i + 1}</span>
                      {c.model && <span className="rv-tool-calls">{c.model}</span>}
                    </div>
                    <div className="rv-explain-content">{c.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {explain.decisions.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-title">Decisions (tool calls the LLM made)</div>
              <div className="rv-tool-list">
                {explain.decisions.map((d, i) => (
                  <div key={i} className="rv-tool-item">
                    <div className="rv-tool-header">
                      <span className="rv-tool-name">{d.toolName}</span>
                      <span className="rv-tool-latency">{Math.round(d.latencyMs)}ms</span>
                    </div>
                    <div className="rv-explain-content rv-explain-args">{JSON.stringify(d.args)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    },
  };
}

// ── Shared ────────────────────────────────────────────────

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: 'error' }) {
  return (
    <div className={`rv-stat ${accent ? `rv-stat--${accent}` : ''}`}>
      <span className="rv-stat-value">{value}</span>
      <span className="rv-stat-label">{label}</span>
    </div>
  );
}
