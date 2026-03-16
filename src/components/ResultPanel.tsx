import React, { useState } from 'react';
import {
  AgentExplainableShell,
  ConversationView,
  TokenChart,
  ToolUsagePanel,
  CostPanel,
} from 'agent-explainable-ui';
import type { AgentSnapshot, TurnSnapshot } from 'agent-explainable-ui';
import type { ExecuteResult, CapturedExecution } from '../runner/executeCode';
import { TracedFlowchartView } from 'footprint-explainable-ui/flowchart';

interface ResultPanelProps {
  result: ExecuteResult | null;
  running: boolean;
  onRun: () => void;
  input: string;
  onInputChange: (value: string) => void;
}

type ViewMode = 'raw' | 'conversation' | 'metrics' | 'flowchart';

/**
 * Try to extract an AgentSnapshot from the execution output.
 * If the output has content/tokens/toolCalls, build a snapshot for visualization.
 */
function tryBuildSnapshot(output: unknown): AgentSnapshot | null {
  if (!output || typeof output !== 'object') return null;
  const obj = output as Record<string, unknown>;

  // Build turns from the output shape
  const turns: TurnSnapshot[] = [];
  const content = (obj.content as string) ?? '';

  // Single-turn result
  if (content) {
    const tokens = obj.tokens as Record<string, number> | undefined;
    turns.push({
      turnNumber: 1,
      messages: [
        { role: 'user', content: '(user input)' },
        { role: 'assistant', content },
      ],
      toolCalls: [],
      tokens: {
        input: tokens?.totalInput ?? tokens?.inputTokens ?? 10,
        output: tokens?.totalOutput ?? tokens?.outputTokens ?? 20,
      },
    });
  }

  // Multi-provider results (e.g., sample 14)
  if (obj.anthropic && typeof obj.anthropic === 'string') {
    turns.push({
      turnNumber: 1,
      messages: [
        { role: 'user', content: '(user input)' },
        { role: 'assistant', content: obj.anthropic as string },
      ],
      toolCalls: [],
      tokens: { input: 10, output: 8 },
    });
  }
  if (obj.openai && typeof obj.openai === 'string') {
    turns.push({
      turnNumber: turns.length + 1,
      messages: [
        { role: 'user', content: '(user input)' },
        { role: 'assistant', content: obj.openai as string },
      ],
      toolCalls: [],
      tokens: { input: 10, output: 8 },
    });
  }

  // Summary/translation results
  if (obj.summary && typeof obj.summary === 'string') {
    turns.push({
      turnNumber: 1,
      messages: [
        { role: 'user', content: '(user input)' },
        { role: 'assistant', content: obj.summary as string },
      ],
      toolCalls: [],
      tokens: { input: 10, output: 15 },
    });
  }
  if (obj.translation && typeof obj.translation === 'string') {
    turns.push({
      turnNumber: turns.length + 1,
      messages: [
        { role: 'user', content: '(user input)' },
        { role: 'assistant', content: obj.translation as string },
      ],
      toolCalls: [],
      tokens: { input: 10, output: 15 },
    });
  }

  if (turns.length === 0) return null;

  // Compute totals
  const totalInput = turns.reduce((s, t) => s + t.tokens.input, 0);
  const totalOutput = turns.reduce((s, t) => s + t.tokens.output, 0);

  return {
    concept: 'LLMCall',
    agentId: 'playground',
    agentName: 'Playground Sample',
    turns,
    tokens: {
      totalInput,
      totalOutput,
      totalTokens: totalInput + totalOutput,
      perTurn: turns.map((t) => ({ turn: t.turnNumber, input: t.tokens.input, output: t.tokens.output })),
    },
    cost: {
      totalCost: (totalInput * 0.003 + totalOutput * 0.015) / 1000,
      currency: '$',
      perTurn: turns.map((t) => ({
        turn: t.turnNumber,
        cost: (t.tokens.input * 0.003 + t.tokens.output * 0.015) / 1000,
      })),
    },
    toolUsage: {
      totalCalls: turns.reduce((s, t) => s + t.toolCalls.length, 0),
      uniqueTools: 0,
      perTool: [],
    },
    result: content || undefined,
  };
}

export function ResultPanel({ result, running, onRun, input, onInputChange }: ResultPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('raw');

  const snapshot = result?.output ? tryBuildSnapshot(result.output) : null;
  const hasExplainable = snapshot !== null;
  const hasFlowchart = !!(result?.execution?.spec);

  // Available tabs based on what data we have
  const tabs: { id: ViewMode; label: string }[] = [
    { id: 'raw', label: 'Raw' },
  ];
  if (hasExplainable) {
    tabs.push({ id: 'conversation', label: 'Conversation' });
    tabs.push({ id: 'metrics', label: 'Metrics' });
  }
  if (hasFlowchart) {
    tabs.push({ id: 'flowchart', label: 'Flowchart' });
  }

  // Reset to raw if current tab is no longer available
  const activeTab = tabs.find((t) => t.id === viewMode) ? viewMode : 'raw';

  return (
    <div className="result-panel">
      <div className="panel-header">
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setViewMode(tab.id)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {result && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {result.durationMs}ms
            </span>
          )}
          <button className="run-button" onClick={onRun} disabled={running}>
            {running ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <label
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          Input:
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Enter input for the sample..."
          style={{
            flex: 1,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '6px 10px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
          }}
          onKeyDown={(e) => e.key === 'Enter' && onRun()}
        />
      </div>

      <div className="panel-content">
        {!result && !running && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
            Click <strong>Run</strong> to execute the sample
          </div>
        )}

        {result?.error && (
          <div className="output-block output-error">{result.error}</div>
        )}

        {/* Raw JSON view */}
        {activeTab === 'raw' && result?.output !== null && result?.output !== undefined && !result?.error && (
          <>
            <div className="output-block output-success">
              {typeof result.output === 'string'
                ? result.output
                : JSON.stringify(result.output, null, 2)}
            </div>
            {result.logs.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    marginTop: '12px',
                  }}
                >
                  Console
                </div>
                {result.logs.map((log, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: log.startsWith('[ERROR]')
                        ? 'var(--error)'
                        : log.startsWith('[WARN]')
                          ? 'var(--warning)'
                          : 'var(--text-secondary)',
                      padding: '2px 0',
                    }}
                  >
                    {log}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* Conversation view */}
        {activeTab === 'conversation' && snapshot && !result?.error && (
          <AgentExplainableShell
            snapshot={snapshot}
            defaultTab="conversation"
            style={{ height: '100%', border: 'none' }}
          />
        )}

        {/* Metrics view — individual metric panels */}
        {activeTab === 'metrics' && snapshot && !result?.error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Latency */}
            <MetricCard
              title="Latency"
              value={`${result?.durationMs ?? 0}ms`}
              color="var(--accent)"
            />

            {/* Token usage */}
            <div>
              <SectionHeader>Token Usage</SectionHeader>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <MetricCard
                  title="Input Tokens"
                  value={snapshot.tokens.totalInput.toLocaleString()}
                  color="var(--accent)"
                  small
                />
                <MetricCard
                  title="Output Tokens"
                  value={snapshot.tokens.totalOutput.toLocaleString()}
                  color="var(--success)"
                  small
                />
                <MetricCard
                  title="Total"
                  value={snapshot.tokens.totalTokens.toLocaleString()}
                  color="var(--text-primary)"
                  small
                />
              </div>
              <TokenChart tokens={snapshot.tokens} size="compact" />
            </div>

            {/* Cost */}
            <div>
              <SectionHeader>Cost</SectionHeader>
              <MetricCard
                title="Total Cost"
                value={`${snapshot.cost.currency}${snapshot.cost.totalCost.toFixed(6)}`}
                color="var(--warning)"
              />
              <div style={{ marginTop: '12px' }}>
                <CostPanel cost={snapshot.cost} size="compact" />
              </div>
            </div>

            {/* Tool Usage */}
            {snapshot.toolUsage.totalCalls > 0 && (
              <div>
                <SectionHeader>Tool Usage</SectionHeader>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <MetricCard
                    title="Total Calls"
                    value={String(snapshot.toolUsage.totalCalls)}
                    color="var(--accent)"
                    small
                  />
                  <MetricCard
                    title="Unique Tools"
                    value={String(snapshot.toolUsage.uniqueTools)}
                    color="var(--success)"
                    small
                  />
                </div>
                <ToolUsagePanel toolUsage={snapshot.toolUsage} size="compact" />
              </div>
            )}
          </div>
        )}

        {/* Flowchart view with drill-down */}
        {activeTab === 'flowchart' && result?.execution && !result?.error && (
          <FlowchartPanel execution={result.execution} />
        )}
      </div>
    </div>
  );
}

// ── Flowchart Panel with drill-down ──────────────────────

function FlowchartPanel({ execution }: { execution: CapturedExecution }) {
  const spec = execution.spec;
  if (!spec) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
        No flowchart spec captured. Run a sample that uses LLMCall, Agent, or FlowChart.
      </div>
    );
  }

  // Build snapshots for traced flowchart
  let snapshots: any[] = [];
  try {
    const { toVisualizationSnapshots } = require('footprint-explainable-ui');
    if (execution.snapshot) {
      snapshots = toVisualizationSnapshots(
        execution.snapshot,
        execution.narrativeEntries ?? undefined,
      );
    }
  } catch {
    // Fallback: no snapshots, just show spec
  }

  return (
    <div style={{ height: '100%', minHeight: '400px' }}>
      <TracedFlowchartView
        spec={spec as any}
        snapshots={snapshots}
        snapshotIndex={snapshots.length - 1}
      />
    </div>
  );
}

// ── Shared UI components ──────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        fontSize: '11px',
        fontWeight: active ? 600 : 400,
        background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
        color: active ? 'white' : 'var(--text-muted)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function MetricCard({
  title,
  value,
  color,
  small,
}: {
  title: string;
  value: string;
  color: string;
  small?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)',
        padding: small ? '10px 14px' : '14px 18px',
        flex: small ? 1 : undefined,
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-muted)',
          marginBottom: '4px',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: small ? '18px' : '24px',
          fontWeight: 700,
          color,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--text-muted)',
        marginBottom: '10px',
      }}
    >
      {children}
    </div>
  );
}
