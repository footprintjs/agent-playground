import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { samples } from '../samples/catalog';
import { CodePanel } from './CodePanel';
import { ResultPanel } from './ResultPanel';
import { HitlPauseForm } from './HitlPauseForm';
import { ChatThinkKit } from './ChatThinkKit';
import { SampleExplainer } from './SampleExplainer';
import { Modal } from './Modal';
// TracedFlowchartView removed in explainable-ui v0.20 — new API is
// recorder-based (createTraceBundle + attachTo before run). The
// flowchart preview tab is stubbed below pending playground migration.
import {
  ExplainableShell,
  toVisualizationSnapshots,
} from 'footprint-explainable-ui';
import type {
  ThemeTokens,
  StageSnapshot,
  RecorderView,
} from 'footprint-explainable-ui';
import { createRecorderViews } from './live/recorderViews';
import { Lens, LensRecorder, structureGraphFromRunner } from 'agentfootprint-lens';
import { ThreeRenderersDemo } from './ThreeRenderersDemo';
// Shared "clean centered column" render strategy — the agent merge-tree
// blueprint (same chart as the collapser demo + live blueprint).
import { LensChart, buildAgentMergeTreeGraph, mergeTreeLayout, MAIN_CHART_NODE_TYPES } from '../charts/lensRender';

/**
 * Defensive error boundary around the Lens panel. If any internal Lens
 * render throws (e.g., during a library upgrade or a malformed event
 * snapshot), display the error inline instead of silently producing an
 * empty panel. Kept as defensive UX, not a debug-only hook.
 */
class LensErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Lens threw:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, color: '#f87171', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <strong>Lens crashed:</strong> {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

// Theme tokens built from the playground's own CSS vars so Lens renders
// on the same cream/navy palette as the rest of the app (not the default
// pure-white coolLight / slate coolDark). CSS-var strings flow through
// React inline styles cleanly; the `:root.light` override automatically
// flips every surface when the user toggles the theme.
const playgroundTheme: ThemeTokens = {
  colors: {
    primary: 'var(--accent)',
    success: 'var(--success)',
    error: 'var(--error)',
    warning: 'var(--warning)',
    bgPrimary: 'var(--bg-primary)',
    bgSecondary: 'var(--bg-secondary)',
    bgTertiary: 'var(--bg-tertiary)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
    border: 'var(--border)',
  },
  radius: 'var(--radius)',
  fontFamily: {
    sans: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
};
import { Panel, Group, Separator } from 'react-resizable-panels';
import { executeCode } from '../runner/executeCode';
import { loadApiKeys } from './SettingsPanel';
import { ProviderPicker, useProviderPicker } from './ProviderPicker';
import { buildProvider } from '../runner/buildProvider';
import type { ChatTurn } from './ResultPanel';

type MobileTab = 'code' | 'output';
type LeftView = 'code' | 'flowchart' | 'explain';

interface SamplePageProps {
  /**
   * Optional handler that opens the SettingsPanel drawer. Plumbed from
   * SamplesLayout so the ProviderPicker can prompt for a key inline
   * when the user picks a key-required provider with no saved key.
   */
  onOpenSettings?: () => void;
}

export function SamplePage({ onOpenSettings }: SamplePageProps = {}) {
  const { sampleId } = useParams<{ sampleId: string }>();
  const [searchParams] = useSearchParams();
  const sample = samples.find((s) => s.id === sampleId);
  const mode = searchParams.get('mode');
  const isConceptSample = mode === 'concepts';

  const [code, setCode] = useState(sample?.code ?? '');
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState('Hello, how can you help me?');

  // Active tab inside the Observability column. `lens` shows the
  // agentfootprint-lens RunTree+EventStream+Summary; `trace` renders
  // the same run snapshot through footprint-explainable-ui's
  // TracedFlowchartView so consumers can compare both renderers
  // against the same data.
  const [observeTab, setObserveTab] = useState<'lens' | 'trace'>('lens');
  // Trace tab — toggle to render each stage's stable `stageId` as a small
  // caption beneath the label. Teaching aid: shows the key recorders use
  // (`runtimeStageId = [subflowPath/]stageId#executionIndex`).
  const [showStageIds, setShowStageIds] = useState(false);

  // On-demand modal: Code / Explain / Flowchart. The steady-state view
  // is just Chat + Lens (live monitor); this heavier content opens in a
  // focused modal via toolbar buttons. `modalTab` is the active tab,
  // `modalOpen` toggles the overlay.
  const [modalTab, setModalTab] = useState<LeftView>('code');
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = (tab: LeftView) => {
    setModalTab(tab);
    setModalOpen(true);
  };

  // Mobile tab — desktop uses the always-visible 3-column layout where
  // observability lives in the Lens column. BTS is gone.
  const [mobileTab, setMobileTab] = useState<MobileTab>('code');

  // LLM provider selection (Mock / Claude / GPT / Ollama). Persisted
  // across reloads; passed to executeCode so the example's
  // `run(input, provider?)` factory uses the chosen provider.
  const [providerKind, setProviderKind] = useProviderPicker();

  // Progressive streaming bubble — tokens arrive via onStreamToken
  // during a run and accumulate here. Cleared when the run finalizes
  // and the full turn is pushed to chatHistory.
  const [streamingResponse, setStreamingResponse] = useState<string>('');

  // Live snapshot fed to Lens during a run — polled at ~100ms inside
  // executeCode so the observability panel updates AS the mock streams
  // tokens. Cleared on sample switch.
  const [liveSnapshot, setLiveSnapshot] = useState<unknown>(null);

  // Live flowchart spec fed to the Flowchart panel during a run. Captured
  // from `runner.toFlowChart().buildTimeStructure` at run-start, BEFORE
  // traversal begins, so multi-agent subflow trees (Swarm/Debate/MapReduce/
  // ToT) surface in the UI while execution streams — not only after.
  const [liveSpec, setLiveSpec] = useState<unknown>(null);

  // Live composition graph from footprintjs TopologyRecorder. Polled during
  // a run alongside the snapshot. Gives { nodes, edges, activeNodeId } —
  // each entered subflow (Swarm agent, Debate role, MapReduce shard,
  // ToT branch) appears as a node as execution reaches it, so the UI can
  // group steps live without waiting for a post-run tree walk.
  const [liveTopology, setLiveTopology] = useState<unknown>(null);

  // Live RunStep[] projected from the BoundaryRecorder at every flowchart
  // update. Slider walks one position per logical arrow (asks / forwards /
  // fork / decide / iteration / answers / react). Lens consumes directly.
  const [liveRunSteps, setLiveRunSteps] = useState<unknown>(null);

  // L4: the outermost Runner instance captured from the sandbox's
  // `__attachLensIfNeeded` hook. Lens needs the live Runner to derive
  // its build-time composition graph via `getUIGroupWith`. Cleared on
  // sample switch.
  const [liveRunner, setLiveRunner] = useState<unknown>(null);

  // Lens recorder. Each Run click creates a fresh recorder (so
  // RunTree / EventLog / Summary reset between turns), observes the
  // outermost runner through the sandbox, and is then handed to the
  // Lens component via state so React re-renders with the populated
  // recorder once events accumulate.
  const [lensRecorder, setLensRecorder] = useState<LensRecorder>(() => new LensRecorder());
  // Debug: expose recorder for playwright inspection.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__lensRecorder = lensRecorder;

  // ─── Pause/Resume HITL state ──────────────────────────────────
  // When the example's run() returns a `RunnerPauseOutcome`, store the
  // checkpoint + pauseData here so the chat panel renders a form. On
  // submit, we re-invoke executeCode in resume mode with the user's
  // answer. The same lensRecorder observes both phases so the
  // commentary timeline is unbroken.
  const [pausedOutcome, setPausedOutcome] = useState<{
    readonly checkpoint: unknown;
    readonly pauseData: unknown;
    readonly originalInput: string;
  } | null>(null);

  // Reset all state when switching samples
  useEffect(() => {
    setCode(sample?.code ?? '');
    setChatHistory([]);
    setStreamingResponse('');
    setLiveSnapshot(null);
    setLiveSpec(null);
    setLiveTopology(null);
    setLiveRunner(null);
    setPausedOutcome(null); // HITL form is sample-scoped — clear on swap
    // Swap in a fresh LensRecorder so prior-sample events don't leak.
    setLensRecorder(new LensRecorder());
    setRunning(false);
    // Default the modal to Explain when the sample has one — read first,
    // then code. Falls back to Code for inline samples with no .md. The
    // modal stays closed on sample switch; the user opens it on demand.
    setModalTab(sample?.explainer ? 'explain' : 'code');
    setModalOpen(false);
    setMobileTab('code');

    // Intentionally NO auto-run. Sample code only executes when the user
    // clicks Run. Removed because landing on any URL used to silently
    // execute the sample — wasted LLM calls (when a real provider is
    // selected), surprise chat bubbles, and mode switches that jumped
    // into "already running" state. The Flowchart tab shows an empty
    // state until the first click; the Code + Explain tabs stand alone
    // without a run.
  }, [sampleId]);

  const handleRun = useCallback(async () => {
    if (!sample || running) return;
    const capturedInput = input;
    setRunning(true);
    try {
      const keys = loadApiKeys();
      const apiKeys = {
        anthropic: keys.anthropic || undefined,
        openai: keys.openai || undefined,
        openrouter: keys.openrouter || undefined,
      };
      // Resolve the user's provider choice → concrete LLMProvider (or
      // null when "Mock" is chosen, in which case the example's own
      // scripted-mock fallback is used).
      const built = buildProvider(providerKind, apiKeys);
      if (built.missingKey) {
        // User picked a real provider but no key set. Surface a hint
        // in the chat as a synthetic error turn — the user opens
        // Settings via the gear icon to add a key.
        const vendor = built.missingKey === 'anthropic'
          ? 'Anthropic'
          : built.missingKey === 'openai'
            ? 'OpenAI'
            : 'OpenRouter';
        setChatHistory((prev) => [
          ...prev,
          {
            input: capturedInput,
            result: {
              output: null,
              logs: [],
              error: `${vendor} API key required. Click the gear icon in the top header to add one.`,
              durationMs: 0,
            },
          },
        ]);
        return;
      }
      // Reset streaming bubble + live snapshot + Lens recorder. Create
      // the fresh recorder INLINE (not via setState) so the sandbox
      // observes the same instance we hand to React — setState is
      // asynchronous and would leave the sandbox holding a stale
      // closure reference.
      setStreamingResponse('');
      setLiveSnapshot(null);
      setLiveRunner(null);
      setPausedOutcome(null); // any prior pause is cleared on a new Run
      const freshRecorder = new LensRecorder();
      setLensRecorder(freshRecorder);
      const res = await executeCode(code, capturedInput, apiKeys, built.provider, {
        onStreamToken: (token) => setStreamingResponse((prev) => prev + token),
        onLiveSnapshot: (snap) => setLiveSnapshot(snap),
        onLiveSpec: (spec) => setLiveSpec(spec),
        onLiveTopology: (topo) => setLiveTopology(topo),
        onLiveRunSteps: (steps) => setLiveRunSteps(steps),
        onLiveRunner: (runner) => setLiveRunner(runner),
        // Lens observe()-based attach: the sandbox calls
        // `recorder.observe(runner)` before calling `runner.run()`.
        lensRecorder: freshRecorder,
      });
      setStreamingResponse('');
      // ── HITL detection ──
      // The example's run() may return a `RunnerPauseOutcome` shape
      // ({ paused: true, checkpoint, pauseData }). Stash it for the
      // form to render; don't append to chat history yet — the chat
      // turn isn't complete until the human answers.
      const out = res?.output as { paused?: boolean; checkpoint?: unknown; pauseData?: unknown } | undefined;
      if (out && out.paused === true && out.checkpoint !== undefined) {
        setPausedOutcome({
          checkpoint: out.checkpoint,
          pauseData: out.pauseData,
          originalInput: capturedInput,
        });
      } else {
        // Capture the recorder's event log so TurnView can replay the
        // activity timeline later (the same one ChatThinkKit showed
        // live). Fresh array so future events on the recorder don't
        // mutate the historical snapshot.
        const events = freshRecorder.selectEventLog().map((e) => e.event);
        setChatHistory((prev) => [...prev, { input: capturedInput, result: res, events }]);
      }
      // Lens column auto-renders the trace once execution lands.
    } finally {
      setRunning(false);
    }
  }, [sample, code, input, running, providerKind]);

  /**
   * HITL resume. Called when the user submits the pause form's answer.
   * Re-invokes the sandbox in `mode: 'resume'`, threading the stored
   * checkpoint + answer to the example's `resume()` export. The SAME
   * lensRecorder is reused so the timeline (commentary, slider, step
   * graph) extends from the pause point forward instead of starting
   * over.
   */
  const handleResume = useCallback(
    async (humanAnswer: unknown) => {
      if (!pausedOutcome || !sample || running) return;
      setRunning(true);
      try {
        const keys = loadApiKeys();
        const apiKeys = {
          anthropic: keys.anthropic || undefined,
          openai: keys.openai || undefined,
          openrouter: keys.openrouter || undefined,
        };
        const built = buildProvider(providerKind, apiKeys);
        const checkpoint = pausedOutcome.checkpoint;
        const original = pausedOutcome.originalInput;
        // Clear the form before the resume call lands; the run is
        // about to mutate state again. Keep the lensRecorder — same
        // run, just second phase.
        setPausedOutcome(null);
        setStreamingResponse('');
        const res = await executeCode(
          code,
          original, // original user input (not used by resume() but the sandbox still wires `input`)
          apiKeys,
          built.provider,
          {
            onStreamToken: (token) => setStreamingResponse((prev) => prev + token),
            onLiveSnapshot: (snap) => setLiveSnapshot(snap),
            onLiveSpec: (spec) => setLiveSpec(spec),
            onLiveTopology: (topo) => setLiveTopology(topo),
            onLiveRunSteps: (steps) => setLiveRunSteps(steps),
            onLiveRunner: (runner) => setLiveRunner(runner),
            lensRecorder, // reuse — same recorder observes the resume agent
            mode: 'resume',
            resumeCheckpoint: checkpoint,
            resumeInput: humanAnswer,
          },
        );
        setStreamingResponse('');
        // Capture events at resume completion — same recorder observed
        // both phases, so the snapshot covers the full HITL flow.
        const events = lensRecorder.selectEventLog().map((e) => e.event);
        setChatHistory((prev) => [...prev, { input: original, result: res, events }]);
      } finally {
        setRunning(false);
      }
    },
    [pausedOutcome, sample, running, providerKind, code, lensRecorder],
  );

  if (!sample) {
    return (
      <div className="welcome">
        <h2>Sample not found</h2>
        <p>No sample with id "{sampleId}". Pick one from the sidebar.</p>
      </div>
    );
  }

  const lastTurn = chatHistory[chatHistory.length - 1];
  const execution = lastTurn?.result?.execution ?? null;
  // Did the run terminate fatally? The lens recorder flips its summary
  // status to 'err' on agentfootprint.error.fatal (bridged from
  // footprintjs onRunFailed). Drives the monitor's ✕ Error badge so a
  // failed run reads as failed, not idle.
  const monitorErrored = ((): boolean => {
    try {
      return lensRecorder.selectSummary?.().status === 'err';
    } catch {
      return false;
    }
  })();
  // Prefer the finalized spec from the last completed turn; fall back to
  // the live spec emitted at run-start so the Flowchart panel renders
  // the tree while execution streams in.
  const spec = execution?.spec ?? liveSpec ?? null;

  // ── ExplainableShell v0.20 inputs for the Trace tab ──────────────
  // toVisualizationSnapshots converts the raw runtime snapshot + narrative
  // entries into the per-stage StageSnapshot[] the time slider walks.
  // createRecorderViews builds the Tokens / Tools / Explain tabs.
  // Mirrors the pattern BTSPanel already uses (see live/BTSPanel.tsx).
  const traceSnapshots = useMemo<StageSnapshot[]>(() => {
    const snap = execution?.snapshot ?? liveSnapshot;
    if (!snap) return [];
    try {
      return toVisualizationSnapshots(
        snap as any,
        (execution?.narrativeEntries as any[]) ?? undefined,
      );
    } catch {
      return [];
    }
  }, [execution, liveSnapshot]);
  const traceRecorderViews = useMemo<RecorderView[]>(
    () => createRecorderViews(execution?.recorders ?? undefined),
    [execution],
  );

  // TraceGraph for the Trace tab's flowchart panel. ExplainableShell needs a
  // `traceGraph` to render the chart canvas; without one it shows the panel
  // chrome (slider, tabs, timeline) but the canvas stays empty.
  // `structureGraphFromRunner` produces the real-structure `{ nodes, edges }`
  // (node ids = runtime stage ids) — the same single runner→graph path the Lens
  // monitor uses, so the Trace tab and the monitor stay in lock-step.
  const traceGraph = useMemo(() => {
    if (!liveRunner) return undefined;
    try {
      return structureGraphFromRunner(liveRunner as Parameters<typeof structureGraphFromRunner>[0]);
    } catch {
      return undefined;
    }
  }, [liveRunner]);

  // Static STRUCTURE blueprint for the Flowchart tab — the agent ReAct
  // merge-tree (Context → slots → messageAPI → CallLLM → Route → loop),
  // rendered with the shared clean-centered-column strategy. No run needed; the
  // Lens/Trace tabs cover the live runtime. (These samples are ReAct agents.)
  const flowchartBlueprint = useMemo(() => buildAgentMergeTreeGraph(), []);

  // Runtime monitor (Lens) chart. Rendered through explain-ui's TracedFlow +
  // our merge-tree layout + StageNode colors via Lens's prop seam; Lens still
  // owns the slider / commentary / details shell + the time-travel reveal.
  //
  // CRITICAL for time-travel: once a run exists we feed the RUNNER'S REAL
  // structure (`structureGraphFromRunner` → node ids are the real
  // `[subflowPath/]stageId`). explain-ui's overlay strips only the
  // `#executionIndex` and matches the remainder against node.id, so the
  // execution path lights up automatically — same mechanism as the Trace tab,
  // zero mapping. Before a run we show the idealized flat blueprint as a
  // preview (no run to light yet).
  const lensChart = useMemo(
    () => ({
      graph: liveRunner ? structureGraphFromRunner(liveRunner as Parameters<typeof structureGraphFromRunner>[0]) : flowchartBlueprint,
      // Box-free layout for the runtime monitor (Lens has its own frame; the
      // main-chart box container interferes with TracedFlow's overlay scoping).
      layout: mergeTreeLayout,
      nodeTypes: MAIN_CHART_NODE_TYPES,
    }),
    [flowchartBlueprint, liveRunner],
  );

  return (
    <>
      {/* Sample title + description live in the top app-header bar (App.tsx
          SamplesToolbar) — no separate banner here. */}

      {/* Desktop: 2 resizable panels — Chat | Lens (live monitor).
          Steady-state view is "talk to it + watch it think". The heavier
          Code / Explain / Flowchart content opens on demand in a modal
          (toolbar buttons in the Chat panel). The ONLY collapse/expand is
          the app sidebar; panels here are drag-to-resize only. */}
      <div className="main-body desktop-panels sample-3panel">
        <Group orientation="horizontal" id="sample-2panel">
          {/* ── Panel 1: Chat (input + response stream) + modal toolbar ── */}
          <Panel defaultSize={42} minSize={22} id="chat">
            <div className="sample-result-panel">
              {/* Toolbar — opens the on-demand modal. No panel collapse. */}
              <div className="sample-chat-toolbar">
                {sample.explainer && (
                  <button
                    className="sample-chat-toolbar-btn"
                    onClick={() => openModal('explain')}
                    title="Open the explainer"
                  >
                    Explain
                  </button>
                )}
                <button
                  className="sample-chat-toolbar-btn"
                  onClick={() => openModal('code')}
                  title="Open the code"
                >
                  {'</>'} Code
                </button>
                <button
                  className="sample-chat-toolbar-btn"
                  onClick={() => openModal('flowchart')}
                  title="Open the flowchart"
                >
                  ⊞ Flowchart
                </button>
              </div>
              <ResultPanel
                history={chatHistory}
                running={running}
                pendingInput={input}
                onRun={handleRun}
                onInputChange={(v: string) => setInput(v)}
                onClear={() => setChatHistory([])}
                streamingResponse={streamingResponse}
                // ChatThinkKit subscribes to the same recorder Lens uses
                // and renders the bubble whenever selectThinkingState
                // returns a non-null state (idle / streaming / tool /
                // paused). Returns null between calls — the typing dots
                // fallback inside ResultPanel never reaches the user
                // once thinkKit becomes truthy.
                thinkKit={
                  <ChatThinkKit
                    recorder={lensRecorder}
                    version={lensRecorder.selectEventLog?.()?.length ?? 0}
                  />
                }
                hitlForm={
                  pausedOutcome ? (
                    <HitlPauseForm
                      pauseData={pausedOutcome.pauseData}
                      onSubmit={(answer) => { void handleResume(answer); }}
                      busy={running}
                    />
                  ) : null
                }
                providerPicker={
                  <ProviderPicker
                    value={providerKind}
                    onChange={setProviderKind}
                    onNeedsKey={onOpenSettings}
                  />
                }
              />
            </div>
          </Panel>

          <Separator className="sample-resize-handle" />

          {/* ── Panel 2: Lens — the live monitor. Lens/Trace tabs + a
                  Live/Replay mode badge. Live while a run is in flight;
                  Replay once it finishes (scrub a completed run). Offline
                  (load a saved run) is the named-but-future third mode. ── */}
          <Panel defaultSize={58} minSize={28} id="lens">
            <div className="sample-bts-panel">
              <div className="sample-observe-tabs">
                <button
                  className={`sample-observe-tab ${observeTab === 'lens' ? 'active' : ''}`}
                  onClick={() => setObserveTab('lens')}
                  title="Lens — agentfootprint-lens (agent-native view)"
                >
                  Lens
                </button>
                <button
                  className={`sample-observe-tab ${observeTab === 'trace' ? 'active' : ''}`}
                  onClick={() => setObserveTab('trace')}
                  title="Trace — footprint-explainable-ui (flowchart with snapshot scrubbing)"
                >
                  Trace
                </button>
                {/* Mode badge — the panel is a MONITOR. ● Live while a run
                    is in flight; ⏸ Replay once it finishes (you're scrubbing
                    a completed run). 📁 Offline (loaded saved run) is named
                    here but not yet built. Approximated from `running` +
                    whether a run has happened; refined when offline lands. */}
                <span
                  className={`sample-monitor-badge ${
                    running
                      ? 'is-live'
                      : monitorErrored
                        ? 'is-error'
                        : execution || liveRunner
                          ? 'is-replay'
                          : 'is-idle'
                  }`}
                  title={
                    running
                      ? 'Live — following the run in real time'
                      : monitorErrored
                        ? 'Error — the run failed'
                        : execution || liveRunner
                          ? 'Replay — scrubbing a finished run'
                          : 'Idle — run the sample to monitor it'
                  }
                >
                  {running
                    ? '● Live'
                    : monitorErrored
                      ? '✕ Error'
                      : execution || liveRunner
                        ? '⏸ Replay'
                        : '○ Idle'}
                </span>
              </div>

              {observeTab === 'lens' && (
                <div
                  style={{
                    flex: '1 1 auto',
                    height: 'auto',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <LensErrorBoundary>
                    <Lens
                      recorder={lensRecorder}
                      // L4: pass the live Runner captured from the
                      // sandbox (drives the runtime overlay + time-travel).
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      runner={liveRunner as any}
                      // Render the merge-tree we built (build-time chart) in
                      // the runtime monitor, via Lens's prop-driven chart seam.
                      chart={lensChart}
                      view="engineer"
                    />
                  </LensErrorBoundary>
                </div>
              )}

              {observeTab === 'trace' && (
                <div className="sample-observe-trace">
                  <label className="sample-observe-toggle">
                    <input
                      type="checkbox"
                      checked={showStageIds}
                      onChange={(e) => setShowStageIds(e.target.checked)}
                    />
                    <span>Show stage IDs</span>
                    <span className="sample-observe-toggle-hint">
                      recorders key per-stage data by{' '}
                      <code>runtimeStageId</code>
                    </span>
                  </label>
                  {spec && traceSnapshots.length > 0 ? (
                    <ExplainableShell
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      spec={spec as any}
                      snapshots={traceSnapshots}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      narrativeEntries={(execution?.narrativeEntries ?? []) as any}
                      recorderViews={traceRecorderViews}
                      showStageId={showStageIds}
                      traceGraph={traceGraph}
                    />
                  ) : (
                    <div className="sample-spec-empty">
                      <div className="sample-spec-empty-text">
                        {spec
                          ? 'Run the sample to populate the trace.'
                          : (<>Click <strong>Run</strong> to populate the trace</>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </Group>
      </div>

      {/* On-demand modal — Code / Explain / Flowchart. Opened by the Chat
          toolbar buttons; one focused overlay instead of a third column. */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ariaLabel="Sample detail"
        header={
          <div className="sample-modal-tabs">
            {sample.explainer && (
              <button
                className={`sample-modal-tab ${modalTab === 'explain' ? 'active' : ''}`}
                onClick={() => setModalTab('explain')}
              >
                Explain
              </button>
            )}
            <button
              className={`sample-modal-tab ${modalTab === 'code' ? 'active' : ''}`}
              onClick={() => setModalTab('code')}
            >
              {'</>'} Code
            </button>
            <button
              className={`sample-modal-tab ${modalTab === 'flowchart' ? 'active' : ''}`}
              onClick={() => setModalTab('flowchart')}
            >
              ⊞ Flowchart
            </button>
          </div>
        }
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {modalTab === 'code' && (
            <CodePanel code={code} onChange={isConceptSample ? undefined : setCode} />
          )}
          {modalTab === 'explain' && sample.explainer && (
            <SampleExplainer markdown={sample.explainer} />
          )}
          {modalTab === 'flowchart' && (
            <div className="sample-spec-view" style={{ height: '68vh', minHeight: 440 }}>
              {/* The agent's STATIC blueprint — real agentfootprint structure
                  rendered with the shared clean-centered-column strategy (the
                  same merge-tree as the collapser demo + live blueprint).
                  Replaces the old "being migrated" stub. */}
              <LensChart graph={flowchartBlueprint} outerKind="Agent" />
            </div>
          )}
        </div>
      </Modal>

      {/* Mobile: tab bar + single panel */}
      <div className="main-body mobile-panels">
        <div className="mobile-tab-bar">
          <button
            className={`mobile-tab ${mobileTab === 'code' ? 'active' : ''}`}
            onClick={() => setMobileTab('code')}
          >
            Code
          </button>
          <button
            className={`mobile-tab ${mobileTab === 'output' ? 'active' : ''}`}
            onClick={() => setMobileTab('output')}
          >
            Output
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {mobileTab === 'code' && (
            <CodePanel code={code} onChange={isConceptSample ? undefined : setCode} />
          )}
          {mobileTab === 'output' && (
            <ResultPanel
              history={chatHistory}
              running={running}
              pendingInput={input}
              onRun={handleRun}
              onInputChange={setInput}
              onClear={() => setChatHistory([])}
              thinkKit={<ChatThinkKit recorder={lensRecorder} version={lensRecorder.selectEventLog?.()?.length ?? 0} />}
              hitlForm={
                pausedOutcome ? (
                  <HitlPauseForm
                    pauseData={pausedOutcome.pauseData}
                    onSubmit={(answer) => { void handleResume(answer); }}
                    busy={running}
                  />
                ) : null
              }
            />
          )}
        </div>

        <div className="mobile-action-bar">
          <button
            className="mobile-action-btn run"
            onClick={handleRun}
            disabled={running}
          >
            {running ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>
    </>
  );
}
