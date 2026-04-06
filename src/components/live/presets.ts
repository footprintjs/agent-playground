/**
 * Live Chat Presets — real-world domain scenarios with mock data.
 *
 * Each preset feels like a production app: e-commerce support with real order data,
 * HR assistant with employee records, product knowledge base with specifications.
 */
import type { LiveConfig, PatternType } from './types';

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly pattern: PatternType;
  readonly config: LiveConfig;
  readonly suggestedMessage: string;
  readonly code: string;
}

export const PRESETS: Preset[] = [
  // ── LLM Call ──────────────────────────────────────────────
  {
    id: 'chat-assistant',
    label: 'Chat Assistant',
    description: 'Simple multi-turn conversation with memory',
    pattern: 'llm-call',
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

  // ── Agent (ReAct with real data) ──────────────────────────
  {
    id: 'refund-approval',
    label: 'Refund Approval (ask_human)',
    description: 'Agent pauses to ask human for approval before processing refunds',
    pattern: 'agent',
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

  // ── RAG ───────────────────────────────────────────────────
  {
    id: 'product-knowledge',
    label: 'Product Knowledge Base',
    description: 'Answer questions from product docs, return policy, AppleCare',
    pattern: 'rag',
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

  // ── Swarm ─────────────────────────────────────────────────
  {
    id: 'specialist-swarm',
    label: 'Specialist Routing',
    description: 'Routes to coding, math, or writing specialist',
    pattern: 'swarm',
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

  // ── Conditional Instructions ──────────────────────────────
  {
    id: 'conditional-instructions',
    label: 'Conditional Instructions',
    description: 'Instructions activate based on tool results — Decision Scope drives behavior',
    pattern: 'agent',
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

  // ── Dynamic ReAct ─────────────────────────────────────────
  {
    id: 'dynamic-support',
    label: 'Dynamic Support (Progressive Auth)',
    description: 'Tools change after identity verification — Dynamic ReAct',
    pattern: 'agent',
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
];

export function getPresetsByPattern(): Map<PatternType, Preset[]> {
  const grouped = new Map<PatternType, Preset[]>();
  for (const preset of PRESETS) {
    if (!grouped.has(preset.pattern)) grouped.set(preset.pattern, []);
    grouped.get(preset.pattern)!.push(preset);
  }
  return grouped;
}

export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
