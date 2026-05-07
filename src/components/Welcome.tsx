import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function useThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.classList.contains('light'));
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
  }, [light]);
  return [light, () => setLight((v) => !v)] as const;
}

/**
 * Chip-grid card contents. Each `categories` array drives one card's
 * chip grid. Cards reflect the canonical taxonomy:
 *
 *   1. Primitives          — LLM, Agent (Classic / Dynamic)
 *   2. Control Flows       — Sequence, Parallel, Conditional, Loop
 *   3. Patterns            — recipes we provide on top of primitives
 *   4. Context Engineering — what you inject into Agent slots
 *   5. Features            — production-grade governance & safety
 *
 * Every `mode` is the example's folder name in agentfootprint/examples/.
 * URL = `/samples/<sample-id>?mode=<folder>`. Sidebar filters by
 * `cat.group === mode`. Adding a new folder works if you drop a chip in.
 */
// Two primitives — LLM + Agent (= ReAct). Agent has two modes: Static
// (fixed toolset every iter) and Dynamic (tools/context narrow per iter
// via autoActivate). Patterns BELOW are compositions on top of these
// — they are NOT Agent modes.
const PRIMITIVE_CATEGORIES = [
  { mode: 'core',          label: 'LLM',             sample: 'llm-call',      desc: 'One-shot LLM primitive' },
  { mode: 'dynamic-react', label: 'Agent · Static',  sample: 'classic-react', desc: 'ReAct — fixed toolset' },
  { mode: 'dynamic-react', label: 'Agent · Dynamic', sample: 'dynamic-react', desc: 'ReAct — tools narrow per iter' },
];

const CONTROL_FLOW_CATEGORIES = [
  { mode: 'core-flow', label: 'Sequence',    sample: 'sequence',    desc: 'Linear pipeline' },
  { mode: 'core-flow', label: 'Parallel',    sample: 'parallel',    desc: 'Fan-out + merge' },
  { mode: 'core-flow', label: 'Conditional', sample: 'conditional', desc: 'Predicate routing' },
  { mode: 'core-flow', label: 'Loop',        sample: 'loop',        desc: 'Bounded iteration' },
];

const PATTERN_CATEGORIES = [
  { mode: 'patterns', label: 'Self-Consistency', sample: 'self-consistency', desc: 'Sample N, vote (Wang 2022)' },
  { mode: 'patterns', label: 'Reflection',       sample: 'reflection',       desc: 'Self-Refine (Madaan 2023)' },
  { mode: 'patterns', label: 'Debate',           sample: 'debate',           desc: 'Multi-Agent Debate (Du 2023)' },
  { mode: 'patterns', label: 'MapReduce',        sample: 'map-reduce',       desc: 'Split → summarize → combine' },
  { mode: 'patterns', label: 'Tree of Thoughts', sample: 'tot',              desc: 'Branch + evaluate (Yao 2023)' },
  { mode: 'patterns', label: 'Swarm',            sample: 'swarm',            desc: 'Multi-agent handoff' },
];

const CONTEXT_CATEGORIES = [
  { mode: 'context-engineering', label: 'Skills',       sample: 'skill',         desc: 'Activate → prompt + tools' },
  { mode: 'context-engineering', label: 'RAG',          sample: 'rag',           desc: 'Retrieved chunks → messages' },
  { mode: 'memory',              label: 'Memory',       sample: 'window-strategy', desc: 'Window / budget / summarize / topK' },
  { mode: 'context-engineering', label: 'Steering',     sample: 'steering',      desc: 'Always-on system rule' },
  { mode: 'context-engineering', label: 'Instructions', sample: 'instruction',   desc: 'Activate-when system rule' },
  { mode: 'context-engineering', label: 'Dynamic ReAct', sample: 'dynamic-react', desc: 'Context morphs each iter' },
];

const FEATURE_CATEGORIES = [
  { mode: 'features', label: 'Resilience',       sample: 'reliability',     desc: 'Retry / fallback / circuit breaker' },
  { mode: 'features', label: 'HITL',             sample: 'pause-resume',    desc: 'Pause / resume — human-in-the-loop' },
  { mode: 'features', label: 'Permissions',      sample: 'permissions',     desc: 'Tool-call gating' },
  { mode: 'features', label: 'Sequence policy',  sample: 'sequence-policy', desc: 'Sequence-aware governance' },
  { mode: 'features', label: 'Output schema',    sample: 'strict-output',   desc: 'Instructor-style retry' },
  { mode: 'features', label: 'Observability',    sample: 'observability',   desc: 'Recorders, metrics, traces' },
];

const CARDS = [
  {
    phase: 'build' as const,
    icon: '\uD83E\uDDE0',
    title: 'Primitives',
    desc: 'Two atomic building blocks: LLM and Agent (ReAct). Agent runs in Static or Dynamic mode. Everything else is a composition.',
    cta: null,
    to: null,
    categories: PRIMITIVE_CATEGORIES,
  },
  {
    phase: 'build' as const,
    icon: '\u21AA\uFE0F',
    title: 'Control Flows',
    desc: 'How primitives compose. Same shape as the agent loop \u2014 reusable for any pipeline.',
    cta: null,
    to: null,
    categories: CONTROL_FLOW_CATEGORIES,
  },
  {
    phase: 'build' as const,
    icon: '\uD83D\uDD01',
    title: 'Patterns',
    desc: 'Named recipes we provide on top of the primitives \u2014 each links to the canonical paper.',
    cta: null,
    to: null,
    categories: PATTERN_CATEGORIES,
  },
  {
    phase: 'build' as const,
    icon: '\uD83E\uDDE9',
    title: 'Context Engineering',
    desc: 'What you inject into the Agent\u2019s slots. The library\u2019s teaching thesis \u2014 visible as tagged injections in Lens.',
    cta: null,
    to: null,
    categories: CONTEXT_CATEGORIES,
  },
  {
    phase: 'execute' as const,
    icon: '\u26A1',
    title: 'Features',
    desc: 'Production-grade governance \u2014 resilience, HITL, permissions, output schema, sequence policy, observability.',
    cta: null,
    to: null,
    categories: FEATURE_CATEGORIES,
  },
];

const PHASE_COLORS: Record<string, { color: string; dim: string; border: string }> = {
  build: { color: '#facc15', dim: 'rgba(250,204,21,0.08)', border: 'rgba(250,204,21,0.25)' },
  execute: { color: '#f59e0b', dim: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
  observe: { color: '#10b981', dim: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
};

export function Welcome() {
  const [light, toggle] = useThemeToggle();

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        gap: 32,
        background: 'var(--bg-primary)',
      }}
    >
      {/* Theme toggle — top right */}
      <button
        onClick={toggle}
        title={light ? 'Switch to dark mode' : 'Switch to light mode'}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          background: 'none',
          border: 'none',
          fontSize: 18,
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          zIndex: 10,
        }}
      >
        {light ? '\u263D' : '\u2600'}
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: 650 }}>
        {/* Robot footprint icon */}
        <svg viewBox="0 0 64 64" fill="var(--accent, #facc15)" xmlns="http://www.w3.org/2000/svg" width="48" height="48" style={{ marginBottom: 16 }}>
          <rect x="18" y="24" width="28" height="34" rx="10" ry="10" />
          <rect x="22" y="32" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
          <rect x="22" y="39" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
          <rect x="22" y="46" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
          <rect x="18" y="10" width="8" height="10" rx="4" />
          <rect x="28" y="8" width="8" height="10" rx="4" />
          <rect x="38" y="10" width="8" height="10" rx="4" />
        </svg>

        {/* Brand name — responsive via CSS class */}
        <h1 className="welcome-brand">
          <span style={{ color: 'var(--text-primary)' }}>AGENT</span>
          <span style={{ color: 'var(--accent, #facc15)' }}>FOOTPRINT</span>
        </h1>

        {/* Subtitle — smaller */}
        <div style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          marginBottom: 20,
          letterSpacing: '0.02em',
        }}>
          The Explainable Agent Framework
        </div>

        {/* Build → Run → Observe — its own line, prominent */}
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 8,
        }}>
          Build &rarr; Run &rarr; Observe.
        </div>

        <p style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: 0,
        }}>
          Every turn, tool call, and decision documented automatically. Zero extra code.
        </p>
      </div>

      {/* 4 cards — responsive via CSS class. Card 2 (Feature Playground)
          renders a category chip-grid instead of a single CTA, so the
          user lands on a sidebar already scoped to their area of
          interest. */}
      <div className="welcome-cards">
        {CARDS.map((card, i) => {
          const colors = PHASE_COLORS[card.phase];

          const cardInner = (
            <div
              className="welcome-card"
              style={{
                height: '100%',
                padding: '28px 24px',
                background: 'var(--bg-secondary)',
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                cursor: card.to ? 'pointer' : 'default',
                transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
              onMouseEnter={(e) => {
                if (!card.to) return;
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 24px ${colors.border}`;
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLDivElement).style.transform = 'none';
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: colors.dim,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {card.desc}
                </div>
              </div>

              {/* Feature-Playground: render the category chip grid. Each
                  chip is its own Link so clicks don't bubble to the card
                  wrapper (card wrapper has no `to` in this case). */}
              {'categories' in card && card.categories ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {card.categories.map((cat) => (
                    <Link
                      key={cat.label}
                      to={`/samples/${cat.sample}?mode=${cat.mode}`}
                      title={cat.desc}
                      style={{
                        textDecoration: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.color,
                        background: colors.dim,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                        transition: 'background 0.12s, transform 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'none';
                      }}
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {card.cta} <span style={{ fontSize: 16 }}>&rarr;</span>
                  </span>
                </div>
              )}
            </div>
          );

          // Card with `to` = single-destination Link. Card without `to`
          // (Feature Playground) = plain wrapper — the inner chips own
          // their own navigation.
          return card.to ? (
            <Link
              key={card.title}
              to={card.to}
              style={{
                textDecoration: 'none',
                display: 'block',
                height: '100%',
                animationDelay: `${0.1 + i * 0.1}s`,
              }}
            >
              {cardInner}
            </Link>
          ) : (
            <div
              key={card.title}
              style={{
                display: 'block',
                height: '100%',
                animationDelay: `${0.1 + i * 0.1}s`,
              }}
            >
              {cardInner}
            </div>
          );
        })}
      </div>

      {/* Canonical taxonomy chips: Primitives → Compositions → Patterns.
          Reads top-to-bottom as the library's mental model. The chip grid
          in the Feature Playground card covers the cross-cutting pieces
          (Context Engineering + Features). */}
      <div className="welcome-concepts">
        <div className="welcome-concept-row">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Primitives</span>
          {['LLM', 'Agent (ReAct)'].map((c, i) => (
            <React.Fragment key={c}>
              {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>&rarr;</span>}
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--accent, #facc15)',
                background: 'rgba(250,204,21,0.1)',
                border: '1px solid rgba(250,204,21,0.2)',
                borderRadius: 6, padding: '4px 10px',
              }}>{c}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="welcome-concept-row">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Compositions</span>
          {['Sequence', 'Parallel', 'Conditional'].map((c, i) => (
            <React.Fragment key={c}>
              {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>&rarr;</span>}
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--accent, #facc15)',
                background: 'rgba(250,204,21,0.1)',
                border: '1px solid rgba(250,204,21,0.2)',
                borderRadius: 6, padding: '4px 10px',
              }}>{c}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="welcome-concept-row">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Patterns</span>
          {['ReAct', 'Dynamic ReAct', 'Hierarchy'].map((c, i) => (
            <React.Fragment key={c}>
              {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>&middot;</span>}
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--accent, #facc15)',
                background: 'rgba(250,204,21,0.1)',
                border: '1px solid rgba(250,204,21,0.2)',
                borderRadius: 6, padding: '4px 10px',
              }}>{c}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Footer links */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { label: 'GitHub', href: 'https://github.com/footprintjs/agentfootprint' },
          { label: 'Powered by footprintjs', href: 'https://footprintjs.github.io/footPrint/' },
          { label: 'npm', href: 'https://www.npmjs.com/package/agentfootprint' },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--text-muted)')}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
