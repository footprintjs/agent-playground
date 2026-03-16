/**
 * Sample catalog — 16 runnable examples organized by category.
 *
 * Each sample uses agentfootprint's builder pattern API:
 *   Concept.create({ provider }).system('...').build() → Runner
 *
 * All samples use mock() adapter for $0 deterministic execution.
 */

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

// ── Sample Code ──────────────────────────────────────────────

const s01 = `
import { LLMCall, mock } from 'agentfootprint';

// Builder pattern: LLMCall.create() → .system() → .build() → runner
const runner = LLMCall
  .create({ provider: mock([{ content: 'This text discusses AI safety and alignment challenges.' }]) })
  .system('Summarize the following text concisely:')
  .build();

const result = await runner.run(input);
return { content: result.content };
`;

const s02 = `
import { Agent, mock, defineTool } from 'agentfootprint';

const searchTool = defineTool({
  name: 'search',
  description: 'Search the web for information',
  parameters: { type: 'object', properties: { query: { type: 'string' } } },
  handler: async ({ query }) => ({ results: ['Result 1: AI is transformative', 'Result 2: ML powers modern apps'] }),
});

// Agent builder: create → system → tool → build
const runner = Agent
  .create({ provider: mock([
    { content: 'Let me search for that.', toolCalls: [{ id: '1', name: 'search', arguments: { query: 'artificial intelligence' } }] },
    { content: 'Based on my research: AI is transformative technology that powers modern applications.' },
  ]) })
  .system('You are a research assistant. Use the search tool to find information.')
  .tool(searchTool)
  .build();

const result = await runner.run(input);
return { content: result.content };
`;

const s03 = `
import { RAG, mock, mockRetriever } from 'agentfootprint';

// RAG builder: create with provider + retriever → system → build
const runner = RAG
  .create({
    provider: mock([{ content: 'According to the documentation, the answer is 42.' }]),
    retriever: mockRetriever([{
      chunks: [
        { content: 'The ultimate answer to life, the universe, and everything is 42.', score: 0.95, metadata: { source: 'guide.pdf' } },
        { content: 'This was computed by Deep Thought over 7.5 million years.', score: 0.82, metadata: { source: 'guide.pdf' } },
      ],
    }]),
  })
  .system('Answer the question using only the provided context.')
  .topK(3)
  .build();

const result = await runner.run(input);
return { content: result.content };
`;

const s04 = `
import { LLMCall, mock } from 'agentfootprint';

// Two LLMCall runners with different system prompts
const summarizer = LLMCall
  .create({ provider: mock([{ content: 'This is a concise summary of the input.' }]) })
  .system('You are a summarizer. Be concise.')
  .build();

const translator = LLMCall
  .create({ provider: mock([{ content: 'Ceci est une traduction en francais.' }]) })
  .system('You are a translator. Translate to French.')
  .build();

const r1 = await summarizer.run(input);
const r2 = await translator.run(input);

return { summary: r1.content, translation: r2.content };
`;

const s05 = `
import { slidingWindow, truncateToCharBudget, userMessage, assistantMessage } from 'agentfootprint';

const messages = [
  userMessage('First question'),
  assistantMessage('First answer'),
  userMessage('Second question'),
  assistantMessage('Second answer'),
  userMessage('Third question'),
  assistantMessage('Third answer'),
  userMessage('Fourth question'),
];

// Keep only last 4 messages
const windowed = slidingWindow(messages, 4);

// Or truncate to character budget
const truncated = truncateToCharBudget(messages, 100);

return {
  original: messages.length + ' messages',
  windowed: windowed.length + ' messages (last 4)',
  truncated: truncated.length + ' messages (100 char budget)',
};
`;

const s06 = `
import { defineTool, ToolRegistry } from 'agentfootprint';

const registry = new ToolRegistry();

registry.register(defineTool({
  name: 'calculator',
  description: 'Evaluate math expressions',
  parameters: { type: 'object', properties: { expr: { type: 'string' } } },
  handler: async ({ expr }) => ({ result: 'calculated' }),
}));

registry.register(defineTool({
  name: 'weather',
  description: 'Get current weather',
  parameters: { type: 'object', properties: { city: { type: 'string' } } },
  handler: async ({ city }) => ({ temp: 72, condition: 'sunny', city }),
}));

return {
  tools: registry.list().map(t => t.name),
  count: registry.list().length,
  hasCalculator: registry.get('calculator') !== undefined,
};
`;

const s07 = `
import { FlowChart, LLMCall, mock } from 'agentfootprint';

// Build individual stage runners
const classify = LLMCall
  .create({ provider: mock([{ content: 'Category: billing' }]) })
  .system('Classify this request:')
  .build();

const analyze = LLMCall
  .create({ provider: mock([{ content: 'Analysis: Customer needs refund for overcharge.' }]) })
  .system('Analyze the classified request:')
  .build();

const respond = LLMCall
  .create({ provider: mock([{ content: 'Dear customer, we have processed your refund of $50.' }]) })
  .system('Generate a customer response:')
  .build();

// FlowChart composes runners into a sequential pipeline
const runner = FlowChart.create()
  .agent('classify', 'Classify Request', classify)
  .agent('analyze', 'Analyze Request', analyze)
  .agent('respond', 'Generate Response', respond)
  .build();

const result = await runner.run(input);
return { content: result.content };
`;

const s08 = `
import { Swarm, LLMCall, mock } from 'agentfootprint';

// Build specialist runners
const billing = LLMCall
  .create({ provider: mock([{ content: 'Your refund of $50 has been processed. It will appear in 3-5 business days.' }]) })
  .system('Handle billing inquiries:')
  .build();

const technical = LLMCall
  .create({ provider: mock([{ content: 'Please try restarting your router.' }]) })
  .system('Handle technical issues:')
  .build();

// Swarm: orchestrator routes to specialists via tool calls
const runner = Swarm
  .create({
    provider: mock([
      // Orchestrator delegates to billing
      { content: 'Routing to billing.', toolCalls: [{ id: '1', name: 'delegate_billing', arguments: { task: 'Process refund request' } }] },
      { content: 'The billing team has processed your refund.' },
    ]),
    name: 'support-swarm',
  })
  .system('Route customer requests to the appropriate specialist.')
  .specialist('billing', 'Handles billing and payment issues', billing)
  .specialist('technical', 'Handles technical support', technical)
  .build();

const result = await runner.run(input);
return { content: result.content };
`;

const s09 = `
import { withRetry, withFallback } from 'agentfootprint';

// withRetry wraps a RunnerLike
let attempt = 0;
const flakyRunner = {
  run: async (msg) => {
    attempt++;
    if (attempt < 3) throw new Error('Server overloaded (attempt ' + attempt + ')');
    return { content: 'Success on attempt ' + attempt };
  },
};

const resilient = withRetry(flakyRunner, { maxRetries: 5, backoffMs: 0 });
const result = await resilient.run(input);

return { content: result.content, attempts: attempt };
`;

const s10 = `
import { LLMCall, mock, TokenRecorder, CostRecorderV2, ToolUsageRecorder, CompositeRecorder } from 'agentfootprint';

const tokens = new TokenRecorder();
const costs = new CostRecorderV2();
const tools = new ToolUsageRecorder();

// Note: CompositeRecorder wraps multiple recorders
const composite = new CompositeRecorder([tokens, costs, tools]);

const runner = LLMCall
  .create({ provider: mock([{ content: 'Hello! How can I help?' }]) })
  .system('You are a helpful assistant.')
  .build();

// Run with recorder (recorder hooks into the execution)
await runner.run(input);

return {
  tokenStats: tokens.stats(),
  totalCost: costs.totalCost(),
  toolStats: tools.stats(),
};
`;

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

const s13 = `
import { Agent, RAG, mock, mockRetriever, defineTool, TokenRecorder } from 'agentfootprint';

// Build a RAG runner for document lookup
const ragRunner = RAG
  .create({
    provider: mock([{ content: 'The return policy allows refunds within 30 days.' }]),
    retriever: mockRetriever([{
      chunks: [{ content: 'Return policy: 30-day refund window for all purchases.', score: 0.9, metadata: {} }],
    }]),
  })
  .system('Answer from docs:')
  .build();

// Build an agent with a tool
const lookupTool = defineTool({
  name: 'lookup_order',
  description: 'Look up order details',
  parameters: { type: 'object', properties: { orderId: { type: 'string' } } },
  handler: async ({ orderId }) => ({ orderId, status: 'shipped', total: '$49.99' }),
});

const agentRunner = Agent
  .create({ provider: mock([
    { content: 'Let me look that up.', toolCalls: [{ id: '1', name: 'lookup_order', arguments: { orderId: 'ORD-123' } }] },
    { content: 'Your order ORD-123 has been shipped. Total was $49.99.' },
  ]) })
  .system('You are a support agent.')
  .tool(lookupTool)
  .build();

const result = await agentRunner.run(input);
return { content: result.content };
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

// Direct adapter usage with _client injection for testing
const r1 = await new AnthropicAdapter({ model: 'claude-sonnet-4-20250514', _client: mockAnthropicClient }).chat([userMessage(input)]);
const r2 = await new OpenAIAdapter({ model: 'gpt-4o', _client: mockOpenAIClient }).chat([userMessage(input)]);

// createProvider bridges config factories → adapters
const provider = createProvider({ ...anthropic('claude-sonnet-4-20250514'), _client: mockAnthropicClient });
const r3 = await provider.chat([userMessage(input)]);

return {
  anthropic: r1.content,
  openai: r2.content,
  viaCreateProvider: r3.content,
};
`;

const s15 = `
import { LLMError, wrapSDKError, classifyStatusCode } from 'agentfootprint';

// Classify HTTP status codes
const classifications = {
  '401': classifyStatusCode(401),
  '429': classifyStatusCode(429),
  '500': classifyStatusCode(500),
  '413': classifyStatusCode(413),
};

// Create and inspect LLMErrors
const rateLimitError = new LLMError({ message: 'Too many requests', code: 'rate_limit', provider: 'openai', statusCode: 429 });
const authError = new LLMError({ message: 'Invalid API key', code: 'auth', provider: 'anthropic', statusCode: 401 });

// Wrap unknown SDK errors automatically
const sdkError = Object.assign(new Error('fetch failed: ECONNREFUSED'));
const wrapped = wrapSDKError(sdkError, 'openai');

return {
  classifications,
  rateLimitError: { code: rateLimitError.code, retryable: rateLimitError.retryable },
  authError: { code: authError.code, retryable: authError.retryable },
  wrappedNetworkError: { code: wrapped.code, retryable: wrapped.retryable },
  allCodes: ['auth', 'rate_limit', 'context_length', 'invalid_request', 'server', 'timeout', 'aborted', 'network', 'unknown'],
};
`;

const s16 = `
import { textBlock, base64Image, urlImage, userMessage } from 'agentfootprint';

// Content block factories for multi-modal messages
const text = textBlock('Describe this image:');
const b64img = base64Image('image/png', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
const urlImg = urlImage('https://example.com/photo.jpg');

// Compose into a multi-modal message (ContentBlock[])
const msg = userMessage([text, b64img]);

return {
  textBlock: text,
  base64ImageBlock: { type: b64img.type, mediaType: b64img.source.mediaType },
  urlImageBlock: { type: urlImg.type, url: urlImg.source.url },
  multiModalMessage: { role: msg.role, blocks: Array.isArray(msg.content) ? msg.content.length : 1 },
  supportedAdapters: ['Anthropic (base64 blocks)', 'OpenAI (data URIs)', 'Bedrock (image bytes)'],
};
`;

// ── Catalog ──────────────────────────────────────────────────

export const samples: Sample[] = [
  { id: 'simple-llm-call', number: 1, title: 'Simple LLM Call', description: 'LLMCall.create() builder pattern', category: 'Basics', code: s01 },
  { id: 'agent-with-tools', number: 2, title: 'Agent with Tools', description: 'Agent builder + defineTool', category: 'Basics', code: s02 },
  { id: 'rag-retrieval', number: 3, title: 'RAG Retrieval', description: 'RAG builder + mockRetriever', category: 'Basics', code: s03 },
  { id: 'prompt-strategies', number: 4, title: 'Prompt Strategies', description: 'Different system prompts per runner', category: 'Providers', code: s04 },
  { id: 'message-strategies', number: 5, title: 'Message Strategies', description: 'Sliding window, truncation', category: 'Providers', code: s05 },
  { id: 'tool-strategies', number: 6, title: 'Tool Strategies', description: 'ToolRegistry, defineTool', category: 'Providers', code: s06 },
  { id: 'flowchart-sequential', number: 7, title: 'FlowChart Pipeline', description: 'Sequential pipeline with stages', category: 'Orchestration', code: s07 },
  { id: 'swarm-delegation', number: 8, title: 'Swarm Delegation', description: 'Orchestrator routes to specialists', category: 'Orchestration', code: s08 },
  { id: 'orchestration', number: 9, title: 'Resilience', description: 'withRetry, withFallback', category: 'Orchestration', code: s09 },
  { id: 'recorders', number: 10, title: 'Recorders', description: 'Token, Cost, Tool usage tracking', category: 'Observability', code: s10 },
  { id: 'protocol-adapters', number: 11, title: 'Protocol Adapters', description: 'MCP tool provider', category: 'Adapters', code: s11 },
  { id: 'agent-loop', number: 12, title: 'Agent Loop', description: 'Low-level agentLoop() control', category: 'Adapters', code: s12 },
  { id: 'full-integration', number: 13, title: 'Full Integration', description: 'RAG + Agent + tools combined', category: 'Integration', code: s13 },
  { id: 'real-adapters', number: 14, title: 'Real Adapters', description: 'Anthropic, OpenAI, createProvider', category: 'Adapters', code: s14 },
  { id: 'error-handling', number: 15, title: 'Error Handling', description: 'LLMError, classification, retry', category: 'Integration', code: s15 },
  { id: 'multimodal', number: 16, title: 'Multi-modal', description: 'Image content blocks', category: 'Integration', code: s16 },
];

export function getCategorizedSamples(): SampleCategory[] {
  const categoryOrder = ['Basics', 'Providers', 'Orchestration', 'Observability', 'Adapters', 'Integration'];
  const map = new Map<string, Sample[]>();

  for (const sample of samples) {
    if (!map.has(sample.category)) map.set(sample.category, []);
    map.get(sample.category)!.push(sample);
  }

  return categoryOrder
    .filter((cat) => map.has(cat))
    .map((cat) => ({ name: cat, samples: map.get(cat)! }));
}
