/**
 * Fetch available models from provider APIs using the user's API key.
 * Falls back to a static list if the fetch fails.
 */

export interface AvailableModel {
  id: string;
  label: string;
  provider: 'anthropic' | 'openai';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Malformed provider responses use the existing whole-provider empty fallback. */
function modelRows(payload: unknown): unknown[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data;
}

interface ModelIdentity {
  id: string;
}

function isModelIdentity(value: unknown): value is ModelIdentity {
  return isRecord(value) && typeof value.id === 'string';
}

// ── Anthropic ───────────────────────────────────────────────

async function fetchAnthropicModels(apiKey: string): Promise<AvailableModel[]> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    const rows = modelRows(data);
    const models: AvailableModel[] = [];
    for (const row of rows) {
      // Preserve the original filter: missing/falsy IDs are skipped, while
      // null rows or truthy non-string IDs fail the whole provider response.
      if (row == null) return [];
      if (!isRecord(row) || !row.id) continue;
      if (typeof row.id !== 'string') return [];
      if (row.id.includes('test')) continue;
      models.push({
        id: row.id,
        // A malformed display name must not reach React or localeCompare.
        label: typeof row.display_name === 'string' ? row.display_name : row.id,
        provider: 'anthropic',
      });
    }
    return models.sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}

// ── OpenAI ──────────────────────────────────────────────────

async function fetchOpenAIModels(apiKey: string): Promise<AvailableModel[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    const rows = modelRows(data);
    if (!rows.every(isModelIdentity)) return [];
    return rows
      .filter(({ id }) => {
        // Only show chat-capable models, not embeddings/whisper/dall-e/etc
        return (
          id.startsWith('gpt-') ||
          id.startsWith('o1') ||
          id.startsWith('o3') ||
          id.startsWith('o4') ||
          id.startsWith('chatgpt')
        ) && !id.includes('realtime') && !id.includes('audio') && !id.includes('tts');
      })
      .map(m => ({
        id: m.id,
        label: m.id,
        provider: 'openai' as const,
      }))
      .sort((a: AvailableModel, b: AvailableModel) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Fetch available models from all configured providers.
 * Returns empty array per provider if no key or fetch fails.
 */
export async function fetchAvailableModels(
  keys: { anthropic?: string; openai?: string },
): Promise<AvailableModel[]> {
  const promises: Promise<AvailableModel[]>[] = [];

  if (keys.anthropic) promises.push(fetchAnthropicModels(keys.anthropic));
  if (keys.openai) promises.push(fetchOpenAIModels(keys.openai));

  const results = await Promise.all(promises);
  return results.flat();
}

// ── Fallback (static list when no keys configured) ──────────

export const FALLBACK_MODELS: AvailableModel[] = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', provider: 'anthropic' },
  { id: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5', provider: 'anthropic' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
];
