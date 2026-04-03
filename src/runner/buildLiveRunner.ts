/**
 * buildLiveRunner — Dynamically constructs an agentfootprint runner from LiveConfig.
 *
 * Supports all four patterns: LLMCall (as Agent maxIter=1), Agent, RAG, Swarm.
 * Includes footprintjs-powered tools (multi-stage subflow tools) for Agent/Swarm.
 * Captures execution data (snapshot, narrative, spec) per turn.
 */
import {
  Agent, AgentRunner, AgentPattern,
  LLMCall,
  RAG, RAGRunner,
  Swarm, SwarmRunner,
  BrowserAnthropicAdapter, BrowserOpenAIAdapter,
  defineTool,
  InMemoryStore,
  mockRetriever,
} from 'agentfootprint';
import type { ToolProvider, PromptProvider } from 'agentfootprint';
import {
  createEcommerceTools, createHRTools,
  PRODUCT_DOCS_CHUNKS, HR_DOCS_CHUNKS,
} from './mockData';
import type { LLMProvider, ToolDefinition } from 'agentfootprint';
import type { CapturedExecution } from './executeCode';
import type { LiveConfig, ChatMessage } from '../components/live/types';

// ── Public API ──────────────────────────────────────────────

export interface LiveRunner {
  /** Send a message and get a response + captured execution data. */
  run(message: string): Promise<LiveTurnResult>;
  /** Reset conversation state. */
  reset(): void;
  /** Get the spec for BTS visualization. */
  getSpec(): unknown;
}

export interface LiveTurnResult {
  content: string;
  execution: CapturedExecution;
  durationMs: number;
  toolCalls?: Array<{ name: string; args: string; result: string }>;
}

/**
 * Build a runner from config. Call once per config change.
 * The runner holds conversation state (InMemoryStore) across turns.
 */
export function buildLiveRunner(
  config: LiveConfig,
  apiKeys: { anthropic?: string; openai?: string },
): LiveRunner {
  const provider = createProvider(config, apiKeys);

  switch (config.pattern) {
    case 'llm-call':
      return buildLLMCallRunner(config, provider);
    case 'agent':
      return buildAgentRunner(config, provider);
    case 'rag':
      return buildRAGRunner(config, provider);
    case 'swarm':
      return buildSwarmRunner(config, provider);
  }
}

// ── Provider Factory ────────────────────────────────────────

function createProvider(
  config: LiveConfig,
  apiKeys: { anthropic?: string; openai?: string },
): LLMProvider {
  if (config.provider === 'anthropic') {
    if (!apiKeys.anthropic) throw new Error('Anthropic API key required');
    return new BrowserAnthropicAdapter({
      apiKey: apiKeys.anthropic,
      model: config.modelId,
    });
  } else {
    if (!apiKeys.openai) throw new Error('OpenAI API key required');
    return new BrowserOpenAIAdapter({
      apiKey: apiKeys.openai,
      model: config.modelId,
    });
  }
}

// ── Memory Config ───────────────────────────────────────────

function buildMemoryConfig(config: LiveConfig, store: InMemoryStore) {
  if (config.memoryStrategy === 'none') return undefined;

  // Build MessageStrategy inline — the main export `slidingWindow` is a helper function,
  // not the strategy factory. We construct the strategy object directly.
  const maxN = config.memoryParam;
  const strategy = {
    prepare: (history: any[]) => {
      if (history.length <= maxN) return history;
      const system = history.filter((m: any) => m.role === 'system');
      const rest = history.filter((m: any) => m.role !== 'system');
      return [...system, ...rest.slice(-maxN)];
    },
  };

  return {
    store,
    conversationId: 'live-chat',
    strategy,
  };
}

// ── footprintjs-Powered Tools ───────────────────────────────

function createFootprintTools(): ToolDefinition[] {
  const calculatorTool = defineTool({
    id: 'calculator',
    description: 'Compute a mathematical expression. Supports +, -, *, /, ^, sqrt, sin, cos, tan, log, pi, e. Example: "sqrt(144) + 2^3"',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'The math expression to compute' },
      },
      required: ['expression'],
    },
    handler: async ({ expression }: { expression: string }) => {
      try {
        const result = computeMath(expression as string);
        return { content: `${expression} = ${result}` };
      } catch (e) {
        return { content: `Error computing "${expression}": ${(e as Error).message}` };
      }
    },
  });

  const dateTimeTool = defineTool({
    id: 'get_current_datetime',
    description: 'Get the current date and time in the specified timezone. Default: UTC.',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'IANA timezone (e.g., "America/New_York", "Europe/London"). Default: "UTC"' },
      },
    },
    handler: async ({ timezone }: { timezone?: string }) => {
      const tz = timezone || 'UTC';
      try {
        const now = new Date();
        const formatted = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' });
        return { content: `Current date/time in ${tz}: ${formatted}` };
      } catch {
        return { content: `Invalid timezone: ${tz}` };
      }
    },
  });

  const webSearchTool = defineTool({
    id: 'web_search',
    description: 'Search the web for information on a topic. Returns simulated search results (for demo purposes).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
      },
      required: ['query'],
    },
    handler: async ({ query }: { query: string }) => {
      return {
        content: `Search results for "${query}":\n` +
          `1. [Wikipedia] Overview of ${query} — comprehensive article covering key concepts and history.\n` +
          `2. [Research Paper] Recent advances in ${query} — peer-reviewed analysis from 2024.\n` +
          `3. [Tutorial] Getting started with ${query} — practical guide with examples.\n\n` +
          `Note: This is a demo search tool. In production, connect to a real search API.`,
      };
    },
  });

  return [calculatorTool, dateTimeTool, webSearchTool];
}

/** Recursive descent math parser. No code execution — pure arithmetic. */
function computeMath(expr: string): number {
  let pos = 0;
  const str = expr.replace(/\s+/g, '');

  function parseExpression(): number {
    let result = parseTerm();
    while (pos < str.length && (str[pos] === '+' || str[pos] === '-')) {
      const op = str[pos++];
      const term = parseTerm();
      result = op === '+' ? result + term : result - term;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parsePower();
    while (pos < str.length && (str[pos] === '*' || str[pos] === '/')) {
      const op = str[pos++];
      const factor = parsePower();
      result = op === '*' ? result * factor : result / factor;
    }
    return result;
  }

  function parsePower(): number {
    let result = parseUnary();
    if (pos < str.length && str[pos] === '^') {
      pos++;
      const exponent = parsePower(); // right-associative
      result = Math.pow(result, exponent);
    }
    return result;
  }

  function parseUnary(): number {
    if (str[pos] === '-') { pos++; return -parseAtom(); }
    if (str[pos] === '+') { pos++; return parseAtom(); }
    return parseAtom();
  }

  function parseAtom(): number {
    // Parenthesized expression
    if (str[pos] === '(') {
      pos++;
      const result = parseExpression();
      if (str[pos] === ')') pos++;
      return result;
    }

    // Named constants
    if (str.slice(pos, pos + 2).toLowerCase() === 'pi') { pos += 2; return Math.PI; }
    if (str[pos] === 'e' && (pos + 1 >= str.length || !/[a-z]/i.test(str[pos + 1]))) { pos++; return Math.E; }

    // Named functions
    const fns: Record<string, (x: number) => number> = {
      sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
      log: Math.log, abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round,
    };
    for (const [name, fn] of Object.entries(fns)) {
      if (str.slice(pos, pos + name.length).toLowerCase() === name && str[pos + name.length] === '(') {
        pos += name.length + 1;
        const arg = parseExpression();
        if (str[pos] === ')') pos++;
        return fn(arg);
      }
    }

    // Number literal
    const start = pos;
    while (pos < str.length && /[0-9.]/.test(str[pos])) {
      pos++;
    }
    if (pos === start) throw new Error(`Unexpected character: ${str[pos]}`);
    return parseFloat(str.slice(start, pos));
  }

  const result = parseExpression();
  if (pos < str.length) throw new Error(`Unexpected character: ${str[pos]}`);
  return result;
}

// ── Pattern Builders ────────────────────────────────────────

function buildLLMCallRunner(config: LiveConfig, provider: LLMProvider): LiveRunner {
  // Use LLMCall concept — simpler flowchart without tools/loop/RouteResponse.
  // Flowchart: SystemPrompt → Messages → CallLLM → ParseResponse → Finalize
  const runner = LLMCall.create({ provider })
    .system(config.systemPrompt)
    .build();

  // LLMCallRunner has no built-in memory — we manage conversation history manually.
  const history: any[] = [];

  return {
    run: async (message: string) => {
      const start = Date.now();
      const result = await runner.run(message);
      history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: result.content },
      );
      const execution = captureExecution(runner);
      return {
        content: result.content,
        execution,
        durationMs: Date.now() - start,
      };
    },
    reset: () => { history.length = 0; },
    getSpec: () => runner.getSpec(),
  };
}

function buildAgentRunner(config: LiveConfig, provider: LLMProvider): LiveRunner {
  const store = new InMemoryStore();
  const memoryConfig = buildMemoryConfig(config, store);

  // Dynamic ReAct preset — use .toolProvider() and .promptProvider()
  if (config.presetId === 'dynamic-support') {
    return buildDynamicSupportRunner(config, provider, store);
  }

  const builder = Agent.create({ provider, name: 'agent' })
    .system(config.systemPrompt)
    .maxIterations(10);

  if (config.enableTools) {
    // Select tools based on preset — domain-specific mock data
    const tools = config.presetId === 'ecommerce-support'
      ? createEcommerceTools()
      : config.presetId === 'hr-assistant'
      ? createHRTools()
      : createFootprintTools(); // default: calculator, datetime, web search
    builder.tools(tools);
  }
  if (memoryConfig) builder.memory(memoryConfig);
  const runner = builder.build();

  return wrapRunner(runner, store);
}

function buildRAGRunner(config: LiveConfig, provider: LLMProvider): LiveRunner {
  // Select knowledge base based on preset
  const chunks = config.presetId === 'product-knowledge'
    ? PRODUCT_DOCS_CHUNKS
    : config.presetId === 'hr-knowledge'
    ? HR_DOCS_CHUNKS
    : [
        { content: 'footprintjs is a flowchart pattern for backend code. It enables self-explainable systems that AI can reason about.', metadata: { source: 'docs' } },
        { content: 'agentfootprint is an explainable agent framework built on footprintjs. It supports LLMCall, Agent, RAG, FlowChart, and Swarm patterns.', metadata: { source: 'docs' } },
        { content: 'The Behind the Scenes (BTS) view shows the execution flowchart, narrative, memory state, and timing for every agent turn.', metadata: { source: 'docs' } },
      ];

  const retriever = mockRetriever([{ chunks }]);

  const runner = RAG.create({ provider, retriever })
    .system(config.systemPrompt)
    .topK(3)
    .build();

  return {
    run: async (message: string) => {
      const start = Date.now();
      const result = await runner.run(message);
      const execution = captureExecution(runner);
      return {
        content: result.content,
        execution,
        durationMs: Date.now() - start,
      };
    },
    reset: () => { /* RAG is stateless per turn */ },
    getSpec: () => runner.getSpec(),
  };
}

function buildSwarmRunner(config: LiveConfig, provider: LLMProvider): LiveRunner {
  const researcher = Agent.create({ provider, name: 'researcher' })
    .system('You are a research specialist. Provide detailed, factual information on topics. Be thorough.')
    .maxIterations(3)
    .build();

  const writer = Agent.create({ provider, name: 'writer' })
    .system('You are a writing specialist. Create clear, well-structured content. Be creative and engaging.')
    .maxIterations(3)
    .build();

  const swarm = Swarm.create({ provider, name: 'swarm' })
    .system(config.systemPrompt || 'You are an orchestrator. Route research questions to the researcher and writing tasks to the writer.')
    .specialist('researcher', 'Research a topic and provide factual information', researcher)
    .specialist('writer', 'Write or rewrite content in a specific style', writer)
    .maxIterations(5)
    .build();

  return {
    run: async (message: string) => {
      const start = Date.now();
      const result = await swarm.run(message);
      const execution = captureExecution(swarm);
      return {
        content: result.content,
        execution,
        durationMs: Date.now() - start,
      };
    },
    reset: () => { /* Swarm is stateless per turn */ },
    getSpec: () => swarm.getSpec(),
  };
}

// ── Dynamic ReAct: Progressive Authorization ────────────────

function buildDynamicSupportRunner(config: LiveConfig, provider: LLMProvider, store: InMemoryStore): LiveRunner {
  const memoryConfig = buildMemoryConfig(config, store);

  // Basic tools — always available
  const basicTools = createEcommerceTools();

  // Admin tools — unlocked after identity verification
  const verifyIdentityTool = defineTool({
    id: 'verify_identity',
    description: 'Verify customer identity for elevated access. Required before issuing refunds or escalating.',
    inputSchema: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] },
    handler: async ({ customerId }) => ({
      content: JSON.stringify({ verified: true, customerId, accessLevel: 'elevated', note: 'Identity confirmed via 2FA' }),
    }),
  });

  const issueRefundTool = defineTool({
    id: 'issue_refund',
    description: 'Issue a refund for an order. Requires elevated access (verify_identity first).',
    inputSchema: { type: 'object', properties: { orderId: { type: 'string' }, amount: { type: 'number' } } },
    handler: async ({ orderId, amount }) => ({
      content: JSON.stringify({ refundId: `REF-${Date.now()}`, orderId, amount, status: 'processed' }),
    }),
  });

  const escalateTool = defineTool({
    id: 'escalate_to_manager',
    description: 'Escalate the case to a manager. Requires elevated access.',
    inputSchema: { type: 'object', properties: { reason: { type: 'string' } } },
    handler: async ({ reason }) => ({
      content: JSON.stringify({ escalationId: `ESC-${Date.now()}`, status: 'assigned', manager: 'Sarah Chen', reason }),
    }),
  });

  // Dynamic tool provider — changes based on conversation state
  const dynamicTools: ToolProvider = {
    resolve: (ctx) => {
      const verified = ctx.messages.some((m: any) =>
        m.role === 'tool' && typeof m.content === 'string' && m.content.includes('"verified":true'));

      const allToolDefs = verified
        ? [...basicTools, verifyIdentityTool, issueRefundTool, escalateTool]
        : [...basicTools, verifyIdentityTool];

      const toolDescs = allToolDefs.map(t => ({
        name: t.id,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      return {
        value: toolDescs,
        chosen: verified ? 'elevated' : 'basic',
        rationale: verified ? 'identity verified — admin tools unlocked' : 'standard access — verify identity for admin tools',
      };
    },
    execute: async (call) => {
      const allTools = [...basicTools, verifyIdentityTool, issueRefundTool, escalateTool];
      const tool = allTools.find(t => t.id === call.name);
      if (!tool) return { content: `Unknown tool: ${call.name}`, error: true };
      return tool.handler(call.arguments);
    },
  };

  // Dynamic prompt — changes after verification
  const dynamicPrompt: PromptProvider = {
    resolve: (ctx) => {
      const verified = ctx.history.some((m: any) =>
        typeof m.content === 'string' && m.content.includes('"verified":true'));

      if (verified) {
        return {
          value: 'You are a SENIOR customer support agent with ELEVATED ACCESS for TechStore. You can now issue refunds and escalate to managers. Always confirm the refund amount with the customer before processing.',
          chosen: 'elevated',
          rationale: 'identity verified — elevated prompt active',
        };
      }
      return {
        value: config.systemPrompt || 'You are a customer support agent for TechStore. You can look up orders and check inventory. To issue refunds or escalate, verify customer identity first using verify_identity.',
        chosen: 'standard',
        rationale: 'standard access — verification required for admin actions',
      };
    },
  };

  const builder = Agent.create({ provider, name: 'dynamic-agent' })
    .pattern(AgentPattern.Dynamic)
    .toolProvider(dynamicTools)
    .promptProvider(dynamicPrompt)
    .maxIterations(10);

  if (memoryConfig) builder.memory(memoryConfig);
  const runner = builder.build();

  return wrapRunner(runner, store);
}

// ── Shared Helpers ──────────────────────────────────────────

function captureExecution(runner: { getSnapshot?: () => unknown; getNarrativeEntries?: () => unknown[]; getNarrative?: () => string[]; getSpec?: () => unknown }): CapturedExecution {
  const execution: CapturedExecution = {};
  try { if (runner.getSnapshot) execution.snapshot = runner.getSnapshot(); } catch {}
  try { if (runner.getNarrativeEntries) execution.narrativeEntries = runner.getNarrativeEntries(); } catch {}
  try { if (runner.getNarrative) execution.narrative = runner.getNarrative(); } catch {}
  try { if (runner.getSpec) execution.spec = runner.getSpec(); } catch {}
  return execution;
}

function wrapRunner(runner: AgentRunner, store: InMemoryStore): LiveRunner {
  return {
    run: async (message: string) => {
      const start = Date.now();
      const result = await runner.run(message);
      const execution = captureExecution(runner);
      return {
        content: result.content,
        execution,
        durationMs: Date.now() - start,
      };
    },
    reset: () => {
      runner.resetConversation();
    },
    getSpec: () => runner.getSpec(),
  };
}
