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
import * as agentfootprintObserve from 'agentfootprint/observe';
import * as footprintjs from 'footprintjs';

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
  /** Recorder data from agentObservability (tokens, tools, cost). */
  recorders?: {
    tokens?: {
      totalCalls: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      calls?: Array<{ model: string; inputTokens: number; outputTokens: number; latencyMs: number }>;
    };
    tools?: { totalCalls: number; byTool: Record<string, { calls: number; errors: number; averageLatencyMs?: number }> };
    cost?: number;
  };
}

export interface ApiKeys {
  anthropic?: string;
  openai?: string;
}

export async function executeCode(code: string, input: string, apiKeys?: ApiKeys): Promise<ExecuteResult> {
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
      return (async function(__agentfootprint, input, console, __captured, __apiKeys, __footprintjs) {
        const {
          LLMCall, LLMCallRunner, Agent, AgentRunner, RAG, RAGRunner,
          FlowChart, FlowChartRunner, Swarm, SwarmRunner,
          mock, mockRetriever, defineTool, ToolRegistry,
          staticPrompt, templatePrompt, compositePrompt,
          slidingWindow, truncateToCharBudget, appendMessage,
          userMessage, assistantMessage, systemMessage, toolResultMessage,
          textBlock, base64Image, urlImage, imageBlock,
          AnthropicAdapter, OpenAIAdapter, BedrockAdapter, createProvider,
          BrowserAnthropicAdapter, BrowserOpenAIAdapter,
          anthropic, openai, ollama, bedrock,
          mcpToolProvider, a2aRunner, agentAsTool, compositeTools, gatedTools,
          fallbackProvider,
          InMemoryStore,
          agentLoop,
          TokenRecorder, TurnRecorder, ToolUsageRecorder, QualityRecorder,
          GuardrailRecorder, CompositeRecorder, CostRecorder,
          LLMError, wrapSDKError, classifyStatusCode,
          withRetry, withFallback, CircuitBreaker,
          StreamEmitter, SSEFormatter,
          hasToolCalls,
        } = __agentfootprint;

        // footprintjs core — flowChart builder, executor, subflow utilities
        const {
          flowChart, FlowChartBuilder, FlowChartExecutor,
          getSubtreeSnapshot, listSubflowPaths,
        } = __footprintjs;

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
        const runnerClasses = [LLMCallRunner, AgentRunner, RAGRunner, FlowChartRunner, SwarmRunner, __footprintjs.FlowChartExecutor];
        const origRuns = new Map();
        let __obs = null; // agentObservability recorder for capturing tokens/tools/cost
        for (const Cls of runnerClasses) {
          if (Cls && Cls.prototype && Cls.prototype.run) {
            origRuns.set(Cls, Cls.prototype.run);
            Cls.prototype.run = async function(...args) {
              // Attach MetricRecorder so timing ends up in snapshot.recorders
              const MetricRecorder = __footprintjs.MetricRecorder;
              if (MetricRecorder && typeof this.attachRecorder === 'function') {
                this.attachRecorder(new MetricRecorder('__timing'));
              }
              // Attach agentObservability recorder for tokens/tools/cost
              if (agentObservability && typeof this.recorder === 'function') {
                __obs = agentObservability();
                this.recorder(__obs);
              }
              const result = await origRuns.get(Cls).apply(this, args);
              captureFromRunner(this);
              // Capture recorder data
              if (__obs) {
                try {
                  __captured.recorders = {
                    tokens: __obs.tokens(),
                    tools: __obs.tools(),
                    cost: __obs.cost(),
                  };
                } catch(e) {}
              }
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
      })(__agentfootprint, __input, __console, __captured, __apiKeys, __footprintjs);
    `;

    const mockConsole = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
    };

    // Execute
    const fn = new Function('__agentfootprint', '__input', '__console', '__captured', '__apiKeys', '__footprintjs', wrapped);
    // Merge observe barrel into agentfootprint so recorders are available
    const mergedAgentfootprint = { ...agentfootprint, ...agentfootprintObserve };
    const output = await fn(mergedAgentfootprint, input, mockConsole, captured, apiKeys ?? {}, footprintjs);

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
