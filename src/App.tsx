import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { SamplePage } from './components/SamplePage';
import { Welcome } from './components/Welcome';
import { Sidebar } from './components/Sidebar';
import { LiveChatPage } from './components/live/LiveChatPage';
import { ViewerPage } from './components/viewer/ViewerPage';
import { SettingsPanel, loadApiKeys } from './components/SettingsPanel';
import { samples } from './samples/catalog';
import '@xyflow/react/dist/style.css';
import './styles/global.css';

function AutoOpenSettings({ onOpen }: { onOpen: () => void }) {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.includes('live-chat') || location.pathname === '/live') {
      const keys = loadApiKeys();
      const hasKeys = keys.anthropic.length > 0 || keys.openai.length > 0;
      if (!hasKeys) onOpen();
    }
  }, [location.pathname]);
  return null;
}

/** Samples layout — single full-width header strip across the top, then
 * a horizontal sidebar + main row below. CSS Grid drives the outer
 * shell (`.app--with-top-header`) so the sidebar's existing flex
 * styling (and main's children) are unaffected — only the *placement*
 * of the toolbar changed. Mirrors the footprintjs-playground header
 * pattern: brand on the left, current sample title in the middle,
 * nav links on the right, all in one strip. */
function SamplesLayout({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="app app--with-top-header">
      <SamplesToolbar onOpenSettings={onOpenSettings} />
      <Sidebar />
      <div className="main">
        <div className="main-content">
          <SamplePage />
        </div>
      </div>
    </div>
  );
}

function SamplesToolbar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [light, setLight] = useState(() => document.documentElement.classList.contains('light'));
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
  }, [light]);

  const keys = loadApiKeys();
  const hasKeys = keys.anthropic.length > 0 || keys.openai.length > 0;

  // Sidebar already carries the brand; the top bar shows the current sample
  // title + one-line description. Falls back to a bare "agentfootprint" when
  // no sample is selected (Welcome page).
  const navigate = useNavigate();
  const sampleMatch = useMatch('/samples/:sampleId');
  const currentSample = sampleMatch?.params.sampleId
    ? samples.find((s) => s.id === sampleMatch.params.sampleId)
    : undefined;

  return (
    <header className="app-header">
      {/* Brand block — replaces the sidebar's brand header so the top
          strip is the single source of identity for the app. */}
      <div className="app-header-brand" onClick={() => navigate('/')} role="button" tabIndex={0}>
        <span className="app-header-brand-title">agentfootprint</span>
        <span className="app-header-brand-attribution">powered by footprintjs</span>
      </div>

      {/* Current-sample title in the middle. Empty on the welcome page. */}
      {currentSample ? (
        <div className="app-header-sample">
          <span className="app-header-sample-title">
            {String(currentSample.number).padStart(2, '0')}. {currentSample.title}
          </span>
          <span className="app-header-sample-desc">{currentSample.description}</span>
        </div>
      ) : (
        <div className="app-header-sample" />
      )}
      <div className="app-header-links">
        <button
          onClick={() => navigate('/')}
          title="Home"
          aria-label="Home"
          className="app-header-home-btn"
        >
          Home
        </button>
        <span className="app-header-sep">&middot;</span>
        <button
          onClick={onOpenSettings}
          title="API key settings"
          aria-label="API key settings"
          className={`settings-btn ${hasKeys ? 'has-keys' : ''}`}
        >
          {hasKeys ? '\u26A1' : '\u2699'}
        </button>
        <span className="app-header-sep">&middot;</span>
        <button
          onClick={() => setLight((v) => !v)}
          title={light ? 'Switch to dark mode' : 'Switch to light mode'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 16,
            cursor: 'pointer',
            padding: '2px 4px',
            lineHeight: 1,
            transition: 'color 0.15s',
          }}
        >
          {light ? '\u263D' : '\u2600'}
        </button>
        <span className="app-header-sep">&middot;</span>
        <a href="https://github.com/footprintjs/footPrint" target="_blank" rel="noopener noreferrer">footprintjs</a>
        <span className="app-header-sep">&middot;</span>
        <a href="https://github.com/footprintjs/agentfootprint" target="_blank" rel="noopener noreferrer">agentfootprint</a>
      </div>
    </header>
  );
}

export function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <AutoOpenSettings onOpen={() => setShowSettings(true)} />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/live" element={<LiveChatPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        <Route
          path="/samples/:sampleId"
          element={<SamplesLayout onOpenSettings={() => setShowSettings(true)} />}
        />
      </Routes>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  );
}
