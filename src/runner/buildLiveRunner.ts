/**
 * buildLiveRunner — Dynamically constructs an agentfootprint runner from LiveConfig.
 *
 * Supports all four patterns: LLMCall (as Agent maxIter=1), Agent, RAG, Swarm.
 * Includes footprintjs-powered tools (multi-stage subflow tools) for Agent/Swarm.
 * Captures execution data (snapshot, narrative, spec) per turn.
 */
import {
  Agent, AgentRunner,
  LLMCall,
  RAG, RAGRunner,
  Swarm, SwarmRunner,
  Conditional,
  BrowserAnthropicAdapter, BrowserOpenAIAdapter,
  defineTool,
  askHuman,
  InMemoryStore,
  mockRetriever,
} from 'agentfootprint';
import type { ToolProvider, PromptProvider } from 'agentfootprint';
import { agentObservability } from 'agentfootprint/observe';
import type { AgentObservabilityRecorder } from 'agentfootprint/observe';
import { defineInstruction, AgentPattern } from 'agentfootprint/instructions';
import type { AgentInstruction } from 'agentfootprint/instructions';
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
  run(message: string, options?: { onToken?: (token: string) => void }): Promise<LiveTurnResult>;
  /** Resume a paused agent with human input. */
  resume?(humanResponse: string): Promise<LiveTurnResult>;
  /** Reset conversation state. */
  reset(): void;
  /** Get the spec for BTS visualization. */
  getSpec(): unknown;
  /**
   * Capture current execution state (snapshot + narrative + spec). Safe to
   * call even after `run()` THREW — returns whatever the executor recorded
   * up to the failure point. Used by the UI's error path so Behind the
   * Scenes shows WHERE it broke, not just the static flowchart.
   */
  getCapture(): CapturedExecution;
}

export interface LiveTurnResult {
  content: string;
  execution: CapturedExecution;
  durationMs: number;
  toolCalls?: Array<{ name: string; args: string; result: string }>;
  /** When true, agent paused (ask_human). Show input and call runner.resume(). */
  paused?: boolean;
  /** The question the agent is asking the human. */
  pauseQuestion?: string;
  /**
   * When true, the agent ran out of iterations before finishing — safeDecider
   * force-finalized at the cap. The UI should render a distinct banner so the
   * user sees this isn't a normal completion.
   */
  maxIterationsReached?: boolean;
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
      if (history.length <= maxN) return { value: history, chosen: 'sliding-window' };
      const system = history.filter((m: any) => m.role === 'system');
      const rest = history.filter((m: any) => m.role !== 'system');
      return { value: [...system, ...rest.slice(-maxN)], chosen: 'sliding-window' };
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
    getCapture: () => captureExecution(runner),
  };
}

function buildAgentRunner(config: LiveConfig, provider: LLMProvider): LiveRunner {
  const store = new InMemoryStore();
  const memoryConfig = buildMemoryConfig(config, store);

  // Dynamic ReAct preset — use .toolProvider() and .promptProvider()
  if (config.presetId === 'dynamic-support') {
    return buildDynamicSupportRunner(config, provider, store);
  }

  // Conditional Instructions preset — defineInstruction + Decision Scope
  if (config.presetId === 'conditional-instructions') {
    return buildConditionalInstructionsRunner(config, provider, store);
  }

  // Parallel Lookup preset — showcases .parallelTools(true) with 3 concurrent lookups
  if (config.presetId === 'parallel-lookup') {
    return buildParallelLookupRunner(config, provider, store);
  }

  // Escalation Gate preset — showcases .route({ branches }) with a human-review runner
  if (config.presetId === 'escalation-gate') {
    return buildEscalationGateRunner(config, provider, store);
  }

  // Conditional Triage preset — showcases the Conditional concept routing
  // between two full runners WITHOUT an LLM at the routing step. Zero-cost
  // triage before any model is called.
  if (config.presetId === 'conditional-triage') {
    return buildConditionalTriageRunner(config, provider, store);
  }

  const builder = Agent.create({ provider, name: 'agent' })
    .system(config.systemPrompt)
    .maxIterations(10)
    .streaming(config.enableStreaming);

  if (config.enableTools) {
    // Select tools based on preset — domain-specific mock data
    const tools = config.presetId === 'ecommerce-support'
      ? createEcommerceTools()
      : config.presetId === 'hr-assistant'
      ? createHRTools()
      : createFootprintTools(); // default: calculator, datetime, web search
    builder.tools(tools);
    // Always add ask_human — enables human-in-the-loop for any agent
    builder.tool(askHuman());
    // Wire the .parallelTools() builder option — Agent executes independent tool calls
    // in a single turn concurrently via Promise.all.
    if (config.parallelTools) builder.parallelTools(true);
  }
  const obs = agentObservability();
  builder.recorder(obs);
  if (memoryConfig) builder.memory(memoryConfig);
  const runner = builder.build();

  return wrapRunner(runner, store, obs);
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
    getCapture: () => captureExecution(runner),
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
    .streaming(config.enableStreaming)
    .maxIterations(5)
    .build();

  return {
    run: async (message: string, options?: { onToken?: (token: string) => void }) => {
      const start = Date.now();
      const result = await swarm.run(message, { onToken: options?.onToken });
      const execution = captureExecution(swarm);
      return {
        content: result.content,
        execution,
        durationMs: Date.now() - start,
      };
    },
    reset: () => { swarm.resetConversation(); },
    getSpec: () => swarm.getSpec(),
    getCapture: () => captureExecution(swarm),
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
    handler: async ({ customerId }: { customerId: string }) => ({
      content: JSON.stringify({ verified: true, customerId, accessLevel: 'elevated', note: 'Identity confirmed via 2FA' }),
    }),
  });

  const issueRefundTool = defineTool({
    id: 'issue_refund',
    description: 'Issue a refund for an order. Requires elevated access (verify_identity first).',
    inputSchema: { type: 'object', properties: { orderId: { type: 'string' }, amount: { type: 'number' } } },
    handler: async ({ orderId, amount }: { orderId: string; amount: number }) => ({
      content: JSON.stringify({ refundId: `REF-${Date.now()}`, orderId, amount, status: 'processed' }),
    }),
  });

  const escalateTool = defineTool({
    id: 'escalate_to_manager',
    description: 'Escalate the case to a manager. Requires elevated access.',
    inputSchema: { type: 'object', properties: { reason: { type: 'string' } } },
    handler: async ({ reason }: { reason: string }) => ({
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
    .streaming(config.enableStreaming)
    .maxIterations(10);

  const obs = agentObservability();
  builder.recorder(obs);
  if (memoryConfig) builder.memory(memoryConfig);
  const runner = builder.build();

  return wrapRunner(runner, store, obs);
}

// ── Conditional Instructions: Decision Scope ───────────────

function buildConditionalInstructionsRunner(config: LiveConfig, provider: LLMProvider, store: InMemoryStore): LiveRunner {
  const memoryConfig = buildMemoryConfig(config, store);

  const ecommerceTools = createEcommerceTools();

  // Classify instruction — sets decision scope from tool results
  const classifyInstruction = defineInstruction({
    id: 'classify-order',
    onToolResult: [{
      id: 'classify',
      decide: (decision: Record<string, unknown>, ctx: any) => {
        const content = ctx.content as Record<string, unknown> | undefined;
        if (content?.status) decision.orderStatus = content.status;
        if (content?.amount) decision.highValue = (content.amount as number) > 500;
      },
    }],
  });

  // Refund instruction — activates when order is cancelled/denied
  const refundInstruction = defineInstruction({
    id: 'refund-handling',
    activeWhen: (d: any) => d.orderStatus === 'cancelled' || d.orderStatus === 'denied',
    prompt: 'This order is cancelled. Be empathetic. Offer to process a refund. Explain the timeline (3-5 business days).',
  });

  // High-value instruction — activates for expensive orders
  const highValueInstruction = defineInstruction({
    id: 'high-value-alert',
    activeWhen: (d: any) => d.highValue === true,
    prompt: 'This is a high-value order. Offer expedited support and consider a courtesy discount on the next purchase.',
  });

  const builder = Agent.create({ provider, name: 'instruction-agent' })
    .system(config.systemPrompt || 'You are a customer support agent for TechStore. Look up orders and help customers.')
    .tools(ecommerceTools)
    .instruction(classifyInstruction as AgentInstruction)
    .instruction(refundInstruction as AgentInstruction)
    .instruction(highValueInstruction as AgentInstruction)
    .decision({ orderStatus: null, highValue: false })
    .pattern(AgentPattern.Dynamic)
    .streaming(config.enableStreaming)
    .maxIterations(10);

  const obs = agentObservability();
  builder.recorder(obs);
  if (memoryConfig) builder.memory(memoryConfig);
  const runner = builder.build();

  return wrapRunner(runner, store, obs);
}

// ── Parallel Lookup Preset ──────────────────────────────────
//
// Demonstrates Agent.parallelTools(true). Three independent "fetch" tools each
// sleep ~200ms. Sequential would be ~600ms; parallel lands in ~220ms.

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createParallelLookupTools(): ToolDefinition[] {
  const FETCH_DELAY = 250;
  const customers: Record<string, unknown> = {
    'cust-42': { id: 'cust-42', name: 'Alice Chen', tier: 'premium', joinedAt: '2022-03-15' },
    'cust-99': { id: 'cust-99', name: 'Bob Martinez', tier: 'standard', joinedAt: '2024-08-02' },
  };
  const orders: Record<string, unknown> = {
    'cust-42': [{ id: 'ORD-1003', amount: 129.99, status: 'shipped' }],
    'cust-99': [{ id: 'ORD-1042', amount: 49.99, status: 'pending' }],
  };
  const products: Record<string, unknown> = {
    'WIDGET-A': { sku: 'WIDGET-A', price: 49.99, stock: 42, title: 'Premium Widget' },
    'GADGET-B': { sku: 'GADGET-B', price: 99.99, stock: 0, title: 'Pro Gadget' },
  };

  return [
    defineTool({
      id: 'get_customer',
      description: 'Fetch a customer record by ID (e.g. cust-42).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Customer ID' } },
        required: ['id'],
      },
      handler: async ({ id }: { id: string }) => {
        await delay(FETCH_DELAY);
        const data = customers[id];
        return {
          content: data ? JSON.stringify(data) : JSON.stringify({ error: 'not found' }),
        };
      },
    }),
    defineTool({
      id: 'get_orders',
      description: 'Fetch recent orders for a customer.',
      inputSchema: {
        type: 'object',
        properties: { customerId: { type: 'string' } },
        required: ['customerId'],
      },
      handler: async ({ customerId }: { customerId: string }) => {
        await delay(FETCH_DELAY);
        const list = orders[customerId] ?? [];
        return { content: JSON.stringify({ orders: list }) };
      },
    }),
    defineTool({
      id: 'get_product',
      description: 'Fetch product info by SKU (e.g. WIDGET-A).',
      inputSchema: {
        type: 'object',
        properties: { sku: { type: 'string' } },
        required: ['sku'],
      },
      handler: async ({ sku }: { sku: string }) => {
        await delay(FETCH_DELAY);
        const data = products[sku];
        return {
          content: data ? JSON.stringify(data) : JSON.stringify({ error: 'not found' }),
        };
      },
    }),
  ];
}

function buildParallelLookupRunner(
  config: LiveConfig,
  provider: LLMProvider,
  store: InMemoryStore,
): LiveRunner {
  const memoryConfig = buildMemoryConfig(config, store);

  const builder = Agent.create({ provider, name: 'parallel-lookup' })
    .system(
      config.systemPrompt ||
        'You are a support agent. When gathering context about a customer, fire independent lookup tools (get_customer, get_orders, get_product) in the SAME turn so they run in parallel — not one after the other. Then summarize.',
    )
    .tools(createParallelLookupTools())
    .parallelTools(true)
    .maxIterations(5)
    .streaming(config.enableStreaming);

  const obs = agentObservability();
  builder.recorder(obs);
  if (memoryConfig) builder.memory(memoryConfig);
  const runner = builder.build();

  return wrapRunner(runner, store, obs);
}

// ── Escalation Gate Preset ──────────────────────────────────
//
// Demonstrates Agent.route({ branches }). When the main agent emits the
// [ESCALATE] keyword in its response, a second runner (mocked here as a
// human-review stub) takes over and produces the final answer — without
// looping back through the LLM. This is the "safety valve" pattern.

function buildEscalationGateRunner(
  config: LiveConfig,
  provider: LLMProvider,
  store: InMemoryStore,
): LiveRunner {
  const memoryConfig = buildMemoryConfig(config, store);

  // Minimal runner — any RunnerLike works: Agent, LLMCall, RAG, or a bespoke object.
  const humanReviewAgent = {
    async run(input: string) {
      return {
        content:
          `[ROUTED TO HUMAN REVIEW]\n\n` +
          `Your message has been queued for a human support specialist and they will respond within 1 business day.\n\n` +
          `We'll follow up on: "${input.slice(0, 120)}${input.length > 120 ? '…' : ''}"`,
        messages: [],
      };
    },
  };

  const builder = Agent.create({ provider, name: 'escalation-agent' })
    .system(
      config.systemPrompt ||
        'You are a customer support agent. For routine questions, answer directly. If the customer is angry, threatening legal action, asking for a refund above $500, or otherwise needs human help, include the literal string [ESCALATE] in your response — the routing layer will take over and queue a human.',
    )
    .route({
      branches: [
        {
          id: 'escalate',
          when: (s: any) =>
            typeof s.parsedResponse?.content === 'string' &&
            s.parsedResponse.content.includes('[ESCALATE]'),
          runner: humanReviewAgent,
        },
      ],
    })
    .maxIterations(5)
    .streaming(config.enableStreaming);

  const obs = agentObservability();
  builder.recorder(obs);
  if (memoryConfig) builder.memory(memoryConfig);
  const runner = builder.build();

  return wrapRunner(runner, store, obs);
}

// ── Conditional Triage — rule-based routing between runners ─
//
// Demonstrates the Conditional concept: a predicate (no LLM) picks the
// downstream runner. The benefit over Agent.route(): no LLM call fires if
// the predicate can answer first — useful for obvious fast-paths (refunds,
// spam, known intents).

function buildConditionalTriageRunner(
  config: LiveConfig,
  provider: LLMProvider,
  store: InMemoryStore,
): LiveRunner {
  const memoryConfig = buildMemoryConfig(config, store);

  // Branch 1: refund specialist — focused system prompt, narrow remit.
  const refundBuilder = Agent.create({ provider, name: 'refund-specialist' })
    .system(
      'You are a refund specialist. Only handle refund requests. Be precise about amounts, timelines, and policy.',
    )
    .maxIterations(3)
    .streaming(config.enableStreaming);
  if (memoryConfig) refundBuilder.memory(memoryConfig);
  const refundAgent = refundBuilder.build();

  // Branch 2: general support — the fallback.
  const generalBuilder = Agent.create({ provider, name: 'general-support' })
    .system(
      config.systemPrompt ||
        'You are general customer support. Answer clearly and concisely.',
    )
    .maxIterations(3)
    .streaming(config.enableStreaming);
  if (memoryConfig) generalBuilder.memory(memoryConfig);
  const generalAgent = generalBuilder.build();

  // Rule-based router — zero LLM calls at the branching step.
  const router = Conditional.create({ name: 'triage' })
    .when((input) => /refund|money back|chargeback/i.test(input), refundAgent, {
      id: 'refund',
      name: 'Refund Specialist',
    })
    .otherwise(generalAgent, { name: 'General Support' })
    .build();

  // ConditionalRunner has a different `run` signature than AgentRunner, so
  // we can't reuse `wrapRunner` (which assumes onToken streaming etc.). Inline
  // a small adapter — snapshot/narrative/spec map through `captureExecution`.
  let lastCapture: CapturedExecution = {};
  return {
    run: async (message: string) => {
      const start = Date.now();
      try {
        const result = await router.run(message);
        lastCapture = captureExecution(router);
        return {
          content: result.content,
          execution: lastCapture,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        lastCapture = captureExecution(router);
        throw err;
      }
    },
    reset: () => {
      store.clear();
      lastCapture = {};
    },
    getSpec: () => router.getSpec(),
    getCapture: () => lastCapture,
  };
}

// ── Shared Helpers ──────────────────────────────────────────

function captureExecution(
  runner: { getSnapshot?: () => unknown; getNarrativeEntries?: () => unknown[]; getNarrative?: () => string[]; getSpec?: () => unknown },
  obs?: AgentObservabilityRecorder,
): CapturedExecution {
  const execution: CapturedExecution = {};
  try { if (runner.getSnapshot) execution.snapshot = runner.getSnapshot(); } catch {}
  try { if (runner.getNarrativeEntries) execution.narrativeEntries = runner.getNarrativeEntries(); } catch {}
  try { if (runner.getNarrative) execution.narrative = runner.getNarrative(); } catch {}
  try { if (runner.getSpec) execution.spec = runner.getSpec(); } catch {}
  if (obs) {
    try {
      execution.recorders = {
        tokens: obs.tokens(),
        tools: obs.tools(),
        cost: obs.cost(),
      };
    } catch {}
  }
  return execution;
}

function wrapRunner(runner: AgentRunner, store: InMemoryStore, obs?: AgentObservabilityRecorder): LiveRunner {
  return {
    run: async (message: string, options?: { onToken?: (token: string) => void }) => {
      const start = Date.now();
      const result = await runner.run(message, { onToken: options?.onToken });
      const execution = captureExecution(runner, obs);
      if (result.paused) {
        return {
          content: '',
          execution,
          durationMs: Date.now() - start,
          paused: true,
          pauseQuestion: result.pauseData?.question,
        };
      }
      return {
        content: result.content,
        execution,
        durationMs: Date.now() - start,
        ...(result.maxIterationsReached && { maxIterationsReached: true }),
      };
    },
    resume: async (humanResponse: string) => {
      const start = Date.now();
      const result = await runner.resume(humanResponse);
      const execution = captureExecution(runner, obs);
      if (result.paused) {
        return {
          content: '',
          execution,
          durationMs: Date.now() - start,
          paused: true,
          pauseQuestion: result.pauseData?.question,
        };
      }
      return {
        content: result.content,
        execution,
        durationMs: Date.now() - start,
        ...(result.maxIterationsReached && { maxIterationsReached: true }),
      };
    },
    reset: () => {
      runner.resetConversation();
    },
    getSpec: () => runner.getSpec(),
    getCapture: () => captureExecution(runner, obs),
  };
}
