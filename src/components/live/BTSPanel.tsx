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
  collapsed: boolean;
  onToggleCollapse: () => void;
  style?: React.CSSProperties;
}

export function BTSPanel({ execution, collapsed, onToggleCollapse, style }: BTSPanelProps) {
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
          {!execution || snapshots.length === 0 ? (
            <div className="live-bts-empty">
              <div className="live-bts-empty-icon">{'\uD83D\uDD2D'}</div>
              <div className="live-bts-empty-text">
                {execution ? 'No execution data for this turn' : 'Click a "Behind the Scenes" badge on a message to inspect it'}
              </div>
            </div>
          ) : (
            <ExplainableShell
              snapshots={snapshots}
              spec={spec as any}
              narrative={narrative}
              narrativeEntries={execution.narrativeEntries as any[] ?? undefined}
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
          )}
        </div>
      )}
    </div>
  );
}
