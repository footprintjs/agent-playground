import type { CapturedExecution } from '../../runner/executeCode';

// ── Pattern Types ─────────────────────────────────────────

export type PatternType = 'llm-call' | 'agent' | 'rag' | 'swarm';

export interface PatternOption {
  readonly id: PatternType;
  readonly label: string;
  readonly description: string;
}

export const PATTERNS: PatternOption[] = [
  { id: 'llm-call', label: 'LLM Call', description: 'Single LLM call with multi-turn memory' },
  { id: 'agent', label: 'Agent', description: 'ReAct agent with tools and memory' },
  { id: 'rag', label: 'RAG', description: 'Retrieval-augmented generation (single-shot per turn)' },
  { id: 'swarm', label: 'Swarm', description: 'Multi-agent orchestrator with specialist routing' },
];

// ── Model Types ───────────────────────────────────────────

export type ProviderType = 'anthropic' | 'openai';

export interface ModelOption {
  readonly id: string;
  readonly label: string;
  readonly provider: ProviderType;
}

export const MODELS: ModelOption[] = [
  // Anthropic
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', provider: 'anthropic' },
  { id: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5', provider: 'anthropic' },
  // OpenAI
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai' },
  { id: 'o3-mini', label: 'o3 Mini', provider: 'openai' },
];

// ── Memory Strategy ───────────────────────────────────────

export type MemoryStrategyType = 'sliding-window' | 'char-budget' | 'none';

export interface MemoryStrategyOption {
  readonly id: MemoryStrategyType;
  readonly label: string;
  readonly description: string;
}

export const MEMORY_STRATEGIES: MemoryStrategyOption[] = [
  { id: 'sliding-window', label: 'Sliding Window', description: 'Keep last N messages' },
  { id: 'char-budget', label: 'Char Budget', description: 'Fit within character limit' },
  { id: 'none', label: 'No Memory', description: 'Each turn is independent' },
];

// ── Configuration ─────────────────────────────────────────

export interface LiveConfig {
  pattern: PatternType;
  modelId: string;
  provider: ProviderType;
  systemPrompt: string;
  memoryStrategy: MemoryStrategyType;
  memoryParam: number; // maxMessages for sliding-window, maxChars for char-budget
  enableTools: boolean;
  enableStreaming: boolean;
  /** Run multiple tool calls within a single turn concurrently (Agent pattern only). */
  parallelTools?: boolean;
  /** Active preset ID — determines which mock data/tools to use. */
  presetId?: string;
}

export const DEFAULT_CONFIG: LiveConfig = {
  pattern: 'agent',
  modelId: 'claude-sonnet-4-20250514',
  provider: 'anthropic',
  systemPrompt: 'You are a helpful assistant. Be concise.',
  memoryStrategy: 'sliding-window',
  memoryParam: 50,
  enableTools: true,
  enableStreaming: true,
  parallelTools: false,
};

// ── Chat Messages ─────────────────────────────────────────

export interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'pause';
  readonly content: string;
  readonly timestamp: number;
  /** Captured execution data for BTS — only on assistant messages. */
  readonly execution?: CapturedExecution;
  /** Tool calls made during this turn. */
  readonly toolCalls?: Array<{ name: string; args: string; result: string }>;
  /** Duration in ms for the LLM turn. */
  readonly durationMs?: number;
  /** When true, this is a pause message — waiting for human input. */
  readonly paused?: boolean;
  /** The question the agent is asking. */
  readonly pauseQuestion?: string;
  /**
   * True when the agent ran out of iterations without a clean finish. Rendered
   * with a distinct banner so the user isn't left wondering why the response
   * looks empty or truncated.
   */
  readonly maxIterationsReached?: boolean;
}
