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

// ── Transform: extract run() body for playground sandbox ─────

function fromSample(raw: string): string {
  const lines = raw.split('\n');

  // 1. Collect import lines
  const importLines = lines.filter(l => l.startsWith('import '));

  // 2. Find the run() function body
  const fnIdx = lines.findIndex(l => l.includes('export async function run'));
  if (fnIdx < 0) return raw; // fallback: return as-is

  // Find body start (opening brace)
  const bodyStartIdx = fnIdx + 1;

  // Find body end: the closing brace before CLI guard or EOF
  const cliIdx = lines.findIndex((l, i) => i > fnIdx && l.startsWith('if (process.argv'));
  const searchEnd = cliIdx > 0 ? cliIdx : lines.length;

  // Walk backwards from searchEnd to find the closing '}'
  let bodyEndIdx = searchEnd - 1;
  while (bodyEndIdx > fnIdx && lines[bodyEndIdx].trim() === '') bodyEndIdx--;
  if (lines[bodyEndIdx].trim() === '}') bodyEndIdx--; // skip closing brace

  // 3. Extract and dedent body by 2 spaces
  const bodyLines = lines.slice(bodyStartIdx, bodyEndIdx + 1)
    .map(l => l.startsWith('  ') ? l.slice(2) : l);

  return importLines.join('\n') + '\n\n' + bodyLines.join('\n').trim() + '\n';
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

// ── Catalog ──────────────────────────────────────────────────

export const samples: Sample[] = [
  { id: 'simple-llm-call', number: 1, title: 'Simple LLM Call', description: 'LLMCall builder + TokenRecorder', category: 'Basics', code: s01 },
  { id: 'agent-with-tools', number: 2, title: 'Agent with Tools', description: 'Agent builder + tools + recorders', category: 'Basics', code: s02 },
  { id: 'rag-retrieval', number: 3, title: 'RAG Retrieval', description: 'RAG builder + retriever + recorder', category: 'Basics', code: s03 },
  { id: 'prompt-strategies', number: 4, title: 'Prompt Strategies', description: 'Different system prompts per runner', category: 'Providers', code: s04 },
  { id: 'message-strategies', number: 5, title: 'Message Strategies', description: 'Sliding window, truncation', category: 'Providers', code: s05 },
  { id: 'tool-strategies', number: 6, title: 'Tool Strategies', description: 'ToolRegistry, defineTool', category: 'Providers', code: s06 },
  { id: 'flowchart-sequential', number: 7, title: 'FlowChart Pipeline', description: 'Sequential pipeline + token/turn recorders', category: 'Orchestration', code: s07 },
  { id: 'swarm-delegation', number: 8, title: 'Swarm Delegation', description: 'Specialist routing + token/tool recorders', category: 'Orchestration', code: s08 },
  { id: 'orchestration', number: 9, title: 'Resilience', description: 'withRetry, withFallback', category: 'Orchestration', code: s09 },
  { id: 'recorders', number: 10, title: 'Recorders', description: 'Token, Cost, Tool usage tracking', category: 'Observability', code: s10 },
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
];

export function getCategorizedSamples(): SampleCategory[] {
  const categoryOrder = ['Basics', 'Providers', 'Orchestration', 'Memory', 'Security', 'Resilience', 'Observability', 'Adapters', 'Integration'];
  const map = new Map<string, Sample[]>();

  for (const sample of samples) {
    if (!map.has(sample.category)) map.set(sample.category, []);
    map.get(sample.category)!.push(sample);
  }

  return categoryOrder
    .filter((cat) => map.has(cat))
    .map((cat) => ({ name: cat, samples: map.get(cat)! }));
}
