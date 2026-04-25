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
// agentfootprint root IS v2 — one flat namespace with every primitive,
// composition, pattern, adapter, and observability helper. v1 subpaths
// are gone; if anything still needs the legacy API it's at
// `agentfootprint/v1`.
import * as agentfootprint from 'agentfootprint';
import * as footprintjs from 'footprintjs';
// trace barrel exposes TopologyRecorder — fallback for anything not
// exposed through `runner.enable.flowchart()`.
import * as footprintjsTrace from 'footprintjs/trace';

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
  /** Called once at the very start of the outermost `runner.run()`, before
   *  any traversal, with the flowchart spec derived from
   *  `runner.toFlowChart().buildTimeStructure`. Lets the Flowchart panel
   *  render the static tree structure while execution streams in — multi-
   *  agent subflow nesting surfaces immediately instead of after the run.
   *  v1 runners expose `getSpec()`; v2 runners expose `toFlowChart()`. */
  readonly onLiveSpec?: (spec: unknown) => void;
  /** Called periodically during the run with the live composition graph
   *  from footprintjs `TopologyRecorder`. Groups steps at runtime —
   *  sub-agents from Swarm / Debate / MapReduce / ToT / Parallel appear
   *  as distinct nodes as execution enters each subflow. Fires alongside
   *  `onLiveSnapshot`. Consumers merge topology nodes with the spec (for
   *  static structure) to highlight which branches actually ran. */
  readonly onLiveTopology?: (topology: unknown) => void;
  /** Called for every AgentStreamEvent during AgentRunner.run(). Injected
   *  into the sample code by monkey-patching AgentRunner.prototype.run to
   *  forward events to useLiveTimeline's ingest. Without this callback,
   *  Lens would only show the post-run snapshot — with it, Lens populates
   *  iteration-by-iteration as the mock (or real provider) runs. */
  readonly onAgentEvent?: (event: unknown) => void;
  /**
   * Optional Lens recorder to attach to every constructed runner via
   * `runner.attachRecorder()`. When present, full EmitEvents flow into
   * the recorder (real `runtimeStageId` + `subflowPath`) instead of the
   * flat AgentStreamEvent shape `observe()` emits — required for
   * multi-agent grouping (FlowChart / Conditional / Parallel / Swarm
   * sub-agents land in `timeline.subAgents`).
   *
   * Pass `lens.recorder` from `useLiveTimeline()`. When absent we fall
   * back to the `onAgentEvent` observe-based path.
   */
  /**
   * Lens v2 recorder. Sandbox calls `recorder.observe(runner)` on each
   * constructed runner before `runner.run()` fires, so the recorder
   * captures the full typed event stream via `runner.on('*')`. The Lens
   * React component then renders from this recorder's selectors.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly lensRecorder?: any;
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
      return (async function(__agentfootprint, input, console, __captured, __apiKeys, __footprintjs, __provider, __onLiveSnapshot, __onAgentEvent, __lensRecorder, __onLiveSpec, __footprintjsTrace, __onLiveTopology) {
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
          // v2 — primitives, compositions, features, patterns. When the
          // sample is v1 these are undefined; v1 code never references
          // them. When the sample is v2, these shadow any v1 collisions
          // because __agentfootprint merges v2 AFTER v1.
          Sequence, Conditional, Loop,
          MockProvider, pauseHere, isPauseRequest, isPaused, PauseRequest,
          pricingTable, costBudget, emitCostTick,
          selfConsistency, reflection, debate, mapReduce, tot, treeOfThoughts, swarm,
          LoggingDomains,
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
            // v1 runners expose getSpec() directly. v2 runners expose
            // toFlowChart() whose buildTimeStructure IS the
            // SerializedPipelineStructure (same shape the Flowchart panel
            // consumes). Check v2 first so v2 wins when both are present.
            if (runner.toFlowChart) {
              const chart = runner.toFlowChart();
              if (chart && chart.buildTimeStructure) {
                __captured.spec = chart.buildTimeStructure;
              }
            } else if (runner.getSpec) {
              __captured.spec = runner.getSpec();
            }
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

        // Wrap .run() on runner classes to capture execution data.
        // v1 runner classes (XyzRunner) are the returned build() product.
        // v2 runner classes are LLMCall/Agent/Sequence/Parallel/Conditional/Loop
        // themselves (they extend RunnerBase). In v1-mode, those names point
        // to builder classes and prototype.run is undefined — the guard
        // below skips cleanly. In v2-mode they point to runner classes and
        // the monkey-patch attaches. Same array, both modes.
        const runnerClasses = [
          LLMCallRunner, AgentRunner, RAGRunner, FlowChartRunner, SwarmRunner, ParallelRunner,
          __footprintjs.FlowChartExecutor,
          // v2 runner classes (shadow v1 builder names when isV2 merged last)
          LLMCall, Agent, Sequence, Parallel, Conditional, Loop,
        ];
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

              // Lens v2 observe() — called once on the outermost runner.
              // The recorder subscribes via runner.on wildcard and builds
              // its RunTree / EventLog / Summary synchronously from the
              // typed event stream. Works for every Runner (primitive,
              // composition, pattern) because every Runner extends
              // RunnerBase which exposes .on().
              if (__lensRecorder && typeof this.on === 'function' && !this.__fpPlaygroundLensAttached) {
                try {
                  __lensRecorder.observe(this);
                  this.__fpPlaygroundLensAttached = true;
                } catch (e) {}
              }

              // FALLBACK PATH — observe() for runners that don't have
              // attachRecorder (older versions) AND for non-Lens consumers
              // of the event stream (still useful for debug logging).
              // Class-agnostic — every agentfootprint runner exposes
              // observe(). Idempotent: subscribe only once per instance.
              if (__onAgentEvent && typeof this.observe === 'function' && !this.__fpPlaygroundSubscribed) {
                try {
                  this.observe(__onAgentEvent);
                  this.__fpPlaygroundSubscribed = true;
                } catch (e) {}
              }

              // TopologyRecorder — the live composition graph accumulator.
              // Attach once per outermost runner; it listens to FlowRecorder
              // events (onSubflowEntry / onFork / onDecision) and exposes a
              // queryable { nodes, edges, activeNodeId } snapshot at any
              // moment. This is how multi-agent patterns (Swarm, Debate,
              // MapReduce, ToT) surface sub-agent grouping in the UI —
              // each agent subflow becomes a node as execution enters it,
              // not from a post-run tree walk.
              //
              // v1 runners expose attachRecorder(); v2 runners expose
              // attach(). Try both so the sandbox works across versions.
              // v2's enable.flowchart() — returns a handle whose
              // getSnapshot() yields a StepGraph (ReAct steps +
              // composition edges, all derived in agentfootprint). The
              // onUpdate callback fires on every event; we forward to
              // __onLiveTopology so the Lens panel re-renders.
              let __topo = null;
              if (!this.__fpPlaygroundTopoAttached && this.enable && typeof this.enable.flowchart === 'function') {
                try {
                  const handle = this.enable.flowchart({
                    onUpdate: (graph) => {
                      if (__onLiveTopology) {
                        try { __onLiveTopology(graph); } catch (e) {}
                      }
                    },
                  });
                  __topo = { getTopology: handle.getSnapshot };
                  this.__fpPlaygroundTopoAttached = true;
                } catch (e) { __topo = null; }
              }

              // Progressive rendering: Lens v2 subscribes to the recorder
              // directly via useSyncExternalStore and re-renders on each
              // event. No poll needed for the Lens column. Static
              // consumers of onLiveSnapshot / onLiveTopology still get
              // fed at run-start + run-end below.
              const __livePoll = null;
              const self = this;
              // Prime the live callbacks immediately so fast runs (<100ms)
              // still surface topology to the UI at least once before the
              // run completes.
              try {
                if (__onLiveTopology && __topo) {
                  __onLiveTopology(__topo.getTopology());
                }
              } catch (e) {}

              // Capture the flowchart spec BEFORE the run starts so the
              // Flowchart view can render the tree structure while
              // execution streams in. toFlowChart() is pure — it rebuilds
              // the composition graph from the builder config, no
              // execution state required. For v2 multi-agent patterns
              // (Swarm, Debate, MapReduce, ToT) this is the only way the
              // agent subflow tree surfaces to Lens during streaming —
              // otherwise the spec lands only at run-end, after the
              // observer has already missed every transition.
              try {
                if (!__captured.spec) {
                  let spec = undefined;
                  if (self.toFlowChart) {
                    const chart = self.toFlowChart();
                    spec = chart && chart.buildTimeStructure;
                  } else if (self.getSpec) {
                    spec = self.getSpec();
                  }
                  if (spec) {
                    __captured.spec = spec;
                    // Push to the UI immediately so Flowchart panel
                    // renders the tree during streaming (not after).
                    if (__onLiveSpec) {
                      try { __onLiveSpec(spec); } catch (e) {}
                    }
                  }
                }
              } catch (e) {}

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
                if (__onLiveSnapshot && self.getSnapshot) {
                  try { __onLiveSnapshot(self.getSnapshot()); } catch (e) {}
                }
                // Final topology push — captures the full composition
                // graph including every subflow that ran. For fast runs
                // (<100ms) the interval may not have ticked at all.
                if (__onLiveTopology && __topo) {
                  try { __onLiveTopology(__topo.getTopology()); } catch (e) {}
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
      })(__agentfootprint, __input, __console, __captured, __apiKeys, __footprintjs, __provider, __onLiveSnapshot, __onAgentEvent, __lensRecorder, __onLiveSpec, __footprintjsTrace, __onLiveTopology);
    `;

    const mockConsole = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
    };

    // Execute
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      '__agentfootprint', '__input', '__console', '__captured', '__apiKeys',
      '__footprintjs', '__provider', '__onLiveSnapshot', '__onAgentEvent',
      '__lensRecorder', '__onLiveSpec', '__footprintjsTrace', '__onLiveTopology',
      wrapped,
    );
    const output = await fn(
      agentfootprint, input, mockConsole, captured, apiKeys ?? {},
      footprintjs, injectedProvider, options?.onLiveSnapshot, options?.onAgentEvent,
      options?.lensRecorder, options?.onLiveSpec, footprintjsTrace,
      options?.onLiveTopology,
    );

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
