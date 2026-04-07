/**
 * Sample catalog — sources code from agent-samples repo.
 *
 * Each sample is imported as a raw string via Vite's ?raw suffix,
 * then transformed to extract the run() body for the playground sandbox.
 *
 * Samples not yet in agent-samples remain inline (s11–s19).
 */

// ── Raw imports from agent-samples ───────────────────────────
import s01Raw from '@samples/basics/01-simple-llm-call.ts?raw';
import s02Raw from '@samples/basics/02-agent-with-tools.ts?raw';
import s03Raw from '@samples/basics/03-rag-retrieval.ts?raw';
import s04Raw from '@samples/providers/04-prompt-strategies.ts?raw';
import s05Raw from '@samples/providers/05-message-strategies.ts?raw';
import s06Raw from '@samples/providers/06-tool-strategies.ts?raw';
import s07Raw from '@samples/orchestration/07-flowchart-pipeline.ts?raw';
import s08Raw from '@samples/orchestration/08-swarm-delegation.ts?raw';
import s09Raw from '@samples/orchestration/09-resilience.ts?raw';
import s10Raw from '@samples/observability/10-recorders.ts?raw';
import s13Raw from '@samples/integration/13-full-integration.ts?raw';
import s15Raw from '@samples/integration/15-error-handling.ts?raw';
import s20Raw from '@samples/security/20-permission-gated-tools.ts?raw';
import s21Raw from '@samples/resilience/21-provider-fallback.ts?raw';
import s22Raw from '@samples/memory/22-persistent-memory.ts?raw';
import s23Raw from '@samples/orchestration/23-react-loop-decider.ts?raw';

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

// ── Transform: strip JSDoc, unwrap run(), remove CLI guard ───
//
// The sandbox (executeCode.ts) already strips imports and provides `input`.
// We need to:
//   1. Remove the JSDoc block at the top
//   2. Remove `export async function run(input: string) {` and its closing `}`
//   3. Remove the CLI guard (`if (process.argv ...)`)
//   4. Dedent the run() body by 2 spaces
// Module-scope code (like `const searchTool = defineTool(...)`) is kept.

function fromSample(raw: string): string {
  const lines = raw.split('\n');
  const result: string[] = [];
  let inJsDoc = false;
  let insideRun = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip JSDoc block at the top
    if (trimmed.startsWith('/**') && i < 10) { inJsDoc = true; continue; }
    if (inJsDoc) { if (trimmed.includes('*/')) inJsDoc = false; continue; }

    // Skip CLI guard
    if (trimmed.startsWith('if (process.argv')) {
      // Skip until the closing brace (usually 1-2 lines)
      while (i < lines.length - 1 && !lines[i].includes('}')) i++;
      continue;
    }

    // Detect `export async function run(...) {`
    if (!insideRun && trimmed.startsWith('export async function run')) {
      insideRun = true;
      braceDepth = 1;
      continue; // skip the function declaration line
    }

    if (insideRun) {
      // Track braces to find the matching closing `}`
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }

      if (braceDepth <= 0) {
        // This is the closing `}` of run() — skip it
        insideRun = false;
        continue;
      }

      // Dedent by 2 spaces
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

// ── Transform agent-samples ─────────────────────────────────

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

const s24 = `
import { Parallel, Agent, mock } from 'agentfootprint';
import { agentObservability } from 'agentfootprint/observe';

const obs = agentObservability();

// Two agents with different perspectives
const optimist = Agent.create({
  provider: mock([{ content: 'The AI trends look very promising! Advances in reasoning, tool use, and multimodal understanding are opening new markets. Strong growth expected.' }]),
  name: 'optimist',
})
  .system('You are an optimistic analyst. Focus on opportunities and growth.')
  .build();

const critic = Agent.create({
  provider: mock([{ content: 'There are significant risks: regulatory uncertainty, compute costs rising, talent shortage, and over-hyped expectations. Proceed with caution.' }]),
  name: 'critic',
})
  .system('You are a critical analyst. Focus on risks and challenges.')
  .build();

// Run both in parallel, merge with LLM
const parallel = Parallel.create({
  provider: mock([{ content: 'Balanced view: AI presents strong opportunities in reasoning and tool use, but faces real risks from regulation and compute costs. A measured approach is recommended.' }]),
  name: 'balanced-analysis',
})
  .agent('optimist', optimist, 'Positive perspective')
  .agent('critic', critic, 'Critical perspective')
  .mergeWithLLM('Synthesize both perspectives into a balanced, actionable summary.')
  .recorder(obs)
  .build();

const result = await parallel.run(input);

return {
  content: result.content,
  branches: result.branches.map(b => ({ id: b.id, status: b.status, preview: b.content.slice(0, 80) + '...' })),
  tokens: obs.tokens(),
  tools: obs.tools(),
  cost: obs.cost(),
};
`;

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

const s27 = `
import { Agent, mock, defineTool } from 'agentfootprint';
import { agentObservability } from 'agentfootprint/observe';

const orderTool = defineTool({
  id: 'check_order',
  description: 'Check order status',
  inputSchema: { type: 'object', properties: { orderId: { type: 'string' } } },
  handler: async ({ orderId }) => ({ content: 'Order ' + orderId + ': shipped, arrives Thursday' }),
});

const obs = agentObservability();

const runner = Agent
  .create({ provider: mock([
    { content: 'Let me check.', toolCalls: [{ id: '1', name: 'check_order', arguments: { orderId: 'ORD-123' } }] },
    { content: 'Your order ORD-123 has shipped and arrives Thursday.' },
  ]) })
  .system('Help customers with order inquiries.')
  .tool(orderTool)
  .recorder(obs)
  .build();

await runner.run(input);

// obs.explain() — what ONLY agentfootprint gives you
const report = obs.explain();
return {
  sources: report.sources,
  claims: report.claims,
  decisions: report.decisions,
  summary: report.summary,
};
`;

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
  { id: 'simple-llm-call', number: 1, title: 'LLM Call', description: 'Single prompt \u2192 single response. No tools, no loop.', category: 'Single LLM', code: s01 },
  { id: 'agent-with-tools', number: 2, title: 'Agent (Tool Use)', description: 'LLM + tools in a loop. Decides when to call tools and when to stop.', category: 'Single LLM', code: s02 },
  { id: 'rag-retrieval', number: 3, title: 'RAG (Retrieval)', description: 'LLM + knowledge retrieval. Chunks injected before the call.', category: 'Single LLM', code: s03 },
  { id: 'flowchart-sequential', number: 7, title: 'Sequential (FlowChart)', description: 'Multiple agents chained in order. Output of one feeds the next.', category: 'Multi-Agent', code: s07 },
  { id: 'parallel-execution', number: 24, title: 'Parallel', description: 'Multiple agents run simultaneously. Results merged by LLM.', category: 'Multi-Agent', code: s24 },
  { id: 'swarm-delegation', number: 8, title: 'Swarm (Routing)', description: 'Orchestrator picks ONE specialist per request. Dynamic delegation.', category: 'Multi-Agent', code: s08 },
  { id: 'prompt-strategies', number: 4, title: 'Prompt Strategies', description: 'Different system prompts per runner', category: 'Providers', code: s04 },
  { id: 'message-strategies', number: 5, title: 'Message Strategies', description: 'Sliding window, truncation', category: 'Providers', code: s05 },
  { id: 'tool-strategies', number: 6, title: 'Tool Strategies', description: 'ToolRegistry, defineTool', category: 'Providers', code: s06 },
  { id: 'orchestration', number: 9, title: 'Resilience', description: 'withRetry, withFallback', category: 'Orchestration', code: s09 },
  { id: 'recorders', number: 10, title: 'Recorders Overview', description: 'agentObservability() — tokens, tools, cost, and grounding in one call', category: 'Observability', code: s10 },
  { id: 'token-cost-tracking', number: 25, title: 'Token & Cost Tracking', description: 'TokenRecorder with pricing table, per-call cost breakdown', category: 'Observability', code: s25 },
  { id: 'tool-usage-analysis', number: 26, title: 'Tool Usage Analysis', description: 'ToolUsageRecorder — calls, errors, latency by tool name', category: 'Observability', code: s26 },
  { id: 'grounding-explain', number: 27, title: 'Grounding (obs.explain)', description: 'Sources vs claims — what tools returned vs what the LLM said', category: 'Observability', code: s27 },
  { id: 'otel-export', number: 28, title: 'OpenTelemetry Export', description: 'OTelRecorder — spans to Datadog, Grafana, or any OTel backend', category: 'Observability', code: s28 },
  { id: 'cloudwatch-export', number: 29, title: 'CloudWatch Export', description: 'Recorder data → AWS CloudWatch metrics pipeline', category: 'Observability', code: s29 },
  { id: 'protocol-adapters', number: 11, title: 'Protocol Adapters', description: 'MCP tool provider', category: 'Adapters', code: s11 },
  { id: 'agent-loop', number: 12, title: 'Agent Loop', description: 'Low-level agentLoop() control', category: 'Adapters', code: s12 },
  { id: 'full-integration', number: 13, title: 'Full Integration', description: 'RAG + Agent + tools combined', category: 'Integration', code: s13 },
  { id: 'real-adapters', number: 14, title: 'Real Adapters', description: 'Anthropic, OpenAI, createProvider', category: 'Adapters', code: s14 },
  { id: 'error-handling', number: 15, title: 'Error Handling', description: 'LLMError, classification, retry', category: 'Integration', code: s15 },
  { id: 'multimodal', number: 16, title: 'Multi-modal', description: 'Image content blocks', category: 'Integration', code: s16 },
  { id: 'live-chat', number: 17, title: 'Live Chat', description: 'Real API call with your key (Anthropic/OpenAI)', category: 'Integration', code: s17 },
  { id: 'dynamic-tool-subflow', number: 18, title: 'Dynamic Tool Subflow', description: 'Pre-executed inner flow attached for drill-down', category: 'Orchestration', code: s18 },
  { id: 'lazy-subflow', number: 19, title: 'Lazy Subflow', description: 'Graph-of-services — lazy branches resolve only when selected', category: 'Orchestration', code: s19 },
  { id: 'gated-tools', number: 20, title: 'Permission-Gated Tools', description: 'Defense-in-depth tool filtering — LLM never sees blocked tools', category: 'Security', code: s20 },
  { id: 'fallback-provider', number: 21, title: 'Provider Fallback', description: 'Multi-provider failover chain with narrative-aware model tracking', category: 'Resilience', code: s21 },
  { id: 'persistent-memory', number: 22, title: 'Persistent Memory', description: 'Multi-turn agent — PrepareMemory/CommitMemory visible in narrative', category: 'Memory', code: s22 },
  { id: 'react-loop-decider', number: 23, title: 'ReAct Loop Decider', description: 'RouteResponse decider — tool-calls vs final branch, no message duplication', category: 'Orchestration', code: s23 },
];

export function getCategorizedSamples(): SampleCategory[] {
  const categoryOrder = ['Single LLM', 'Multi-Agent', 'Providers', 'Orchestration', 'Memory', 'Security', 'Resilience', 'Observability', 'Adapters', 'Integration'];
  const map = new Map<string, Sample[]>();

  for (const sample of samples) {
    if (!map.has(sample.category)) map.set(sample.category, []);
    map.get(sample.category)!.push(sample);
  }

  return categoryOrder
    .filter((cat) => map.has(cat))
    .map((cat) => ({ name: cat, samples: map.get(cat)! }));
}
