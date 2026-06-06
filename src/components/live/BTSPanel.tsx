import React, { useMemo } from 'react';
import {
  ExplainableShell,
  toVisualizationSnapshots,
} from 'footprint-explainable-ui';
// TracedFlowchartView removed in explainable-ui v0.20 — new API is
// recorder-based. The render callbacks below pass through undefined
// so ExplainableShell falls back to its default flowchart rendering.
import type { StageSnapshot, RecorderView } from 'footprint-explainable-ui';
import type { TraceGraph } from 'footprint-explainable-ui/flowchart';
import type { CapturedExecution } from '../../runner/executeCode';
import { createRecorderViews } from './recorderViews';
import { LensChart } from '../../charts/lensRender';

interface BTSPanelProps {
  execution: CapturedExecution | null;
  /** Pattern blueprint graph — the "what will run" chart, shown when no
   *  execution is selected. Built from the real chart STRUCTURE (no run). */
  previewGraph?: TraceGraph | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  style?: React.CSSProperties;
}

export function BTSPanel({ execution, previewGraph, collapsed, onToggleCollapse, style }: BTSPanelProps) {
  const snapshots = useMemo<StageSnapshot[]>(() => {
    if (!execution?.snapshot) return [];
    try {
      return toVisualizationSnapshots(
        execution.snapshot as any,
        (execution.narrativeEntries as any[]) ?? undefined,
      );
    } catch {
      return [];
    }
  }, [execution]);

  const spec = execution?.spec ?? null;

  // Progressive recorder tabs — update with time-travel slider via stageLabel
  const recorderViews = useMemo<RecorderView[]>(
    () => createRecorderViews(execution?.recorders ?? undefined),
    [execution],
  );

  const hasExecution = execution && snapshots.length > 0;
  const hasPreview = !hasExecution && !!previewGraph;

  return (
    <div className={`live-bts ${collapsed ? 'live-bts--collapsed' : ''}`} style={style}>
      <div className="live-bts-header" onClick={onToggleCollapse}>
        <button className="live-collapse-btn" aria-label={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '\u25C0' : '\u25B6'}
        </button>
        <span className="live-bts-title">Behind the Scenes</span>
        <span className="live-bts-badge-label">footprintjs</span>
      </div>

      {!collapsed && (
        <div className="live-bts-body">
          {hasExecution ? (
            <>
              <ExplainableShell
                snapshots={snapshots}
                spec={spec as any}
                narrativeEntries={execution!.narrativeEntries as any[] ?? undefined}
                tabs={['explainable']}
                defaultTab="narrative"
                hideTabs={['result']}
                size="compact"
                recorderViews={recorderViews}
                panelLabels={{ topology: "What Ran", details: "What Happened", timeline: "How Long" }}
                /* renderFlowchart prop stubbed pending v0.20 migration —
                   ExplainableShell falls back to default rendering when omitted. */
                style={{ flex: 1 }}
              />
              <div className="live-bts-hint">
                This trace was collected automatically during execution — no extra code.
              </div>
            </>
          ) : hasPreview ? (
            <div className="live-bts-preview">
              <div className="live-bts-preview-label">Pattern Blueprint</div>
              <div className="live-bts-preview-hint">
                This is what will run when you send a message.
                Each stage is a step in the flowchart.
              </div>
              <div className="live-bts-preview-chart" style={{ flex: 1, minHeight: 0 }}>
                {/* Static STRUCTURE rendered with the shared clean-centered-column
                    strategy (same chart as the collapser demo's agent merge-tree). */}
                <LensChart graph={previewGraph!} outerKind="Agent" />
              </div>
            </div>
          ) : (
            <div className="live-bts-empty">
              <div className="live-bts-empty-icon">{'\uD83D\uDD2D'}</div>
              <div className="live-bts-empty-text">
                Select an example to see the pattern flowchart, or click &ldquo;Behind the Scenes&rdquo; on a message to inspect it.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
