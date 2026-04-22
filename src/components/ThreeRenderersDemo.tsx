/**
 * ThreeRenderersDemo — concrete proof of "one shape, many renderers."
 *
 * Three panels side-by-side, all reading from the SAME
 * `AgentTimelineRecorder`. The recorder owns every derivation; each
 * panel is a pure renderer over the typed selector surface:
 *
 *   ENGINEER view    → <AgentLens> (StageFlow + MessagesPanel)
 *                      powered by recorder.selectTopology() + selectTurns()
 *   ANALYST view     → <CommentaryPanel>
 *                      powered by recorder.selectContextBySource() + selectCommentary()
 *   END-USER view    → <ThinkKitPanel>
 *                      powered by recorder.selectActivities() + selectStatus()
 *
 * A Vue / Angular / CLI consumer would render the same three audiences
 * over the same three selectors — the library shape is framework-agnostic.
 */
import React from 'react';
import type { AgentTimelineRecorder } from 'agentfootprint';
import {
  AgentLens,
  CommentaryPanel,
  ThinkKitPanel,
  timelineFromRecorder,
} from 'agentfootprint-lens';

export interface ThreeRenderersDemoProps {
  readonly recorder: AgentTimelineRecorder;
  /** Bumped by the parent on every event so this component re-renders
   *  and re-reads the selectors. Pairs with useLiveTimeline.sync(). */
  readonly version: number;
}

export function ThreeRenderersDemo({ recorder, version }: ThreeRenderersDemoProps) {
  // Bundle selectors into the Lens's render shape for AgentLens.
  const timeline = timelineFromRecorder(recorder);
  // Run summary powers the footer totals line.
  const runSummary = recorder.selectRunSummary();

  return (
    <div style={styles.root}>
      <div style={styles.banner}>
        <strong>One shape, many renderers.</strong> All three panels below read
        from the same <code>AgentTimelineRecorder</code>. No per-view derivation
        logic — every shape comes from a typed selector. Vue / Angular / CLI
        consumers render the same audiences over the same selectors.
      </div>

      <div style={styles.grid}>
        {/* ── Engineer view: Flowchart ── */}
        <section style={styles.panel}>
          <header style={styles.panelHeader}>
            <span style={styles.panelAudience}>ENGINEER</span>
            <h3 style={styles.panelTitle}>Flowchart</h3>
            <code style={styles.selector}>selectTopology() + selectTurns()</code>
          </header>
          <div style={styles.panelBody}>
            <AgentLens timeline={timeline} agentName={timeline.agent.name} />
          </div>
        </section>

        {/* ── Analyst view: Commentary + context ledger ── */}
        <section style={styles.panel}>
          <header style={styles.panelHeader}>
            <span style={styles.panelAudience}>ANALYST</span>
            <h3 style={styles.panelTitle}>Commentary</h3>
            <code style={styles.selector}>selectContextBySource() + selectCommentary()</code>
          </header>
          <div style={styles.panelBody}>
            <CommentaryPanel recorder={recorder} version={version} />
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
            <ThinkKitPanel recorder={recorder} version={version} />
          </div>
        </section>
      </div>

      <div style={styles.summary}>
        <strong>selectRunSummary():</strong>{' '}
        {runSummary.turnCount} turn{runSummary.turnCount === 1 ? '' : 's'}, {runSummary.iterationCount} iteration{runSummary.iterationCount === 1 ? '' : 's'}, {runSummary.toolCallCount} tool call{runSummary.toolCallCount === 1 ? '' : 's'}, {runSummary.inputTokens + runSummary.outputTokens} tokens, {Math.round(runSummary.totalDurationMs)}ms
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: 16, height: '100%' },
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
    gridTemplateColumns: 'minmax(300px, 1.2fr) minmax(240px, 1fr) minmax(240px, 1fr)',
    gap: 12,
    flex: 1,
    minHeight: 0,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--bg-secondary, white)',
    border: '1px solid var(--border, #d0d7de)',
    borderRadius: 6,
    overflow: 'hidden',
    minHeight: 400,
  },
  panelHeader: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border, #d0d7de)',
    background: 'var(--bg-tertiary, #f6f8fa)',
    flex: '0 0 auto',
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
    fontSize: 10,
    color: 'var(--text-muted, #666)',
    background: 'var(--bg-primary, white)',
    padding: '2px 6px',
    borderRadius: 3,
    display: 'inline-block',
  },
  panelBody: { flex: 1, overflow: 'auto', minHeight: 0 },
  summary: {
    padding: '8px 12px',
    background: 'var(--bg-tertiary, #f6f8fa)',
    border: '1px solid var(--border, #d0d7de)',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'var(--font-mono, monospace)',
    flex: '0 0 auto',
  },
} as const;
