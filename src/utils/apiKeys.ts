import type { ProviderKind } from '../runner/buildProvider';

export interface ApiKeys {
  anthropic: string;
  openai: string;
  /** OpenRouter — unified gateway for Claude / GPT / Gemini / Llama / 200+ models.
   *  One key, one endpoint, OpenAI-compatible API. */
  openrouter: string;
}

const STORAGE_KEY = 'agent-playground:api-keys';

/**
 * Read API keys from localStorage. Persists across tab closes and
 * browser restarts so the user doesn't paste the key every visit.
 *
 * Trade-off vs sessionStorage: keys live until the user clicks
 * "Clear all keys" or wipes browser data. The panel surfaces this
 * explicitly so the user can opt out at any time.
 */
export function loadApiKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Backfill openrouter for sessions that pre-date the field.
      return { anthropic: '', openai: '', openrouter: '', ...parsed };
    }
  } catch {
    // Missing browser storage, denied access, or malformed saved data means no saved keys.
  }
  return { anthropic: '', openai: '', openrouter: '' };
}

/** Persist API keys to localStorage. */
export function saveApiKeys(keys: ApiKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function clearApiKeys() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Map a provider kind to the API-key field it consumes (or null when
 *  the provider doesn't need a key — Mock + Ollama). */
function keyFieldFor(kind: ProviderKind): keyof ApiKeys | null {
  switch (kind) {
    case 'anthropic':
      return 'anthropic';
    case 'openai':
      return 'openai';
    case 'openrouter':
      return 'openrouter';
    case 'mock':
    case 'ollama':
      return null;
  }
}

/** True when the chosen provider requires a key AND that key is not in
 *  localStorage yet. Cheap — reads localStorage every call. */
export function providerNeedsKey(kind: ProviderKind): boolean {
  const field = keyFieldFor(kind);
  if (!field) return false;
  const keys = loadApiKeys();
  return !keys[field] || keys[field].length === 0;
}
