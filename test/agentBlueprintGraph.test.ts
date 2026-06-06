/**
 * Contract for `buildAgentMergeTreeGraph` — the SHARED agent-blueprint graph
 * used by the collapser demo, the live Pattern Blueprint, and the Samples
 * Flowchart tab. It captures the real agentfootprint `buildAgentMessageApiChart`
 * structure as a neutral TraceGraph and dresses it for the merge-tree render.
 *
 * These pin the structural contract so the three consumers can't silently drift:
 *   1. the ReAct spine + all three slots are present
 *   2. the Tools slot ALWAYS exists with its tools→call-llm bypass edge (it's
 *      the unconditional tool-schema engineering point in the message-API chart)
 *   3. slot subflows are retyped to `slotPill`
 *   4. the ReAct loop edge (tool-calls → context) is present
 *   5. the redundant Context→slot edge labels are stripped
 */
import { describe, expect, it } from 'vitest';
import { buildAgentMergeTreeGraph } from '../src/charts/lensRender';

const ids = (g: { nodes: { id: string }[] }) => g.nodes.map((n) => n.id);
const hasEdge = (g: { edges: { source: string; target: string }[] }, s: string, t: string) =>
  g.edges.some((e) => e.source === s && e.target === t);

describe('buildAgentMergeTreeGraph', () => {
  it('builds the ReAct spine + slots (with tools by default)', () => {
    const g = buildAgentMergeTreeGraph();
    for (const id of ['context', 'sf-system-prompt', 'sf-messages', 'sf-tools', 'message-api', 'call-llm', 'sf-route', 'tool-calls', 'final']) {
      expect(ids(g)).toContain(id);
    }
  });

  it('the Tools slot + its tools→call-llm bypass are ALWAYS present (unconditional in the chart)', () => {
    const g = buildAgentMergeTreeGraph();
    expect(ids(g)).toContain('sf-tools');
    // tools is a SEPARATE wire field — it bypasses messageAPI and merges at call-llm
    expect(hasEdge(g, 'sf-tools', 'call-llm')).toBe(true);
    expect(hasEdge(g, 'sf-tools', 'message-api')).toBe(false);
    // the two assembled-message slots merge at messageAPI
    expect(hasEdge(g, 'sf-system-prompt', 'message-api')).toBe(true);
    expect(hasEdge(g, 'sf-messages', 'message-api')).toBe(true);
  });

  it('retypes slot subflows to slotPill (slim pills)', () => {
    const g = buildAgentMergeTreeGraph();
    for (const id of ['sf-system-prompt', 'sf-messages', 'sf-tools']) {
      const n = g.nodes.find((x) => x.id === id)!;
      expect((n as { type?: string }).type).toBe('slotPill');
    }
    // a non-slot stage keeps its default stage rendering (not a pill)
    const callLlm = g.nodes.find((x) => x.id === 'call-llm')!;
    expect((callLlm as { type?: string }).type).not.toBe('slotPill');
  });

  it('keeps the ReAct loop edge (tool-calls → context)', () => {
    const g = buildAgentMergeTreeGraph();
    expect(g.edges.some((e) => e.source === 'tool-calls' && e.target === 'context' && (e as { data?: { kind?: string } }).data?.kind === 'loop')).toBe(true);
  });

  it('strips the redundant Context→slot edge labels (pills already name them)', () => {
    const g = buildAgentMergeTreeGraph();
    const contextEdges = g.edges.filter((e) => e.source === 'context');
    expect(contextEdges.length).toBeGreaterThan(0);
    for (const e of contextEdges) {
      expect((e as { label?: unknown }).label).toBeUndefined();
      expect((e as { data?: { label?: unknown } }).data?.label).toBeUndefined();
    }
  });
});
