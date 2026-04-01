import React from 'react';
import { Link } from 'react-router-dom';

const CARDS = [
  {
    icon: '🧠',
    title: 'Concept Ladder',
    desc: 'LLMCall → Agent → RAG → FlowChart → Swarm. Every layer adds orchestration power. 5 minutes to understand the whole stack.',
    cta: 'Start from scratch',
    to: '/samples/simple-llm-call',
    accent: '#7c6cf0',
  },
  {
    icon: '⚡',
    title: 'Playground',
    desc: '22 interactive samples — tools, memory, multi-modal, resilience, gated permissions. Edit and run live, $0 with mock adapters.',
    cta: 'Explore samples',
    to: '/samples/agent-with-tools',
    accent: '#a855f7',
  },
  {
    icon: '💬',
    title: 'Live Chat',
    desc: 'Set your Anthropic or OpenAI key via the ⚙ icon and run real LLM calls directly from the browser.',
    cta: 'Try with your key',
    to: '/samples/live-chat',
    accent: '#10b981',
  },
];

export function Welcome() {
  return (
    <div className="welcome-hero">
      <div className="welcome-tagline">agentfootprint</div>
      <h1 className="welcome-title">Explainable AI Agents</h1>
      <p className="welcome-subtitle">
        Build → Run → Observe. Every turn, tool call, and decision documented automatically.
        Zero extra code.
      </p>

      <div className="welcome-cards">
        {CARDS.map((card, i) => (
          <Link
            key={card.title}
            to={card.to}
            className="welcome-card"
            style={{ '--card-accent': card.accent, animationDelay: `${0.1 + i * 0.1}s` } as React.CSSProperties}
          >
            <div className="welcome-card-icon">{card.icon}</div>
            <div className="welcome-card-title">{card.title}</div>
            <div className="welcome-card-desc">{card.desc}</div>
            <div className="welcome-card-cta" style={{ color: card.accent }}>
              {card.cta} →
            </div>
          </Link>
        ))}
      </div>

      <div className="welcome-ladder">
        {['LLMCall', 'Agent', 'RAG', 'FlowChart', 'Swarm'].map((c, i) => (
          <React.Fragment key={c}>
            {i > 0 && <span className="welcome-arrow">→</span>}
            <span className="concept-badge">{c}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="welcome-footer-links">
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
            className="welcome-footer-link"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
