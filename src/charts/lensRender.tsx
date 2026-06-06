/**
 * lensRender — the SHARED "clean centered column" render strategy for agent /
 * LLM-call merge-tree charts, extracted so the collapser demo, the live Pattern
 * Blueprint preview, and (later) the live runtime panel all render through ONE
 * source instead of duplicating the layout config.
 *
 * The strategy (all visual, lives in the renderer layer):
 *   - `createTraceGroupLayout({ mergeAlign: 'fork-origin' })` → straight trunk
 *     (each join aligns with the fork it re-converges; see explainable-ui).
 *   - `createMainChartBoxLayout` → wrap the whole chart in one labelled box.
 *   - StageNode centering + SmartStepEdge (built into TraceFlow) → cards centred
 *     in their boxes, rank-skipping edges (tools→call-llm) route around skips.
 *   - slot subflows retyped to `slotPill` (SlotPillNode) for the slim-pill look.
 *
 * STRUCTURE still comes from agentfootprint (`buildAgentMessageApiChart`, built
 * on footprintjs primitives) → StructureRecorder → neutral TraceGraph. This
 * module only decides how that graph is PAINTED.
 */

import React from 'react';
import {
  TraceFlow,
  createTraceStructureRecorder,
  createMainChartBoxLayout,
  createTraceGroupLayout,
  snapLinearSuccessors,
  applyGroupLayout,
  filterGraphForDrill,
  type TraceFlowLayout,
  GroupContainerNode,
  SlotPillNode,
  type TraceGraph,
  type TraceNode,
} from 'footprint-explainable-ui/flowchart';
import { buildAgentMessageApiChart, MockProvider } from 'agentfootprint';

/** The composition kind that labels a main-chart box. Local to the playground
 *  now that the lens-card collapser (which once owned this union) was removed —
 *  the lens has a single `structureGraphFromRunner` path and no longer needs it. */
type OuterKind = 'Agent' | 'LLMCall' | 'Sequence' | 'Parallel' | 'Loop' | 'Conditional';

// ── Node sizing (programmatic, measured — never hardcoded) ─────────────────
// Font mirrors SlotPillNode (12px / 600) under the page's ui-sans-serif stack.
const SLOT_FONT = '600 12px ui-sans-serif, system-ui, sans-serif';
const SLOT_CHROME_PX = 44; // 12 left pad + 8 dot + 8 gap + 12 right pad + 4 slack
const SLOT_MIN_W = 110;
let _slotMeasureCtx: CanvasRenderingContext2D | null | undefined;
function slotLabelWidth(label: string): number {
  if (_slotMeasureCtx === undefined) {
    _slotMeasureCtx =
      typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (_slotMeasureCtx) _slotMeasureCtx.font = SLOT_FONT;
  }
  if (!_slotMeasureCtx) return label.length * 7; // SSR/test fallback (~7px/char @12px)
  return _slotMeasureCtx.measureText(label).width;
}
/** A slot pill's natural width = measured label + chrome, with a min floor. */
export function slotWidth(label: string): number {
  return Math.max(SLOT_MIN_W, Math.ceil(slotLabelWidth(label)) + SLOT_CHROME_PX);
}

// CLEAN CENTERED COLUMN: every box is its OWN natural width; the group layout
// centers it under its inputs. Merges are shown by the converging arrows, not by
// widening boxes. Sizing EVERY node matters — the layout stamps the footprint it
// laid out, so an unsized node would render at its intrinsic width while
// positioned for the fallback and its center would drift.
// Size hierarchy — the renderer's resolver IS the source of truth for layout
// footprint (it gets stamped onto node.style, keeping center==paint). Drive it
// off `data.size` ('lg' = the LLM star, 'sm' = plumbing, default md). Scaling
// here (not in card CSS) is what keeps centering correct.
const SIZE_SCALE = { sm: 0.82, md: 1, lg: 1.4 } as const;
const lensNodeSize = (node: TraceNode) => {
  const label = (node.data?.label as string | undefined) ?? node.id;
  const hint = (node.data?.size as 'sm' | 'md' | 'lg' | undefined) ?? 'md';
  const k = SIZE_SCALE[hint];
  if (node.data?.isSubflow) {
    return { width: Math.round(slotWidth(label) * k), height: Math.round(38 * k) };
  }
  return {
    width: Math.round(Math.max(160, Math.ceil(slotLabelWidth(label)) + 40) * k),
    height: Math.round(64 * k),
  };
};

// The looping branch (ToolCalls) draws on the RIGHT — the side the loop-back
// curve arcs up. Pure visual ordering; the chart spec is untouched.
const toolCallsOnRight = (sourceId: string, kids: readonly string[]) =>
  sourceId === 'sf-route'
    ? [...kids].sort((a, b) => Number(a === 'tool-calls') - Number(b === 'tool-calls'))
    : kids;

const lensDagreOpts = {
  rankSep: 56,
  nodeSep: 48, // wider gap between same-rank siblings (the 3 slots breathe apart)
  nodeSize: lensNodeSize,
  siblingOrder: toolCallsOnRight,
  // STRAIGHT TRUNK: align each join with the fork it re-converges (its inputs'
  // lowest common ancestor) so context → messageAPI → call-llm → route render as
  // ONE centered column, slots/tools splaying symmetrically around it.
  mergeAlign: 'fork-origin' as const,
};
/** The merge-tree group layout WITHOUT the main-chart box wrapper. Use for the
 *  Lens runtime monitor (Lens supplies its own frame, and the box container can
 *  interfere with TracedFlow's drill-scope / overlay aggregation). The static
 *  Flowchart-tab blueprint uses the boxed `mainChartBoxLayoutFor` instead. */
// STRAIGHT TRUNK: mergeAlign aligns merges to the fork axis, but linear
// successors (with now-varying node widths from the size hierarchy) can still
// land slightly off their predecessor's center-x → SmartStepEdge then draws a
// small Z-jog. `snapLinearSuccessors` snaps every single-in/single-out node onto
// its predecessor's center-x (root / merges / fork-children provably untouched),
// so the spine renders as one straight vertical line. The resolver MUST match
// `lensNodeSize` so reconstructed centers equal what the layout placed.
const _baseMergeTree = createTraceGroupLayout(lensDagreOpts);
export const mergeTreeLayout: TraceFlowLayout = (graph) =>
  snapLinearSuccessors(_baseMergeTree(graph), { nodeSize: lensNodeSize });
const lensNodeSizeLayout = mergeTreeLayout;

/** The full grouped layout for a scene: group-based straight-trunk layout wrapped
 *  in one labelled main-chart box. `nestedGroupIds` boxes inner subflows too. */
export function mainChartBoxLayoutFor(kind: OuterKind, nestedGroupIds?: readonly string[]): TraceFlowLayout {
  const base: TraceFlowLayout =
    nestedGroupIds && nestedGroupIds.length > 0
      ? (graph) =>
          applyGroupLayout(graph, { groupedSubflowIds: [...nestedGroupIds], baseLayout: lensNodeSizeLayout })
      : lensNodeSizeLayout;
  return createMainChartBoxLayout({
    baseLayout: base,
    label: kind === 'Agent' ? 'Agent' : 'LLM call',
    kind,
    padding: 40, // breathing room so the widest node never touches the box border
  });
}

export const MAIN_CHART_NODE_TYPES = {
  groupContainer: GroupContainerNode,
  slotPill: SlotPillNode,
};

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

// ── Agent blueprint graph (STRUCTURE → TraceGraph) ─────────────────────────

export interface AgentBlueprintOptions {
  readonly systemPrompt?: string;
}

/**
 * Build the agent merge-tree as a neutral TraceGraph: the real agentfootprint
 * `buildAgentMessageApiChart` structure captured via a StructureRecorder, with
 * slot subflows retyped to slim `slotPill` nodes and the redundant Context→slot
 * edge labels dropped (the pills already read "System Prompt"/"Messages"/"Tools").
 * Provider/model are irrelevant to STRUCTURE, so a mock stands in.
 *
 * NOTE: the Tools slot is ALWAYS part of the agent's message-API structure (it's
 * the tool-schema engineering point — `buildAgentMessageApiChart` adds it
 * unconditionally), so the blueprint always shows all three slots. The tool LIST
 * only fills the slot's contents; a representative tool stands in here.
 */
export function buildAgentMergeTreeGraph(opts: AgentBlueprintOptions = {}): TraceGraph {
  const { systemPrompt = 'You answer questions, using tools when needed.' } = opts;
  const trace = createTraceStructureRecorder();
  buildAgentMessageApiChart({
    provider: new MockProvider({ reply: '' }),
    model: 'mock',
    systemPrompt,
    tools: [
      {
        name: 'weather',
        description: 'Get weather for a city',
        inputSchema: { type: 'object' as const, properties: { city: { type: 'string' } } },
      },
    ],
    structureRecorders: [trace.recorder],
  });
  const topLevel = filterGraphForDrill(trace.getGraph(), null);
  return {
    edges: topLevel.edges.map((e) =>
      e.source === 'context'
        ? ({ ...e, label: undefined, data: { ...e.data, label: undefined } } as typeof e)
        : e,
    ),
    nodes: topLevel.nodes.map((n) =>
      n.data?.isSubflow
        ? { ...n, type: 'slotPill', data: { ...n.data, slotKind: n.data.subflowId, selected: true } }
        : n,
    ),
  };
}
