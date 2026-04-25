import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { samples } from '../samples/catalog';
import { CodePanel } from './CodePanel';
import { ResultPanel } from './ResultPanel';
import { ChatThinkKit } from './ChatThinkKit';
import { SampleExplainer } from './SampleExplainer';
import { TracedFlowchartView } from 'footprint-explainable-ui/flowchart';
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
type LeftView = 'code' | 'flowchart' | 'explain' | '3renderers';

export function SamplePage() {
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

  // Reset all state when switching samples
  useEffect(() => {
    setCode(sample?.code ?? '');
    setChatHistory([]);
    setStreamingResponse('');
    setLiveSnapshot(null);
    setLiveSpec(null);
    setLiveTopology(null);
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
      setChatHistory((prev) => [...prev, { input: capturedInput, result: res }]);
      // Lens column auto-renders the trace once execution lands.
    } finally {
      setRunning(false);
    }
  }, [sample, code, input, running, providerKind]);

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
                    className={`sample-left-tab ${leftView === '3renderers' ? 'active' : ''}`}
                    onClick={() => setLeftView('3renderers')}
                    title="One recorder, three renderers — engineer/analyst/user views"
                  >
                    3 Views
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
                  {leftView === '3renderers' && (
                    // 3-renderers demo was coupled to the older Lens
                    // timeline shape; the current Lens exposes
                    // recorder.selectRunTree() / selectEventLog() /
                    // selectSummary() instead. Tab kept for a future
                    // rewrite over the new selectors.
                    <div style={{ padding: 16, color: 'var(--text-muted)' }}>
                      3-renderers demo pending Lens selector rewrite.
                    </div>
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Separator disabled className="sample-resize-handle" />

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
                  thinkKit={null}
                  providerPicker={
                    <ProviderPicker value={providerKind} onChange={setProviderKind} />
                  }
                />
              </div>
            )}
          </Panel>

          <Separator disabled className="sample-resize-handle" />

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
                {/* Lens — same agentfootprint-lens component Neo uses. We
                    feed it a live `timeline` via useLiveTimeline (ingested
                    from AgentStreamEvents during the run) and the post-run
                    snapshot so the Trace tab lights up after completion.
                    Mock and real providers both populate Lens identically
                    because the emit channel fires the same events. */}
                {/* Lens — single-prop API: pass the recorder that
                    observed the run. The recorder derives RunTree + Event
                    Log + Summary lazily via its selectors; each turn of
                    runner execution updates the recorder in place. */}
                <Lens
                  recorder={lensRecorder}
                  // StepGraph from runner.enable.flowchart() — pushed via
                  // onLiveTopology during the run. Lens re-renders the
                  // React Flow graph each time this changes.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  stepGraph={liveTopology as any}
                  view="engineer"
                />
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
