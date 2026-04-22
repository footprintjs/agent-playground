/**
 * SampleExplainer — renders the per-sample `.md` explainer file with
 * theme-aware styling. Adapted from footprint-playground's component.
 *
 * Strips frontmatter (`---\n...\n---`) before rendering since the
 * playground UI shows title/description from the catalog, not from
 * the markdown body.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { useTheme } from '../hooks/useTheme';

function stripFrontMatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  const after = md.indexOf('\n', end + 4);
  return after === -1 ? '' : md.slice(after + 1);
}

interface Props {
  markdown: string;
}

export function SampleExplainer({ markdown }: Props) {
  const body = stripFrontMatter(markdown);
  const theme = useTheme();
  const isLight = theme === 'light';

  // Theme-aware palette — dark/light parallels the rest of the playground.
  // Hardcoded hex (not CSS vars) so this component stays self-contained
  // and renders correctly even before the global stylesheet evaluates.
  const tableBorder = isLight ? '#e5e7eb' : '#2a2a36';
  const codeBg = isLight ? '#f4f4f6' : '#1e1e2e';
  const inlineCodeBg = isLight ? '#eef0f3' : '#2a2a36';
  const blockquoteBg = isLight ? '#f8f9fb' : '#1a1b24';
  const textColor = isLight ? '#1a1a1a' : '#e0e0e8';
  const mutedColor = isLight ? '#5a5a64' : '#b0b0b8';

  return (
    <div
      className="sample-explainer"
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '28px 36px 48px',
        fontSize: 14,
        lineHeight: 1.65,
        color: textColor,
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }: any) => (
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.25 }}>
              {children}
            </h1>
          ),
          h2: ({ children }: any) => (
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '28px 0 10px', lineHeight: 1.3 }}>
              {children}
            </h2>
          ),
          h3: ({ children }: any) => (
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                margin: '20px 0 8px',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {children}
            </h3>
          ),
          p: ({ children }: any) => <p style={{ margin: '0 0 14px' }}>{children}</p>,
          ul: ({ children }: any) => <ul style={{ margin: '0 0 14px', paddingLeft: 22 }}>{children}</ul>,
          ol: ({ children }: any) => <ol style={{ margin: '0 0 14px', paddingLeft: 22 }}>{children}</ol>,
          li: ({ children }: any) => <li style={{ margin: '0 0 4px' }}>{children}</li>,
          strong: ({ children }: any) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
          a: ({ href, children }: any) => (
            <a
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              style={{
                color: 'var(--accent, #facc15)',
                textDecoration: 'none',
                borderBottom: '1px dashed var(--accent, #facc15)',
              }}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }: any) => (
            <blockquote
              style={{
                margin: '0 0 14px',
                padding: '10px 14px',
                background: blockquoteBg,
                borderLeft: '3px solid var(--accent, #facc15)',
                borderRadius: 4,
                color: mutedColor,
              }}
            >
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...rest }: any) => {
            if (inline) {
              return (
                <code
                  {...rest}
                  style={{
                    background: inlineCodeBg,
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontSize: '0.9em',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
          pre: ({ children }: any) => (
            <pre
              style={{
                background: codeBg,
                padding: '12px 14px',
                borderRadius: 6,
                overflowX: 'auto',
                margin: '0 0 14px',
                fontSize: 12.5,
                lineHeight: 1.55,
                fontFamily: "'JetBrains Mono', monospace",
                border: `1px solid ${tableBorder}`,
              }}
            >
              {children}
            </pre>
          ),
          table: ({ children }: any) => (
            <div style={{ overflowX: 'auto', margin: '0 0 14px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }: any) => (
            <th
              style={{
                textAlign: 'left',
                padding: '8px 12px',
                borderBottom: `2px solid ${tableBorder}`,
                fontWeight: 600,
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }: any) => (
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${tableBorder}` }}>
              {children}
            </td>
          ),
          hr: () => (
            <hr
              style={{
                border: 'none',
                borderTop: `1px solid ${tableBorder}`,
                margin: '24px 0',
              }}
            />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
