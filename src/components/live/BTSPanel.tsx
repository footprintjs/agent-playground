import React, { useMemo } from 'react';
import {
  ExplainableShell,
  toVisualizationSnapshots,
} from 'footprint-explainable-ui';
import { TracedFlowchartView } from 'footprint-explainable-ui/flowchart';
import type { StageSnapshot } from 'footprint-explainable-ui';
import type { CapturedExecution } from '../../runner/executeCode';

interface BTSPanelProps {
  execution: CapturedExecution | null;
  /** Pattern blueprint spec — shown when no execution is selected. */
  previewSpec?: unknown;
  collapsed: boolean;
  onToggleCollapse: () => void;
  style?: React.CSSProperties;
}

export function BTSPanel({ execution, previewSpec, collapsed, onToggleCollapse, style }: BTSPanelProps) {
  const snapshots = useMemo<StageSnapshot[]>(() => {
    if (!execution?.snapshot) return [];
    try {
      return toVisualizationSnapshots(
        execution.snapshot as any,
        (execution.narrativeEntries as any[]) ?? undefined,
      );
    } catch {
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

  const narrative = useMemo(() => {
    const lines: string[] = [];
    for (const snap of snapshots) {
      const stageLines = (snap.narrative ?? '').split('\n').filter(Boolean);
      lines.push(...stageLines);
    }
    return lines;
  }, [snapshots]);

  const spec = execution?.spec ?? null;

  // Extract metrics from snapshot recorders
  const metrics = useMemo(() => {
    if (!execution?.snapshot) return null;
    const snap = execution.snapshot as any;
    const recorders = snap?.recorders ?? snap?.recorderSnapshots;
    if (!recorders) return null;

    // Find MetricRecorder data
    const metricSnap = Array.isArray(recorders)
      ? recorders.find((r: any) => r.name === 'Metrics')
      : recorders['metrics'] ?? recorders['Metrics'];

    if (!metricSnap?.data) return null;
    return metricSnap.data as {
      totalDuration?: number;
      totalReads?: number;
      totalWrites?: number;
      stages?: Record<string, { totalDuration?: number; readCount?: number; writeCount?: number }>;
    };
  }, [execution]);

  // Determine what to show: execution, preview, or empty
  const hasExecution = execution && snapshots.length > 0;
  const hasPreview = !hasExecution && previewSpec;

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
          {hasExecution && metrics && (
            <div className="live-bts-metrics">
              <div className="live-bts-metrics-title">Execution Metrics</div>
              <div className="live-bts-metrics-grid">
                <div className="live-bts-metric">
                  <span className="live-bts-metric-value">{metrics.totalDuration ? `${metrics.totalDuration}ms` : '—'}</span>
                  <span className="live-bts-metric-label">Duration</span>
                </div>
                <div className="live-bts-metric">
                  <span className="live-bts-metric-value">{metrics.totalReads ?? '—'}</span>
                  <span className="live-bts-metric-label">Reads</span>
                </div>
                <div className="live-bts-metric">
                  <span className="live-bts-metric-value">{metrics.totalWrites ?? '—'}</span>
                  <span className="live-bts-metric-label">Writes</span>
                </div>
                <div className="live-bts-metric">
                  <span className="live-bts-metric-value">{metrics.stages ? Object.keys(metrics.stages).length : '—'}</span>
                  <span className="live-bts-metric-label">Stages</span>
                </div>
              </div>
            </div>
          )}

          {hasExecution ? (
            /* Execution mode: full BTS with narrative, timing, flowchart trace */
            <ExplainableShell
              snapshots={snapshots}
              spec={spec as any}
              narrative={narrative}
              narrativeEntries={execution!.narrativeEntries as any[] ?? undefined}
              tabs={['explainable']}
              defaultTab="narrative"
              size="compact"
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
            <div className="live-bts-hint">
              This trace was collected automatically during execution — no extra code.
              Try "Conditional Instructions" to see how tool results change the system prompt.
            </div>
          ) : hasPreview ? (
            /* Preview mode: pattern blueprint — flowchart only, no execution data */
            <div className="live-bts-preview">
              <div className="live-bts-preview-label">Pattern Blueprint</div>
              <div className="live-bts-preview-hint">
                This is what will run when you send a message.
                Each stage is a step in the flowchart.
              </div>
              <div className="live-bts-preview-chart">
                <TracedFlowchartView
                  spec={previewSpec as any}
                  snapshots={[]}
                  snapshotIndex={-1}
                />
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="live-bts-empty">
              <div className="live-bts-empty-icon">{'\uD83D\uDD2D'}</div>
              <div className="live-bts-empty-text">
                Select an example to see the pattern flowchart, or click "Behind the Scenes" on a message to inspect it.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
