/**
 * Sample catalog — auto-discovers examples from agentfootprint/examples.
 *
 * `import.meta.glob` walks `@samples/**` (resolved via the `@samples`
 * alias to `../agentfootprint/examples/*` — see vite.config.ts) and
 * pulls each example as both:
 *   - the module's exported `meta` object (catalog metadata)
 *   - the raw source string (playground sandbox)
 *   - the paired `.md` explainer (rendered in the Explain tab)
 *
 * Add a new example to agentfootprint/examples/<group>/<NN>-name.ts
 * with a proper `export const meta = {...}` and it appears here
 * automatically — no catalog edit required. Same for the paired `.md`.
 *
 * Playground-only inline samples (live chat, multimodal, MCP demo, etc.)
 * live below the auto-discovered list — they have no agentfootprint
 * counterpart and remain hand-maintained.
 */

// Inline copy of agentfootprint's ExampleMeta type so we don't import from
// outside this project's rootDir. Keep this in sync with
// ../../agentfootprint/examples/helpers/cli.ts.
interface ExampleMeta {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly description: string;
  readonly defaultInput: string | null;
  readonly providerSlots: readonly string[];
  readonly tags: readonly string[];
}

// ── Types ────────────────────────────────────────────────────

export interface Sample {
  id: string;
  number: number;
  title: string;
  description: string;
  /** Display label (Title Case) — derived from the folder. */
  category: string;
  /** URL-mode key = source folder name (kebab-case). Drives `?mode=...`.
   *  Inline samples omit this — they're not folder-auto-discovered. */
  group?: string;
  code: string;
  /** Markdown explainer (paired `.md`). Optional — inline samples don't have one. */
  explainer?: string;
}

export interface SampleCategory {
  name: string;
  samples: Sample[];
  /** URL-mode key — same as Sample.group, hoisted so Sidebar can filter
   *  by `?mode=<group>` without opening a sample. Undefined for inline
   *  groupings (they can't be linked-to via the mode param). */
  group?: string;
}

/**
 * Category = the example's `group` field, which by convention matches the
 * folder it lives in (`examples/patterns/` → group `patterns`). No manual
 * mapping table — the folder structure IS the taxonomy. Display labels
 * are derived by `prettifyGroup()`; URL modes use the raw group name.
 *
 * Curriculum-first ordering: Concepts + Patterns lead, everything else
 * falls in alphabetically. Add groups here ONLY if you want them ahead
 * of the default sort — otherwise new folders auto-slot in.
 */
const GROUP_PROMOTE_ORDER = ['concepts', 'patterns'];

/** kebab-case folder name → Title Case display label.
 *  `runtime-features` → `Runtime Features`. Stable, invertible, no map. */
function prettifyGroup(group: string): string {
  return group
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

// ── Auto-discover from agentfootprint/examples ───────────────

// Glob patterns must be literal strings/array literals — Vite's transform
// can't resolve them through variables. Exclude helpers/ (imports Node's
// `url` module, breaks browser bundle) and DESIGN/README (not example md).
const exampleModules = import.meta.glob(
  ['@samples/**/*.ts', '!@samples/helpers/**'],
  { eager: true },
);
const exampleRaw = import.meta.glob(
  ['@samples/**/*.ts', '!@samples/helpers/**'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;
const explainerRaw = import.meta.glob(
  ['@samples/**/*.md', '!@samples/DESIGN.md', '!@samples/README.md'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

/**
 * Strip JSDoc, the `meta` export, the CLI guard, and the `run()` wrapper
 * from an example's `.ts` source. Prepends `const provider = undefined;`
 * so `provider ?? defaultMock()` resolves to the scripted mock when the
 * playground sandbox runs the extracted code.
 *
 * The sandbox (executeCode.ts) strips imports and injects agentfootprint
 * modules + `input`. We need to make the body executable as a top-level
 * snippet inside an async IIFE — top-level `export` is a syntax error
 * in that context.
 */
function fromSample(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let inJsDoc = false;
  let insideRun = false;
  let braceDepth = 0;
  let skipBlockUntilClose = false;
  let skipBraceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed.startsWith('/**') && i < 10 && !inJsDoc) {
      inJsDoc = true;
      if (trimmed.includes('*/')) inJsDoc = false;
      continue;
    }
    if (inJsDoc) {
      if (trimmed.includes('*/')) inJsDoc = false;
      continue;
    }

    if (skipBlockUntilClose) {
      for (const ch of line) {
        if (ch === '{') skipBraceDepth++;
        else if (ch === '}') skipBraceDepth--;
      }
      if (skipBraceDepth <= 0) skipBlockUntilClose = false;
      continue;
    }

    if (trimmed.startsWith('export const meta')) {
      skipBraceDepth = 0;
      for (const ch of line) {
        if (ch === '{') skipBraceDepth++;
        else if (ch === '}') skipBraceDepth--;
      }
      skipBlockUntilClose = skipBraceDepth > 0;
      continue;
    }

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

    if (!insideRun && /^export\s+(async\s+)?function\s+run\b/.test(trimmed)) {
      insideRun = true;
      braceDepth = 0;
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }
      continue;
    }

    if (insideRun) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0) {
        insideRun = false;
        continue;
      }
      out.push(line.startsWith('  ') ? line.slice(2) : line);
    } else {
      out.push(line);
    }
  }

  while (out.length > 0 && out[0].trim() === '') out.shift();
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();

  // The `run(input, provider?)` signature means the body references both
  // `input` (sandbox-injected) and `provider` (was a parameter). The
  // sandbox now injects `__provider` based on the user's ProviderPicker
  // selection — null when "Mock" is chosen (so `provider ?? defaultMock()`
  // falls through to the example's scripted mock), or a real LLMProvider
  // when "Claude" / "GPT" / "Ollama" is selected.
  return 'const provider = __provider ?? undefined;\n' + out.join('\n') + '\n';
}

function toSampleId(metaId: string): string {
  const last = metaId.split('/').pop() ?? metaId;
  return last.replace(/^\d+-/, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

function deriveNumber(path: string): number {
  const file = path.split('/').pop() ?? '';
  const match = file.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : 99;
}

const fileBased: Sample[] = Object.entries(exampleModules)
  .filter(([path]) => !path.includes('/helpers/'))
  .map(([path, mod]): Sample | null => {
    const meta = (mod as { meta?: ExampleMeta }).meta;
    if (!meta) {
      console.warn(`[catalog] ${path} missing 'meta' export — skipping`);
      return null;
    }
    const raw = exampleRaw[path];
    const mdPath = path.replace(/\.ts$/, '.md');
    const explainer = explainerRaw[mdPath];
    return {
      id: toSampleId(meta.id),
      number: deriveNumber(path),
      title: meta.title,
      description: meta.description,
      // `category` holds the display label; the sample's folder (meta.group)
      // is the URL-mode key. `getCategorizedSamples()` groups by label.
      category: prettifyGroup(meta.group),
      group: meta.group,
      code: fromSample(raw),
      ...(explainer ? { explainer } : {}),
    };
  })
  .filter((s): s is Sample => s !== null)
  .sort((a, b) => {
    // Promoted groups come first in their declared order; everything else
    // sorts alphabetically by display label, then by the file's leading
    // number (01-..., 02-...) to preserve the curriculum flow.
    const ag = (a as Sample & { group?: string }).group ?? '';
    const bg = (b as Sample & { group?: string }).group ?? '';
    const ai = GROUP_PROMOTE_ORDER.indexOf(ag);
    const bi = GROUP_PROMOTE_ORDER.indexOf(bg);
    if (ai !== -1 && bi !== -1 && ai !== bi) return ai - bi;
    if (ai !== -1 && bi === -1) return -1;
    if (bi !== -1 && ai === -1) return 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.number - b.number;
  });

// ── Inline samples (playground-only, no agentfootprint counterpart) ──

const s11 = `
import { mcpToolProvider } from 'agentfootprint';

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

const s14 = `
import { AnthropicAdapter, OpenAIAdapter, createProvider } from 'agentfootprint';
import { anthropic, openai } from 'agentfootprint';
import { userMessage } from 'agentfootprint';

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
const narrative = executor.getNarrativeEntries().map(e => e.text);

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
  narrative: executor.getNarrativeEntries().map(e => e.text),
  snapshot: executor.getSnapshot(),
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

const s29 = `
import { Agent, mock, defineTool } from 'agentfootprint';
import { agentObservability } from 'agentfootprint/observe';

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

// Inline samples — category + group must match prettifyGroup() output of
// file-based samples, so they merge into the same Sidebar sections.
// Folder-as-truth: if you're tempted to invent a new `category` here, ask
// if it should become its own `examples/<folder>/` instead.
const inlineSamples: Sample[] = [
  { id: 'mcp-protocol',         number: 80, title: 'MCP tool provider',       description: 'mcpToolProvider — bridge external MCP servers.',                       group: 'integrations',     category: prettifyGroup('integrations'),     code: s11 },
  { id: 'real-adapters',        number: 81, title: 'Real adapters (mock)',    description: 'AnthropicAdapter, OpenAIAdapter, createProvider wiring.',              group: 'providers',        category: prettifyGroup('providers'),        code: s14 },
  { id: 'multimodal',           number: 82, title: 'Multimodal blocks',       description: 'textBlock, base64Image, urlImage content blocks.',                      group: 'integrations',     category: prettifyGroup('integrations'),     code: s16 },
  { id: 'live-chat',            number: 83, title: 'Live chat',                description: 'Real API call with your key (Anthropic or OpenAI).',                    group: 'integrations',     category: prettifyGroup('integrations'),     code: s17 },
  { id: 'dynamic-tool-subflow', number: 84, title: 'Dynamic tool subflow',    description: 'Pre-executed inner flow attached for drill-down.',                      group: 'runtime-features', category: prettifyGroup('runtime-features'), code: s18 },
  { id: 'lazy-subflow',         number: 85, title: 'Lazy subflow',            description: 'Graph-of-services — lazy branches resolve only when selected.',         group: 'runtime-features', category: prettifyGroup('runtime-features'), code: s19 },
  { id: 'tool-usage',           number: 86, title: 'Tool Usage recorder',    description: 'ToolUsageRecorder — per-tool calls, errors, latency.',                  group: 'observability',    category: prettifyGroup('observability'),    code: s26 },
  { id: 'cloudwatch-export',    number: 87, title: 'CloudWatch export',      description: 'Recorder data → AWS CloudWatch metrics pipeline.',                      group: 'observability',    category: prettifyGroup('observability'),    code: s29 },
];

// ── Final catalog ────────────────────────────────────────────

export const samples: Sample[] = [...fileBased, ...inlineSamples];

export function getCategorizedSamples(): SampleCategory[] {
  const map = new Map<string, Sample[]>();
  for (const sample of samples) {
    if (!map.has(sample.category)) map.set(sample.category, []);
    map.get(sample.category)!.push(sample);
  }
  // Samples are already sorted by group-promotion + alpha; iteration
  // order of the Map matches insertion order, so this preserves the
  // curriculum-first layout without a separate ORDER table.
  return Array.from(map.entries()).map(([name, samples]) => ({
    name,
    samples,
    // Hoist the group from the first sample — every sample in a given
    // category shares the same group (folder), so this is well-defined.
    // Inline samples without a group fall through undefined.
    ...(samples[0]?.group ? { group: samples[0].group } : {}),
  }));
}
