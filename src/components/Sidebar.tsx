import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getCategorizedSamples } from '../samples/catalog';
import type { SampleCategory } from '../samples/catalog';

/**
 * URL-mode aliases for URL stability across folder renames. Keep this
 * tiny — every entry is a promise we've made to existing links. Today's
 * only alias: `runtime` → `runtime-features` (the folder grew a suffix
 * but old `?mode=runtime` URLs shouldn't 404).
 */
const MODE_ALIAS: Record<string, string> = {
  runtime: 'runtime-features',
};

/**
 * Sub-layer mapping for `?mode=concepts` — the canonical 5-layer
 * taxonomy (Primitives / Compositions / Patterns / Context Engineering)
 * lives at the DISPLAY layer. The library's `examples/concepts/` folder
 * still contains all 7 samples flat (LLM, Agent, RAG, FlowChart,
 * Parallel, Conditional, Swarm). We sub-split at render time so the
 * sidebar teaches the taxonomy without requiring a library-side folder
 * refactor. Sample IDs not listed here fall through to "Concepts" as
 * before.
 */
const CONCEPT_SAMPLE_LAYER: Record<string, 'Primitives' | 'Compositions' | 'Patterns' | 'Context Engineering'> = {
  'llm-call': 'Primitives',
  'agent': 'Primitives',
  'agent-with-tools': 'Primitives',
  'flowchart': 'Compositions',
  'flowchart-sequential': 'Compositions',
  'parallel': 'Compositions',
  'parallel-execution': 'Compositions',
  'conditional': 'Compositions',
  'conditional-triage': 'Compositions',
  'swarm': 'Patterns',
  'swarm-delegation': 'Patterns',
  'rag': 'Context Engineering',
  'rag-retrieval': 'Context Engineering',
};
const LAYER_ORDER = ['Primitives', 'Compositions', 'Patterns', 'Context Engineering', 'Concepts'] as const;

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const allCategories = getCategorizedSamples();
  const [mobileOpen, setMobileOpen] = useState(false);

  // URL mode = the category's folder name (from agentfootprint/examples/<folder>).
  // Unknown / no mode → show everything (safe default for direct URLs).
  const rawMode = searchParams.get('mode');
  const mode = rawMode ? (MODE_ALIAS[rawMode] ?? rawMode) : null;

  const categories = useMemo<SampleCategory[]>(() => {
    if (!mode) return allCategories;
    const filtered = allCategories.filter((cat) => cat.group === mode);
    // If the mode matched no category, fall through to "show all" rather
    // than leave the user with an empty sidebar.
    if (filtered.length === 0) return allCategories;

    // Special case: concepts mode sub-splits into the 5-layer taxonomy
    // (Primitives / Compositions / Patterns / Context Engineering). The
    // library keeps all 7 concept samples in one folder; the sidebar
    // teaches the taxonomy at the display layer.
    if (mode === 'concepts') {
      const buckets = new Map<string, SampleCategory['samples'][number][]>();
      for (const cat of filtered) {
        for (const s of cat.samples) {
          const layer = CONCEPT_SAMPLE_LAYER[s.id] ?? 'Concepts';
          if (!buckets.has(layer)) buckets.set(layer, []);
          buckets.get(layer)!.push(s);
        }
      }
      return LAYER_ORDER
        .filter((name) => buckets.has(name))
        .map((name) => ({
          name,
          samples: buckets.get(name)!,
          group: 'concepts',
        }));
    }

    return filtered;
  }, [allCategories, mode]);

  // Extract sampleId from current path
  const match = location.pathname.match(/\/samples\/([^/]+)/);
  const activeSampleId = match?.[1] ?? null;

  const handleNavigate = (sampleId: string) => {
    // Preserve the mode param (using the raw URL form, not the aliased
    // internal form) when navigating between samples.
    const modeParam = rawMode ? `?mode=${rawMode}` : '';
    navigate(`/samples/${sampleId}${modeParam}`);
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
        {mobileOpen ? '\u2715' : '\u2630'}
      </button>

      {/* Overlay backdrop */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
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
