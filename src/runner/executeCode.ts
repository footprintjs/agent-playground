/**
 * Sandbox code executor — runs sample code in a Function() sandbox.
 *
 * Strips imports, provides agentfootprint modules via scope injection,
 * transpiles TypeScript with Sucrase, wraps in async IIFE.
 *
 * Monkey-patches runner classes to capture execution data
 * (snapshot, narrativeEntries, spec) for the explainable UI.
 */
import { transform } from 'sucrase';
import * as agentfootprint from 'agentfootprint';

export interface ExecuteResult {
  output: unknown;
  logs: string[];
  error?: string;
  durationMs: number;
  /** Captured execution data for explainable UI. */
  execution?: CapturedExecution;
}

export interface CapturedExecution {
  snapshot?: unknown;
  narrativeEntries?: unknown[];
  narrative?: string[];
  spec?: unknown;
}

export async function executeCode(code: string, input: string): Promise<ExecuteResult> {
  const logs: string[] = [];
  const start = performance.now();

  // Mutable capture — monkey-patched runners write here
  const captured: CapturedExecution = {};

  try {
    // Strip imports — we inject modules
    const stripped = code
      .replace(/^import\s+.*from\s+['"].*['"];?\s*$/gm, '')
      .replace(/^import\s+{[^}]*}\s+from\s+['"].*['"];?\s*$/gm, '')
      .trim();

    // Transpile TS → JS
    const { code: jsCode } = transform(stripped, {
      transforms: ['typescript'],
      disableESTransforms: true,
    });

    // Wrap in async function
    const wrapped = `
      return (async function(__agentfootprint, input, console, __captured) {
        const {
          LLMCall, LLMCallRunner, Agent, AgentRunner, RAG, RAGRunner,
          FlowChart, FlowChartRunner, Swarm, SwarmRunner,
          mock, mockRetriever, defineTool, ToolRegistry,
          staticPrompt, templatePrompt, compositePrompt,
          slidingWindow, truncateToCharBudget, appendMessage,
          userMessage, assistantMessage, systemMessage, toolResultMessage,
          textBlock, base64Image, urlImage, imageBlock,
          AnthropicAdapter, OpenAIAdapter, BedrockAdapter, createProvider,
          anthropic, openai, ollama, bedrock,
          mcpToolProvider, a2aRunner, agentAsTool, compositeTools,
          agentLoop,
          TokenRecorder, TurnRecorder, ToolUsageRecorder, QualityRecorder,
          GuardrailRecorder, CompositeRecorder, CostRecorder,
          LLMError, wrapSDKError, classifyStatusCode,
          withRetry, withFallback, CircuitBreaker,
          StreamEmitter, SSEFormatter,
          hasToolCalls,
        } = __agentfootprint;

        // ── Monkey-patch runners to capture execution data ──
        function captureFromRunner(runner) {
          try {
            if (runner.getSnapshot) __captured.snapshot = runner.getSnapshot();
          } catch(e) {}
          try {
            if (runner.getNarrativeEntries) __captured.narrativeEntries = runner.getNarrativeEntries();
          } catch(e) {}
          try {
            if (runner.getNarrative) __captured.narrative = runner.getNarrative();
          } catch(e) {}
          try {
            if (runner.getSpec) __captured.spec = runner.getSpec();
          } catch(e) {}
        }

        // Wrap .run() on common runner classes
        const runnerClasses = [LLMCallRunner, AgentRunner, RAGRunner, FlowChartRunner, SwarmRunner];
        const origRuns = new Map();
        for (const Cls of runnerClasses) {
          if (Cls && Cls.prototype && Cls.prototype.run) {
            origRuns.set(Cls, Cls.prototype.run);
            Cls.prototype.run = async function(...args) {
              const result = await origRuns.get(Cls).apply(this, args);
              captureFromRunner(this);
              return result;
            };
          }
        }

        try {
          ${jsCode}
        } finally {
          // Restore original .run() methods
          for (const [Cls, orig] of origRuns) {
            Cls.prototype.run = orig;
          }
        }
      })(__agentfootprint, __input, __console, __captured);
    `;

    const mockConsole = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
    };

    // Execute
    const fn = new Function('__agentfootprint', '__input', '__console', '__captured', wrapped);
    const output = await fn(agentfootprint, input, mockConsole, captured);

    return {
      output,
      logs,
      durationMs: Math.round(performance.now() - start),
      execution: (captured.snapshot || captured.narrative) ? captured : undefined,
    };
  } catch (err) {
    return {
      output: null,
      logs,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - start),
    };
  }
}
