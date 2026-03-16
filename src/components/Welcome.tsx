import React from 'react';

export function Welcome() {
  return (
    <div className="welcome">
      <h2>agentfootprint Playground</h2>
      <p>
        Interactive sandbox for the explainable agent framework.
        Select a sample from the sidebar to explore the concept ladder.
      </p>
      <div className="concept-ladder">
        <span className="concept-badge">LLMCall</span>
        <span className="concept-badge"><span className="arrow">&rarr;</span> Agent</span>
        <span className="concept-badge"><span className="arrow">&rarr;</span> RAG</span>
        <span className="concept-badge"><span className="arrow">&rarr;</span> FlowChart</span>
        <span className="concept-badge"><span className="arrow">&rarr;</span> Swarm</span>
      </div>
      <p style={{ marginTop: '24px', fontSize: '12px' }}>
        16 samples &middot; Mock adapters for $0 testing &middot; Same code as production
      </p>
    </div>
  );
}
