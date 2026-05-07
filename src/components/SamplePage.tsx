import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { samples } from '../samples/catalog';
import { CodePanel } from './CodePanel';
import { ResultPanel } from './ResultPanel';
import { HitlPauseForm } from './HitlPauseForm';
import { ChatThinkKit } from './ChatThinkKit';
import { SampleExplainer } from './SampleExplainer';
import { TracedFlowchartView } from 'footprint-explainable-ui/flowchart';
import { ExplainableShell } from 'footprint-explainable-ui';
import type { ThemeTokens } from 'footprint-explainable-ui';
import { Lens, LensRecorder } from 'agentfootprint-lens';
import { ThreeRenderersDemo } from './ThreeRenderersDemo';

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
import { Panel, Group, Separator, usePanelRef } from 'react-resizable-panels';
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

  // Imperative refs into react-resizable-panels v4 for the collapse/expand
  // buttons on each column header. .collapse() / .expand() let users
  // toggle a panel between full width and a thin strip.
  const tabsPanelRef = usePanelRef();
  const chatPanelRef = usePanelRef();
  const lensPanelRef = usePanelRef();

  // Per-panel collapse state — drives whether each panel renders its
  // normal content + collapse button, or a clickable "expand strip"
  // overlay (a thin vertical bar with an arrow). The two pieces of
  // state stay in sync because the collapse button sets it true AND
  // calls panelRef.collapse(); the strip's click does the inverse.
  const [tabsCollapsed, setTabsCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [lensCollapsed, setLensCollapsed] = useState(false);
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

  // Left panel: code or flowchart spec toggle
  const [leftView, setLeftView] = useState<LeftView>('code');

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

  // Lens recorder. Each Run click creates a fresh recorder (so
  // RunTree / EventLog / Summary reset between turns), observes the
  // outermost runner through the sandbox, and is then handed to the
  // Lens component via state so React re-renders with the populated
  // recorder once events accumulate.
  const [lensRecorder, setLensRecorder] = useState<LensRecorder>(() => new LensRecorder());

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
    setPausedOutcome(null); // HITL form is sample-scoped — clear on swap
    // Swap in a fresh LensRecorder so prior-sample events don't leak.
    setLensRecorder(new LensRecorder());
    setRunning(false);
    // Default to Explain when the sample has one — read first, then shape,
    // then code. Falls back to Code for the inline samples that have no .md.
    setLeftView(sample?.explainer ? 'explain' : 'code');
    setTabsCollapsed(false);
    setChatCollapsed(false);
    setLensCollapsed(false);
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
      setPausedOutcome(null); // any prior pause is cleared on a new Run
      const freshRecorder = new LensRecorder();
      setLensRecorder(freshRecorder);
      const res = await executeCode(code, capturedInput, apiKeys, built.provider, {
        onStreamToken: (token) => setStreamingResponse((prev) => prev + token),
        onLiveSnapshot: (snap) => setLiveSnapshot(snap),
        onLiveSpec: (spec) => setLiveSpec(spec),
        onLiveTopology: (topo) => setLiveTopology(topo),
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
  // Prefer the finalized spec from the last completed turn; fall back to
  // the live spec emitted at run-start so the Flowchart panel renders
  // the tree while execution streams in.
  const spec = execution?.spec ?? liveSpec ?? null;

  return (
    <>
      {/* Sample title + description live in the top app-header bar (App.tsx
          SamplesToolbar) — no separate banner here. */}

      {/* Desktop: 3 resizable columns — Tabs | Chat | Observability(Lens).
          All three are visible from the start. Each panel has a collapse/
          expand button in its header. Drag handles between panels. The
          Lens column shows an empty-state until the first run, then
          surfaces the live trace + explain trace post-execution. */}
      <div className="main-body desktop-panels sample-3panel">
        <Group orientation="horizontal" id="sample-3panel">
          {/* ── Column 1: Tabs (Explain / Flowchart / Code) ── */}
          <Panel
            panelRef={tabsPanelRef}
            defaultSize={42}
            minSize={20}
            collapsible
            collapsedSize="14px"
            id="tabs"
          >
            {tabsCollapsed ? (
              <button
                className="sample-panel-expand-strip"
                onClick={() => {
                  tabsPanelRef.current?.expand();
                  setTabsCollapsed(false);
                }}
                title="Expand panel"
                aria-label="Expand panel"
              >
                <span className="sample-panel-expand-strip-icon">⇥</span>
                <span className="sample-panel-expand-strip-label">Tabs</span>
              </button>
            ) : (
              <div className="sample-left-panel">
                <div className="sample-left-tabs">
                  {sample.explainer && (
                    <button
                      className={`sample-left-tab ${leftView === 'explain' ? 'active' : ''}`}
                      onClick={() => setLeftView('explain')}
                    >
                      Explain
                    </button>
                  )}
                  <button
                    className={`sample-left-tab ${leftView === 'flowchart' ? 'active' : ''}`}
                    onClick={() => setLeftView('flowchart')}
                  >
                    Flowchart
                  </button>
                  <button
                    className={`sample-left-tab ${leftView === 'code' ? 'active' : ''}`}
                    onClick={() => setLeftView('code')}
                  >
                    {'</>'}  Code
                  </button>
                  <button
                    className="sample-panel-collapse-btn"
                    onClick={() => {
                      tabsPanelRef.current?.collapse();
                      setTabsCollapsed(true);
                    }}
                    title="Collapse panel"
                    aria-label="Collapse panel"
                  >
                    ⇤
                  </button>
                </div>
                <div className="sample-left-content">
                  {leftView === 'code' && (
                    <CodePanel code={code} onChange={isConceptSample ? undefined : setCode} />
                  )}
                  {leftView === 'flowchart' && (
                    <div className="sample-spec-view">
                      {spec ? (
                        <TracedFlowchartView
                          spec={spec as any}
                          snapshots={[]}
                          snapshotIndex={-1}
                        />
                      ) : (
                        <div className="sample-spec-empty">
                          <div className="sample-spec-empty-text">
                            Click <strong>Run</strong> to generate the flowchart spec
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {leftView === 'explain' && sample.explainer && (
                    <SampleExplainer markdown={sample.explainer} />
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Separator className="sample-resize-handle" />

          {/* ── Column 2: Chat (input + response stream) ── */}
          <Panel
            panelRef={chatPanelRef}
            defaultSize={28}
            minSize={18}
            collapsible
            collapsedSize="14px"
            id="chat"
          >
            {chatCollapsed ? (
              <button
                className="sample-panel-expand-strip"
                onClick={() => {
                  chatPanelRef.current?.expand();
                  setChatCollapsed(false);
                }}
                title="Expand chat"
                aria-label="Expand chat"
              >
                <span className="sample-panel-expand-strip-icon">⇥</span>
                <span className="sample-panel-expand-strip-label">Chat</span>
              </button>
            ) : (
              <div className="sample-result-panel">
                <button
                  className="sample-panel-collapse-btn sample-panel-collapse-btn--floating"
                  onClick={() => {
                    chatPanelRef.current?.collapse();
                    setChatCollapsed(true);
                  }}
                  title="Collapse chat"
                  aria-label="Collapse chat"
                >
                  ⇤
                </button>
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
            )}
          </Panel>

          <Separator className="sample-resize-handle" />

          {/* ── Column 3: Observability (Lens). Always visible, with an
                  empty state pre-run; shows live trace + explain trace
                  post-run via agentfootprint-lens. ── */}
          <Panel
            panelRef={lensPanelRef}
            defaultSize={30}
            minSize={20}
            collapsible
            collapsedSize="14px"
            id="lens"
          >
            {lensCollapsed ? (
              <button
                className="sample-panel-expand-strip"
                onClick={() => {
                  lensPanelRef.current?.expand();
                  setLensCollapsed(false);
                }}
                title="Expand observability"
                aria-label="Expand observability"
              >
                <span className="sample-panel-expand-strip-icon">⇥</span>
                <span className="sample-panel-expand-strip-label">Observability</span>
              </button>
            ) : (
              <div className="sample-bts-panel">
                <button
                  className="sample-panel-collapse-btn sample-panel-collapse-btn--floating"
                  onClick={() => {
                    lensPanelRef.current?.collapse();
                    setLensCollapsed(true);
                  }}
                  title="Collapse observability"
                  aria-label="Collapse observability"
                >
                  ⇤
                </button>
                {/* Tab strip: pick which renderer to show.
                    Lens is the agent-native view; Trace renders the
                    same snapshot through footprint-explainable-ui so
                    consumers can compare both layers against the same
                    underlying data. */}
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
                </div>

                {observeTab === 'lens' && (
                  <Lens
                    recorder={lensRecorder}
                    // StepGraph from runner.enable.flowchart() — pushed via
                    // onLiveTopology during the run. Lens re-renders the
                    // React Flow graph each time this changes.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    stepGraph={liveTopology as any}
                    view="engineer"
                  />
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
                    {spec ? (
                      <ExplainableShell
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        spec={spec as any}
                        // Raw runtime snapshot — ExplainableShell calls
                        // toVisualizationSnapshots() internally to derive
                        // the per-stage scrub array. Pair with
                        // narrativeEntries below for rich per-stage text
                        // alongside the time slider + commit log.
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        runtimeSnapshot={(execution?.snapshot ?? liveSnapshot) as any}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        narrativeEntries={(execution?.narrativeEntries ?? []) as any}
                        showStageId={showStageIds}
                      />
                    ) : (
                      <div className="sample-spec-empty">
                        <div className="sample-spec-empty-text">
                          Click <strong>Run</strong> to populate the trace
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </Group>
      </div>

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
