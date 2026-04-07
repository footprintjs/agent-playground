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

/**
 * Minimal TypeScript syntax highlighter for mobile <pre> fallback.
 * Only processes trusted content from the sample catalog.
 * Escapes HTML entities first, then wraps known tokens in colored spans.
 */
function highlightTS(src: string): string {
  // Escape HTML entities to prevent injection
  let html = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Strings (single and double quotes)
  html = html.replace(/(&#39;[^&#]*?&#39;|&quot;[^&]*?&quot;|'[^']*?'|"[^"]*?")/g,
    '<span style="color:#ce9178">$1</span>');

  // Template literals (backtick strings)
  html = html.replace(/(`[^`]*?`)/g, '<span style="color:#ce9178">$1</span>');

  // Keywords
  const keywords = /\b(import|export|from|const|let|var|async|await|function|return|if|else|new|typeof|try|catch|finally|throw|for|of|in)\b/g;
  html = html.replace(keywords, '<span style="color:#569cd6">$1</span>');

  // Types / classes (capitalized words)
  html = html.replace(/\b([A-Z][a-zA-Z0-9]+)\b/g, '<span style="color:#4ec9b0">$1</span>');

  // Comments (single line)
  html = html.replace(/(\/\/.*)/g, '<span style="color:#6a9955">$1</span>');

  // Numbers
  html = html.replace(/\b(\d+)\b/g, '<span style="color:#b5cea8">$1</span>');

  return html;
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
          /* Mobile: syntax-highlighted <pre> block.
             Content is from our own sample catalog (trusted), not user input.
             highlightTS only wraps tokens in <span> with color styles — no script injection. */
          <pre
            style={{
              height: '100%',
              overflow: 'auto',
              padding: '12px',
              margin: 0,
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              color: '#d4d4d4',
              background: '#1e1e1e',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: highlightTS(code) }}
          />
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
