import React from 'react';
import Editor from '@monaco-editor/react';

interface CodePanelProps {
  code: string;
  onChange?: (code: string) => void;
}

export function CodePanel({ code, onChange }: CodePanelProps) {
  return (
    <div className="code-panel">
      <div className="panel-header">
        <span>Code</span>
        {onChange && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            editable
          </span>
        )}
      </div>
      <div className="panel-content" style={{ padding: 0, overflow: 'hidden' }}>
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
      </div>
    </div>
  );
}
