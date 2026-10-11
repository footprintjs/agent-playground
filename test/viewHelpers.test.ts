import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StageSnapshot } from 'footprint-explainable-ui';
import { createRecorderViews } from '../src/components/live/recorderViews';
import { loadApiKeys, saveApiKeys, clearApiKeys, providerNeedsKey } from '../src/utils/apiKeys';

afterEach(() => vi.unstubAllGlobals());

describe('API-key storage independent of the settings component', () => {
  function storage(initial: string | null = null) {
    let raw = initial;
    const localStorage = {
      getItem: vi.fn(() => raw),
      setItem: vi.fn((_key: string, value: string) => { raw = value; }),
      removeItem: vi.fn(() => { raw = null; }),
    };
    vi.stubGlobal('localStorage', localStorage);
    return localStorage;
  }

  it('preserves the storage key and save/load/clear behavior', () => {
    const localStorage = storage();
    const keys = { anthropic: 'test-a', openai: 'test-o', openrouter: 'test-r' };
    expect(loadApiKeys()).toEqual({ anthropic: '', openai: '', openrouter: '' });
    saveApiKeys(keys);
    expect(localStorage.setItem).toHaveBeenCalledWith('agent-playground:api-keys', JSON.stringify(keys));
    expect(loadApiKeys()).toEqual(keys);
    clearApiKeys();
    expect(localStorage.removeItem).toHaveBeenCalledWith('agent-playground:api-keys');
    expect(loadApiKeys()).toEqual({ anthropic: '', openai: '', openrouter: '' });
  });

  it('backfills older saved settings without an OpenRouter field', () => {
    storage(JSON.stringify({ anthropic: 'test-a', openai: 'test-o' }));
    expect(loadApiKeys()).toEqual({ anthropic: 'test-a', openai: 'test-o', openrouter: '' });
  });

  it('falls back to empty keys for malformed data or unavailable browser storage', () => {
    const localStorage = storage('{broken');
    expect(loadApiKeys()).toEqual({ anthropic: '', openai: '', openrouter: '' });
    localStorage.getItem.mockImplementation(() => { throw new Error('Storage access denied'); });
    expect(loadApiKeys()).toEqual({ anthropic: '', openai: '', openrouter: '' });
    vi.stubGlobal('localStorage', undefined);
    expect(loadApiKeys()).toEqual({ anthropic: '', openai: '', openrouter: '' });
  });

  it('only prompts for a missing key belonging to the selected paid provider', () => {
    const localStorage = storage(JSON.stringify({ anthropic: 'test-a', openai: '', openrouter: 'test-r' }));
    expect(providerNeedsKey('anthropic')).toBe(false);
    expect(providerNeedsKey('openai')).toBe(true);
    expect(providerNeedsKey('openrouter')).toBe(false);
    localStorage.getItem.mockClear();
    expect(providerNeedsKey('mock')).toBe(false);
    expect(providerNeedsKey('ollama')).toBe(false);
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
});

const snapshot = (runtimeStageId?: string): StageSnapshot => ({
  stageName: runtimeStageId ?? 'unkeyed',
  stageLabel: runtimeStageId ?? 'Unkeyed',
  runtimeStageId,
  memory: {},
  narrative: '',
  startMs: 0,
  durationMs: 0,
});

describe('recorder views after separating component primitives', () => {
  it('keeps all three view identities and their empty states', () => {
    const views = createRecorderViews();
    expect(views.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'tokens', name: 'Tokens' },
      { id: 'tools', name: 'Tools' },
      { id: 'explain', name: 'Explain' },
    ]);
    expect(views.map(view => renderToStaticMarkup(view.render({ snapshots: [], selectedIndex: 0 })))).toEqual([
      '<div class="rv-panel rv-empty"><div class="rv-empty-text">No LLM calls recorded.</div></div>',
      '<div class="rv-panel rv-empty"><div class="rv-empty-text">No tool calls recorded.</div></div>',
      '<div class="rv-panel rv-empty"><div class="rv-empty-text">No grounding data. Run a sample with tools to see sources vs claims.</div></div>',
    ]);
  });

  it('reveals calls only through the selected runtime stage, not unkeyed or future calls', () => {
    const [tokens] = createRecorderViews({
      tokens: {
        totalCalls: 3,
        totalInputTokens: 600,
        totalOutputTokens: 60,
        calls: [
          { model: 'mock', inputTokens: 100, outputTokens: 10, latencyMs: 1, runtimeStageId: 'call-llm#0' },
          { model: 'mock', inputTokens: 200, outputTokens: 20, latencyMs: 1, runtimeStageId: 'call-llm#1' },
          { model: 'mock', inputTokens: 300, outputTokens: 30, latencyMs: 1 },
        ],
      },
    });
    const snapshots = [snapshot(), snapshot('call-llm#0'), snapshot('call-llm#1')];
    const render = (selectedIndex: number) => renderToStaticMarkup(tokens.render({ snapshots, selectedIndex }));
    expect(render(0)).toContain('LLM call hasn&#x27;t executed yet. Step forward.');
    expect(render(1)).toContain('100 in / 10 out');
    expect(render(1)).not.toContain('200 in / 20 out');
    expect(render(2)).toContain('200 in / 20 out');
    expect(render(2)).not.toContain('300 in / 30 out');
    expect(render(99)).toBe(render(2));
  });

  it('preserves progressive tool and grounding display with the shared stat component', () => {
    const [, tools, explain] = createRecorderViews({
      tools: { totalCalls: 1, byTool: { lookup: { calls: 1, errors: 0, averageLatencyMs: 12 } } },
      explain: {
        sources: [{ toolName: 'lookup', args: {}, result: 'Recorded fact' }],
        claims: [{ content: 'Final claim', iteration: 0 }],
        decisions: [{ toolName: 'lookup', args: {}, latencyMs: 12 }],
        summary: 'Recorded summary',
      },
    });
    const snapshots = [snapshot(), snapshot('call-llm#0'), snapshot('execute-tool#0'), snapshot('final#0')];
    const render = (view: typeof tools, selectedIndex: number) => renderToStaticMarkup(view.render({ snapshots, selectedIndex }));
    expect(render(tools, 1)).toContain('Tool execution hasn&#x27;t started yet. Step forward.');
    expect(render(tools, 2)).toContain('avg 12ms');
    expect(render(explain, 0)).toContain('LLM hasn&#x27;t been called yet. Step forward.');
    expect(render(explain, 1)).toContain('LLM decided to call lookup. Executing tools next.');
    expect(render(explain, 2)).toContain('Recorded fact');
    expect(render(explain, 2)).not.toContain('Final claim');
    expect(render(explain, 3)).toContain('Final claim');
    expect(render(explain, 3)).toContain('Recorded summary');
  });
});
