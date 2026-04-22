/**
 * buildProvider — translate the user's picker selection (mock /
 * anthropic / openai / ollama) into a concrete LLMProvider that the
 * sandbox can inject into the example's `run(input, provider)` factory.
 *
 * Returns null when a real provider is selected but the API key is
 * missing — callers should surface the settings panel in that case.
 */

import {
  mock,
  BrowserAnthropicAdapter,
  BrowserOpenAIAdapter,
} from 'agentfootprint';
import type { LLMProvider } from 'agentfootprint';
import { asStreaming } from './streamingMock';

export type ProviderKind = 'mock' | 'anthropic' | 'openai' | 'openrouter' | 'ollama';

export interface ApiKeys {
  readonly anthropic?: string;
  readonly openai?: string;
  readonly openrouter?: string;
}

export interface BuildProviderResult {
  /** The provider — null means a key was required but missing. */
  readonly provider: LLMProvider | null;
  /** When provider is null, this names the key that was missing so the
   *  UI can route the user to the settings panel for that vendor. */
  readonly missingKey?: 'anthropic' | 'openai' | 'openrouter';
}

/**
 * Build a provider from the user's selection. When the selection is
 * `mock`, returns `null` so the example's own scripted-mock fallback
 * kicks in (every example's `run(input, provider?)` defaults `provider`
 * to its scripted mock when undefined).
 *
 * Wraps mock with `asStreaming` only if streaming is requested — pure
 * mock stays sync for examples that don't subscribe to events.
 */
export function buildProvider(
  kind: ProviderKind,
  apiKeys: ApiKeys,
  opts: { streamingMock?: boolean } = {},
): BuildProviderResult {
  switch (kind) {
    case 'mock':
      // null → example uses its built-in scripted mock as the default
      // parameter. We don't override that — the playground sandbox
      // already preserves the example's natural mock responses.
      return { provider: null };

    case 'anthropic': {
      if (!apiKeys.anthropic) return { provider: null, missingKey: 'anthropic' };
      const provider: LLMProvider = new BrowserAnthropicAdapter({
        apiKey: apiKeys.anthropic,
        model: 'claude-sonnet-4-20250514',
      });
      return { provider: opts.streamingMock ? asStreaming(provider) : provider };
    }

    case 'openai': {
      if (!apiKeys.openai) return { provider: null, missingKey: 'openai' };
      const provider: LLMProvider = new BrowserOpenAIAdapter({
        apiKey: apiKeys.openai,
        model: 'gpt-4o-mini',
      });
      return { provider: opts.streamingMock ? asStreaming(provider) : provider };
    }

    case 'openrouter': {
      // OpenRouter — unified gateway. OpenAI-compatible API, so we
      // reuse BrowserOpenAIAdapter with their baseURL. Default model
      // routes to Claude 3.5 Sonnet (good cost/quality balance);
      // power users can edit the OPENROUTER_MODEL constant below.
      if (!apiKeys.openrouter) return { provider: null, missingKey: 'openrouter' };
      const provider: LLMProvider = new BrowserOpenAIAdapter({
        apiKey: apiKeys.openrouter,
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-3.5-sonnet',
      });
      return { provider: opts.streamingMock ? asStreaming(provider) : provider };
    }

    case 'ollama': {
      // Ollama runs locally; OpenAI-compatible API at default port.
      const provider: LLMProvider = new BrowserOpenAIAdapter({
        apiKey: 'ollama', // Ollama ignores the key but the adapter requires one
        baseURL: 'http://localhost:11434/v1',
        model: 'llama3',
      });
      return { provider: opts.streamingMock ? asStreaming(provider) : provider };
    }
  }
}

/**
 * Build a streaming-wrapped scripted mock for the playground's
 * "Mock (streaming)" picker option. Used when the user wants the
 * example's scripted responses BUT delivered token-by-token like a
 * real LLM. Takes a function that produces the underlying mock so we
 * can re-create per-Run for fresh state.
 */
export function buildStreamingMock(make: () => LLMProvider): LLMProvider {
  return asStreaming(make());
}

/** Preset display info for the picker UI. */
export const PROVIDER_OPTIONS: ReadonlyArray<{
  readonly kind: ProviderKind;
  readonly label: string;
  readonly hint: string;
}> = [
  { kind: 'mock', label: 'Mock', hint: 'scripted, no API key, $0' },
  { kind: 'anthropic', label: 'Claude', hint: 'requires Anthropic API key' },
  { kind: 'openai', label: 'GPT', hint: 'requires OpenAI API key' },
  { kind: 'openrouter', label: 'OpenRouter', hint: 'one key, 200+ models (Claude / GPT / Gemini / …)' },
  { kind: 'ollama', label: 'Ollama (local)', hint: 'requires Ollama running locally' },
];

// Bare-mock builder used by SamplePage when ProviderKind === 'mock'
// but the example exposes streaming events (the chat panel listens) —
// we wrap the example's natural scripted response in asStreaming so
// the user sees tokens appear instead of a one-shot blob.
export { mock };
