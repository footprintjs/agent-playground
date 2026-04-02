import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { SamplePage } from './components/SamplePage';
import { Welcome } from './components/Welcome';
import { Sidebar } from './components/Sidebar';
import { LiveChatPage } from './components/live/LiveChatPage';
import { SettingsPanel, loadApiKeys } from './components/SettingsPanel';
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

/** Samples layout — sidebar + sample page */
function SamplesLayout({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <SamplesToolbar onOpenSettings={onOpenSettings} />
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

  return (
    <header className="app-header">
      <span className="app-header-title">Agent Playground</span>
      <div className="app-header-links">
        <button
          onClick={onOpenSettings}
          title="API key settings"
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
        <Route
          path="/samples/:sampleId"
          element={<SamplesLayout onOpenSettings={() => setShowSettings(true)} />}
        />
      </Routes>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  );
}
