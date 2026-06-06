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
// Example-only helper: lives alongside the example sources, exposes a
// single `exampleProvider(kind, opts)` factory every example references
// for its default mock provider. Loaded via Vite's `import.meta.glob`
// (eager) because a static `import` from `@samples/helpers/provider`
// crosses tsconfig's rootDir boundary. The sandbox injects whatever
// this exports as a top-level scope binding so the example's stripped
// `import { exampleProvider } from '../helpers/provider.js'` works.
const __exampleHelperModule = import.meta.glob(
  '@samples/helpers/provider.ts',
  { eager: true },
) as Record<string, { exampleProvider: (...args: unknown[]) => unknown }>;
const exampleProviderHelper = Object.values(__exampleHelperModule)[0]?.exampleProvider;
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
  /** Called during the run with the live `RunStep[]` projected from the
   *  flowchart handle's BoundaryRecorder via `buildRunSteps`. The slider
   *  total = `runSteps.length`, with one position per logical arrow on
   *  the flowchart. Composition-aware (Sequence forwards / Parallel
   *  fork / Conditional decide / Loop iteration). */
  readonly onLiveRunSteps?: (runSteps: unknown) => void;
  /** Called once at the start of the outermost `runner.run()` with the
   *  outermost Runner instance. Lets the host UI hand the runner to
   *  `<Lens runner={...} />` so the chart can derive its build-time
   *  composition graph via `runner.getUIGroupWith(lensGroupTranslator)`.
   *  Fires before any traversal, after the sandbox finishes wiring
   *  recorders. */
  readonly onLiveRunner?: (runner: unknown) => void;
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

  /**
   * Sandbox dispatch mode. Default `'run'` — invokes the example's
   * `run(input, provider)` export. Set to `'resume'` to invoke
   * `resume(checkpoint, humanAnswer, provider)` instead.
   *
   * Resume mode is how the playground completes a HITL pause: when
   * `run()` returns a `RunnerPauseOutcome`, the playground stores the
   * checkpoint, renders a form, and on submit re-invokes executeCode
   * with `mode: 'resume'` + the user's answer. The example's
   * `resume()` builds a fresh agent (cross-executor resume safe) and
   * runs it to completion.
   */
  readonly mode?: 'run' | 'resume';
  /** Required when `mode === 'resume'`. The checkpoint stored from the
   *  prior paused outcome — opaque, JSON-serializable, fed to the
   *  example's `resume()` as-is. */
  readonly resumeCheckpoint?: unknown;
  /** Required when `mode === 'resume'`. The human's answer to the
   *  pause question — becomes the paused tool's return value. */
  readonly resumeInput?: unknown;
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
    let stripped = code
      // Named / type / multi-line: `import { A, B, type C } from 'x';`
      .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?/g, '')
      // Default / type-default / namespace: `import X from 'y';`, `import * as X from 'y';`
      .replace(/import\s+(?:type\s+)?(?:\*\s+as\s+)?\w+\s+from\s+['"][^'"]+['"];?/g, '')
      // Bare side-effect imports: `import 'x';`
      .replace(/import\s+['"][^'"]+['"];?/g, '')
      .trim();

    // v2.14 — sample model rewrite. Examples in agentfootprint/examples/
    // hardcode mock-only model ids (`'mock-weather'`, `'mock'`) for
    // their scripted MockProvider fixture. When the user picks a real
    // provider in the playground, those literals leak into Lens's
    // DETAILS panel via stream.llm_start events even though the real
    // HTTP call hits the right model (the playground's provider wrapper
    // translates outbound requests). Rewrite the literals so the
    // recorded model matches the wire model, end-to-end.
    //
    // Limited to a known mock-id allowlist so we don't accidentally
    // touch a real `claude-*` / `gpt-*` model id a sample author wrote.
    if (injectedProvider) {
      const REAL_DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
      const MOCK_MODEL_IDS = ['mock-weather', 'mock'];
      for (const mockId of MOCK_MODEL_IDS) {
        const re = new RegExp(`(['"\`])${mockId}\\1`, 'g');
        stripped = stripped.replace(re, `'${REAL_DEFAULT_MODEL}'`);
      }
    }

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
      return (async function(__agentfootprint, input, console, __captured, __apiKeys, __footprintjs, __provider, __onLiveSnapshot, __onAgentEvent, __lensRecorder, __onLiveSpec, __footprintjsTrace, __onLiveTopology, exampleProvider, __mode, __checkpoint, __resumeInput, __onLiveRunSteps, __onLiveRunner) {
        const {
          LLMCall, LLMCallRunner, Agent, AgentRunner, RAG, RAGRunner,
          FlowChart, FlowChartRunner, Swarm, SwarmRunner, Parallel, ParallelRunner,
          mock, mockRetriever, defineTool, ToolRegistry,
          AgentPattern, defineInstruction, quickBind,
          // Injection factory family — the context-engineering samples
          // (skills / steering / facts / memory / RAG) reference these; without
          // them the sandbox throws "defineSteering is not defined" etc.
          defineSkill, defineSteering, defineFact, defineMemory, defineRAG,
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

        // Observability accumulator — subscribes to typed events and
        // folds them into the shape recorderViews.tsx renders (tokens /
        // tools / cost), keyed by runtimeStageId for slider slicing.
        const __obs = {
          tokens: { totalCalls: 0, calls: [] },
          tools:  { totalCalls: 0, calls: [] },
          cost:   { totalCost: 0,  calls: [] },
        };
        function __attachObsIfNeeded(self) {
          if (!self || self.__fpPlaygroundObsAttached) return;
          if (typeof self.on !== 'function') return;
          self.on('agentfootprint.stream.llm_end', (ev) => {
            const usage = ev.payload.usage ?? {};
            const inputTokens = Number(usage.input ?? 0);
            const outputTokens = Number(usage.output ?? 0);
            __obs.tokens.totalCalls += 1;
            __obs.tokens.calls.push({
              runtimeStageId: ev.meta.runtimeStageId,
              model: ev.payload.model,
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              ...(ev.payload.content ? { content: ev.payload.content } : {}),
            });
          });
          self.on('agentfootprint.stream.tool_end', (ev) => {
            __obs.tools.totalCalls += 1;
            __obs.tools.calls.push({
              runtimeStageId: ev.meta.runtimeStageId,
              toolName: ev.payload.toolName,
              ...(ev.payload.args !== undefined ? { args: ev.payload.args } : {}),
              ...(ev.payload.result !== undefined ? { result: ev.payload.result } : {}),
            });
          });
          self.on('agentfootprint.cost.tick', (ev) => {
            const cost = Number(ev.payload.cost ?? 0);
            if (cost > 0) {
              __obs.cost.totalCost += cost;
              __obs.cost.calls.push({
                runtimeStageId: ev.meta.runtimeStageId,
                cost,
                ...(ev.payload.model ? { model: ev.payload.model } : {}),
              });
            }
          });
          self.__fpPlaygroundObsAttached = true;
        }

        function snapshotObs() {
          if (__obs.tokens.totalCalls === 0
              && __obs.tools.totalCalls === 0
              && __obs.cost.totalCost === 0) {
            return null;
          }
          try {
            return JSON.parse(JSON.stringify(__obs));
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
        const origResumes = new Map();
        // Closure-scoped "first runner wins" guard. The sandbox patches
        // BOTH agentfootprint composition classes (Parallel, Sequence,
        // etc.) AND footprintjs FlowChartExecutor. The outer composition
        // .run fires first with the right "this", then internally invokes
        // FlowChartExecutor.run with a DIFFERENT "this" — without this
        // guard, the second invocation overwrites liveRunner with the
        // inner executor (which has no getUIGroupWith).
        let __liveRunnerEmitted = false;
        // Shared lens-attach helper. Used by both .run() and .resume()
        // so the second phase of a HITL flow (a fresh agent built
        // inside the example's resume() export) gets observed too —
        // otherwise the Lens panel freezes at the pause point.
        function __attachLensIfNeeded(self) {
          if (__lensRecorder && typeof self.on === 'function' && !self.__fpPlaygroundLensAttached) {
            try {
              __lensRecorder.observe(self);
              self.__fpPlaygroundLensAttached = true;
            } catch (e) {}
          }
          if (__onAgentEvent && typeof self.observe === 'function' && !self.__fpPlaygroundSubscribed) {
            try {
              self.observe(__onAgentEvent);
              self.__fpPlaygroundSubscribed = true;
            } catch (e) {}
          }
          // Observability accumulator — same per-runner-instance attach
          // as the Lens recorder so a fresh runner built inside an
          // example's resume() export still feeds Tokens/Tools/Cost.
          __attachObsIfNeeded(self);
        }
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

              // Observability accumulator — subscribes to typed events
              // on the outermost runner so the Trace tab's Tokens /
              // Tools / Cost panels populate. Idempotent.
              __attachObsIfNeeded(this);

              // L4: expose the outermost runner so Lens can render its
              // build-time composition graph via getUIGroupWith. See the
              // closure-scope flag declared above for the why.
              if (__onLiveRunner && !__liveRunnerEmitted) {
                try {
                  __onLiveRunner(this);
                  __liveRunnerEmitted = true;
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
                  // Attach a RunStepRecorder once per run. It accumulates
                  // RunStep entries incrementally as events fire (real-
                  // time, O(N) total). On each flowchart onUpdate we
                  // push the recorder already-built step list to Lens
                  // via getSteps which is O(filter) and never walks.
                  // Replaces the previous buildRunSteps(boundary) pattern
                  // that re-walked all events on every update (O(N^2) over
                  // a streaming run).
                  let __runStepRec = null;
                  if (typeof __agentfootprint.runStepRecorder === 'function') {
                    __runStepRec = __agentfootprint.runStepRecorder();
                    try { this.attach(__runStepRec); } catch (e) {}
                    if (this.dispatcher && typeof __runStepRec.subscribe === 'function') {
                      try { __runStepRec.subscribe(this.dispatcher); } catch (e) {}
                    }
                  }
                  const handleRef = { current: null };
                  handleRef.current = this.enable.flowchart({
                    onUpdate: (graph) => {
                      if (__onLiveTopology) {
                        try { __onLiveTopology(graph); } catch (e) {}
                      }
                      if (__runStepRec && __onLiveRunSteps) {
                        try { __onLiveRunSteps(__runStepRec.getSteps()); } catch (e) {}
                      }
                    },
                  });
                  __topo = { getTopology: handleRef.current.getSnapshot };
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

          // Patch .resume() the same way. Resume mode (HITL second
          // phase) builds a fresh agent inside the example's
          // resume() export and calls agent.resume(checkpoint, ...)
          // -- which would NEVER trigger the .run() patch above. Lens
          // would freeze at the pause point. Patching .resume() here
          // makes the lensRecorder observe the resume agent so the
          // commentary, slider, and step graph extend through the
          // second phase too.
          if (Cls && Cls.prototype && Cls.prototype.resume && !origResumes.has(Cls)) {
            origResumes.set(Cls, Cls.prototype.resume);
            Cls.prototype.resume = async function(...args) {
              __attachLensIfNeeded(this);

              // Topology recorder for the resume agent. Without this,
              // the StepGraph the playground feeds Lens is frozen at
              // the first agent's pause-point state — slider stays at
              // 3/3 even after the resume's second LLM call lands.
              // The new graph replaces the prior one (each agent has
              // its own BoundaryRecorder); the resume phase's nodes +
              // edges become Lens's source of truth post-resume.
              if (!this.__fpPlaygroundTopoAttached && this.enable && typeof this.enable.flowchart === 'function') {
                try {
                  this.enable.flowchart({
                    onUpdate: (graph) => {
                      if (__onLiveTopology) {
                        try { __onLiveTopology(graph); } catch (e) {}
                      }
                    },
                  });
                  this.__fpPlaygroundTopoAttached = true;
                } catch (e) {}
              }

              try {
                const result = await origResumes.get(Cls).apply(this, args);
                captureFromRunner(this);
                if (__onLiveSnapshot && this.getSnapshot) {
                  try { __onLiveSnapshot(this.getSnapshot()); } catch (e) {}
                }
                return result;
              } catch (e) {
                throw e;
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
          for (const [Cls, orig] of origResumes) {
            Cls.prototype.resume = orig;
          }
        }
      })(__agentfootprint, __input, __console, __captured, __apiKeys, __footprintjs, __provider, __onLiveSnapshot, __onAgentEvent, __lensRecorder, __onLiveSpec, __footprintjsTrace, __onLiveTopology, __exampleProvider, __mode, __checkpoint, __resumeInput, __onLiveRunSteps, __onLiveRunner);
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
      '__exampleProvider',
      '__mode', '__checkpoint', '__resumeInput',
      '__onLiveRunSteps',
      '__onLiveRunner',
      wrapped,
    );
    const output = await fn(
      agentfootprint, input, mockConsole, captured, apiKeys ?? {},
      footprintjs, injectedProvider, options?.onLiveSnapshot, options?.onAgentEvent,
      options?.lensRecorder, options?.onLiveSpec, footprintjsTrace,
      options?.onLiveTopology,
      exampleProviderHelper,
      options?.mode ?? 'run',
      options?.resumeCheckpoint,
      options?.resumeInput,
      options?.onLiveRunSteps,
      options?.onLiveRunner,
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
