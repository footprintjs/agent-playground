import React, { useMemo } from 'react';
import {
  ExplainableShell,
  toVisualizationSnapshots,
} from 'footprint-explainable-ui';
import { TracedFlowchartView } from 'footprint-explainable-ui/flowchart';
import type { StageSnapshot, RecorderView } from 'footprint-explainable-ui';
import type { CapturedExecution } from '../../runner/executeCode';
import { createTokensView, createToolsView } from './recorderViews';

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

  // Use the captured agent narrative directly (from createAgentRenderer)
  const narrative = useMemo(() => {
    if (execution?.narrative && execution.narrative.length > 0) {
      return execution.narrative;
    }
    const lines: string[] = [];
    for (const snap of snapshots) {
      const stageLines = (snap.narrative ?? '').split('\n').filter(Boolean);
      lines.push(...stageLines);
    }
    return lines;
  }, [execution, snapshots]);

  const spec = execution?.spec ?? null;

  // Build recorder views from agentObservability data — consumer-driven tabs
  const recorderViews = useMemo<RecorderView[]>(() => {
    const views: RecorderView[] = [];
    const rec = execution?.recorders;
    if (!rec) return views;

    if (rec.tokens && rec.tokens.totalCalls > 0) {
      views.push(createTokensView(rec.tokens, rec.cost ?? undefined));
    }
    if (rec.tools && rec.tools.totalCalls > 0) {
      views.push(createToolsView(rec.tools));
    }
    return views;
  }, [execution]);

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
          {hasExecution ? (
            <>
              <ExplainableShell
                snapshots={snapshots}
                spec={spec as any}
                narrative={narrative}
                narrativeEntries={execution!.narrativeEntries as any[] ?? undefined}
                tabs={['explainable']}
                defaultTab="narrative"
                size="compact"
                hideTabs={['result']}
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
              <div className="live-bts-preview-chart">
                <TracedFlowchartView
                  spec={previewSpec as any}
                  snapshots={[]}
                  snapshotIndex={-1}
                />
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
