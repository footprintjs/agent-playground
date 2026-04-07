/**
 * Recorder Views — consumer-provided tabs for ExplainableShell.
 *
 * Each function creates a RecorderView from agentObservability() data.
 * Pass them to ExplainableShell via `recorderViews` prop.
 */
import React from 'react';
import type { RecorderView } from 'footprint-explainable-ui';
import { estimateTotalCost, formatCost } from '../../utils/estimateCost';

// ── Types ──────────────────────────────────────────────────

interface LLMCallEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

interface TokenStats {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  calls?: LLMCallEntry[];
}

interface ToolStats {
  totalCalls: number;
  byTool: Record<string, { calls: number; errors: number; averageLatencyMs?: number }>;
}

// ── Tokens View ────────────────────────────────────────────

export function createTokensView(tokens: TokenStats, providedCost?: number): RecorderView {
  const calls = tokens.calls ?? [];
  const cost = providedCost ?? (calls.length > 0 ? estimateTotalCost(calls) : 0);

  return {
    id: 'tokens',
    name: 'Tokens',
    render: () => (
      <div className="rv-panel">
        <div className="rv-stats">
          <Stat value={tokens.totalCalls} label="LLM Calls" />
          <Stat value={tokens.totalInputTokens.toLocaleString()} label="Input Tokens" />
          <Stat value={tokens.totalOutputTokens.toLocaleString()} label="Output Tokens" />
          <Stat
            value={(tokens.totalInputTokens + tokens.totalOutputTokens).toLocaleString()}
            label="Total Tokens"
          />
          {cost > 0 && (
            <Stat value={formatCost(cost)} label="Est. Cost" />
          )}
        </div>

        {calls.length > 0 && (
          <div className="rv-section">
            <div className="rv-section-title">Per LLM Call</div>
            <div className="rv-calls-table">
              {calls.map((call, i) => {
                const total = call.inputTokens + call.outputTokens;
                const maxTokens = Math.max(...calls.map(c => c.inputTokens + c.outputTokens), 1);
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
                      <div
                        className="rv-bar-input"
                        style={{ flex: call.inputTokens || 1 }}
                      />
                      <div
                        className="rv-bar-output"
                        style={{ flex: call.outputTokens || 1 }}
                      />
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
    ),
  };
}

// ── Tools View ─────────────────────────────────────────────

export function createToolsView(tools: ToolStats): RecorderView {
  const totalErrors = Object.values(tools.byTool).reduce((s, t) => s + t.errors, 0);

  return {
    id: 'tools',
    name: 'Tools',
    render: () => (
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
    ),
  };
}

// ── Shared Stat Component ──────────────────────────────────

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: 'error' }) {
  return (
    <div className={`rv-stat ${accent ? `rv-stat--${accent}` : ''}`}>
      <span className="rv-stat-value">{value}</span>
      <span className="rv-stat-label">{label}</span>
    </div>
  );
}
