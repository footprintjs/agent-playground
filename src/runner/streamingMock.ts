/**
 * asStreaming — wraps any LLMProvider so its responses STREAM via the
 * agentfootprint StreamCallback, instead of returning the whole content
 * string in one shot. Makes the "Run with Mock" experience visually
 * match "Run with Anthropic" — same token-by-token reveal, same
 * lifecycle event cadence, same UX.
 *
 * Why playground-side and not in agentfootprint:
 *   - Streaming mocks are a UX polish for the playground, not a
 *     library concern. The library's `mock([...])` should stay simple.
 *   - We can iterate the feel (msPerToken, chunk strategy) here without
 *     bumping agentfootprint versions.
 */

import type { LLMProvider } from 'agentfootprint';

export interface AsStreamingOptions {
  /** Average milliseconds between emitted tokens. Default 28ms. */
  readonly msPerToken?: number;
  /** Random jitter added to each per-token delay (±ms). Default 14. */
  readonly jitterMs?: number;
  /** Time to first token — the "thinking before speaking" beat. Real
   *  Claude/GPT: 400–1200ms, higher with extended thinking. Default 750. */
  readonly firstTokenDelayMs?: number;
  /** Extra jitter on the TTFT so consecutive runs feel different.
   *  Default ±400ms. */
  readonly firstTokenJitterMs?: number;
  /** After a sentence-ending token, add this much pause (ms) before
   *  the next token. Mimics the natural "forming the next phrase"
   *  rhythm of real LLMs mid-response. Default 120. */
  readonly sentencePauseMs?: number;
  /** When the mock response includes tool calls, add this extra delay
   *  after tokens finish but BEFORE the chat() promise resolves.
   *  Simulates the LLM's "committing to a tool call" pause that happens
   *  in real providers between the text and the tool_use block.
   *  Default 350. */
  readonly toolDeliberationMs?: number;
  /** Extra per-token sink, called regardless of whether the downstream
   *  caller subscribed via the agent's streamCallback / onEvent. */
  readonly onToken?: (token: string) => void;
  /** Called once when the response is fully streamed. */
  readonly onDone?: () => void;
}

/** Fake-but-plausible token usage. ~4 chars per token is the common
 *  heuristic for OpenAI/Anthropic English text. Used to fill in the
 *  mock's response `usage` field so Lens + CostRecorder + TokenRecorder
 *  all have data to render. */
function estimateUsage(
  messages: ReadonlyArray<{ content: unknown }>,
  result: { content: unknown },
): { inputTokens: number; outputTokens: number } {
  const inputText = messages
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join(' ');
  const outputText = typeof result.content === 'string' ? result.content : '';
  return {
    inputTokens: Math.max(4, Math.ceil(inputText.length / 4)),
    outputTokens: Math.max(4, Math.ceil(outputText.length / 4)),
  };
}

/** Split content into roughly-token-sized chunks (~3-6 chars) at word
 *  boundaries. Real LLM tokenizers are different, but this LOOKS the
 *  same to a viewer and keeps the implementation trivial. */
function tokenize(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const ch of text) {
    buf += ch;
    if (ch === ' ' || ch === '\n' || buf.length >= 6) {
      out.push(buf);
      buf = '';
    }
  }
  if (buf) out.push(buf);
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wrap a provider so its `chat()` calls stream via the StreamCallback.
 * Falls back to the underlying provider's response shape — only the
 * delivery changes.
 */
export function asStreaming(
  inner: LLMProvider,
  opts: AsStreamingOptions = {},
): LLMProvider {
  const msPerToken = opts.msPerToken ?? 28;
  const jitterMs = opts.jitterMs ?? 14;
  const firstTokenDelayMs = opts.firstTokenDelayMs ?? 750;
  const firstTokenJitterMs = opts.firstTokenJitterMs ?? 400;
  const sentencePauseMs = opts.sentencePauseMs ?? 120;
  const toolDeliberationMs = opts.toolDeliberationMs ?? 350;
  const onToken = opts.onToken;
  const onDone = opts.onDone;

  /** Does this token end a sentence / phrase? Used to insert natural
   *  "forming next phrase" pauses during streaming. */
  const isSentenceEnd = (t: string) => /[.!?,:;]\s*$/.test(t) || t.includes('\n');

  return {
    async chat(messages, options) {
      const stream = options?.streamCallback;
      const rawResult = await inner.chat(messages, options);

      // Augment the mock's response so Lens (and agent recorders) have
      // the same structured fields they get from real providers like
      // BrowserAnthropicAdapter. Without these, the Lens trace looks
      // thin — usage/model/finishReason all missing.
      const result = {
        ...rawResult,
        model: (rawResult as { model?: string }).model ?? 'mock-claude-sonnet-4',
        finishReason:
          (rawResult as { finishReason?: string }).finishReason ??
          (Array.isArray((rawResult as { toolCalls?: unknown[] }).toolCalls) &&
          ((rawResult as { toolCalls?: unknown[] }).toolCalls as unknown[]).length > 0
            ? 'tool_use'
            : 'stop'),
        usage:
          (rawResult as { usage?: unknown }).usage ??
          estimateUsage(messages, rawResult),
      } as typeof rawResult;

      const content = typeof result.content === 'string' ? result.content : null;
      const hasToolCalls =
        Array.isArray((result as { toolCalls?: unknown[] }).toolCalls) &&
        ((result as { toolCalls?: unknown[] }).toolCalls as unknown[]).length > 0;

      if (content) {
        // TTFT — the "thinking before speaking" beat. Randomized so
        // consecutive calls feel different, not mechanical.
        const ttftJitter = (Math.random() * 2 - 1) * firstTokenJitterMs;
        await sleep(Math.max(150, firstTokenDelayMs + ttftJitter));

        const tokens = tokenize(content);
        for (const token of tokens) {
          if (stream) stream({ type: 'text', text: token });
          if (onToken) onToken(token);

          // Base per-token delay with jitter
          const baseJitter = (Math.random() * 2 - 1) * jitterMs;
          let delay = msPerToken + baseJitter;

          // Sentence-ending tokens get an extra pause — matches the
          // natural cadence of real LLMs forming the next phrase.
          if (isSentenceEnd(token)) {
            delay += sentencePauseMs + (Math.random() * 2 - 1) * 40;
          }

          await sleep(Math.max(0, delay));
        }
      }

      // If the response ends with a tool call, add a visible "deliberation"
      // pause AFTER tokens but BEFORE resolving chat(). Real LLMs have a
      // perceptible gap between the text and the tool_use block — this
      // makes the Agent's ExecuteTools stage feel like a genuine decision,
      // not an instant chain.
      if (hasToolCalls) {
        await sleep(toolDeliberationMs);
      }

      if (content) {
        if (stream) stream({ type: 'done' });
        if (onDone) onDone();
      }

      return result;
    },
  } as LLMProvider;
}
