import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAvailableModels } from '../src/runner/fetchModels';

afterEach(() => vi.unstubAllGlobals());

function respondWith(payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('provider model discovery boundary', () => {
  it('does not contact providers without configured keys', async () => {
    const fetchMock = respondWith({ data: [] });
    expect(await fetchAvailableModels({})).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves Anthropic display names, fallback labels, filtering and sorting', async () => {
    const fetchMock = respondWith({ data: [
      { id: 'claude-z', display_name: 'Alpha' },
      { id: 'claude-b' },
      { id: 'claude-c', display_name: null },
      { id: 'claude-test', display_name: 'Test' },
      { id: '', display_name: 'Empty' },
    ] });
    expect(await fetchAvailableModels({ anthropic: 'test-anthropic-key' })).toEqual([
      { id: 'claude-z', label: 'Alpha', provider: 'anthropic' },
      { id: 'claude-b', label: 'claude-b', provider: 'anthropic' },
      { id: 'claude-c', label: 'claude-c', provider: 'anthropic' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('https://api.anthropic.com/v1/models?limit=100', {
      headers: {
        'x-api-key': 'test-anthropic-key',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
  });

  it('preserves the OpenAI chat-capable model filter and sorting', async () => {
    const fetchMock = respondWith({ data: [
      'o4-mini', 'gpt-4o', 'o1', 'chatgpt-4o-latest', 'o3',
      'text-embedding-3-small', 'whisper-1', 'dall-e-3',
      'gpt-4o-realtime', 'gpt-4o-audio', 'gpt-4o-tts', '',
    ].map(id => ({ id })) });
    expect(await fetchAvailableModels({ openai: 'test-openai-key' })).toEqual(
      ['chatgpt-4o-latest', 'gpt-4o', 'o1', 'o3', 'o4-mini'].map(id => ({ id, label: id, provider: 'openai' })),
    );
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
      headers: { Authorization: 'Bearer test-openai-key' },
    });
  });

  it.each([null, [], {}, { data: null }, { data: {} }, { data: 'models' }])(
    'uses the empty fallback for an invalid payload: %j', async payload => {
      respondWith(payload);
      expect(await fetchAvailableModels({ anthropic: 'a', openai: 'o' })).toEqual([]);
    },
  );

  it('keeps valid Anthropic models while skipping rows with no usable ID', async () => {
    respondWith({ data: [
      { id: 'claude-a' }, {}, { id: null }, { id: '' }, { id: 0 }, { id: false },
      false, 42, 'not a model', [],
      { id: 'claude-b', display_name: '' },
    ] });
    expect(await fetchAvailableModels({ anthropic: 'a' })).toEqual([
      { id: 'claude-b', label: '', provider: 'anthropic' },
      { id: 'claude-a', label: 'claude-a', provider: 'anthropic' },
    ]);
  });

  it.each([42, false, true, {}, []])(
    'uses the validated ID rather than a non-string Anthropic label: %j', async displayName => {
      respondWith({ data: [{ id: 'claude-a' }, { id: 'claude-b', display_name: displayName }] });
      expect(await fetchAvailableModels({ anthropic: 'a' })).toEqual([
        { id: 'claude-a', label: 'claude-a', provider: 'anthropic' },
        { id: 'claude-b', label: 'claude-b', provider: 'anthropic' },
      ]);
    },
  );

  it.each([null, { id: 42 }])(
    'does not return a partial Anthropic list when a row is malformed: %j', async row => {
      respondWith({ data: [{ id: 'claude-a' }, row] });
      expect(await fetchAvailableModels({ anthropic: 'a' })).toEqual([]);
    },
  );

  it.each([null, {}, { id: 42 }])(
    'does not return a partial OpenAI list when a row is malformed: %j', async row => {
      respondWith({ data: [{ id: 'gpt-4o' }, row] });
      expect(await fetchAvailableModels({ openai: 'o' })).toEqual([]);
    },
  );

  it('keeps provider failures independent', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async input => {
      const data = String(input).includes('anthropic') ? [{ id: 123 }] : [{ id: 'gpt-4o' }];
      return new Response(JSON.stringify({ data }));
    }));
    expect(await fetchAvailableModels({ anthropic: 'a', openai: 'o' })).toEqual([
      { id: 'gpt-4o', label: 'gpt-4o', provider: 'openai' },
    ]);
  });

  it.each(['http', 'json', 'network'])('retains the empty fallback on %s failure', async failure => {
    const fetchMock = vi.fn<typeof fetch>();
    if (failure === 'network') fetchMock.mockRejectedValue(new Error('Offline'));
    else fetchMock.mockResolvedValue(new Response('not JSON', { status: failure === 'http' ? 503 : 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchAvailableModels({ anthropic: 'a', openai: 'o' })).toEqual([]);
  });
});
