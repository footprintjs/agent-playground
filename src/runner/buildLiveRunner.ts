/**
 * buildLiveRunner — STUBBED (live-chat port pending).
 *
 * The original v1 implementation (1027 LOC) used `agentfootprint/observe`,
 * `agentfootprint/instructions`, `agentfootprint/memory`, plus four runner
 * patterns (LLMCall/Agent/RAG/Swarm) and four browser adapters
 * (BrowserAnthropicAdapter, BrowserOpenAIAdapter, etc.) — none of which
 * exist in agentfootprint v2.
 *
 * Original at /tmp/buildLiveRunner.v1.ts.
 *
 * Re-implementation TODO:
 *   - Build minimal Anthropic + OpenAI adapters that conform to v2's
 *     LLMProvider interface (in this repo, not in agentfootprint).
 *   - Wire the `llm-call` and `agent` patterns to LLMCall.create() and
 *     Agent.create() respectively.
 *   - Defer rag/swarm/memory-strategies/parallelTools/instructions until
 *     v2 surfaces equivalents.
 *
 * This stub keeps the type contract intact so `LiveChatPage.tsx`
 * type-checks; runtime calls throw with a clear "not yet ported" message.
 */

import type { CapturedExecution } from './executeCode';

export interface LiveRunner {
  run(message: string, opts?: { onToken?: (t: string) => void }): Promise<LiveTurnResult>;
  resume?(message: string): Promise<LiveTurnResult>;
  reset(): void;
  getSpec(): unknown;
  getCapture(): CapturedExecution | undefined;
}

export interface LiveTurnResult {
  readonly content: string;
  readonly paused?: boolean;
  readonly pauseQuestion?: string;
  readonly execution?: CapturedExecution;
  readonly durationMs?: number;
  readonly maxIterationsReached?: boolean;
}

export interface BuildLiveRunnerKeys {
  readonly anthropic?: string;
  readonly openai?: string;
}

export function buildLiveRunner(
  _config: unknown,
  _keys?: BuildLiveRunnerKeys,
): LiveRunner {
  const notSupported = (): never => {
    throw new Error(
      'Live chat is being ported to agentfootprint v2 — try Samples for now.',
    );
  };
  return {
    run: notSupported,
    resume: notSupported,
    reset: () => {},
    getSpec: () => undefined,
    getCapture: () => undefined,
  };
}
