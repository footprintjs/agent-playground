/**
 * Live Chat Presets — pre-configured examples grouped by pattern.
 *
 * Each preset includes a config (pattern, prompt, tools, memory)
 * and a suggested first message so the user just clicks Send.
 */
import type { LiveConfig, PatternType } from './types';

export interface Preset {
  /** Unique identifier. */
  readonly id: string;
  /** Display name. */
  readonly label: string;
  /** Short description shown on hover/subtitle. */
  readonly description: string;
  /** Which pattern category this belongs to. */
  readonly pattern: PatternType;
  /** Pre-filled config applied when selected. */
  readonly config: LiveConfig;
  /** Suggested first message — pre-filled in the input box. */
  readonly suggestedMessage: string;
  /** Sample code showing how to build this with agentfootprint. */
  readonly code: string;
}

export const PRESETS: Preset[] = [
  // ── LLM Call ──────────────────────────────────────────────
  {
    id: 'chat-assistant',
    label: 'Chat Assistant',
    description: 'Simple multi-turn chat with memory',
    pattern: 'llm-call',
    config: {
      pattern: 'llm-call',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a helpful, concise assistant. Answer in 2-3 sentences unless the user asks for detail.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: false,
    },
    suggestedMessage: 'What are the main differences between REST and GraphQL?',
    code: `import { LLMCall, anthropic } from 'agentfootprint';

const runner = LLMCall
  .create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a helpful, concise assistant.')
  .build();

const result = await runner.run('What are the differences between REST and GraphQL?');
console.log(result.content);`,
  },
  {
    id: 'code-reviewer',
    label: 'Code Reviewer',
    description: 'Reviews code and suggests improvements',
    pattern: 'llm-call',
    config: {
      pattern: 'llm-call',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a senior code reviewer. When given code, analyze it for: bugs, security issues, performance problems, and readability. Be specific and actionable.',
      memoryStrategy: 'sliding-window',
      memoryParam: 20,
      enableTools: false,
    },
    suggestedMessage: 'Review this function:\n\nfunction getUser(id) {\n  const user = db.query("SELECT * FROM users WHERE id = " + id);\n  return user;\n}',
    code: `import { LLMCall, anthropic } from 'agentfootprint';

const reviewer = LLMCall
  .create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a senior code reviewer.')
  .build();

const result = await reviewer.run('Review this function: ...');`,
  },

  // ── Agent (Regular ReAct) ─────────────────────────────────
  {
    id: 'math-agent',
    label: 'Math Agent',
    description: 'Agent with calculator tool — see tool calls in BTS',
    pattern: 'agent',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a helpful math assistant. Use the calculator tool for any arithmetic. Show your work.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: true,
    },
    suggestedMessage: 'What is 17 * 23 + 456 / 12?',
    code: `import { Agent, defineTool, anthropic } from 'agentfootprint';

const calculator = defineTool({
  id: 'calculator',
  description: 'Evaluate a math expression',
  inputSchema: { type: 'object', properties: { expression: { type: 'string' } } },
  handler: async ({ expression }) => ({ content: String(compute(expression)) }),
});

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a math assistant. Use the calculator tool.')
  .tool(calculator)
  .build();

const result = await agent.run('What is 17 * 23 + 456 / 12?');`,
  },
  {
    id: 'research-agent',
    label: 'Research Agent',
    description: 'Multi-turn agent with multiple tools and memory',
    pattern: 'agent',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a research assistant. Use available tools to find information. Ask clarifying questions when needed.',
      memoryStrategy: 'sliding-window',
      memoryParam: 100,
      enableTools: true,
    },
    suggestedMessage: 'What time is it right now, and what is 2^10?',
    code: `import { Agent, anthropic } from 'agentfootprint';

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a research assistant. Use tools to find information.')
  .tool(calculatorTool)
  .tool(datetimeTool)
  .tool(searchTool)
  .build();

const result = await agent.run('What time is it right now, and what is 2^10?');`,
  },

  // ── RAG ───────────────────────────────────────────────────
  {
    id: 'knowledge-base',
    label: 'Knowledge Base Q&A',
    description: 'Retrieve docs then answer — see retrieval in BTS',
    pattern: 'rag',
    config: {
      pattern: 'rag',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'Answer based on the retrieved documents. If the docs don\'t contain the answer, say so.',
      memoryStrategy: 'none',
      memoryParam: 50,
      enableTools: false,
    },
    suggestedMessage: 'What is footprintjs and how does it work?',
    code: `import { RAG, anthropic, mockRetriever } from 'agentfootprint';

const retriever = mockRetriever([{
  chunks: [
    { content: 'footprintjs is a flowchart pattern for backend code...' },
    { content: 'agentfootprint is an explainable agent framework...' },
  ],
}]);

const runner = RAG.create({ provider: anthropic('claude-sonnet-4-20250514'), retriever })
  .system('Answer based on the retrieved documents.')
  .build();

const result = await runner.run('What is footprintjs?');`,
  },

  // ── Swarm ─────────────────────────────────────────────────
  {
    id: 'specialist-swarm',
    label: 'Specialist Swarm',
    description: 'Router dispatches to coding, math, or writing specialist',
    pattern: 'swarm',
    config: {
      pattern: 'swarm',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are an orchestrator. Route the user to the best specialist: coding, math, or writing.',
      memoryStrategy: 'none',
      memoryParam: 50,
      enableTools: false,
    },
    suggestedMessage: 'Write a haiku about programming',
    code: `import { Swarm, Agent, anthropic } from 'agentfootprint';

const writingAgent = Agent.create({ provider })
  .system('You are a creative writing specialist.')
  .build();

const codingAgent = Agent.create({ provider })
  .system('You are a coding specialist.')
  .build();

const swarm = Swarm.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('Route to the best specialist.')
  .specialist('coding', codingAgent)
  .specialist('writing', writingAgent)
  .build();

const result = await swarm.run('Write a haiku about programming');`,
  },
];

/** Group presets by pattern for the UI. */
export function getPresetsByPattern(): Map<PatternType, Preset[]> {
  const grouped = new Map<PatternType, Preset[]>();
  for (const preset of PRESETS) {
    if (!grouped.has(preset.pattern)) grouped.set(preset.pattern, []);
    grouped.get(preset.pattern)!.push(preset);
  }
  return grouped;
}

/** Find a preset by ID. */
export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
