import { createTraceStructureRecorder, filterGraphForDrill, type TraceGraph } from 'footprint-explainable-ui/flowchart';
import { buildAgentMessageApiChart } from 'agentfootprint';
import { MockProvider } from 'agentfootprint/providers';

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
