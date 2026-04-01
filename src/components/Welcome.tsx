import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function useThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.classList.contains('light'));
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
  }, [light]);
  return [light, () => setLight((v) => !v)] as const;
}

const CARDS = [
  {
    phase: 'build' as const,
    icon: '\uD83E\uDDE0',
    title: 'Concept Ladder',
    desc: 'LLMCall \u2192 Agent \u2192 RAG \u2192 FlowChart \u2192 Swarm. Every layer adds orchestration power. 5 minutes to understand the whole stack.',
    cta: 'Start from scratch',
    to: '/samples/simple-llm-call',
  },
  {
    phase: 'execute' as const,
    icon: '\u26A1',
    title: 'Playground',
    desc: '22 interactive samples \u2014 tools, memory, multi-modal, resilience, gated permissions. Edit and run live, $0 with mock adapters.',
    cta: 'Explore samples',
    to: '/samples/agent-with-tools',
  },
  {
    phase: 'observe' as const,
    icon: '\uD83D\uDCAC',
    title: 'Live Chat',
    desc: 'Set your Anthropic or OpenAI key via the \u2699 icon and run real LLM calls directly from the browser.',
    cta: 'Try with your key',
    to: '/samples/live-chat',
  },
];

const PHASE_COLORS: Record<string, { color: string; dim: string; border: string }> = {
  build: { color: '#7c6cf0', dim: 'rgba(124,108,240,0.08)', border: 'rgba(124,108,240,0.25)' },
  execute: { color: '#a855f7', dim: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.25)' },
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
        padding: '60px 40px',
        gap: 48,
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
      <div style={{ textAlign: 'center', maxWidth: 600 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--accent)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          agentfootprint
        </div>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 800,
            lineHeight: 1.1,
            margin: '0 0 16px',
            background: 'linear-gradient(135deg, var(--text-primary) 40%, var(--accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Explainable AI Agents
        </h1>
        <p
          style={{
            fontSize: 17,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Build &rarr; Run &rarr; Observe. Every turn, tool call, and decision documented automatically. Zero extra code.
        </p>
      </div>

      {/* 3 cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          width: '100%',
          maxWidth: 900,
        }}
      >
        {CARDS.map((card, i) => {
          const colors = PHASE_COLORS[card.phase];
          return (
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
              <div
                className="welcome-card"
                style={{
                  height: '100%',
                  padding: '28px 24px',
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 14,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
                onMouseEnter={(e) => {
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
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {card.cta} <span style={{ fontSize: 16 }}>&rarr;</span>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Concept Ladder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['LLMCall', 'Agent', 'RAG', 'FlowChart', 'Swarm'].map((c, i) => (
          <React.Fragment key={c}>
            {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>&rarr;</span>}
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'rgba(124,108,240,0.1)',
                border: '1px solid rgba(124,108,240,0.2)',
                borderRadius: 6,
                padding: '4px 10px',
                letterSpacing: '0.02em',
              }}
            >
              {c}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Footer links */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { label: 'GitHub', href: 'https://github.com/footprintjs/agentfootprint' },
          { label: 'footprintjs', href: 'https://github.com/footprintjs/footPrint' },
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
