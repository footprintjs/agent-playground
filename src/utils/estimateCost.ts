/**
 * estimateCost — pure function to calculate LLM API cost from token usage.
 *
 * Uses published pricing per 1M tokens (USD).
 * Returns 0 for unknown models.
 */

interface TokenUsage {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

// Per 1M tokens, USD
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-haiku-3-5-20241022': { input: 0.80, output: 4 },
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'o3-mini': { input: 1.10, output: 4.40 },
};

/** Estimate cost for a single LLM call. */
export function estimateCallCost(usage: TokenUsage): number {
  const p = PRICING[usage.model];
  if (!p) return 0;
  return (usage.inputTokens / 1_000_000) * p.input
       + (usage.outputTokens / 1_000_000) * p.output;
}

/** Estimate total cost across multiple LLM calls. */
export function estimateTotalCost(calls: readonly TokenUsage[]): number {
  let total = 0;
  for (const call of calls) total += estimateCallCost(call);
  return total;
}

/** Format USD cost for display. */
export function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
