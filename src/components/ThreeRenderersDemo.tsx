/**
 * ThreeRenderersDemo — concrete proof of "one shape, many renderers."
 *
 * Three panels side-by-side, all reading from the SAME
 * `AgentTimelineRecorder`. The recorder owns every derivation; each
 * panel is a pure renderer over the typed selector surface:
 *
 *   Flowchart panel     → recorder.selectTopology()    (engineer view)
 *   Commentary panel    → recorder.selectCommentary()  (analyst view)
 *   ThinkKit panel      → recorder.selectActivities()
 *                       + recorder.selectStatus()      (end-user view)
 *
 * A Vue / Angular / CLI consumer would render the same three audiences
 * over the same three selectors — the library shape is framework-agnostic.
 */
import React from 'react';
import type { AgentTimelineRecorder } from 'agentfootprint';

export interface ThreeRenderersDemoProps {
  readonly recorder: AgentTimelineRecorder;
  /** Bumped by the parent on every event so this component re-renders
   *  and re-reads the selectors. Pairs with useLiveTimeline.sync(). */
  readonly version: number;
}

export function ThreeRenderersDemo({ recorder, version }: ThreeRenderersDemoProps) {
  // Version-keyed so selector memoization invalidates between renders
  // when new events arrive.
  void version;

  const topology = recorder.selectTopology();
  const commentary = recorder.selectCommentary();
  const activities = recorder.selectActivities();
  const status = recorder.selectStatus();
  const runSummary = recorder.selectRunSummary();

  return (
    <div style={styles.root}>
      <div style={styles.banner}>
        <strong>One shape, many renderers.</strong> All three panels below
        read from the same <code>AgentTimelineRecorder</code>. No per-view
        transformation logic — every shape comes from a typed selector.
      </div>

      <div style={styles.grid}>
        {/* ── Engineer view: Flowchart (composition topology) ── */}
        <section style={styles.panel}>
          <header style={styles.panelHeader}>
            <span style={styles.panelAudience}>ENGINEER</span>
            <h3 style={styles.panelTitle}>Flowchart</h3>
            <code style={styles.selector}>selectTopology()</code>
          </header>
          <div style={styles.panelBody}>
            {topology.nodes.length === 0 ? (
              <Empty text="No composition yet — run an agent" />
            ) : (
              <ul style={styles.topologyList}>
                {topology.nodes.map((n) => (
                  <li key={n.id} style={{ paddingLeft: n.depth * 12 }}>
                    <span style={kindBadge(n.kind)}>{n.kind}</span>
                    <strong>{n.name}</strong>
                    <span style={styles.edges}>
                      {n.incomingKind !== 'root' && ` ← ${n.incomingKind}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {topology.edges.length > 0 && (
              <div style={styles.edges}>
                {topology.edges.length} edge{topology.edges.length === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </section>

        {/* ── Analyst view: Commentary (human narrative) ── */}
        <section style={styles.panel}>
          <header style={styles.panelHeader}>
            <span style={styles.panelAudience}>ANALYST</span>
            <h3 style={styles.panelTitle}>Commentary</h3>
            <code style={styles.selector}>selectCommentary()</code>
          </header>
          <div style={styles.panelBody}>
            {commentary.length === 0 ? (
              <Empty text="No events yet" />
            ) : (
              <ol style={styles.commentaryList}>
                {commentary.map((c, i) => (
                  <li key={i} style={styles.commentaryItem}>
                    <span style={kindBadge(c.kind)}>{c.kind}</span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* ── End-user view: ThinkKit activities + status ── */}
        <section style={styles.panel}>
          <header style={styles.panelHeader}>
            <span style={styles.panelAudience}>END USER</span>
            <h3 style={styles.panelTitle}>ThinkKit</h3>
            <code style={styles.selector}>selectActivities() + selectStatus()</code>
          </header>
          <div style={styles.panelBody}>
            <div style={styles.statusPill}>
              <span style={styles.statusDot(status.kind)} />
              {status.text || 'Idle'}
            </div>
            {activities.length === 0 ? (
              <Empty text="No activity yet" />
            ) : (
              <ul style={styles.activityList}>
                {activities.map((a) => (
                  <li key={a.id} style={styles.activityItem}>
                    <span style={styles.activityCheck(a.done)}>{a.done ? '✓' : '◯'}</span>
                    <span style={{ flex: 1 }}>
                      <strong>{a.label}</strong>
                      {a.meta && <span style={styles.activityMeta}> — {a.meta}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* ── Aggregates banner ── */}
      <div style={styles.summary}>
        <strong>selectRunSummary():</strong>
        {' '}
        {runSummary.turnCount} turn{runSummary.turnCount === 1 ? '' : 's'}, {' '}
        {runSummary.iterationCount} iteration{runSummary.iterationCount === 1 ? '' : 's'}, {' '}
        {runSummary.toolCallCount} tool call{runSummary.toolCallCount === 1 ? '' : 's'}, {' '}
        {runSummary.inputTokens + runSummary.outputTokens} tokens, {' '}
        {Math.round(runSummary.totalDurationMs)}ms
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ opacity: 0.5, fontStyle: 'italic', padding: '1em 0' }}>{text}</div>;
}

function kindBadge(kind: string): React.CSSProperties {
  const colors: Record<string, string> = {
    llm: '#4a90e2',
    tool: '#7cbd5a',
    turn: '#b07cd4',
    context: '#e2a050',
    subflow: '#4a90e2',
    'fork-branch': '#7cbd5a',
    'decision-branch': '#e2a050',
  };
  return {
    display: 'inline-block',
    padding: '2px 6px',
    marginRight: 8,
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 3,
    background: colors[kind] ?? '#888',
    color: 'white',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  };
}

const styles = {
  root: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: 16 },
  banner: {
    padding: '10px 14px',
    background: 'var(--bg-tertiary, #f0f4f8)',
    border: '1px solid var(--border, #d0d7de)',
    borderRadius: 6,
    fontSize: 13,
    lineHeight: 1.4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))',
    gap: 12,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--bg-secondary, white)',
    border: '1px solid var(--border, #d0d7de)',
    borderRadius: 6,
    overflow: 'hidden',
    minHeight: 320,
  },
  panelHeader: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border, #d0d7de)',
    background: 'var(--bg-tertiary, #f6f8fa)',
  },
  panelAudience: {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: 'var(--text-muted, #666)',
  },
  panelTitle: { margin: '4px 0 4px 0', fontSize: 16 },
  selector: {
    fontSize: 11,
    color: 'var(--text-muted, #666)',
    background: 'var(--bg-primary, white)',
    padding: '2px 6px',
    borderRadius: 3,
  },
  panelBody: { padding: 12, overflow: 'auto', flex: 1, fontSize: 13 },
  topologyList: { listStyle: 'none', padding: 0, margin: 0 },
  edges: { marginTop: 10, fontSize: 11, color: 'var(--text-muted, #666)' },
  commentaryList: { listStyle: 'none', padding: 0, margin: 0 },
  commentaryItem: {
    padding: '4px 0',
    borderBottom: '1px dashed var(--border, #eee)',
    display: 'flex',
    alignItems: 'flex-start',
  },
  statusPill: {
    padding: '6px 10px',
    marginBottom: 10,
    background: 'var(--bg-primary, #eef6ff)',
    border: '1px solid var(--border, #d0d7de)',
    borderRadius: 14,
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: (kind: string): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: { llm: '#4a90e2', tool: '#7cbd5a', turn: '#b07cd4', idle: '#aaa' }[kind] ?? '#aaa',
    animation: kind !== 'idle' ? 'pulse 1.2s infinite' : 'none',
  }),
  activityList: { listStyle: 'none', padding: 0, margin: 0 },
  activityItem: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    padding: '4px 0',
  },
  activityCheck: (done: boolean): React.CSSProperties => ({
    color: done ? '#7cbd5a' : '#bbb',
    fontFamily: 'monospace',
  }),
  activityMeta: { color: 'var(--text-muted, #777)', fontSize: 12 },
  summary: {
    padding: '8px 12px',
    background: 'var(--bg-tertiary, #f6f8fa)',
    border: '1px solid var(--border, #d0d7de)',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'var(--font-mono, monospace)',
  },
} as const;
