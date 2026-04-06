/**
 * Fetch available models from provider APIs using the user's API key.
 * Falls back to a static list if the fetch fails.
 */

export interface AvailableModel {
  id: string;
  label: string;
  provider: 'anthropic' | 'openai';
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
    const data = await response.json();
    return (data.data ?? [])
      .filter((m: any) => m.id && !m.id.includes('test'))
      .map((m: any) => ({
        id: m.id,
        label: m.display_name ?? m.id,
        provider: 'anthropic' as const,
      }))
      .sort((a: AvailableModel, b: AvailableModel) => a.label.localeCompare(b.label));
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
    const data = await response.json();
    return (data.data ?? [])
      .filter((m: any) => {
        const id = m.id as string;
        // Only show chat-capable models, not embeddings/whisper/dall-e/etc
        return (
          id.startsWith('gpt-') ||
          id.startsWith('o1') ||
          id.startsWith('o3') ||
          id.startsWith('o4') ||
          id.startsWith('chatgpt')
        ) && !id.includes('realtime') && !id.includes('audio') && !id.includes('tts');
      })
      .map((m: any) => ({
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
