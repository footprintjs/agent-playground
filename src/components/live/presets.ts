/**
 * Live Chat Presets — real-world domain scenarios with mock data.
 *
 * Each preset feels like a production app: e-commerce support with real order data,
 * HR assistant with employee records, product knowledge base with specifications.
 */
import type { LiveConfig, PatternType } from './types';

export type PresetCategory =
  | 'getting-started'
  | 'tool-use'
  | 'dynamic-behavior'
  | 'knowledge'
  | 'multi-agent';

export interface PresetCategoryMeta {
  readonly id: PresetCategory;
  readonly label: string;
  readonly description: string;
}

export const PRESET_CATEGORIES: PresetCategoryMeta[] = [
  { id: 'getting-started', label: 'Getting Started', description: 'Simple patterns to explore' },
  { id: 'tool-use', label: 'Tool Use', description: 'Agents that call tools and APIs' },
  { id: 'dynamic-behavior', label: 'Dynamic Behavior', description: 'Runtime adaptation and conditional logic' },
  { id: 'knowledge', label: 'Knowledge & RAG', description: 'Answer from documents and data' },
  { id: 'multi-agent', label: 'Multi-Agent', description: 'Orchestrate multiple specialists' },
];

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly pattern: PatternType;
  readonly category: PresetCategory;
  readonly config: LiveConfig;
  readonly suggestedMessage: string;
  readonly code: string;
}

export const PRESETS: Preset[] = [
  // ── Getting Started ───────────────────────────────────────
  {
    id: 'chat-assistant',
    label: 'Chat Assistant',
    description: 'Simple multi-turn conversation with memory',
    pattern: 'llm-call',
    category: 'getting-started',
    config: {
      pattern: 'llm-call',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a helpful, concise assistant. Answer in 2-3 sentences unless asked for detail.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: false,
      enableStreaming: true,
      presetId: 'chat-assistant',
    },
    suggestedMessage: 'What are the main differences between REST and GraphQL?',
    code: `import { LLMCall, anthropic } from 'agentfootprint';

const chat = LLMCall
  .create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a helpful, concise assistant.')
  .build();

const result = await chat.run('What are the differences between REST and GraphQL?');`,
  },
  {
    id: 'code-reviewer',
    label: 'Code Reviewer',
    description: 'Reviews code for bugs, security, and quality',
    pattern: 'llm-call',
    category: 'getting-started',
    config: {
      pattern: 'llm-call',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a senior code reviewer. Analyze code for: bugs, security vulnerabilities, performance issues, and readability. Be specific and actionable. Use severity levels: CRITICAL, WARNING, INFO.',
      memoryStrategy: 'sliding-window',
      memoryParam: 20,
      enableTools: false,
      enableStreaming: true,
      presetId: 'code-reviewer',
    },
    suggestedMessage: 'Review this function:\n\nfunction getUser(id) {\n  const user = db.query("SELECT * FROM users WHERE id = " + id);\n  return user;\n}',
    code: `import { LLMCall, anthropic } from 'agentfootprint';

const reviewer = LLMCall
  .create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a senior code reviewer. Analyze for bugs, security, performance.')
  .build();

const result = await reviewer.run('Review this function: ...');`,
  },

  // ── Tool Use ──────────────────────────────────────────────
  {
    id: 'refund-approval',
    label: 'Refund Approval',
    description: 'Pauses to ask human for approval before processing refunds',
    pattern: 'agent',
    category: 'tool-use',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: `You are a customer support agent for TechStore. You help customers with refunds.

RULES (follow strictly):
1. ALWAYS look up the order first using lookup_order. If the lookup fails or returns an error, tell the customer you cannot access their order right now and ask them to try again later. Do NOT proceed with a refund if the order lookup failed.
2. Only if the order lookup succeeds, use the ask_human tool to request manager approval. Include the EXACT order ID, amount, and item names from the lookup result — never make up order details.
3. After the manager responds via ask_human, tell the customer the decision.
4. If the manager denies, explain politely. If approved, confirm the refund.`,
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: true,
      enableStreaming: true,
      presetId: 'ecommerce-support',
    },
    suggestedMessage: 'I want a refund for order ORD-1001. The product arrived damaged.',
    code: `import { Agent, askHuman, defineTool, anthropic } from 'agentfootprint';

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a support agent. Use ask_human for manager approval before refunds.')
  .tool(lookupOrder)
  .tool(askHuman())  // ← enables human-in-the-loop
  .build();

const result = await agent.run('I want a refund for order ORD-1001');
if (result.paused) {
  // Agent asked: "Approve refund of $299 for ORD-1001?"
  const final = await agent.resume('Yes, approved');
}`,
  },
  {
    id: 'ecommerce-support',
    label: 'E-Commerce Support',
    description: 'Customer support with orders, inventory, and tracking',
    pattern: 'agent',
    category: 'tool-use',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a customer support agent for TechStore. You can look up orders, check inventory, and track packages. Be helpful and empathetic. If an order is cancelled or returned, apologize and offer alternatives. Always use the tools to look up information — never make up order details.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: true,
      enableStreaming: true,
      presetId: 'ecommerce-support',
    },
    suggestedMessage: 'Can you check the status of order ORD-1003?',
    code: `import { Agent, defineTool, anthropic } from 'agentfootprint';

const lookupOrder = defineTool({
  id: 'lookup_order',
  description: 'Look up order by ID or customer name',
  inputSchema: { ... },
  handler: async ({ orderId }) => {
    const order = await db.orders.findOne({ orderId });
    return { content: JSON.stringify(order) };
  },
});

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a customer support agent for TechStore.')
  .tool(lookupOrder)
  .tool(checkInventory)
  .tool(trackPackage)
  .build();

// Try: "Check order ORD-1003" (cancelled)
// Try: "Is the MacBook Air in stock?" (out of stock)
// Try: "Track package PKG-4522-US" (shipped)`,
  },
  {
    id: 'hr-assistant',
    label: 'HR Assistant',
    description: 'Employee lookup, PTO balance, and policy questions',
    pattern: 'agent',
    category: 'tool-use',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are an HR assistant. You can look up employee information, check PTO balances, and answer policy questions. Always use the tools to look up data — never guess employee details. For sensitive requests, remind the employee to contact HR directly.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: true,
      enableStreaming: true,
      presetId: 'hr-assistant',
    },
    suggestedMessage: 'How many PTO days does Sarah Chen have left?',
    code: `import { Agent, defineTool, anthropic } from 'agentfootprint';

const lookupEmployee = defineTool({
  id: 'lookup_employee',
  description: 'Look up employee info by name or ID',
  inputSchema: { ... },
  handler: async ({ name }) => {
    const emp = await hr.employees.findByName(name);
    return { content: JSON.stringify(emp) };
  },
});

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are an HR assistant.')
  .tool(lookupEmployee)
  .tool(lookupPolicy)
  .tool(checkPTOBalance)
  .build();

// Try: "How many PTO days does Sarah Chen have?"
// Try: "What is the remote work policy?"
// Try: "Look up Maria Garcia's department"`,
  },

  // ── Knowledge & RAG ───────────────────────────────────────
  {
    id: 'product-knowledge',
    label: 'Product Knowledge Base',
    description: 'Answer questions from product docs, return policy, AppleCare',
    pattern: 'rag',
    category: 'knowledge',
    config: {
      pattern: 'rag',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a product specialist for TechStore. Answer questions based ONLY on the retrieved product documentation. If the docs don\'t contain the answer, say "I don\'t have that information in our product database." Cite which document section your answer comes from.',
      memoryStrategy: 'none',
      memoryParam: 50,
      enableTools: false,
      enableStreaming: true,
      presetId: 'product-knowledge',
    },
    suggestedMessage: 'What does AppleCare+ cover and how much does it cost?',
    code: `import { RAG, anthropic, mockRetriever } from 'agentfootprint';

const retriever = mockRetriever([{
  chunks: [
    { content: 'MacBook Pro 16": M4 Pro chip, 24GB RAM...', metadata: { source: 'specs' } },
    { content: 'Return Policy: 14 days for full refund...', metadata: { source: 'returns' } },
    { content: 'AppleCare+: 3 years coverage, $199/year...', metadata: { source: 'applecare' } },
  ],
}]);

const runner = RAG.create({ provider: anthropic('claude-sonnet-4-20250514'), retriever })
  .system('Answer based on retrieved product documentation only.')
  .build();

// Try: "What does AppleCare+ cover?"
// Try: "Can I return an opened MacBook?"
// Try: "What shipping options are available?"`,
  },
  {
    id: 'hr-knowledge',
    label: 'HR Policy Knowledge Base',
    description: 'Answer HR questions from company handbook',
    pattern: 'rag',
    category: 'knowledge',
    config: {
      pattern: 'rag',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are an HR policy advisor. Answer questions based ONLY on the company handbook sections provided. Be precise about numbers (days, amounts, percentages). If the policy doesn\'t cover the question, direct the employee to their HR Business Partner.',
      memoryStrategy: 'none',
      memoryParam: 50,
      enableTools: false,
      enableStreaming: true,
      presetId: 'hr-knowledge',
    },
    suggestedMessage: 'How many days of parental leave do we get?',
    code: `import { RAG, anthropic, mockRetriever } from 'agentfootprint';

const retriever = mockRetriever([{
  chunks: [
    { content: 'PTO Policy: 1.5 days/month, max 5 carry-over...', metadata: { section: 'PTO' } },
    { content: 'Remote Work: 2 days in-office minimum...', metadata: { section: 'WFH' } },
    { content: 'Benefits: 90% health premiums, 401k 4% match...', metadata: { section: 'Benefits' } },
  ],
}]);

// Try: "How many days of parental leave?"
// Try: "What is the expense policy for hotels?"
// Try: "Can I work fully remote?"`,
  },

  // ── Multi-Agent ───────────────────────────────────────────
  {
    id: 'specialist-swarm',
    label: 'Specialist Routing',
    description: 'Routes to coding, math, or writing specialist',
    pattern: 'swarm',
    category: 'multi-agent',
    config: {
      pattern: 'swarm',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are an orchestrator. Analyze the user request and route to the best specialist: coding (for code questions), math (for calculations), or writing (for creative content). Explain which specialist you chose and why.',
      memoryStrategy: 'none',
      memoryParam: 50,
      enableTools: false,
      enableStreaming: true,
      presetId: 'specialist-swarm',
    },
    suggestedMessage: 'Write a haiku about debugging code',
    code: `import { Swarm, Agent, anthropic } from 'agentfootprint';

const provider = anthropic('claude-sonnet-4-20250514');

const writingAgent = Agent.create({ provider })
  .system('You are a creative writing specialist. Write vivid, engaging content.')
  .build();

const codingAgent = Agent.create({ provider })
  .system('You are a coding specialist. Write clean, well-documented code.')
  .build();

// Swarm uses the same Agent loop infrastructure — gains streaming,
// memory, narrative, toFlowChart() for free.
const swarm = Swarm.create({ provider })
  .system('Route to coding or writing specialist.')
  .specialist('coding', 'Code specialist for programming tasks', codingAgent)
  .specialist('writing', 'Writing specialist for creative content', writingAgent)
  .streaming(true)
  .build();

const result = await swarm.run('Write a haiku about debugging');
// result.agents shows which specialists were invoked
// swarm.getNarrative() shows full execution trace`,
  },

  // ── Dynamic Behavior ──────────────────────────────────────
  {
    id: 'conditional-instructions',
    label: 'Conditional Instructions',
    description: 'Instructions activate based on tool results via Decision Scope',
    pattern: 'agent',
    category: 'dynamic-behavior',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a customer support agent for TechStore. Look up orders and help customers.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: true,
      enableStreaming: true,
      presetId: 'conditional-instructions',
    },
    suggestedMessage: 'Check order ORD-1003 — I need help with a refund',
    code: `import { Agent, defineTool } from 'agentfootprint';
import { defineInstruction, AgentPattern } from 'agentfootprint/instructions';

// Classify — tool results update Decision Scope
const classify = defineInstruction({
  id: 'classify-order',
  onToolResult: [{
    id: 'classify',
    decide: (decision, ctx) => {
      decision.orderStatus = ctx.content.status;
      decision.highValue = ctx.content.amount > 500;
    },
  }],
});

// Refund — activates ONLY when order is cancelled
const refund = defineInstruction({
  id: 'refund-handling',
  activeWhen: (d) => d.orderStatus === 'cancelled',
  prompt: 'Be empathetic. Offer refund. Timeline: 3-5 days.',
});

const agent = Agent.create({ provider })
  .tool(lookupOrder)
  .instruction(classify)
  .instruction(refund)
  .decision({ orderStatus: null, highValue: false })
  .pattern(AgentPattern.Dynamic)
  .build();

// Turn 1: lookup_order → {status: "cancelled"}
//   decide() sets orderStatus = "cancelled"
// Turn 2: InstructionsToLLM re-evaluates
//   refund-handling activates → empathy prompt injected`,
  },

  {
    id: 'dynamic-support',
    label: 'Progressive Authorization',
    description: 'Tools and prompt change after identity verification',
    pattern: 'agent',
    category: 'dynamic-behavior',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a customer support agent. Start by looking up the customer order. If the order is flagged or cancelled, you may need elevated access — use verify_identity first, then admin tools become available.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: true,
      enableStreaming: true,
      presetId: 'dynamic-support',
    },
    suggestedMessage: 'Check order ORD-1003 and help me get a refund',
    code: `import { Agent, AgentPattern, defineTool, anthropic } from 'agentfootprint';
import type { ToolProvider, PromptProvider } from 'agentfootprint';

// Dynamic tool provider — tools change based on conversation state
const dynamicTools: ToolProvider = {
  resolve: (ctx) => {
    const verified = ctx.messages.some(m =>
      m.role === 'tool' && m.content.includes('"verified":true'));

    const basic = [lookupOrder, checkInventory, verifyIdentity];
    const admin = [issueRefund, escalateToManager];

    if (verified) {
      return { value: [...basic, ...admin], chosen: 'elevated', rationale: 'identity verified' };
    }
    return { value: basic, chosen: 'basic', rationale: 'standard access' };
  },
};

// Dynamic prompt — changes after verification
const dynamicPrompt: PromptProvider = {
  resolve: (ctx) => {
    const verified = ctx.history.some(m =>
      typeof m.content === 'string' && m.content.includes('"verified":true'));

    if (verified) {
      return {
        value: 'You are a SENIOR support agent with ELEVATED ACCESS. You can issue refunds and escalate.',
        chosen: 'elevated',
        rationale: 'identity verified',
      };
    }
    return {
      value: 'You are a support agent. Verify identity before issuing refunds.',
      chosen: 'standard',
    };
  },
};

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .pattern(AgentPattern.Dynamic)     // re-evaluate all slots each iteration
  .toolProvider(dynamicTools)         // tools change after verification
  .promptProvider(dynamicPrompt)      // prompt changes after verification
  .build();

// Turn 1: lookup_order → flagged
// Turn 2: verify_identity → verified
// Turn 3: issue_refund now available!`,
  },

  // ── Parallel Lookup (Tool Use) ─────────────────────────────
  {
    id: 'parallel-lookup',
    label: 'Parallel Tool Lookup',
    description: 'Fire 3 independent tools in one turn concurrently via Promise.all',
    pattern: 'agent',
    category: 'tool-use',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt:
        'You are a support agent. When gathering context about a customer, fire independent lookup tools (get_customer, get_orders, get_product) in the SAME turn so they run in parallel — not one after the other. Then summarize what you found.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: true,
      enableStreaming: true,
      parallelTools: true,
      presetId: 'parallel-lookup',
    },
    suggestedMessage:
      'Give me everything you know about customer cust-42 and product WIDGET-A in one shot.',
    code: `import { Agent, defineTool, anthropic } from 'agentfootprint';

const FETCH_DELAY = 250; // each tool sleeps 250ms

const getCustomer = defineTool({
  id: 'get_customer',
  description: 'Fetch a customer record by ID.',
  inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  handler: async ({ id }) => { await sleep(FETCH_DELAY); return { content: '...' }; },
});

const getOrders = defineTool({
  id: 'get_orders',
  description: 'Fetch recent orders for a customer.',
  inputSchema: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] },
  handler: async ({ customerId }) => { await sleep(FETCH_DELAY); return { content: '...' }; },
});

const getProduct = defineTool({
  id: 'get_product',
  description: 'Fetch product info by SKU.',
  inputSchema: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] },
  handler: async ({ sku }) => { await sleep(FETCH_DELAY); return { content: '...' }; },
});

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('Fire independent lookups in parallel when gathering context.')
  .tools([getCustomer, getOrders, getProduct])
  .parallelTools(true)   // ← the toggle — concurrent within a turn
  .build();

// Sequential would be ~750ms (250ms × 3).
// Parallel lands in ~260ms + LLM overhead.`,
  },

  // ── Escalation Gate (Dynamic Behavior) ─────────────────────
  {
    id: 'escalation-gate',
    label: 'Escalation Gate',
    description: 'Inject a user-defined routing branch — safety valve before default flow',
    pattern: 'agent',
    category: 'dynamic-behavior',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt:
        'You are a customer support agent. For routine questions, answer directly. If the customer is angry, threatening legal action, asking for a refund above $500, or otherwise needs human help, include the literal string [ESCALATE] in your response — the routing layer will take over and queue a human.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: false,
      enableStreaming: true,
      presetId: 'escalation-gate',
    },
    suggestedMessage:
      "I've been waiting three weeks for a refund and no one is answering. I'm going to call my lawyer.",
    code: `import { Agent, anthropic } from 'agentfootprint';
import type { RunnerLike } from 'agentfootprint';

// Any RunnerLike works — Agent, LLMCall, RAG, or a custom object with .run(input).
const humanReviewAgent: RunnerLike = {
  async run(input) {
    return {
      content: \`[ROUTED TO HUMAN REVIEW] Queued for support specialist. Followup within 1 business day.\`,
      messages: [],
    };
  },
};

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system(
    'You are a support agent. Emit [ESCALATE] in your response for angry customers, ' +
    'legal threats, or refunds > $500 — the router will take over.',
  )
  .route({
    branches: [
      {
        id: 'escalate',
        when: (s) =>
          typeof s.parsedResponse?.content === 'string' &&
          s.parsedResponse.content.includes('[ESCALATE]'),
        runner: humanReviewAgent,
      },
    ],
  })
  .build();

// Try: "I've been waiting 3 weeks for my refund and I'm calling my lawyer."
//   → main LLM emits [ESCALATE]
//   → router fires humanReviewAgent
//   → that answer becomes the final response (loop breaks)`,
  },

  // ── Conditional Triage (Dynamic Behavior) ───────────────
  {
    id: 'conditional-triage',
    label: 'Conditional Triage',
    description:
      'Rule-based routing between two agents with ZERO LLM calls at the branching step',
    pattern: 'agent',
    category: 'dynamic-behavior',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are general customer support. Answer clearly and concisely.',
      memoryStrategy: 'sliding-window',
      memoryParam: 50,
      enableTools: false,
      enableStreaming: false,
      presetId: 'conditional-triage',
    },
    suggestedMessage: 'I need a refund for order #42',
    code: `import { Agent, Conditional, anthropic } from 'agentfootprint';

// Specialist for one job.
const refundAgent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a refund specialist. Handle refund requests precisely.')
  .build();

// Fallback for everything else.
const generalAgent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are general support. Answer clearly and concisely.')
  .build();

// Rule-based triage — NO LLM call at the routing step.
// Predicates are synchronous; first match wins; .otherwise() is required.
const triage = Conditional.create({ name: 'triage' })
  .when((input) => /refund|money back|chargeback/i.test(input), refundAgent, {
    id: 'refund',
    name: 'Refund Specialist',
  })
  .otherwise(generalAgent, { name: 'General Support' })
  .build();

// Try: "I need a refund for order #42" → refund path
// Try: "How do I reset my password?"    → general path
//
// Conditional differs from Agent.route():
//   - Agent.route() branches INSIDE a ReAct loop (after LLM decides)
//   - Conditional branches at the TOP LEVEL before any LLM fires`,
  },

  // ── Memory Pipeline (Dynamic Behavior) ──────────────────
  {
    id: 'memory-pipeline',
    label: 'Memory Pipeline',
    description:
      'Cross-turn memory via .memoryPipeline() — load / pick / format / persist as visible flowchart subflows',
    pattern: 'agent',
    category: 'dynamic-behavior',
    config: {
      pattern: 'agent',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt:
        'You are a helpful assistant. You remember what the user tells you across turns.',
      memoryStrategy: 'sliding-window', // ignored by this preset — it uses memoryPipeline()
      memoryParam: 0,
      enableTools: false,
      enableStreaming: false,
      presetId: 'memory-pipeline',
    },
    suggestedMessage: 'My name is Alice and I live in San Francisco.',
    code: `import { Agent, anthropic } from 'agentfootprint';
import { defaultPipeline, InMemoryStore } from 'agentfootprint/memory';

// Build a memory pipeline ONCE at app startup — it's a compiled FlowChart.
// Swap InMemoryStore for RedisStore / PostgresStore without changing the
// agent or the pipeline composition.
const store = new InMemoryStore();
const pipeline = defaultPipeline({
  store,
  loadCount: 20,         // how many recent entries to load per turn
  reserveTokens: 512,    // budget reserved for system prompt + new user msg
  // writeTier: 'hot',   // optional — mark entries as hot for tier-filtered reads
});

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You remember what the user tells you across turns.')
  .memoryPipeline(pipeline)   // ← the one line that adds memory
  .build();

// Same agent instance — per-run identity keeps many users isolated.
await agent.run('My name is Alice.', {
  identity: { conversationId: 'alice-chat', principal: 'user-42' },
});

await agent.run("What's my name?", {
  identity: { conversationId: 'alice-chat', principal: 'user-42' },
});
// → LLM prompt now contains <memory turn="1">Alice's message</memory>
// → agent answers "Your name is Alice."

// Cross-turn behavior:
//   - Load Memory subflow reads prior entries, picks what fits the budget,
//     formats them as a <memory> tagged system message
//   - AssemblePrompt prepends memory BEFORE the current user message
//   - Save Memory subflow persists the turn's messages at turn end
//
// Every load / pick / format / write appears in the BTS narrative —
// no guessing what the agent "remembers."`,
  },
];

export function getPresetsByPattern(): Map<PatternType, Preset[]> {
  const grouped = new Map<PatternType, Preset[]>();
  for (const preset of PRESETS) {
    if (!grouped.has(preset.pattern)) grouped.set(preset.pattern, []);
    grouped.get(preset.pattern)!.push(preset);
  }
  return grouped;
}

export function getPresetsByCategory(): { category: PresetCategoryMeta; presets: Preset[] }[] {
  return PRESET_CATEGORIES
    .map((cat) => ({
      category: cat,
      presets: PRESETS.filter((p) => p.category === cat.id),
    }))
    .filter((g) => g.presets.length > 0);
}

export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
