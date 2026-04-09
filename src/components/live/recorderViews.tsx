/**
 * Recorder Views — progressive time-travel tabs for ExplainableShell.
 *
 * All 3 tabs (Tokens, Tools, Explain) are always visible.
 * Each updates progressively with the time-travel slider.
 *
 * Uses runtimeStageId from snapshots for O(1) recorder lookup.
 * snapshots[selectedIndex].runtimeStageId → recorder.getByKey(id)
 *
 * Single entry point: createRecorderViews(recorders) → RecorderView[]
 */
import React from 'react';
import type { RecorderView, StageSnapshot } from 'footprint-explainable-ui';
import { estimateTotalCost, formatCost } from '../../utils/estimateCost';
import type { RecorderSnapshot } from '../../runner/executeCode';

// ── Collect recorder entries up to selectedIndex ──────────

/** Collect all runtimeStageIds from snapshots[0..selectedIndex]. */
function collectKeysUpTo(snapshots: StageSnapshot[], selectedIndex: number): Set<string> {
  const keys = new Set<string>();
  const end = Math.min(selectedIndex + 1, snapshots.length);
  for (let i = 0; i < end; i++) {
    const id = (snapshots[i] as any).runtimeStageId;
    if (id) keys.add(id);
  }
  return keys;
}

// ── Single entry point ────────────────────────────────────

export function createRecorderViews(final?: RecorderSnapshot): RecorderView[] {
  return [
    tokensView(final),
    toolsView(final),
    explainView(final),
  ];
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

function tokensView(final?: RecorderSnapshot): RecorderView {
  return {
    id: 'tokens',
    name: 'Tokens',
    render: ({ snapshots, selectedIndex }) => {
      const tokens = final?.tokens;
      if (!tokens || tokens.totalCalls === 0) {
        return <EmptyState message="No LLM calls recorded." />;
      }

      const allCalls = tokens.calls ?? [];
      // Progressive: only show calls whose runtimeStageId is at or before selectedIndex
      const visibleKeys = collectKeysUpTo(snapshots, selectedIndex);
      const calls = allCalls.filter((c) => c.runtimeStageId && visibleKeys.has(c.runtimeStageId));

      if (calls.length === 0) {
        return <EmptyState message="LLM call hasn't executed yet. Step forward." />;
      }

      const inputTokens = calls.reduce((s, c) => s + c.inputTokens, 0);
      const outputTokens = calls.reduce((s, c) => s + c.outputTokens, 0);
      const cost = calls.length > 0 ? estimateTotalCost(calls) : 0;

      return (
        <div className="rv-panel">
          <div className="rv-stats">
            <Stat value={calls.length} label="LLM Calls" />
            <Stat value={inputTokens.toLocaleString()} label="Input Tokens" />
            <Stat value={outputTokens.toLocaleString()} label="Output Tokens" />
            <Stat value={(inputTokens + outputTokens).toLocaleString()} label="Total Tokens" />
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

function toolsView(final?: RecorderSnapshot): RecorderView {
  return {
    id: 'tools',
    name: 'Tools',
    render: ({ snapshots, selectedIndex }) => {
      const tools = final?.tools;
      if (!tools || tools.totalCalls === 0) {
        return <EmptyState message="No tool calls recorded." />;
      }

      // Check if any tool execution stages are visible
      const visibleKeys = collectKeysUpTo(snapshots, selectedIndex);
      const hasToolStage = [...visibleKeys].some((k) => k.includes('execute-tool') || k.includes('tool-calls'));

      if (!hasToolStage) {
        return <EmptyState message="Tool execution hasn't started yet. Step forward." />;
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

function explainView(final?: RecorderSnapshot): RecorderView {
  return {
    id: 'explain',
    name: 'Explain',
    render: ({ snapshots, selectedIndex }) => {
      const explain = final?.explain;
      if (!explain || (explain.sources.length === 0 && explain.claims.length === 0)) {
        return <EmptyState message="No grounding data. Run a sample with tools to see sources vs claims." />;
      }

      const visibleKeys = collectKeysUpTo(snapshots, selectedIndex);
      const hasLLM = [...visibleKeys].some((k) => k.includes('call-llm'));
      const hasTool = [...visibleKeys].some((k) => k.includes('execute-tool') || k.includes('tool-calls'));
      const hasFinal = [...visibleKeys].some((k) => k.includes('final'));

      if (!hasLLM) {
        return <EmptyState message="LLM hasn't been called yet. Step forward." />;
      }

      if (!hasTool && explain.decisions.length > 0) {
        return (
          <div className="rv-panel">
            <div className="rv-stats">
              <Stat value={0} label="Sources" />
              <Stat value={0} label="Claims" />
              <Stat value={explain.decisions.length} label="Decisions (pending)" />
            </div>
            <div className="rv-section">
              <div className="rv-section-title rv-explain-summary">
                LLM decided to call {explain.decisions.map(d => d.toolName).join(', ')}. Executing tools next.
              </div>
            </div>
          </div>
        );
      }

      const sources = hasTool ? explain.sources : [];
      const decisions = hasTool ? explain.decisions : [];
      const claims = hasFinal ? explain.claims : [];

      if (sources.length === 0 && claims.length === 0 && decisions.length === 0) {
        return <EmptyState message="No grounding data. Run a sample with tools to see sources vs claims." />;
      }

      const summary = claims.length > 0
        ? explain.summary
        : `${sources.length} source${sources.length !== 1 ? 's' : ''} collected. Claims arrive after finalize.`;

      return (
        <div className="rv-panel">
          <div className="rv-stats">
            <Stat value={sources.length} label="Sources" />
            <Stat value={claims.length} label="Claims" />
            <Stat value={decisions.length} label="Decisions" />
          </div>

          <div className="rv-section">
            <div className="rv-section-title rv-explain-summary">{summary}</div>
          </div>

          {sources.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-title">Sources (tool results — ground truth)</div>
              <div className="rv-tool-list">
                {sources.map((s, i) => (
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

          {claims.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-title">Claims (LLM output — to verify)</div>
              <div className="rv-tool-list">
                {claims.map((c, i) => (
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

          {decisions.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-title">Decisions (tool calls the LLM made)</div>
              <div className="rv-tool-list">
                {decisions.map((d, i) => (
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
