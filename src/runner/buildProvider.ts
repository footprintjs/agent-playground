/**
 * buildProvider — translate ProviderPicker selection into an LLMProvider.
 *
 * v2 STATUS: only `mock` is wired. Real providers (anthropic / openai /
 * openrouter / ollama) need v2-aligned browser adapters built on top of
 * agentfootprint v2's `LLMProvider` interface. Tracked alongside the
 * live-chat port — see buildLiveRunner.ts for the broader plan.
 */

import { MockProvider } from 'agentfootprint';
import type { LLMProvider } from 'agentfootprint';

export type ProviderKind = 'mock' | 'anthropic' | 'openai' | 'openrouter' | 'ollama';

export interface ApiKeys {
  readonly anthropic?: string;
  readonly openai?: string;
  readonly openrouter?: string;
}

export interface BuildProviderResult {
  readonly provider: LLMProvider | null;
  readonly missingKey?: 'anthropic' | 'openai' | 'openrouter';
  readonly notImplemented?: boolean;
}

export interface ProviderOption {
  readonly id: ProviderKind;
  readonly label: string;
}

export const PROVIDER_OPTIONS: readonly ProviderOption[] = [
  { id: 'mock', label: 'Mock' },
  { id: 'anthropic', label: 'Claude' },
  { id: 'openai', label: 'GPT' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'ollama', label: 'Ollama (local)' },
];

/**
 * Build a provider from the user's selection. `mock` returns null so
 * examples fall through to their scripted MockProvider; real provider
 * paths return `notImplemented: true` until the v2 adapters are in.
 */
export function buildProvider(kind: ProviderKind, apiKeys: ApiKeys): BuildProviderResult {
  switch (kind) {
    case 'mock':
      return { provider: null };
    case 'anthropic':
      if (!apiKeys.anthropic) return { provider: null, missingKey: 'anthropic' };
      return { provider: null, notImplemented: true };
    case 'openai':
      if (!apiKeys.openai) return { provider: null, missingKey: 'openai' };
      return { provider: null, notImplemented: true };
    case 'openrouter':
      if (!apiKeys.openrouter) return { provider: null, missingKey: 'openrouter' };
      return { provider: null, notImplemented: true };
    case 'ollama':
      return { provider: null, notImplemented: true };
  }
  // Exhaustiveness guard — TS picks this up if a new ProviderKind is added.
  void (kind satisfies never);
  return { provider: null };
}

// Re-exported so MockProvider stays a one-import call site for samples.
export { MockProvider };
