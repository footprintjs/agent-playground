/**
 * patternSpecs — STUBBED.
 *
 * Original v1-coupled implementation moved aside during the agentfootprint
 * v2 promotion (commit 66fe7b6). Live-chat pattern specs need to be
 * re-implemented against the v2 runner surface; until then, this module
 * is a typed no-op so the v2 sample pages can load without import-time
 * failures from `agentfootprint/instructions`, `mock`, `mockRetriever`, etc.
 */

export type PatternType = string;

export function getPatternSpec(_pattern: PatternType, _presetId?: string): unknown {
  throw new Error('Live pattern specs not yet ported to v2 — original at /tmp/patternSpecs.v1.ts');
}
