import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SamplePage } from './components/SamplePage';
import { Welcome } from './components/Welcome';
import { Sidebar } from './components/Sidebar';
import '@xyflow/react/dist/style.css';
import './styles/global.css';

function useThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.classList.contains('light'));
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
  }, [light]);
  return [light, () => setLight((v) => !v)] as const;
}

function AppHeader() {
  const [light, toggle] = useThemeToggle();
  return (
    <header className="app-header">
      <span className="app-header-title">Agent Playground</span>
      <div className="app-header-links">
        <button
          onClick={toggle}
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
        <span className="app-header-sep">·</span>
        <a href="https://github.com/footprintjs/footPrint" target="_blank" rel="noopener noreferrer">footprintjs</a>
        <span className="app-header-sep">·</span>
        <a href="https://github.com/footprintjs/agentfootprint" target="_blank" rel="noopener noreferrer">agentfootprint</a>
      </div>
    </header>
  );
}

export function App() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <AppHeader />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/samples/:sampleId" element={<SamplePage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
