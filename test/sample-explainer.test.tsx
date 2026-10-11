import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SampleExplainer } from '../src/components/SampleExplainer';

describe('sample Markdown rendering', () => {
  it('keeps ordinary Markdown, inline code and highlighted block rendering', () => {
    const html = renderToStaticMarkup(<SampleExplainer markdown={[
      '---', 'title: Hidden metadata', '---', '# Visible title',
      '', 'Use `inline` with [the docs](https://example.com) or [a section](#section).',
      '', '```js', 'const answer = 42;', '```',
    ].join('\n')} />);
    expect(html).not.toContain('Hidden metadata');
    expect(html).toContain('Visible title</h1>');
    expect(html).toContain('<code>inline</code>');
    expect(html).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('href="#section"');
    expect(html).toContain('class="hljs language-js"');
    expect(html).not.toContain('[object Object]');
  });
});
