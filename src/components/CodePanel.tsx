import React from 'react';

interface CodePanelProps {
  code: string;
}

export function CodePanel({ code }: CodePanelProps) {
  // Use a simple pre/code for now — Monaco can be added later
  const lines = code.trim().split('\n');

  return (
    <div className="code-panel">
      <div className="panel-header">Code</div>
      <div className="panel-content" style={{ padding: 0 }}>
        <pre
          style={{
            margin: 0,
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '1.6',
            overflow: 'auto',
            height: '100%',
          }}
        >
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'flex' }}>
              <span
                style={{
                  width: '36px',
                  textAlign: 'right',
                  paddingRight: '12px',
                  color: 'var(--text-muted)',
                  userSelect: 'none',
                  flexShrink: 0,
                  fontSize: '12px',
                }}
              >
                {i + 1}
              </span>
              <code style={{ whiteSpace: 'pre' }}>{line}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
