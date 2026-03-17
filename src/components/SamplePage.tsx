import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { samples } from '../samples/catalog';
import { CodePanel } from './CodePanel';
import { ResultPanel } from './ResultPanel';
import { BehindTheScenes } from './BehindTheScenes';
import { executeCode } from '../runner/executeCode';
import type { ExecuteResult } from '../runner/executeCode';
import { loadApiKeys } from './SettingsPanel';

type View = 'code' | 'result' | 'bts';

export function SamplePage() {
  const { sampleId } = useParams<{ sampleId: string }>();
  const sample = samples.find((s) => s.id === sampleId);

  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState('Hello, how can you help me?');
  const [mobileView, setMobileView] = useState<View>('code');

  // Track the last valid execution so it survives re-runs
  const lastExecution = useRef(result?.execution ?? null);
  if (result?.execution) {
    lastExecution.current = result.execution;
  }

  // Reset all state when switching samples
  useEffect(() => {
    setResult(null);
    setRunning(false);
    setMobileView('code');
    lastExecution.current = null;
  }, [sampleId]);

  const handleRun = useCallback(async () => {
    if (!sample || running) return;
    setRunning(true);
    try {
      const keys = loadApiKeys();
      const res = await executeCode(sample.code, input, {
        anthropic: keys.anthropic || undefined,
        openai: keys.openai || undefined,
      });
      setResult(res);
      setMobileView('result'); // auto-switch to result on mobile
    } finally {
      setRunning(false);
    }
  }, [sample, input, running]);

  if (!sample) {
    return (
      <div className="welcome">
        <h2>Sample not found</h2>
        <p>No sample with id "{sampleId}". Pick one from the sidebar.</p>
      </div>
    );
  }

  const execution = result?.execution ?? lastExecution.current;
  const hasExecution = !!execution;

  // Behind the Scenes full-screen view
  if (mobileView === 'bts' && execution) {
    return (
      <div className="bts-fullscreen" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <BehindTheScenes
          execution={execution}
          onClose={() => setMobileView('result')}
        />
      </div>
    );
  }

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
        {/* Desktop: BTS button in header */}
        {hasExecution && (
          <button
            onClick={() => setMobileView('bts')}
            className="bts-button desktop-only"
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              animation: 'bts-appear 0.4s ease-out',
            }}
          >
            Behind the Scenes
          </button>
        )}
      </div>

      {/* Desktop: side-by-side code + result */}
      <div className="main-body desktop-panels">
        <CodePanel code={sample.code} />
        <ResultPanel
          result={result}
          running={running}
          onRun={handleRun}
          input={input}
          onInputChange={setInput}
        />
      </div>

      {/* Mobile: togglable code/result + contextual action button */}
      <div className="main-body mobile-panels">
        {/* Toggle tabs */}
        <div className="mobile-tab-bar">
          <button
            className={`mobile-tab ${mobileView === 'code' ? 'active' : ''}`}
            onClick={() => setMobileView('code')}
          >
            Code
          </button>
          <button
            className={`mobile-tab ${mobileView === 'result' ? 'active' : ''}`}
            onClick={() => setMobileView('result')}
          >
            Result
          </button>
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {mobileView === 'code' && <CodePanel code={sample.code} />}
          {mobileView === 'result' && (
            <ResultPanel
              result={result}
              running={running}
              onRun={handleRun}
              input={input}
              onInputChange={setInput}
            />
          )}
        </div>

        {/* Contextual action button */}
        <div className="mobile-action-bar">
          {hasExecution ? (
            <button className="mobile-action-btn bts" onClick={() => setMobileView('bts')}>
              Behind the Scenes
            </button>
          ) : (
            <button
              className="mobile-action-btn run"
              onClick={handleRun}
              disabled={running}
            >
              {running ? 'Running...' : 'Run'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
