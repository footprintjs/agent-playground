import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCategorizedSamples } from '../samples/catalog';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const categories = getCategorizedSamples();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Extract sampleId from current path
  const match = location.pathname.match(/\/samples\/([^/]+)/);
  const activeSampleId = match?.[1] ?? null;

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="sidebar-hamburger"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Overlay backdrop */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <h1 onClick={() => handleNavigate('/')} style={{ cursor: 'pointer' }}>
            Agent Playground
          </h1>
          <p>agentfootprint interactive samples</p>
          <button
            className="sidebar-home-btn"
            onClick={() => handleNavigate('/')}
          >
            Home
          </button>
        </div>
        <div className="sidebar-list">
          {categories.map((cat) => (
            <div key={cat.name}>
              <div className="sidebar-category">{cat.name}</div>
              {cat.samples.map((sample) => (
                <button
                  key={sample.id}
                  className={`sidebar-item ${activeSampleId === sample.id ? 'active' : ''}`}
                  onClick={() => handleNavigate(`/samples/${sample.id}`)}
                >
                  <span className="number">{String(sample.number).padStart(2, '0')}</span>
                  <span>{sample.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
