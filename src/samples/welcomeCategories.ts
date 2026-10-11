/**
 * Chip-grid card contents. Each `categories` array drives one card's
 * chip grid. Cards reflect the canonical taxonomy:
 *
 *   1. Primitives          — LLM, Agent (Classic / Dynamic)
 *   2. Control Flows       — Sequence, Parallel, Conditional, Loop
 *   3. Patterns            — recipes we provide on top of primitives
 *   4. Context Engineering — what you inject into Agent slots
 *   5. Features            — production-grade governance & safety
 *
 * Every `mode` is the example's folder name in agentfootprint/examples/.
 * URL = `/samples/<sample-id>?mode=<folder>`. Sidebar filters by
 * `cat.group === mode`. Adding a new folder works if you drop a chip in.
 */
// Two primitives — LLM + Agent (= ReAct). Agent has two modes: Static
// (fixed toolset every iter) and Dynamic (tools/context narrow per iter
// via autoActivate). Patterns BELOW are compositions on top of these
// — they are NOT Agent modes.
export const PRIMITIVE_CATEGORIES = [
  { mode: 'core',          label: 'LLM',             sample: 'llm-call',      desc: 'One-shot LLM primitive' },
  { mode: 'dynamic-react', label: 'Agent · Static',  sample: 'classic-react', desc: 'ReAct — fixed toolset' },
  { mode: 'dynamic-react', label: 'Agent · Dynamic', sample: 'dynamic-react', desc: 'ReAct — tools narrow per iter' },
];

export const CONTROL_FLOW_CATEGORIES = [
  { mode: 'core-flow', label: 'Sequence',    sample: 'sequence',    desc: 'Linear pipeline' },
  { mode: 'core-flow', label: 'Parallel',    sample: 'parallel',    desc: 'Fan-out + merge' },
  { mode: 'core-flow', label: 'Conditional', sample: 'conditional', desc: 'Predicate routing' },
  { mode: 'core-flow', label: 'Loop',        sample: 'loop',        desc: 'Bounded iteration' },
];

export const PATTERN_CATEGORIES = [
  { mode: 'patterns', label: 'Self-Consistency', sample: 'self-consistency', desc: 'Sample N, vote (Wang 2022)' },
  { mode: 'patterns', label: 'Reflection',       sample: 'reflection',       desc: 'Self-Refine (Madaan 2023)' },
  { mode: 'patterns', label: 'Debate',           sample: 'debate',           desc: 'Multi-Agent Debate (Du 2023)' },
  { mode: 'patterns', label: 'MapReduce',        sample: 'map-reduce',       desc: 'Split → summarize → combine' },
  { mode: 'patterns', label: 'Tree of Thoughts', sample: 'tot',              desc: 'Branch + evaluate (Yao 2023)' },
  { mode: 'patterns', label: 'Swarm',            sample: 'swarm',            desc: 'Multi-agent handoff' },
];

export const CONTEXT_CATEGORIES = [
  { mode: 'context-engineering', label: 'Skills',       sample: 'skill',         desc: 'Activate → prompt + tools' },
  { mode: 'context-engineering', label: 'RAG',          sample: 'rag',           desc: 'Retrieved chunks → messages' },
  { mode: 'memory',              label: 'Memory',       sample: 'window-strategy', desc: 'Window / budget / summarize / topK' },
  { mode: 'context-engineering', label: 'Steering',     sample: 'steering',      desc: 'Always-on system rule' },
  { mode: 'context-engineering', label: 'Instructions', sample: 'instruction',   desc: 'Activate-when system rule' },
  { mode: 'context-engineering', label: 'Dynamic ReAct', sample: 'dynamic-react', desc: 'Context morphs each iter' },
];

export const FEATURE_CATEGORIES = [
  { mode: 'features', label: 'Resilience',       sample: 'reliability',     desc: 'Retry / fallback / circuit breaker' },
  { mode: 'features', label: 'HITL',             sample: 'pause-resume',    desc: 'Pause / resume — human-in-the-loop' },
  { mode: 'features', label: 'Permissions',      sample: 'permissions',     desc: 'Tool-call gating' },
  { mode: 'features', label: 'Sequence policy',  sample: 'sequence-policy', desc: 'Sequence-aware governance' },
  { mode: 'features', label: 'Output schema',    sample: 'strict-output',   desc: 'Instructor-style retry' },
  { mode: 'features', label: 'Observability',    sample: 'observability',   desc: 'Recorders, metrics, traces' },
];
