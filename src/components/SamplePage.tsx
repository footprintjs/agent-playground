import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { samples } from '../samples/catalog';
import { CodePanel } from './CodePanel';
import { ResultPanel } from './ResultPanel';
import { BTSPanel } from './live/BTSPanel';
import { TracedFlowchartView } from 'footprint-explainable-ui/flowchart';
import { executeCode } from '../runner/executeCode';
import { loadApiKeys } from './SettingsPanel';
import type { ChatTurn } from './ResultPanel';

type MobileTab = 'code' | 'output' | 'bts';
type LeftView = 'code' | 'flowchart';

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

  // Left panel: code or flowchart spec toggle
  const [leftView, setLeftView] = useState<LeftView>('code');

  // Right panel: BTS (opens after run with animation)
  const [btsOpen, setBtsOpen] = useState(false);
  const [codeCollapsed, setCodeCollapsed] = useState(false);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<MobileTab>('code');

  // Reset all state when switching samples
  useEffect(() => {
    setCode(sample?.code ?? '');
    setChatHistory([]);
    setRunning(false);
    setLeftView('code');
    setBtsOpen(false);
    setCodeCollapsed(false);
    setMobileTab('code');

    // Auto-run on load for concept samples — mock-based, instant, $0
    // This makes the flowchart spec available immediately
    if (sample && isConceptSample) {
      const autoRun = async () => {
        const keys = loadApiKeys();
        const res = await executeCode(sample.code, 'Hello, how can you help me?', {
          anthropic: keys.anthropic || undefined,
          openai: keys.openai || undefined,
        });
        setChatHistory([{ input: 'Hello, how can you help me?', result: res }]);
      };
      autoRun();
    }
  }, [sampleId]);

  const handleRun = useCallback(async () => {
    if (!sample || running) return;
    const capturedInput = input;
    setRunning(true);
    try {
      const keys = loadApiKeys();
      const res = await executeCode(code, capturedInput, {
        anthropic: keys.anthropic || undefined,
        openai: keys.openai || undefined,
      });
      setChatHistory((prev) => [...prev, { input: capturedInput, result: res }]);

      // Choreography: collapse code, open BTS
      setCodeCollapsed(true);
      setBtsOpen(true);
      setMobileTab('bts');
    } finally {
      setRunning(false);
    }
  }, [sample, code, input, running]);

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
  const spec = execution?.spec ?? null;

  return (
    <>
      {/* Sample header */}
      <div className="sample-header">
        <div className="sample-header-info">
          <h2>
            {String(sample.number).padStart(2, '0')}. {sample.title}
          </h2>
          <div className="description">{sample.description}</div>
        </div>
      </div>

      {/* Desktop: Left (Code/Spec) | Result | BTS (after run) */}
      <div className="main-body desktop-panels sample-3panel">
        {/* Left panel: Code ↔ Flowchart Spec */}
        <div className={`sample-left-panel ${codeCollapsed ? 'sample-left-panel--collapsed' : ''}`}>
          {codeCollapsed ? (
            <div
              className="sample-collapsed-strip"
              onClick={() => { setCodeCollapsed(false); setBtsOpen(false); }}
            >
              <span className="sample-collapsed-icon">{'</>'}</span>
              <span>Code</span>
            </div>
          ) : (
            <>
              <div className="sample-left-tabs">
                <button
                  className={`sample-left-tab ${leftView === 'code' ? 'active' : ''}`}
                  onClick={() => setLeftView('code')}
                >
                  {'</>'}  Code
                </button>
                <button
                  className={`sample-left-tab ${leftView === 'flowchart' ? 'active' : ''}`}
                  onClick={() => setLeftView('flowchart')}
                >
                  Flowchart
                </button>
                {execution && !btsOpen && (
                  <button
                    className="sample-left-tab sample-bts-tab"
                    onClick={() => { setCodeCollapsed(true); setBtsOpen(true); }}
                  >
                    BTS
                  </button>
                )}
              </div>
              <div className="sample-left-content">
                {leftView === 'code' ? (
                  <CodePanel code={code} onChange={isConceptSample ? undefined : setCode} />
                ) : (
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
              </div>
            </>
          )}
        </div>

        {/* Result panel */}
        <div className="sample-result-panel">
          <ResultPanel
            history={chatHistory}
            running={running}
            pendingInput={input}
            onRun={handleRun}
            onInputChange={setInput}
            onClear={() => setChatHistory([])}
          />
        </div>

        {/* BTS panel — slides in after run */}
        {btsOpen && execution && (
          <div className="sample-bts-panel">
            <BTSPanel
              execution={execution}
              previewSpec={spec}
              collapsed={false}
              onToggleCollapse={() => { setBtsOpen(false); setCodeCollapsed(false); }}
            />
          </div>
        )}
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
          <button
            className={`mobile-tab ${mobileTab === 'bts' ? 'active' : ''}`}
            onClick={() => setMobileTab('bts')}
          >
            BTS
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
            />
          )}
          {mobileTab === 'bts' && (
            <div style={{ height: '100%' }}>
              <BTSPanel
                execution={execution}
                previewSpec={spec}
                collapsed={false}
                onToggleCollapse={() => setMobileTab('output')}
              />
            </div>
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
