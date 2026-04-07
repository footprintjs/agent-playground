import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getCategorizedSamples } from '../samples/catalog';
import type { SampleCategory } from '../samples/catalog';

/** Sample IDs that represent the 6 core concepts. */
const CONCEPT_IDS = new Set([
  'simple-llm-call',      // LLMCall
  'agent-with-tools',     // Agent
  'rag-retrieval',        // RAG
  'flowchart-sequential', // FlowChart
  'swarm-delegation',     // Swarm
  'parallel-execution',   // Parallel
]);

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const allCategories = getCategorizedSamples();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Determine mode from query param
  const mode = searchParams.get('mode') as 'concepts' | 'features' | null;

  // Filter categories based on mode
  const categories = useMemo<SampleCategory[]>(() => {
    if (mode === 'concepts') {
      // Show concept samples grouped by Single LLM / Multi-Agent
      return allCategories
        .filter((cat) => cat.name === 'Single LLM' || cat.name === 'Multi-Agent')
        .map((cat) => ({
          ...cat,
          samples: cat.samples.filter((s) => CONCEPT_IDS.has(s.id)),
        }))
        .filter((cat) => cat.samples.length > 0);
    }
    if (mode === 'features') {
      // Show everything EXCEPT the concept samples
      return allCategories
        .map((cat) => ({
          ...cat,
          samples: cat.samples.filter((s) => !CONCEPT_IDS.has(s.id)),
        }))
        .filter((cat) => cat.samples.length > 0);
    }
    // No mode = show all (direct URL access)
    return allCategories;
  }, [allCategories, mode]);

  // Extract sampleId from current path
  const match = location.pathname.match(/\/samples\/([^/]+)/);
  const activeSampleId = match?.[1] ?? null;

  const handleNavigate = (sampleId: string) => {
    // Preserve the mode param when navigating between samples
    const modeParam = mode ? `?mode=${mode}` : '';
    navigate(`/samples/${sampleId}${modeParam}`);
    setMobileOpen(false);
  };

  const modeLabel = mode === 'concepts' ? 'Concept Ladder' : mode === 'features' ? 'Feature Playground' : 'All Samples';

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="sidebar-hamburger"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? '\u2715' : '\u2630'}
      </button>

      {/* Overlay backdrop */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            Agent Playground
          </h1>
          <p>{modeLabel}</p>
          <button
            className="sidebar-home-btn"
            onClick={() => navigate('/')}
          >
            Home
          </button>
        </div>
        <div className="sidebar-list">
          {categories.map((cat) => (
            <div key={cat.name}>
              <div className="sidebar-category">{cat.name}</div>
              {cat.samples.map((sample, idx) => (
                <button
                  key={sample.id}
                  className={`sidebar-item ${activeSampleId === sample.id ? 'active' : ''}`}
                  onClick={() => handleNavigate(sample.id)}
                >
                  <span className="number">
                    {mode ? String(idx + 1).padStart(2, '0') : String(sample.number).padStart(2, '0')}
                  </span>
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
