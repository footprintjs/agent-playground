import React from 'react';
import { TraceFlow, type TraceGraph } from 'footprint-explainable-ui/flowchart';
import { mainChartBoxLayoutFor, MAIN_CHART_NODE_TYPES, type OuterKind } from './lensLayout';

// ── The reusable chart component ───────────────────────────────────────────

export interface LensChartProps {
  /** Neutral TraceGraph (from a StructureRecorder). */
  readonly graph: TraceGraph;
  /** Names the main-chart box ("Agent" / "LLM call"). */
  readonly outerKind: OuterKind;
  /** Inner subflow ids to box inside the main box (box-in-box). */
  readonly groupSubflowIds?: readonly string[];
  readonly onNodeClick?: (indexOrId: number | string) => void;
}

/** Render a merge-tree TraceGraph with the clean centered-column strategy. */
export function LensChart({ graph, outerKind, groupSubflowIds, onNodeClick }: LensChartProps) {
  return (
    <TraceFlow
      graph={graph}
      layout={mainChartBoxLayoutFor(outerKind, groupSubflowIds)}
      nodeTypes={MAIN_CHART_NODE_TYPES}
      onNodeClick={onNodeClick}
    />
  );
}
