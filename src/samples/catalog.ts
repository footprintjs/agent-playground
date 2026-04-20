/**
 * Sample catalog — sources code directly from agentfootprint/examples.
 *
 * The `@samples/*` alias resolves to `../agentfootprint/examples/*` (see
 * vite.config.ts). Mirrors the footprint-playground/footPrint pattern:
 * library's examples are the single source of truth for the playground,
 * no middle `agent-samples` repo.
 *
 * Each sample is imported as a raw string via Vite's ?raw suffix,
 * then transformed to extract the run() body for the playground sandbox.
 *
 * Samples not in agentfootprint/examples remain inline (playground-only
 * demos — live chat, multimodal, etc.).
 */

// ── Raw imports from agentfootprint/examples ────────────────
import s01Raw from '@samples/concepts/01-llm-call.ts?raw';
import s02Raw from '@samples/concepts/02-agent.ts?raw';
import s03Raw from '@samples/concepts/03-rag.ts?raw';
import s04Raw from '@samples/providers/01-prompt.ts?raw';
import s05Raw from '@samples/providers/02-message.ts?raw';
import s06Raw from '@samples/providers/03-tool.ts?raw';
import s07Raw from '@samples/concepts/04-flowchart.ts?raw';
import s08Raw from '@samples/concepts/07-swarm.ts?raw';
import s09Raw from '@samples/resilience/01-runner-wrappers.ts?raw';
import s10Raw from '@samples/observability/01-recorders.ts?raw';
import s13Raw from '@samples/integrations/01-full-integration.ts?raw';
import s15Raw from '@samples/integrations/02-error-handling.ts?raw';
import s20Raw from '@samples/security/01-gated-tools.ts?raw';
import s21Raw from '@samples/resilience/02-provider-fallback.ts?raw';
import s22Raw from '@samples/runtime-features/memory/01-memory-pipeline.ts?raw';
import s23Raw from '@samples/patterns/01-regular-vs-dynamic.ts?raw';

// ── New-in-restructure examples (previously inline or absent) ───
import s24Raw from '@samples/concepts/05-parallel.ts?raw';
import s27Raw from '@samples/concepts/06-conditional.ts?raw';
import s30Raw from '@samples/patterns/02-plan-execute.ts?raw';
import s31Raw from '@samples/patterns/03-reflexion.ts?raw';
import s32Raw from '@samples/patterns/04-tree-of-thoughts.ts?raw';
import s33Raw from '@samples/patterns/05-map-reduce.ts?raw';
import s34Raw from '@samples/observability/02-explain.ts?raw';
import s35Raw from '@samples/observability/03-otel.ts?raw';
import s36Raw from '@samples/observability/04-export-trace.ts?raw';
import s37Raw from '@samples/runtime-features/streaming/01-events.ts?raw';
import s38Raw from '@samples/runtime-features/instructions/01-basic.ts?raw';
import s39Raw from '@samples/runtime-features/parallel-tools/01-parallel-tools.ts?raw';
import s40Raw from '@samples/runtime-features/custom-route/01-custom-route.ts?raw';
import s41Raw from '@samples/advanced/01-agent-loop.ts?raw';

// ── Types ────────────────────────────────────────────────────

export interface Sample {
  id: string;
  number: number;
  title: string;
  description: string;
  category: string;
  code: string;
}

export interface SampleCategory {
  name: string;
  samples: Sample[];
}

// ── Transform: strip JSDoc, skip meta export, unwrap run(), remove CLI guard ──
//
// Source shape (the factory contract every example in agentfootprint/examples uses):
//
//   /** JSDoc */
//   import { Agent, mock } from 'agentfootprint';
//   import type { LLMProvider } from 'agentfootprint';
//   import { isCliEntry, printResult, type ExampleMeta } from '../helpers/cli';
//
//   export const meta: ExampleMeta = { ... };
//
//   const defaultMock = () => mock([...]);
//
//   export async function run(input: string, provider?: LLMProvider) {
//     // <the body we want the playground sandbox to execute>
//   }
//
//   if (isCliEntry(import.meta.url)) { run(meta.defaultInput).then(...) }
//
// executeCode.ts strips imports and injects agentfootprint modules. This
// transform handles the rest:
//   1. Strip the JSDoc block at the top
//   2. Skip the `export const meta = { ... };` block (the sandbox runs inside
//      an async IIFE — a top-level `export` statement would be a syntax error)
//   3. Skip the `if (isCliEntry(...)) { ... }` guard
//   4. Unwrap `export async function run(input, provider?) { ... }` — strip
//      the declaration line + matching closing brace; keep the body dedented.
//   5. Keep module-scope helpers (tool defs, default mocks, etc.) so the body
//      can reference them.

function fromSample(raw: string): string {
  const lines = raw.split('\n');
  const result: string[] = [];
  let inJsDoc = false;
  let insideRun = false;
  let braceDepth = 0;
  let skipBlockUntilClose = false; // true while we're inside a meta export or CLI guard block
  let skipBraceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip JSDoc block at the top
    if (trimmed.startsWith('/**') && i < 10 && !inJsDoc) {
      inJsDoc = true;
      if (trimmed.includes('*/')) inJsDoc = false; // single-line /** ... */
      continue;
    }
    if (inJsDoc) {
      if (trimmed.includes('*/')) inJsDoc = false;
      continue;
    }

    // If we're inside a brace-tracked skip block (meta export or CLI guard),
    // stay in it until the matching `}` closes.
    if (skipBlockUntilClose) {
      for (const ch of line) {
        if (ch === '{') skipBraceDepth++;
        else if (ch === '}') skipBraceDepth--;
      }
      if (skipBraceDepth <= 0) skipBlockUntilClose = false;
      continue;
    }

    // Skip `export const meta = { ... };` — an exported top-level statement
    // is not valid inside the sandbox's async IIFE.
    if (trimmed.startsWith('export const meta')) {
      skipBraceDepth = 0;
      for (const ch of line) {
        if (ch === '{') skipBraceDepth++;
        else if (ch === '}') skipBraceDepth--;
      }
      skipBlockUntilClose = skipBraceDepth > 0;
      continue;
    }

    // Skip the CLI guard (new `if (isCliEntry(...))`, legacy `if (process.argv ...)`,
    // or `if (import.meta.url ...)` fallback form).
    if (
      trimmed.startsWith('if (isCliEntry(') ||
      trimmed.startsWith('if (process.argv') ||
      trimmed.startsWith('if (import.meta.url')
    ) {
      skipBraceDepth = 0;
      for (const ch of line) {
        if (ch === '{') skipBraceDepth++;
        else if (ch === '}') skipBraceDepth--;
      }
      skipBlockUntilClose = skipBraceDepth > 0;
      continue;
    }

    // Detect `export async function run(...)` / `export function run(...)`.
    if (!insideRun && /^export\s+(async\s+)?function\s+run\b/.test(trimmed)) {
      insideRun = true;
      braceDepth = 0;
      // Count braces on the declaration line — some samples put `{` on the
      // same line as the signature, others on the next.
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }
      continue; // skip the declaration line itself
    }

    if (insideRun) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }

      if (braceDepth <= 0) {
        // Closing `}` of run() — drop it.
        insideRun = false;
        continue;
      }

      // Dedent by 2 spaces for readability.
      result.push(line.startsWith('  ') ? line.slice(2) : line);
    } else {
      result.push(line);
    }
  }

  // Clean up leading/trailing blank lines
  while (result.length > 0 && result[0].trim() === '') result.shift();
  while (result.length > 0 && result[result.length - 1].trim() === '') result.pop();

  return result.join('\n') + '\n';
}

// ── Transform file-imported samples ──────────────────────────

const s01 = fromSample(s01Raw);
const s02 = fromSample(s02Raw);
const s03 = fromSample(s03Raw);
const s04 = fromSample(s04Raw);
const s05 = fromSample(s05Raw);
const s06 = fromSample(s06Raw);
const s07 = fromSample(s07Raw);
const s08 = fromSample(s08Raw);
const s09 = fromSample(s09Raw);
const s10 = fromSample(s10Raw);
const s13 = fromSample(s13Raw);
const s15 = fromSample(s15Raw);
const s20 = fromSample(s20Raw);
const s21 = fromSample(s21Raw);
const s22 = fromSample(s22Raw);
const s23 = fromSample(s23Raw);

// New-in-restructure examples
const s24 = fromSample(s24Raw);
const s27 = fromSample(s27Raw);
const s30 = fromSample(s30Raw);
const s31 = fromSample(s31Raw);
const s32 = fromSample(s32Raw);
const s33 = fromSample(s33Raw);
const s34 = fromSample(s34Raw);
const s35 = fromSample(s35Raw);
const s36 = fromSample(s36Raw);
const s37 = fromSample(s37Raw);
const s38 = fromSample(s38Raw);
const s39 = fromSample(s39Raw);
const s40 = fromSample(s40Raw);
const s41 = fromSample(s41Raw);

// ── Inline samples (not yet in agent-samples) ────────────────

const s11 = `
import { mcpToolProvider } from 'agentfootprint';

// Mock MCP client (in production, this connects to a real MCP server)
const client = {
  listTools: async () => [
    { name: 'file_read', description: 'Read a file', inputSchema: { type: 'object' } },
    { name: 'file_write', description: 'Write a file', inputSchema: { type: 'object' } },
    { name: 'shell_exec', description: 'Execute shell command', inputSchema: { type: 'object' } },
  ],
  callTool: async (name, args) => ({ content: name + ': ' + JSON.stringify(args) }),
};

const provider = mcpToolProvider({ client });
const tools = await provider.resolve({ message: '', turnNumber: 0, loopIteration: 0, messages: [] });

return {
  availableTools: tools.map(t => t.name),
  count: tools.length,
};
`;

const s12 = `
import { agentLoop, mock } from 'agentfootprint';

const result = await agentLoop({
  provider: mock([
    { content: 'The sky is blue because of Rayleigh scattering of sunlight in the atmosphere.' },
  ]),
  messages: [{ role: 'user', content: input }],
  maxIterations: 5,
});

return {
  content: result.content,
  iterations: result.iterations,
  finishReason: result.finishReason,
};
`;

const s14 = `
import { AnthropicAdapter, OpenAIAdapter, createProvider } from 'agentfootprint';
import { anthropic, openai } from 'agentfootprint';
import { userMessage } from 'agentfootprint';

// Mock SDK clients for playground (real SDKs not installed)
const mockAnthropicClient = {
  messages: {
    create: async () => ({
      id: 'msg_1', model: 'claude-sonnet-4-20250514', role: 'assistant',
      content: [{ type: 'text', text: 'Hello from Claude!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 8 },
    }),
  },
};

const mockOpenAIClient = {
  chat: { completions: { create: async () => ({
    id: 'chatcmpl-1', model: 'gpt-4o',
    choices: [{ index: 0, message: { role: 'assistant', content: 'Hello from GPT!' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
  }) } },
};

const r1 = await new AnthropicAdapter({ model: 'claude-sonnet-4-20250514', _client: mockAnthropicClient }).chat([userMessage(input)]);
const r2 = await new OpenAIAdapter({ model: 'gpt-4o', _client: mockOpenAIClient }).chat([userMessage(input)]);

const provider = createProvider({ ...anthropic('claude-sonnet-4-20250514'), _client: mockAnthropicClient });
const r3 = await provider.chat([userMessage(input)]);

return {
  anthropic: r1.content,
  openai: r2.content,
  viaCreateProvider: r3.content,
};
`;

const s16 = `
import { textBlock, base64Image, urlImage, userMessage } from 'agentfootprint';

const text = textBlock('Describe this image:');
const b64img = base64Image('image/png', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
const urlImg = urlImage('https://example.com/photo.jpg');

const msg = userMessage([text, b64img]);

return {
  textBlock: text,
  base64ImageBlock: { type: b64img.type, mediaType: b64img.source.mediaType },
  urlImageBlock: { type: urlImg.type, url: urlImg.source.url },
  multiModalMessage: { role: msg.role, blocks: Array.isArray(msg.content) ? msg.content.length : 1 },
  supportedAdapters: ['Anthropic (base64 blocks)', 'OpenAI (data URIs)', 'Bedrock (image bytes)'],
};
`;

const s17 = `
import { LLMCall, BrowserAnthropicAdapter, BrowserOpenAIAdapter, mock, TokenRecorder } from 'agentfootprint';

const tokens = new TokenRecorder();

let provider;
if (__apiKeys.anthropic) {
  provider = new BrowserAnthropicAdapter({
    apiKey: __apiKeys.anthropic,
    model: 'claude-sonnet-4-20250514',
  });
  console.log('Using Anthropic API (claude-sonnet-4-20250514)');
} else if (__apiKeys.openai) {
  provider = new BrowserOpenAIAdapter({
    apiKey: __apiKeys.openai,
    model: 'gpt-4o-mini',
  });
  console.log('Using OpenAI API (gpt-4o-mini)');
} else {
  provider = mock([{
    content: 'This is a mock response. To use a real LLM, click the gear icon in the header and add your API key.',
  }]);
  console.log('No API key set — using mock. Click the gear icon to add your key.');
}

const runner = LLMCall
  .create({ provider })
  .system('You are a helpful, concise assistant.')
  .recorder(tokens)
  .build();

const result = await runner.run(input);
return {
  content: result.content,
  tokenStats: tokens.getStats(),
  provider: __apiKeys.anthropic ? 'anthropic' : __apiKeys.openai ? 'openai' : 'mock',
};
`;

const s18 = `
import { flowChart, FlowChartExecutor } from 'footprintjs';

const innerFlowStructure = {
  name: 'Validate-Input', id: 'validate', type: 'stage',
  next: { name: 'Fetch-Data', id: 'fetch', type: 'stage',
    next: { name: 'Format-Response', id: 'format', type: 'stage' } },
};

const chart = flowChart(
  'Receive Request',
  async (scope) => {
    scope.setValue('request', scope.getArgs());
    console.log('Stage 1: Received request');
  },
  'receive', undefined, 'Accept incoming request',
)
  .addFunction('Process with Tool', async (scope) => {
    const toolResult = { status: 'ok', data: 'processed: ' + scope.getValue('request') };
    scope.setValue('toolResult', toolResult);
    console.log('Stage 2: Tool executed (inner pipeline already ran)');
    return {
      name: 'TOOL_TRACE', id: 'tool-trace', isSubflowRoot: true,
      subflowId: 'inner-pipeline', subflowName: 'Tool Internal Pipeline',
      description: 'Validate → Fetch → Format (pre-executed)',
      subflowDef: { buildTimeStructure: innerFlowStructure },
    };
  }, 'process', undefined, 'Execute tool with structural trace')
  .addFunction('Return Response', async (scope) => {
    const result = scope.getValue('toolResult');
    scope.setValue('response', { ...result, timestamp: Date.now() });
    console.log('Stage 3: Response ready');
  }, 'respond', undefined, 'Format and return response')
  .setEnableNarrative()
  .build();

const executor = new FlowChartExecutor(chart);
await executor.run({ input });

const snapshot = executor.getSnapshot();
const narrative = executor.getNarrative();

return {
  response: snapshot.sharedState?.response,
  narrative,
  stages: snapshot.executionTree?.name,
  hasSubflowTrace: !!snapshot.executionTree?.children?.[0]?.children?.[0]?.subflowStructure,
};
`;

const s19 = `
import { flowChart, FlowChartExecutor } from 'footprintjs';
import { LLMCall, mock, TokenRecorder } from 'agentfootprint';

const authService = flowChart(
  'Validate Token', async (scope) => { scope.setValue('tokenValid', true); console.log('Auth: token validated'); },
  'validate-token', undefined, 'Validate JWT and extract claims',
).addFunction('Check Permissions', async (scope) => {
  scope.setValue('authorized', true); console.log('Auth: permissions checked');
}, 'check-perms', 'Verify user permissions').build();

const paymentService = flowChart(
  'Create Charge', async (scope) => { scope.setValue('chargeId', 'ch_' + Date.now()); console.log('Payment: charge created'); },
  'create-charge', undefined, 'Create payment charge',
).addFunction('Confirm Payment', async (scope) => {
  scope.setValue('paymentStatus', 'confirmed'); console.log('Payment: confirmed');
}, 'confirm-payment', 'Wait for confirmation').build();

const notificationService = flowChart(
  'Send Email', async (scope) => { scope.setValue('emailSent', true); console.log('Notification: email sent'); },
  'send-email', undefined, 'Send transactional email',
).build();

const resolved = [];

const chart = flowChart(
  'Parse Request', async (scope) => {
    const services = scope.getArgs()?.requiredServices ?? ['auth', 'payment'];
    scope.setValue('requiredServices', services);
    console.log('Required services:', services);
  }, 'parse-request', undefined, 'Determine required services',
)
  .addSelectorFunction('Route Services', async (scope) => scope.getValue('requiredServices'), 'route-services', 'Select which services to invoke')
    .addLazySubFlowChartBranch('auth', () => { resolved.push('auth'); return authService; }, 'Auth Service')
    .addLazySubFlowChartBranch('payment', () => { resolved.push('payment'); return paymentService; }, 'Payment Service')
    .addLazySubFlowChartBranch('notification', () => { resolved.push('notification'); return notificationService; }, 'Notification Service')
    .end()
  .addFunction('Build Response', async (scope) => { scope.setValue('status', 200); console.log('Response: OK'); }, 'build-response', 'Aggregate results')
  .setEnableNarrative()
  .build();

const executor = new FlowChartExecutor(chart);
await executor.run({ input });

return {
  resolved,
  subflowCount: executor.getSubflowResults().size,
  narrative: executor.getNarrative(),
  snapshot: executor.getSnapshot(),
};
`;

// (Legacy inline s24 "Parallel — optimist/critic" removed. The new
// file-based `s24` from concepts/05-parallel.ts replaces it above.)

// ── Observability deep-dive samples (inline) ────────────────

const s25 = `
import { LLMCall, mock } from 'agentfootprint';
import { TokenRecorder, CostRecorder } from 'agentfootprint/observe';

// Individual recorders for fine-grained control
const tokens = new TokenRecorder();
const cost = new CostRecorder({
  pricingTable: {
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'gpt-4o': { input: 2.5, output: 10 },
  },
});

const runner = LLMCall
  .create({ provider: mock([{ content: 'Hello!' }]) })
  .system('You are a helpful assistant.')
  .recorder(tokens)
  .recorder(cost)
  .build();

await runner.run(input);

return {
  tokenStats: tokens.getStats(),
  totalCost: cost.getTotalCost(),
  costBreakdown: cost.getEntries(),
};
`;

const s26 = `
import { Agent, mock, defineTool } from 'agentfootprint';
import { ToolUsageRecorder } from 'agentfootprint/observe';

const searchTool = defineTool({
  id: 'search',
  description: 'Search the web',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
  handler: async ({ query }) => ({ content: 'Results for: ' + query }),
});

const calcTool = defineTool({
  id: 'calculate',
  description: 'Perform calculations',
  inputSchema: { type: 'object', properties: { expression: { type: 'string' } } },
  handler: async ({ expression }) => ({ content: 'Result: 42' }),
});

const toolUsage = new ToolUsageRecorder();

const runner = Agent
  .create({ provider: mock([
    { content: 'Searching...', toolCalls: [
      { id: '1', name: 'search', arguments: { query: 'population' } },
      { id: '2', name: 'calculate', arguments: { expression: '8.1e9 * 0.6' } },
    ] },
    { content: 'About 4.86 billion people have internet access.' },
  ]) })
  .system('Use tools to answer questions.')
  .tool(searchTool)
  .tool(calcTool)
  .recorder(toolUsage)
  .build();

await runner.run(input);

const stats = toolUsage.getStats();
return {
  totalCalls: stats.totalCalls,
  byTool: stats.byTool,
};
`;

// (Legacy inline s27 "Grounding (obs.explain)" removed. The new file-based
// `s34` from observability/02-explain.ts provides the grounding demo, and
// `s27` now points at concepts/06-conditional.ts.)

const s28 = `
import { Agent, mock } from 'agentfootprint';
import { OTelRecorder } from 'agentfootprint/observe';

// Duck-typed OTel tracer — in production, use @opentelemetry/api
const spans = [];
const mockTracer = {
  startSpan: (name, options) => {
    const span = { name, attributes: { ...options?.attributes }, events: [] };
    spans.push(span);
    return {
      setAttribute: (k, v) => { span.attributes[k] = v; },
      setStatus: (s) => { span.status = s; },
      end: () => { span.endedAt = Date.now(); },
    };
  },
};

const otel = new OTelRecorder(mockTracer);

const runner = Agent
  .create({ provider: mock([{ content: 'Hello from the traced agent!' }]) })
  .system('You are a helpful assistant.')
  .recorder(otel)
  .build();

await runner.run(input);

return {
  spanCount: spans.length,
  spans: spans.map(s => ({
    name: s.name,
    model: s.attributes['gen_ai.request.model'],
    inputTokens: s.attributes['gen_ai.usage.input_tokens'],
    outputTokens: s.attributes['gen_ai.usage.output_tokens'],
  })),
};
`;

const s29 = `
import { Agent, mock, defineTool } from 'agentfootprint';
import { agentObservability } from 'agentfootprint/observe';

// Simulate CloudWatch putMetricData
const cloudwatchMetrics = [];
function putMetric(namespace, name, value, unit) {
  cloudwatchMetrics.push({ namespace, name, value, unit, timestamp: new Date().toISOString() });
}

const searchTool = defineTool({
  id: 'search',
  description: 'Search',
  inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
  handler: async ({ q }) => ({ content: 'Found: ' + q }),
});

const obs = agentObservability();

const runner = Agent
  .create({ provider: mock([
    { content: 'Searching...', toolCalls: [{ id: '1', name: 'search', arguments: { q: 'data' } }] },
    { content: 'Here is the data.' },
  ]) })
  .system('Search assistant.')
  .tool(searchTool)
  .recorder(obs)
  .build();

await runner.run(input);

// Export recorder data to CloudWatch-style metrics
const tokens = obs.tokens();
putMetric('AgentFootprint', 'InputTokens', tokens.totalInputTokens, 'Count');
putMetric('AgentFootprint', 'OutputTokens', tokens.totalOutputTokens, 'Count');
putMetric('AgentFootprint', 'LLMCalls', tokens.totalCalls, 'Count');
putMetric('AgentFootprint', 'EstimatedCost', obs.cost(), 'None');

const tools = obs.tools();
putMetric('AgentFootprint', 'ToolCalls', tools.totalCalls, 'Count');

return {
  metrics: cloudwatchMetrics,
  summary: tokens.totalCalls + ' LLM calls, ' + tools.totalCalls + ' tool calls',
};
`;

// ── Catalog ──────────────────────────────────────────────────

export const samples: Sample[] = [
  // ── Concepts (the 7-concept ladder — library's primary examples) ──
  { id: 'llm-call',       number: 1,  title: 'LLMCall',            description: 'Single prompt → single response. No tools, no loop.',           category: 'Concepts', code: s01 },
  { id: 'agent',          number: 2,  title: 'Agent (ReAct)',       description: 'LLM + tools in a loop. Decides when to call tools and when to stop.', category: 'Concepts', code: s02 },
  { id: 'rag',            number: 3,  title: 'RAG',                 description: 'Retrieve → augment → generate. Answer grounded in chunks.',      category: 'Concepts', code: s03 },
  { id: 'flowchart',      number: 4,  title: 'FlowChart',           description: 'Sequential pipeline — runners chained in order.',                category: 'Concepts', code: s07 },
  { id: 'parallel',       number: 5,  title: 'Parallel',            description: 'Fan-out, run N runners concurrently, merge results.',             category: 'Concepts', code: s24 },
  { id: 'conditional',    number: 6,  title: 'Conditional',         description: 'Deterministic if/else routing between runners.',                  category: 'Concepts', code: s27 },
  { id: 'swarm',          number: 7,  title: 'Swarm',               description: 'LLM-routed delegation — orchestrator picks a specialist at runtime.', category: 'Concepts', code: s08 },

  // ── Patterns (loop-shape + 4 composition factories) ──
  { id: 'loop-pattern',   number: 10, title: 'Regular vs Dynamic',  description: 'AgentPattern — which slots re-evaluate each iteration.',         category: 'Patterns',  code: s23 },
  { id: 'plan-execute',   number: 11, title: 'planExecute',         description: 'Planner → Executor (cheap planner + capable executor).',         category: 'Patterns',  code: s30 },
  { id: 'reflexion',      number: 12, title: 'reflexion',           description: 'Solve → Critique → Improve (self-review pass).',                 category: 'Patterns',  code: s31 },
  { id: 'tot',            number: 13, title: 'treeOfThoughts',      description: 'N parallel thinkers → judge picks the best.',                    category: 'Patterns',  code: s32 },
  { id: 'map-reduce',     number: 14, title: 'mapReduce',           description: 'Fan-out pre-bound mappers → reduce (LLM or function).',          category: 'Patterns',  code: s33 },

  // ── Providers (3 strategy slots) ──
  { id: 'prompt-strategy',  number: 20, title: 'PromptProvider',     description: 'Different system prompts per runner, same input.',              category: 'Providers', code: s04 },
  { id: 'message-strategy', number: 21, title: 'MessageStrategy',    description: 'slidingWindow, charBudget — context-window management.',        category: 'Providers', code: s05 },
  { id: 'tool-strategy',    number: 22, title: 'ToolProvider',       description: 'ToolRegistry + defineTool — register, list, retrieve.',         category: 'Providers', code: s06 },

  // ── Runtime features (during execution) ──
  { id: 'streaming',        number: 30, title: 'Streaming events',   description: 'AgentStreamEvent — 9 lifecycle events for real-time UX.',       category: 'Runtime',   code: s37 },
  { id: 'instructions',     number: 31, title: 'Instructions',       description: 'defineInstruction — conditional context injection.',            category: 'Runtime',   code: s38 },
  { id: 'parallel-tools',   number: 32, title: 'Parallel tools',     description: '.parallelTools(true) — concurrent tool calls in one turn.',      category: 'Runtime',   code: s39 },
  { id: 'custom-route',     number: 33, title: 'Custom routing',     description: 'Agent.route({ branches }) — inject branches ahead of default.',  category: 'Runtime',   code: s40 },
  { id: 'memory-pipeline',  number: 34, title: 'Memory pipeline',    description: 'Persistent memory across sessions via MemoryPipeline.',          category: 'Runtime',   code: s22 },

  // ── Observability (after execution) ──
  { id: 'recorders',        number: 40, title: 'agentObservability',  description: 'Tokens + tools + cost + grounding — one call.',                 category: 'Observability', code: s10 },
  { id: 'explain',          number: 41, title: 'ExplainRecorder',     description: 'Per-iteration grounding — sources, claims, decisions.',         category: 'Observability', code: s34 },
  { id: 'otel-style',       number: 42, title: 'Cost + Token + Turn', description: 'OTel-style metrics bundle — the cost+token side.',             category: 'Observability', code: s35 },
  { id: 'export-trace',     number: 43, title: 'exportTrace',         description: 'Serialize a run to portable JSON — for viewers, replay, audit.', category: 'Observability', code: s36 },
  { id: 'otel-export',      number: 44, title: 'OpenTelemetry spans', description: 'OTelRecorder — spans to Datadog, Grafana, any OTel backend.',  category: 'Observability', code: s28 },
  { id: 'cloudwatch-export', number: 45, title: 'CloudWatch export',  description: 'Recorder data → AWS CloudWatch metrics pipeline.',              category: 'Observability', code: s29 },
  { id: 'tool-usage',       number: 46, title: 'Tool Usage',          description: 'ToolUsageRecorder — per-tool calls, errors, latency.',          category: 'Observability', code: s26 },

  // ── Security + Resilience ──
  { id: 'gated-tools',      number: 50, title: 'Permission-gated tools', description: 'LLM never sees blocked tools — defense-in-depth.',           category: 'Security',     code: s20 },
  { id: 'runner-wrappers',  number: 51, title: 'withRetry / Fallback',   description: 'Wrap any RunnerLike with retry / fallback / circuit breaker.', category: 'Resilience', code: s09 },
  { id: 'provider-fallback', number: 52, title: 'fallbackProvider',      description: 'Automatic failover across LLM providers.',                   category: 'Resilience',   code: s21 },

  // ── Advanced ──
  { id: 'agent-loop',       number: 60, title: 'agentLoop() engine',  description: 'Low-level — what Agent/Swarm/RAG wrap internally.',             category: 'Advanced',     code: s41 },

  // ── Integrations / full stack ──
  { id: 'full-integration', number: 70, title: 'Full integration',    description: 'RAG + Agent + tools composed end-to-end.',                      category: 'Integration',  code: s13 },
  { id: 'error-handling',   number: 71, title: 'Error handling',      description: 'LLMError taxonomy + classifyStatusCode + wrapSDKError.',        category: 'Integration',  code: s15 },

  // ── Playground-only inline demos (no library equivalent) ──
  { id: 'protocol-adapters',    number: 80, title: 'MCP tool provider',    description: 'mcpToolProvider — bridge external MCP servers.',            category: 'Adapters',    code: s11 },
  { id: 'real-adapters',        number: 81, title: 'Real adapters (mock)',  description: 'AnthropicAdapter, OpenAIAdapter, createProvider wiring.',   category: 'Adapters',    code: s14 },
  { id: 'multimodal',           number: 82, title: 'Multimodal blocks',     description: 'textBlock, base64Image, urlImage content blocks.',          category: 'Integration', code: s16 },
  { id: 'live-chat',            number: 83, title: 'Live chat',             description: 'Real API call with your key (Anthropic or OpenAI).',        category: 'Integration', code: s17 },
  { id: 'dynamic-tool-subflow', number: 84, title: 'Dynamic tool subflow',  description: 'Pre-executed inner flow attached for drill-down.',          category: 'Runtime',     code: s18 },
  { id: 'lazy-subflow',         number: 85, title: 'Lazy subflow',          description: 'Graph-of-services — lazy branches resolve only when selected.', category: 'Runtime', code: s19 },
];

export function getCategorizedSamples(): SampleCategory[] {
  const categoryOrder = [
    'Concepts',
    'Patterns',
    'Providers',
    'Runtime',
    'Observability',
    'Security',
    'Resilience',
    'Advanced',
    'Integration',
    'Adapters',
  ];
  const map = new Map<string, Sample[]>();

  for (const sample of samples) {
    if (!map.has(sample.category)) map.set(sample.category, []);
    map.get(sample.category)!.push(sample);
  }

  return categoryOrder
    .filter((cat) => map.has(cat))
    .map((cat) => ({ name: cat, samples: map.get(cat)! }));
}
