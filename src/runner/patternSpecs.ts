/**
 * Pattern blueprint specs — generate flowchart specs without API keys.
 *
 * Each pattern produces a different flowchart topology. The spec is
 * the static structure (stages, connections, subflows) that can be
 * rendered as a flowchart preview before any execution.
 */

import { Agent, LLMCall, RAG, Swarm, mock, mockRetriever, defineTool } from 'agentfootprint';
import type { PatternType } from '../components/live/types';

// Dummy provider — never called, just needed to build the chart structure
const dummyProvider = mock([{ content: '' }]);

const dummyTool = defineTool({
  id: 'tool',
  description: 'placeholder',
  inputSchema: { type: 'object' },
  handler: async () => ({ content: '' }),
});

const dummyRetriever = mockRetriever([{ chunks: [{ content: '' }] }]);

// Cache specs by pattern — build once
const specCache = new Map<string, unknown>();

/**
 * Get the flowchart spec for a pattern — shows the topology without execution.
 * Cached: each pattern is built once.
 */
export function getPatternSpec(pattern: PatternType, presetId?: string): unknown {
  const key = presetId ?? pattern;
  if (specCache.has(key)) return specCache.get(key)!;

  let spec: unknown;
  try {
    switch (pattern) {
      case 'llm-call': {
        const runner = LLMCall.create({ provider: dummyProvider })
          .system('...')
          .build();
        spec = runner.getSpec();
        break;
      }
      case 'agent': {
        const runner = Agent.create({ provider: dummyProvider, name: 'agent' })
          .system('...')
          .tool(dummyTool)
          .build();
        spec = runner.getSpec();
        break;
      }
      case 'rag': {
        const runner = RAG.create({ provider: dummyProvider, retriever: dummyRetriever })
          .system('...')
          .build();
        spec = runner.getSpec();
        break;
      }
      case 'swarm': {
        // Swarm.getSpec() requires run() first — run with mock to capture spec.
        const specialist = Agent.create({ provider: dummyProvider, name: 'specialist' })
          .system('Specialist')
          .build();
        const swarmRunner = Swarm.create({ provider: dummyProvider, name: 'swarm' })
          .system('Route to specialist')
          .specialist('coding', 'Code specialist', specialist)
          .specialist('writing', 'Writing specialist', specialist)
          .maxIterations(1)
          .build();
        // Fire-and-forget run to populate spec, ignore result/errors
        swarmRunner.run('test').catch(() => {});
        // Spec is available after run() starts (synchronous chart build)
        spec = swarmRunner.getSpec();
        break;
      }
    }
  } catch (err) {
    console.error(`[patternSpecs] Failed to build spec for "${pattern}":`, err);
    spec = null;
  }

  if (spec) specCache.set(key, spec);
  return spec ?? null;
}
