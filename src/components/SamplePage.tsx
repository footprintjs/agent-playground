import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { samples } from '../samples/catalog';
import { CodePanel } from './CodePanel';
import { ResultPanel } from './ResultPanel';
import { BTSPanel } from './live/BTSPanel';
import { executeCode } from '../runner/executeCode';
import { loadApiKeys } from './SettingsPanel';
import { useDragResize } from './live/useDragResize';
import type { ChatTurn } from './ResultPanel';

type MobileTab = 'code' | 'output' | 'bts';

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

  // BTS panel state
  const [btsCollapsed, setBtsCollapsed] = useState(false);
  const [btsWidth, setBtsWidth] = useState(420);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<MobileTab>('code');

  // Reset all state when switching samples
  useEffect(() => {
    setCode(sample?.code ?? '');
    setChatHistory([]);
    setRunning(false);
    setMobileTab('code');
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
      setMobileTab('output');
      // Auto-expand BTS when first execution arrives
      if (btsCollapsed) setBtsCollapsed(false);
    } finally {
      setRunning(false);
    }
  }, [sample, code, input, running, btsCollapsed]);

  // Drag resize for BTS panel
  const dragHandle = useDragResize({
    initialWidth: btsWidth,
    minWidth: 240,
    maxWidth: 900,
    direction: 'left',
    onResize: setBtsWidth,
    onCollapse: () => setBtsCollapsed(true),
  });

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
        {/* Desktop: BTS toggle */}
        <button
          onClick={() => setBtsCollapsed(!btsCollapsed)}
          className="bts-toggle-btn desktop-only"
          style={{
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 600,
            background: btsCollapsed ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: btsCollapsed ? 'var(--text-secondary)' : '#1a1a2e',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {btsCollapsed ? 'Show BTS' : 'Behind the Scenes'}
        </button>
      </div>

      {/* Desktop: 3-panel layout — Code+Result | Drag | BTS */}
      <div className="main-body desktop-panels sample-3panel">
        <div className="sample-code-result" style={{ flex: 1, minWidth: 0 }}>
          <CodePanel code={code} onChange={isConceptSample ? undefined : setCode} />
          <ResultPanel
            history={chatHistory}
            running={running}
            pendingInput={input}
            onRun={handleRun}
            onInputChange={setInput}
            onClear={() => setChatHistory([])}
          />
        </div>

        {!btsCollapsed && (
          <>
            <div
              className="sample-drag-handle"
              onMouseDown={dragHandle.onMouseDown}
            />
            <div style={{ width: btsWidth, minWidth: 240, flexShrink: 0 }}>
              <BTSPanel
                execution={execution}
                previewSpec={spec}
                collapsed={false}
                onToggleCollapse={() => setBtsCollapsed(true)}
              />
            </div>
          </>
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

        {/* Mobile action bar */}
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
