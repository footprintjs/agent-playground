/**
 * buildProvider — translate ProviderPicker selection into an LLMProvider.
 *
 * Anthropic ("Claude") is wired via `browserAnthropic` from agentfootprint.
 * The remaining real providers (openai / openrouter / ollama) still
 * return `notImplemented: true` until their browser adapters land.
 *
 * Sample-model translation: every example in the catalog hardcodes
 * playground-friendly model ids (`'mock-weather'`, `'mock'`, etc.)
 * that target the example's scripted MockProvider. When the user picks
 * a real provider, those ids hit the real API and return HTTP 404
 * (`not_found_error`). We wrap real providers with a thin adapter that
 * normalizes any non-vendor-native model id to the provider's stock
 * default — keeps the LIBRARY strict (it should reject typo'd model
 * ids like `claud-sonnet-4-5`) while making the playground "just work"
 * across every sample.
 */

import { MockProvider, browserAnthropic } from 'agentfootprint';
import type { LLMProvider, LLMRequest } from 'agentfootprint';

/** Vendor-native model-id prefix per provider. Anything else → default. */
const ANTHROPIC_NATIVE_PREFIX = /^claude-/;
/** Stock default for the playground when an example targets a mock id. */
const ANTHROPIC_PLAYGROUND_DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Wrap a real Anthropic-shaped provider so the playground samples (which
 * hardcode mock model ids) work without 404s. Pass-through for native
 * `claude-*` ids; substitutes the playground default otherwise.
 *
 * NOT a library concern — strict model-id rejection from Anthropic is a
 * useful signal for production agents and we don't want to mask it
 * upstream. The playground knows it's running mock-targeted samples.
 */
function withPlaygroundModelDefault(
  inner: LLMProvider,
  defaultModel: string,
  nativePrefix: RegExp,
): LLMProvider {
  const rewrite = (req: LLMRequest): LLMRequest =>
    nativePrefix.test(req.model) ? req : { ...req, model: defaultModel };
  return {
    name: inner.name,
    complete: (req) => inner.complete(rewrite(req)),
    ...(inner.stream && { stream: (req) => inner.stream!(rewrite(req)) }),
  };
}

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
    case 'anthropic': {
      if (!apiKeys.anthropic) return { provider: null, missingKey: 'anthropic' };
      const inner = browserAnthropic({ apiKey: apiKeys.anthropic });
      return {
        provider: withPlaygroundModelDefault(
          inner,
          ANTHROPIC_PLAYGROUND_DEFAULT_MODEL,
          ANTHROPIC_NATIVE_PREFIX,
        ),
      };
    }
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
