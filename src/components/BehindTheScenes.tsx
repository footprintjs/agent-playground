/**
 * BehindTheScenes — Full explainable UI for agent execution.
 *
 * Delegates entirely to ExplainableShell from footprint-explainable-ui,
 * which handles time-travel, narrative sync, memory, Gantt, scope diff.
 * We just convert the captured execution data → snapshots + narrative.
 */
import React, { useMemo } from 'react';
import {
  ExplainableShell,
  toVisualizationSnapshots,
} from 'footprint-explainable-ui';
import { TracedFlowchartView } from 'footprint-explainable-ui/flowchart';
import type { StageSnapshot, RecorderView } from 'footprint-explainable-ui';
import type { CapturedExecution } from '../runner/executeCode';
import { createTokensView, createToolsView } from './live/recorderViews';

interface BehindTheScenesProps {
  execution: CapturedExecution;
  onClose: () => void;
}

export function BehindTheScenes({ execution, onClose }: BehindTheScenesProps) {
  // Convert runtime snapshot → visualization snapshots
  const snapshots = useMemo<StageSnapshot[]>(() => {
    if (!execution.snapshot) return [];
    try {
      return toVisualizationSnapshots(
        execution.snapshot as any,
        (execution.narrativeEntries as any[]) ?? undefined,
      );
    } catch {
      // Fallback: build from narrative strings
      if (execution.narrative && execution.narrative.length > 0) {
        return execution.narrative.map((text, i) => ({
          stageName: `stage-${i}`,
          stageLabel: `Stage ${i + 1}`,
          memory: {},
          narrative: text,
          startMs: i * 100,
          durationMs: 100,
          status: 'done' as const,
        }));
      }
      return [];
    }
  }, [execution]);

  // Build flat narrative lines from snapshots (each has per-stage narrative)
  const narrative = useMemo(() => {
    const lines: string[] = [];
    for (const snap of snapshots) {
      const stageLines = (snap.narrative ?? '').split('\n').filter(Boolean);
      lines.push(...stageLines);
    }
    return lines;
  }, [snapshots]);

  const spec = execution.spec ?? null;

  // Build recorder views from captured agentObservability data
  const recorderViews = useMemo<RecorderView[]>(() => {
    const views: RecorderView[] = [];
    const rec = execution.recorders;
    if (!rec) return views;
    if (rec.tokens && rec.tokens.totalCalls > 0) {
      views.push(createTokensView(rec.tokens, rec.cost ?? undefined));
    }
    if (rec.tools && rec.tools.totalCalls > 0) {
      views.push(createToolsView(rec.tools));
    }
    return views;
  }, [execution]);

  if (snapshots.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Header onClose={onClose} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No execution data captured</div>
            <div style={{ fontSize: '13px' }}>
              Run a sample that uses LLMCall, Agent, RAG, FlowChart, or Swarm to see the behind-the-scenes view.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header onClose={onClose} />
      <ExplainableShell
        snapshots={snapshots}
        spec={spec as any}
        narrative={narrative}
        narrativeEntries={execution.narrativeEntries as any[] ?? undefined}
        tabs={['explainable']}
        defaultTab="narrative"
        size="compact"
        recorderViews={recorderViews}
        panelLabels={{ topology: "What Ran", details: "What Happened", timeline: "How Long" }}
        renderFlowchart={
          spec
            ? ({ spec: levelSpec, snapshots: snaps, selectedIndex, onNodeClick }) => (
                <TracedFlowchartView
                  spec={levelSpec}
                  snapshots={snaps}
                  snapshotIndex={selectedIndex}
                  onNodeClick={onNodeClick}
                />
              )
            : undefined
        }
        style={{ flex: 1 }}
      />
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        padding: '4px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onClose}
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          color: 'var(--text-secondary)',
          padding: '3px 10px',
          fontSize: '11px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        ← Back
      </button>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Behind the Scenes</span>
      <span
        style={{
          fontSize: '9px',
          padding: '1px 6px',
          borderRadius: '4px',
          background: 'var(--accent)',
          color: 'white',
          fontWeight: 600,
        }}
      >
        footprintjs
      </span>
    </div>
  );
}
