import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

interface CodePanelProps {
  code: string;
  onChange?: (code: string) => void;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export function CodePanel({ code, onChange }: CodePanelProps) {
  const isMobile = useIsMobile();

  return (
    <div className="code-panel">
      <div className="panel-header">
        <span>Code</span>
        {onChange && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              fontWeight: 400,
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            editable
          </span>
        )}
      </div>
      <div className="panel-content" style={{ padding: 0, overflow: 'hidden' }}>
        {isMobile ? (
          /* Mobile: simple <pre> block — Monaco doesn't render on small screens */
          <pre
            style={{
              height: '100%',
              overflow: 'auto',
              padding: '12px',
              margin: 0,
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              color: 'var(--text-primary)',
              background: 'var(--bg-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {code}
          </pre>
        ) : (
          <Editor
            height="100%"
            language="typescript"
            theme="vs-dark"
            value={code}
            onChange={(v) => onChange?.(v ?? '')}
            options={{
              fontSize: 13,
              lineHeight: 1.6,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: 'on',
              readOnly: !onChange,
              padding: { top: 12 },
              renderLineHighlight: 'line',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
          />
        )}
      </div>
    </div>
  );
}
