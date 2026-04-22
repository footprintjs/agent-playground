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
import * as agentfootprintExplain from 'agentfootprint/explain';
import * as agentfootprintResilience from 'agentfootprint/resilience';
import * as agentfootprintProviders from 'agentfootprint/providers';
import * as footprintjs from 'footprintjs';
import { asStreaming } from './streamingMock';

export interface ExecuteResult {
  output: unknown;
  logs: string[];
  error?: string;
  durationMs: number;
  /** Captured execution data for explainable UI. */
  execution?: CapturedExecution;
}

export interface RecorderSnapshot {
  tokens?: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    calls?: Array<{ model: string; inputTokens: number; outputTokens: number; latencyMs: number; runtimeStageId?: string }>;
  };
  tools?: { totalCalls: number; byTool: Record<string, { calls: number; errors: number; averageLatencyMs?: number }> };
  cost?: number;
  explain?: {
    sources: Array<{ toolName: string; args: Record<string, unknown>; result: string; turnNumber?: number }>;
    claims: Array<{ content: string; model?: string; iteration: number }>;
    decisions: Array<{ toolName: string; args: Record<string, unknown>; latencyMs: number }>;
    summary: string;
  };
}

export interface CapturedExecution {
  snapshot?: unknown;
  narrativeEntries?: unknown[];
  spec?: unknown;
  /** Recorder data from agentObservability (tokens, tools, cost, explain). */
  recorders?: RecorderSnapshot;
}

export interface ApiKeys {
  anthropic?: string;
  openai?: string;
}

export interface ExecuteOptions {
  /** Called for every token as the mock streams. Lets the chat UI
   *  render a progressive bubble (Claude-style token-by-token). */
  readonly onStreamToken?: (token: string) => void;
  /** Called once when the mock streaming finishes. */
  readonly onStreamDone?: () => void;
  /** Called periodically during the run with the latest runner snapshot.
   *  Drives the Lens column — so the observability panel updates as the
   *  mock streams tokens, instead of only at the end of the run. */
  readonly onLiveSnapshot?: (snapshot: unknown) => void;
  /** Called for every AgentStreamEvent during AgentRunner.run(). Injected
   *  into the sample code by monkey-patching AgentRunner.prototype.run to
   *  forward events to useLiveTimeline's ingest. Without this callback,
   *  Lens would only show the post-run snapshot — with it, Lens populates
   *  iteration-by-iteration as the mock (or real provider) runs. */
  readonly onAgentEvent?: (event: unknown) => void;
}

export async function executeCode(
  code: string,
  input: string,
  apiKeys?: ApiKeys,
  /** Optional injected provider — replaces the example's default mock when supplied.
   *  Selected by the user via ProviderPicker (mock / anthropic / openai / ollama). */
  injectedProvider?: unknown,
  options?: ExecuteOptions,
): Promise<ExecuteResult> {
  const logs: string[] = [];
  const start = performance.now();

  // Mutable capture — monkey-patched runners write here
  const captured: CapturedExecution = {};

  try {
    // Strip imports — we inject modules via function scope instead.
    // Handle single-line, multi-line `{ ... }`, default, namespace, and
    // `import type` forms. `[\s\S]*?` matches across newlines (plain `.`
    // doesn't span newlines by default).
    const stripped = code
      // Named / type / multi-line: `import { A, B, type C } from 'x';`
      .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?/g, '')
      // Default / type-default / namespace: `import X from 'y';`, `import * as X from 'y';`
      .replace(/import\s+(?:type\s+)?(?:\*\s+as\s+)?\w+\s+from\s+['"][^'"]+['"];?/g, '')
      // Bare side-effect imports: `import 'x';`
      .replace(/import\s+['"][^'"]+['"];?/g, '')
      .trim();

    // Transpile TS → JS
    const { code: jsCode } = transform(stripped, {
      transforms: ['typescript'],
      disableESTransforms: true,
    });

    // Wrap in async function. `__provider` is passed to the example body
    // via the catalog's fromSample prelude (`const provider = __provider;`).
    // When undefined, the example's `provider ?? defaultMock()` falls back
    // to the example's scripted mock — same behavior as before. When a
    // real provider is injected, the example uses it for every chat call.
    const wrapped = `
      return (async function(__agentfootprint, input, console, __captured, __apiKeys, __footprintjs, __provider, __onLiveSnapshot, __onAgentEvent) {
        const {
          LLMCall, LLMCallRunner, Agent, AgentRunner, RAG, RAGRunner,
          FlowChart, FlowChartRunner, Swarm, SwarmRunner, Parallel, ParallelRunner,
          mock, mockRetriever, defineTool, ToolRegistry,
          AgentPattern, defineInstruction, quickBind,
          staticPrompt, templatePrompt, compositePrompt,
          slidingWindow, charBudget, appendMessage,
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
          agentObservability,
          OTelRecorder,
          ExplainRecorder,
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
            if (runner.getSpec) __captured.spec = runner.getSpec();
          } catch(e) {}
        }

        // Intercept .build() on builder classes to inject agentObservability recorder
        let __obs = null;
        const builderClasses = [LLMCall, Agent, RAG, Swarm, Parallel];
        const origBuilds = new Map();
        for (const Cls of builderClasses) {
          if (Cls && Cls.prototype && Cls.prototype.build) {
            origBuilds.set(Cls, Cls.prototype.build);
            Cls.prototype.build = function(...args) {
              // Inject agentObservability before build
              if (agentObservability && typeof this.recorder === 'function') {
                __obs = agentObservability({ id: '__bts-obs' });
                this.recorder(__obs);
              }
              return origBuilds.get(Cls).apply(this, args);
            };
          }
        }

        // Snapshot obs state — returns a deep copy of current cumulative data
        function snapshotObs() {
          if (!__obs) return null;
          try {
            return JSON.parse(JSON.stringify({
              tokens: __obs.tokens(),
              tools: __obs.tools(),
              cost: __obs.cost(),
              explain: __obs.explain(),
            }));
          } catch(e) { return null; }
        }

        // Wrap .run() on runner classes to capture execution data
        const runnerClasses = [LLMCallRunner, AgentRunner, RAGRunner, FlowChartRunner, SwarmRunner, ParallelRunner, __footprintjs.FlowChartExecutor];
        const origRuns = new Map();
        for (const Cls of runnerClasses) {
          if (Cls && Cls.prototype && Cls.prototype.run) {
            origRuns.set(Cls, Cls.prototype.run);
            Cls.prototype.run = async function(...args) {
              // Attach MetricRecorder so timing ends up in snapshot.recorders
              const MetricRecorder = __footprintjs.MetricRecorder;
              if (MetricRecorder && typeof this.attachRecorder === 'function') {
                this.attachRecorder(new MetricRecorder('__timing'));
              }

              // Subscribe to the runner event stream so Lens lights up.
              // Class-agnostic — every agentfootprint runner exposes
              // observe(). Idempotent: subscribe only once per instance
              // (sample code may call run() multiple times).
              if (__onAgentEvent && typeof this.observe === 'function' && !this.__fpPlaygroundSubscribed) {
                try {
                  this.observe(__onAgentEvent);
                  this.__fpPlaygroundSubscribed = true;
                } catch (e) {}
              }

              // Live-snapshot polling — every ~100ms during the run,
              // push a fresh snapshot to the Lens column so the
              // observability panel updates AS the mock streams tokens,
              // not only at the end.
              let __livePoll = null;
              const self = this;
              if (__onLiveSnapshot && self.getSnapshot) {
                __livePoll = setInterval(() => {
                  try {
                    __onLiveSnapshot(self.getSnapshot());
                  } catch (e) {}
                }, 100);
              }

              try {
                const result = await origRuns.get(Cls).apply(this, args);
                captureFromRunner(this);
                // Final recorder snapshot
                const finalSnap = snapshotObs();
                if (finalSnap) {
                  __captured.recorders = finalSnap;
                }
                // Final live-snapshot push so the UI is guaranteed to
                // have the end-of-run state (the interval may have
                // missed the final commit).
                if (__onLiveSnapshot) {
                  try { __onLiveSnapshot(self.getSnapshot()); } catch (e) {}
                }
                return result;
              } finally {
                if (__livePoll) clearInterval(__livePoll);
              }
            };
          }
        }

        try {
          ${jsCode}
        } finally {
          // Restore original methods
          for (const [Cls, orig] of origRuns) {
            Cls.prototype.run = orig;
          }
          for (const [Cls, orig] of origBuilds) {
            Cls.prototype.build = orig;
          }
        }
      })(__agentfootprint, __input, __console, __captured, __apiKeys, __footprintjs, __provider, __onLiveSnapshot, __onAgentEvent);
    `;

    const mockConsole = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
    };

    // Execute
    const fn = new Function('__agentfootprint', '__input', '__console', '__captured', '__apiKeys', '__footprintjs', '__provider', '__onLiveSnapshot', '__onAgentEvent', wrapped);
    // Merge subpath barrels into agentfootprint so all exports are available
    const mergedAgentfootprint: Record<string, unknown> = {
      ...agentfootprint,
      ...agentfootprintObserve,
      ...agentfootprintExplain,
      ...agentfootprintResilience,
      ...agentfootprintProviders,
    };
    // When the picker is "Mock" (no real provider injected), wrap the
    // example's `mock([...])` calls with `asStreaming(...)` so the
    // scripted responses arrive token-by-token via the StreamCallback —
    // matching the visual feel of "Run with Claude" / "Run with GPT".
    if (!injectedProvider) {
      const originalMock = mergedAgentfootprint.mock as (...args: unknown[]) => unknown;
      mergedAgentfootprint.mock = (...args: unknown[]) =>
        asStreaming(originalMock(...args) as Parameters<typeof asStreaming>[0], {
          onToken: options?.onStreamToken,
          onDone: options?.onStreamDone,
        });
    }
    const output = await fn(mergedAgentfootprint, input, mockConsole, captured, apiKeys ?? {}, footprintjs, injectedProvider, options?.onLiveSnapshot, options?.onAgentEvent);

    return {
      output,
      logs,
      durationMs: Math.round(performance.now() - start),
      execution: (captured.snapshot || captured.narrativeEntries) ? captured : undefined,
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
