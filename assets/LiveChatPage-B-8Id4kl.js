import{r as l,j as e,l as B,t as pe,E as me,T as V,L as he,S as ge}from"./index-wMYifPy0.js";const ve=[{id:"llm-call",label:"LLM Call",description:"Single LLM call with multi-turn memory"},{id:"agent",label:"Agent",description:"ReAct agent with tools and memory"},{id:"rag",label:"RAG",description:"Retrieval-augmented generation (single-shot per turn)"},{id:"swarm",label:"Swarm",description:"Multi-agent orchestrator with specialist routing"}],fe=[{id:"sliding-window",label:"Sliding Window",description:"Keep last N messages"},{id:"char-budget",label:"Char Budget",description:"Fit within character limit"},{id:"none",label:"No Memory",description:"Each turn is independent"}],ye={pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a helpful assistant. Be concise.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!0,enableStreaming:!0,parallelTools:!1},be=[{id:"getting-started",label:"Getting Started",description:"Simple patterns to explore"},{id:"tool-use",label:"Tool Use",description:"Agents that call tools and APIs"},{id:"dynamic-behavior",label:"Dynamic Behavior",description:"Runtime adaptation and conditional logic"},{id:"knowledge",label:"Knowledge & RAG",description:"Answer from documents and data"},{id:"multi-agent",label:"Multi-Agent",description:"Orchestrate multiple specialists"}],xe=[{id:"chat-assistant",label:"Chat Assistant",description:"Simple multi-turn conversation with memory",pattern:"llm-call",category:"getting-started",config:{pattern:"llm-call",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a helpful, concise assistant. Answer in 2-3 sentences unless asked for detail.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!1,enableStreaming:!0,presetId:"chat-assistant"},suggestedMessage:"What are the main differences between REST and GraphQL?",code:`import { LLMCall, anthropic } from 'agentfootprint';

const chat = LLMCall
  .create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a helpful, concise assistant.')
  .build();

const result = await chat.run('What are the differences between REST and GraphQL?');`},{id:"code-reviewer",label:"Code Reviewer",description:"Reviews code for bugs, security, and quality",pattern:"llm-call",category:"getting-started",config:{pattern:"llm-call",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a senior code reviewer. Analyze code for: bugs, security vulnerabilities, performance issues, and readability. Be specific and actionable. Use severity levels: CRITICAL, WARNING, INFO.",memoryStrategy:"sliding-window",memoryParam:20,enableTools:!1,enableStreaming:!0,presetId:"code-reviewer"},suggestedMessage:`Review this function:

function getUser(id) {
  const user = db.query("SELECT * FROM users WHERE id = " + id);
  return user;
}`,code:`import { LLMCall, anthropic } from 'agentfootprint';

const reviewer = LLMCall
  .create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a senior code reviewer. Analyze for bugs, security, performance.')
  .build();

const result = await reviewer.run('Review this function: ...');`},{id:"refund-approval",label:"Refund Approval",description:"Pauses to ask human for approval before processing refunds",pattern:"agent",category:"tool-use",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:`You are a customer support agent for TechStore. You help customers with refunds.

RULES (follow strictly):
1. ALWAYS look up the order first using lookup_order. If the lookup fails or returns an error, tell the customer you cannot access their order right now and ask them to try again later. Do NOT proceed with a refund if the order lookup failed.
2. Only if the order lookup succeeds, use the ask_human tool to request manager approval. Include the EXACT order ID, amount, and item names from the lookup result — never make up order details.
3. After the manager responds via ask_human, tell the customer the decision.
4. If the manager denies, explain politely. If approved, confirm the refund.`,memoryStrategy:"sliding-window",memoryParam:50,enableTools:!0,enableStreaming:!0,presetId:"ecommerce-support"},suggestedMessage:"I want a refund for order ORD-1001. The product arrived damaged.",code:`import { Agent, askHuman, defineTool, anthropic } from 'agentfootprint';

const agent = Agent.create({ provider: anthropic('claude-sonnet-4-20250514') })
  .system('You are a support agent. Use ask_human for manager approval before refunds.')
  .tool(lookupOrder)
  .tool(askHuman())  // ← enables human-in-the-loop
  .build();

const result = await agent.run('I want a refund for order ORD-1001');
if (result.paused) {
  // Agent asked: "Approve refund of $299 for ORD-1001?"
  const final = await agent.resume('Yes, approved');
}`},{id:"ecommerce-support",label:"E-Commerce Support",description:"Customer support with orders, inventory, and tracking",pattern:"agent",category:"tool-use",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a customer support agent for TechStore. You can look up orders, check inventory, and track packages. Be helpful and empathetic. If an order is cancelled or returned, apologize and offer alternatives. Always use the tools to look up information — never make up order details.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!0,enableStreaming:!0,presetId:"ecommerce-support"},suggestedMessage:"Can you check the status of order ORD-1003?",code:`import { Agent, defineTool, anthropic } from 'agentfootprint';

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
// Try: "Track package PKG-4522-US" (shipped)`},{id:"hr-assistant",label:"HR Assistant",description:"Employee lookup, PTO balance, and policy questions",pattern:"agent",category:"tool-use",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are an HR assistant. You can look up employee information, check PTO balances, and answer policy questions. Always use the tools to look up data — never guess employee details. For sensitive requests, remind the employee to contact HR directly.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!0,enableStreaming:!0,presetId:"hr-assistant"},suggestedMessage:"How many PTO days does Sarah Chen have left?",code:`import { Agent, defineTool, anthropic } from 'agentfootprint';

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
// Try: "Look up Maria Garcia's department"`},{id:"product-knowledge",label:"Product Knowledge Base",description:"Answer questions from product docs, return policy, AppleCare",pattern:"rag",category:"knowledge",config:{pattern:"rag",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:`You are a product specialist for TechStore. Answer questions based ONLY on the retrieved product documentation. If the docs don't contain the answer, say "I don't have that information in our product database." Cite which document section your answer comes from.`,memoryStrategy:"none",memoryParam:50,enableTools:!1,enableStreaming:!0,presetId:"product-knowledge"},suggestedMessage:"What does AppleCare+ cover and how much does it cost?",code:`import { RAG, anthropic, mockRetriever } from 'agentfootprint';

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
// Try: "What shipping options are available?"`},{id:"hr-knowledge",label:"HR Policy Knowledge Base",description:"Answer HR questions from company handbook",pattern:"rag",category:"knowledge",config:{pattern:"rag",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are an HR policy advisor. Answer questions based ONLY on the company handbook sections provided. Be precise about numbers (days, amounts, percentages). If the policy doesn't cover the question, direct the employee to their HR Business Partner.",memoryStrategy:"none",memoryParam:50,enableTools:!1,enableStreaming:!0,presetId:"hr-knowledge"},suggestedMessage:"How many days of parental leave do we get?",code:`import { RAG, anthropic, mockRetriever } from 'agentfootprint';

const retriever = mockRetriever([{
  chunks: [
    { content: 'PTO Policy: 1.5 days/month, max 5 carry-over...', metadata: { section: 'PTO' } },
    { content: 'Remote Work: 2 days in-office minimum...', metadata: { section: 'WFH' } },
    { content: 'Benefits: 90% health premiums, 401k 4% match...', metadata: { section: 'Benefits' } },
  ],
}]);

// Try: "How many days of parental leave?"
// Try: "What is the expense policy for hotels?"
// Try: "Can I work fully remote?"`},{id:"specialist-swarm",label:"Specialist Routing",description:"Routes to coding, math, or writing specialist",pattern:"swarm",category:"multi-agent",config:{pattern:"swarm",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are an orchestrator. Analyze the user request and route to the best specialist: coding (for code questions), math (for calculations), or writing (for creative content). Explain which specialist you chose and why.",memoryStrategy:"none",memoryParam:50,enableTools:!1,enableStreaming:!0,presetId:"specialist-swarm"},suggestedMessage:"Write a haiku about debugging code",code:`import { Swarm, Agent, anthropic } from 'agentfootprint';

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
// swarm.getNarrativeEntries() shows full execution trace`},{id:"conditional-instructions",label:"Conditional Instructions",description:"Instructions activate based on tool results via Decision Scope",pattern:"agent",category:"dynamic-behavior",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a customer support agent for TechStore. Look up orders and help customers.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!0,enableStreaming:!0,presetId:"conditional-instructions"},suggestedMessage:"Check order ORD-1003 — I need help with a refund",code:`import { Agent, defineTool } from 'agentfootprint';
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
//   refund-handling activates → empathy prompt injected`},{id:"dynamic-support",label:"Progressive Authorization",description:"Tools and prompt change after identity verification",pattern:"agent",category:"dynamic-behavior",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a customer support agent. Start by looking up the customer order. If the order is flagged or cancelled, you may need elevated access — use verify_identity first, then admin tools become available.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!0,enableStreaming:!0,presetId:"dynamic-support"},suggestedMessage:"Check order ORD-1003 and help me get a refund",code:`import { Agent, AgentPattern, defineTool, anthropic } from 'agentfootprint';
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
// Turn 3: issue_refund now available!`},{id:"parallel-lookup",label:"Parallel Tool Lookup",description:"Fire 3 independent tools in one turn concurrently via Promise.all",pattern:"agent",category:"tool-use",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a support agent. When gathering context about a customer, fire independent lookup tools (get_customer, get_orders, get_product) in the SAME turn so they run in parallel — not one after the other. Then summarize what you found.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!0,enableStreaming:!0,parallelTools:!0,presetId:"parallel-lookup"},suggestedMessage:"Give me everything you know about customer cust-42 and product WIDGET-A in one shot.",code:`import { Agent, defineTool, anthropic } from 'agentfootprint';

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
// Parallel lands in ~260ms + LLM overhead.`},{id:"escalation-gate",label:"Escalation Gate",description:"Inject a user-defined routing branch — safety valve before default flow",pattern:"agent",category:"dynamic-behavior",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a customer support agent. For routine questions, answer directly. If the customer is angry, threatening legal action, asking for a refund above $500, or otherwise needs human help, include the literal string [ESCALATE] in your response — the routing layer will take over and queue a human.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!1,enableStreaming:!0,presetId:"escalation-gate"},suggestedMessage:"I've been waiting three weeks for a refund and no one is answering. I'm going to call my lawyer.",code:`import { Agent, anthropic } from 'agentfootprint';
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
//   → that answer becomes the final response (loop breaks)`},{id:"conditional-triage",label:"Conditional Triage",description:"Rule-based routing between two agents with ZERO LLM calls at the branching step",pattern:"agent",category:"dynamic-behavior",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are general customer support. Answer clearly and concisely.",memoryStrategy:"sliding-window",memoryParam:50,enableTools:!1,enableStreaming:!1,presetId:"conditional-triage"},suggestedMessage:"I need a refund for order #42",code:`import { Agent, Conditional, anthropic } from 'agentfootprint';

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
//   - Conditional branches at the TOP LEVEL before any LLM fires`},{id:"memory-pipeline",label:"Memory Pipeline",description:"Cross-turn memory via .memoryPipeline() — load / pick / format / persist as visible flowchart subflows",pattern:"agent",category:"dynamic-behavior",config:{pattern:"agent",modelId:"claude-sonnet-4-20250514",provider:"anthropic",systemPrompt:"You are a helpful assistant. You remember what the user tells you across turns.",memoryStrategy:"sliding-window",memoryParam:0,enableTools:!1,enableStreaming:!1,presetId:"memory-pipeline"},suggestedMessage:"My name is Alice and I live in San Francisco.",code:`import { Agent, anthropic } from 'agentfootprint';
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
// no guessing what the agent "remembers."`}];function we(){return be.map(t=>({category:t,presets:xe.filter(n=>n.category===t.id)})).filter(t=>t.presets.length>0)}const U={"llm-call":"✨",agent:"🤖",rag:"🔍",swarm:"🐝"},Q={"llm-call":"LLM Call",agent:"Agent",rag:"RAG",swarm:"Swarm"};function je({activePresetId:t,onSelect:n,onViewCode:c,disabled:s}){const[o,p]=l.useState(!1),u=l.useRef(null),m=l.useMemo(()=>we(),[]),d=l.useMemo(()=>{for(const v of m){const i=v.presets.find(h=>h.id===t);if(i)return i}return null},[m,t]);return l.useEffect(()=>{if(!o)return;const v=i=>{u.current&&!u.current.contains(i.target)&&p(!1)};return document.addEventListener("mousedown",v),()=>document.removeEventListener("mousedown",v)},[o]),l.useEffect(()=>{if(!o)return;const v=i=>{i.key==="Escape"&&p(!1)};return document.addEventListener("keydown",v),()=>document.removeEventListener("keydown",v)},[o]),e.jsxs("div",{className:"preset-selector",ref:u,children:[e.jsxs("button",{className:`preset-trigger ${o?"preset-trigger--open":""} ${d?"preset-trigger--active":""}`,onClick:()=>!s&&p(!o),disabled:s,type:"button",children:[d?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"preset-trigger-icon",children:U[d.pattern]}),e.jsxs("span",{className:"preset-trigger-content",children:[e.jsx("span",{className:"preset-trigger-label",children:d.label}),e.jsx("span",{className:"preset-trigger-pattern",children:Q[d.pattern]})]})]}):e.jsx("span",{className:"preset-trigger-placeholder",children:"Choose an example to explore..."}),e.jsx("span",{className:`preset-trigger-chevron ${o?"preset-trigger-chevron--open":""}`,children:"▾"})]}),o&&e.jsx("div",{className:"preset-dropdown",children:m.map(({category:v,presets:i})=>e.jsxs("div",{className:"preset-group",children:[e.jsxs("div",{className:"preset-group-header",children:[e.jsx("span",{className:"preset-group-label",children:v.label}),e.jsx("span",{className:"preset-group-desc",children:v.description})]}),i.map(h=>e.jsxs("button",{className:`preset-item ${t===h.id?"preset-item--active":""}`,onClick:()=>{n(h),p(!1)},type:"button",children:[e.jsx("span",{className:"preset-item-icon",children:U[h.pattern]}),e.jsxs("span",{className:"preset-item-content",children:[e.jsx("span",{className:"preset-item-label",children:h.label}),e.jsx("span",{className:"preset-item-desc",children:h.description})]}),e.jsx("span",{className:"preset-item-badge",children:Q[h.pattern]}),e.jsx("button",{className:"preset-item-code",onClick:a=>{a.stopPropagation(),c(h)},title:"View code",type:"button",children:"</>"})]},h.id))]},v.id))})]})}async function Ne(t){try{const n=await fetch("https://api.anthropic.com/v1/models?limit=100",{headers:{"x-api-key":t,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}});return n.ok?((await n.json()).data??[]).filter(s=>s.id&&!s.id.includes("test")).map(s=>({id:s.id,label:s.display_name??s.id,provider:"anthropic"})).sort((s,o)=>s.label.localeCompare(o.label)):[]}catch{return[]}}async function ke(t){try{const n=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:`Bearer ${t}`}});return n.ok?((await n.json()).data??[]).filter(s=>{const o=s.id;return(o.startsWith("gpt-")||o.startsWith("o1")||o.startsWith("o3")||o.startsWith("o4")||o.startsWith("chatgpt"))&&!o.includes("realtime")&&!o.includes("audio")&&!o.includes("tts")}).map(s=>({id:s.id,label:s.id,provider:"openai"})).sort((s,o)=>s.id.localeCompare(o.id)):[]}catch{return[]}}async function Se(t){const n=[];return t.anthropic&&n.push(Ne(t.anthropic)),t.openai&&n.push(ke(t.openai)),(await Promise.all(n)).flat()}const J=[{id:"claude-sonnet-4-20250514",label:"Claude Sonnet 4",provider:"anthropic"},{id:"claude-opus-4-20250514",label:"Claude Opus 4",provider:"anthropic"},{id:"claude-haiku-3-5-20241022",label:"Claude Haiku 3.5",provider:"anthropic"},{id:"gpt-4o",label:"GPT-4o",provider:"openai"},{id:"gpt-4o-mini",label:"GPT-4o Mini",provider:"openai"}];function Te({config:t,onChange:n,onReset:c,collapsed:s,onToggleCollapse:o,running:p,style:u,onPresetSelect:m,activePresetId:d}){const[v,i]=l.useState(null),h=(r,C)=>{const S={...t,[r]:C,presetId:void 0};if(r==="modelId"){const M=(a??J).find(W=>W.id===C);M&&(S.provider=M.provider)}n(S)},[a,f]=l.useState(null);l.useEffect(()=>{const r=B();if(!r.anthropic&&!r.openai){f(null);return}Se({anthropic:r.anthropic||void 0,openai:r.openai||void 0}).then(C=>{f(C.length>0?C:null)})},[t.provider]);const N=a??J;return e.jsxs("div",{className:`live-config ${s?"live-config--collapsed":""}`,style:u,children:[e.jsxs("div",{className:"live-config-header",onClick:o,children:[e.jsx("span",{className:"live-config-title",children:"Configuration"}),e.jsx("button",{className:"live-collapse-btn","aria-label":s?"Expand":"Collapse",children:s?"▶":"◀"})]}),!s&&e.jsxs("div",{className:"live-config-body",children:[e.jsx(A,{label:"Try an Example",children:e.jsx(je,{activePresetId:d,onSelect:r=>{n(r.config),m==null||m(r),c()},onViewCode:r=>i(r),disabled:p})}),e.jsx(A,{label:"Pattern",children:e.jsx("div",{className:"live-pattern-grid",children:ve.map(r=>e.jsxs("button",{className:`live-pattern-btn ${t.pattern===r.id?"active":""}`,onClick:()=>h("pattern",r.id),disabled:p,title:r.description,children:[e.jsx("span",{className:"live-pattern-icon",children:Ce(r.id)}),e.jsx("span",{children:r.label})]},r.id))})}),e.jsx(A,{label:"Model",children:e.jsx("select",{className:"live-select",value:t.modelId,onChange:r=>h("modelId",r.target.value),disabled:p,children:N.map(r=>e.jsxs("option",{value:r.id,children:[r.label," (",r.provider,")"]},r.id))})}),e.jsx(A,{label:"System Prompt",children:e.jsx("textarea",{className:"live-textarea",value:t.systemPrompt,onChange:r=>h("systemPrompt",r.target.value),rows:3,disabled:p,placeholder:"You are a helpful assistant..."})}),(t.pattern==="agent"||t.pattern==="swarm")&&e.jsxs(A,{label:"Tools",children:[e.jsxs("label",{className:"live-toggle",children:[e.jsx("input",{type:"checkbox",checked:t.enableTools,onChange:r=>h("enableTools",r.target.checked),disabled:p}),e.jsx("span",{children:"Enable tools (calculator, datetime, web search)"})]}),t.pattern==="agent"&&t.enableTools&&e.jsxs("label",{className:"live-toggle",style:{marginTop:6},children:[e.jsx("input",{type:"checkbox",checked:!!t.parallelTools,onChange:r=>h("parallelTools",r.target.checked),disabled:p}),e.jsx("span",{children:"Run independent tool calls in parallel (per turn)"})]})]}),e.jsx(A,{label:"Streaming",children:e.jsxs("label",{className:"live-toggle",children:[e.jsx("input",{type:"checkbox",checked:t.enableStreaming,onChange:r=>h("enableStreaming",r.target.checked),disabled:p}),e.jsx("span",{children:"Stream tokens (see response as it types)"})]})}),e.jsxs(A,{label:"Memory Strategy",children:[e.jsx("div",{className:"live-memory-options",children:fe.map(r=>e.jsxs("label",{className:"live-radio",title:r.description,children:[e.jsx("input",{type:"radio",name:"memory-strategy",value:r.id,checked:t.memoryStrategy===r.id,onChange:()=>h("memoryStrategy",r.id),disabled:p||t.pattern==="rag"}),e.jsx("span",{children:r.label})]},r.id))}),t.memoryStrategy!=="none"&&t.pattern!=="rag"&&e.jsxs("div",{className:"live-param-row",children:[e.jsx("label",{className:"live-param-label",children:t.memoryStrategy==="sliding-window"?"Max Messages":"Max Chars"}),e.jsx("input",{type:"number",className:"live-input-number",value:t.memoryParam,onChange:r=>h("memoryParam",Math.max(1,parseInt(r.target.value)||1)),min:1,disabled:p})]})]}),e.jsx("button",{className:"live-reset-btn",onClick:c,disabled:p,children:"Reset Conversation"})]}),v&&e.jsx("div",{className:"live-code-overlay",onClick:()=>i(null),children:e.jsxs("div",{className:"live-code-modal",onClick:r=>r.stopPropagation(),children:[e.jsxs("div",{className:"live-code-header",children:[e.jsxs("span",{children:[v.label," — Code"]}),e.jsx("button",{onClick:()=>i(null),children:"✕"})]}),e.jsx("pre",{className:"live-code-body",children:e.jsx("code",{children:v.code})}),e.jsx("button",{className:"live-code-copy",onClick:()=>{navigator.clipboard.writeText(v.code)},children:"Copy"})]})})]})}function A({label:t,children:n}){return e.jsxs("div",{className:"live-section",children:[e.jsx("div",{className:"live-section-label",children:t}),n]})}function Ce(t){switch(t){case"llm-call":return"✨";case"agent":return"🤖";case"rag":return"🔍";case"swarm":return"🐝"}}function Ae({messages:t,running:n,input:c,streamingContent:s,onInputChange:o,onSend:p,onResume:u,onViewBTS:m,selectedBTSId:d}){const v=l.useRef(null),i=l.useRef(null);l.useEffect(()=>{var a;(a=v.current)==null||a.scrollIntoView({behavior:"smooth"})},[t,n]);const h=a=>{a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),!n&&c.trim()&&p())};return e.jsxs("div",{className:"live-chat",children:[e.jsxs("div",{className:"live-chat-messages",children:[t.length===0&&!n&&e.jsxs("div",{className:"live-chat-empty",children:[e.jsx("div",{className:"live-chat-empty-icon",children:"💬"}),e.jsx("div",{className:"live-chat-empty-text",children:"Send a message to start the conversation"}),e.jsx("div",{className:"live-chat-empty-hint",children:"Behind the Scenes data is captured every turn"})]}),t.map(a=>e.jsxs("div",{className:`live-msg live-msg--${a.role==="pause"?"assistant":a.role}${a.paused?" live-msg--paused":""}`,children:[e.jsxs("div",{className:"live-msg-header",children:[e.jsx("span",{className:"live-msg-role",children:a.role==="user"?"You":a.paused?"Agent (waiting)":"Assistant"}),a.durationMs!=null&&e.jsxs("span",{className:"live-msg-meta",children:[a.durationMs,"ms"]})]}),a.paused?e.jsx(Ee,{question:a.pauseQuestion??"Waiting for your response...",onResume:u,disabled:n}):e.jsxs(e.Fragment,{children:[a.maxIterationsReached&&e.jsxs("div",{className:"live-max-iter-banner",role:"alert",children:[e.jsx("span",{className:"live-max-iter-icon",children:"⚠️"}),e.jsx("span",{className:"live-max-iter-text",children:"Agent hit the iteration cap before finishing. It may have been stuck retrying a failing tool call — check Behind the Scenes for details."})]}),e.jsx("div",{className:"live-msg-content",children:a.content})]}),a.execution&&e.jsxs(e.Fragment,{children:[e.jsxs("button",{className:`live-bts-badge ${d===a.id?"active":""}`,onClick:()=>m(a.id),children:["🔍"," Behind the Scenes"]}),e.jsxs("button",{className:"live-bts-badge",title:"Copy this run as a trace JSON — paste into /viewer to inspect later or share with support",onClick:async()=>{const f={schemaVersion:1,exportedAt:new Date().toISOString(),redacted:!1,snapshot:a.execution.snapshot,narrativeEntries:a.execution.narrativeEntries,spec:a.execution.spec};try{await navigator.clipboard.writeText(JSON.stringify(f))}catch{const N=document.createElement("textarea");N.value=JSON.stringify(f),document.body.appendChild(N),N.select(),document.execCommand("copy"),document.body.removeChild(N)}},children:["📋"," Copy Trace"]})]})]},a.id)),n&&e.jsxs("div",{className:"live-msg live-msg--assistant live-msg--loading",children:[e.jsx("div",{className:"live-msg-header",children:e.jsx("span",{className:"live-msg-role",children:"Assistant"})}),e.jsx("div",{className:"live-msg-content",children:s?e.jsxs("span",{children:[s,e.jsx("span",{className:"live-cursor",children:"|"})]}):e.jsxs("span",{className:"live-typing-dots",children:[e.jsx("span",{children:"."}),e.jsx("span",{children:"."}),e.jsx("span",{children:"."})]})})]}),e.jsx("div",{ref:v})]}),e.jsxs("div",{className:"live-chat-input-bar",children:[e.jsx("textarea",{ref:i,className:"live-chat-input",value:c,onChange:a=>o(a.target.value),onKeyDown:h,placeholder:"Type a message...",rows:1,disabled:n}),e.jsx("button",{className:"live-send-btn",onClick:p,disabled:n||!c.trim(),children:n?"⏳":"↑"})]})]})}function Ee({question:t,onResume:n,disabled:c}){const[s,o]=l.useState(""),[p,u]=l.useState(!1),m=d=>{p||c||(u(!0),n==null||n(d))};return e.jsxs("div",{className:"pause-card",children:[e.jsxs("div",{className:"pause-card-header",children:[e.jsx("span",{className:"pause-card-icon",children:"⏸"}),e.jsx("span",{className:"pause-card-label",children:"Approval Required"})]}),e.jsx("div",{className:"pause-card-question",children:t}),p?e.jsx("div",{className:"pause-card-responded",children:"Response sent"}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"pause-card-actions",children:[e.jsxs("button",{className:"pause-card-btn pause-card-btn--approve",onClick:()=>m("Approved. Please proceed with the refund."),disabled:c,children:["✓"," Approve"]}),e.jsxs("button",{className:"pause-card-btn pause-card-btn--deny",onClick:()=>m("Denied. The refund request is rejected."),disabled:c,children:["✗"," Deny"]})]}),e.jsxs("div",{className:"pause-card-custom",children:[e.jsx("input",{type:"text",className:"pause-card-input",value:s,onChange:d=>o(d.target.value),onKeyDown:d=>{d.key==="Enter"&&s.trim()&&m(s.trim())},placeholder:"Or type a custom response...",disabled:c}),s.trim()&&e.jsx("button",{className:"pause-card-btn pause-card-btn--send",onClick:()=>m(s.trim()),disabled:c,children:"Send"})]})]})]})}const Ie={"claude-sonnet-4-20250514":{input:3,output:15},"claude-opus-4-20250514":{input:15,output:75},"claude-haiku-3-5-20241022":{input:.8,output:4},"gpt-4o":{input:2.5,output:10},"gpt-4o-mini":{input:.15,output:.6},"gpt-4.1":{input:2,output:8},"gpt-4.1-mini":{input:.4,output:1.6},"o3-mini":{input:1.1,output:4.4}};function Me(t){const n=Ie[t.model];return n?t.inputTokens/1e6*n.input+t.outputTokens/1e6*n.output:0}function Le(t){let n=0;for(const c of t)n+=Me(c);return n}function Re(t){return t===0?"$0":t<.01?`$${t.toFixed(4)}`:`$${t.toFixed(3)}`}function F(t,n){const c=new Set,s=Math.min(n+1,t.length);for(let o=0;o<s;o++){const p=t[o].runtimeStageId;p&&c.add(p)}return c}function Pe(t){return[De(t),Oe(t),We(t)]}function E({message:t}){return e.jsx("div",{className:"rv-panel rv-empty",children:e.jsx("div",{className:"rv-empty-text",children:t})})}function De(t){return{id:"tokens",name:"Tokens",render:({snapshots:n,selectedIndex:c})=>{const s=t==null?void 0:t.tokens;if(!s||s.totalCalls===0)return e.jsx(E,{message:"No LLM calls recorded."});const o=s.calls??[],p=F(n,c),u=o.filter(i=>i.runtimeStageId&&p.has(i.runtimeStageId));if(u.length===0)return e.jsx(E,{message:"LLM call hasn't executed yet. Step forward."});const m=u.reduce((i,h)=>i+h.inputTokens,0),d=u.reduce((i,h)=>i+h.outputTokens,0),v=u.length>0?Le(u):0;return e.jsxs("div",{className:"rv-panel",children:[e.jsxs("div",{className:"rv-stats",children:[e.jsx(j,{value:u.length,label:"LLM Calls"}),e.jsx(j,{value:m.toLocaleString(),label:"Input Tokens"}),e.jsx(j,{value:d.toLocaleString(),label:"Output Tokens"}),e.jsx(j,{value:(m+d).toLocaleString(),label:"Total Tokens"}),v>0&&e.jsx(j,{value:Re(v),label:"Est. Cost"})]}),u.length>0&&e.jsxs("div",{className:"rv-section",children:[e.jsx("div",{className:"rv-section-title",children:"Per LLM Call"}),e.jsx("div",{className:"rv-calls-table",children:u.map((i,h)=>{const a=i.inputTokens+i.outputTokens,f=Math.max(...u.map(r=>r.inputTokens+r.outputTokens),1),N=Math.round(a/f*100);return e.jsxs("div",{className:"rv-call-row",children:[e.jsxs("div",{className:"rv-call-header",children:[e.jsxs("span",{className:"rv-call-label",children:["Call ",h+1]}),e.jsxs("span",{className:"rv-call-tokens",children:[i.inputTokens.toLocaleString()," in / ",i.outputTokens.toLocaleString()," out"]})]}),e.jsxs("div",{className:"rv-bar",children:[e.jsx("div",{className:"rv-bar-input",style:{flex:i.inputTokens||1}}),e.jsx("div",{className:"rv-bar-output",style:{flex:i.outputTokens||1}})]}),e.jsx("div",{className:"rv-bar-bg",style:{width:`${N}%`}})]},h)})}),e.jsxs("div",{className:"rv-legend",children:[e.jsxs("span",{className:"rv-legend-item",children:[e.jsx("span",{className:"rv-legend-swatch rv-legend-swatch--input"})," Input"]}),e.jsxs("span",{className:"rv-legend-item",children:[e.jsx("span",{className:"rv-legend-swatch rv-legend-swatch--output"})," Output"]})]})]})]})}}}function Oe(t){return{id:"tools",name:"Tools",render:({snapshots:n,selectedIndex:c})=>{const s=t==null?void 0:t.tools;if(!s||s.totalCalls===0)return e.jsx(E,{message:"No tool calls recorded."});if(![...F(n,c)].some(m=>m.includes("execute-tool")||m.includes("tool-calls")))return e.jsx(E,{message:"Tool execution hasn't started yet. Step forward."});const u=Object.values(s.byTool).reduce((m,d)=>m+d.errors,0);return e.jsxs("div",{className:"rv-panel",children:[e.jsxs("div",{className:"rv-stats",children:[e.jsx(j,{value:s.totalCalls,label:"Total Calls"}),e.jsx(j,{value:Object.keys(s.byTool).length,label:"Unique Tools"}),e.jsx(j,{value:u,label:"Errors",accent:u>0?"error":void 0})]}),e.jsxs("div",{className:"rv-section",children:[e.jsx("div",{className:"rv-section-title",children:"Per Tool"}),e.jsx("div",{className:"rv-tool-list",children:Object.entries(s.byTool).map(([m,d])=>e.jsxs("div",{className:"rv-tool-item",children:[e.jsxs("div",{className:"rv-tool-header",children:[e.jsx("span",{className:"rv-tool-name",children:m}),e.jsxs("span",{className:"rv-tool-calls",children:[d.calls,"x"]})]}),e.jsxs("div",{className:"rv-tool-meta",children:[d.averageLatencyMs!=null&&e.jsxs("span",{className:"rv-tool-latency",children:["avg ",Math.round(d.averageLatencyMs),"ms"]}),d.errors>0&&e.jsxs("span",{className:"rv-tool-errors",children:[d.errors," error",d.errors>1?"s":""]})]}),e.jsx("div",{className:"rv-tool-bar",children:e.jsx("div",{className:"rv-tool-bar-fill",style:{width:`${Math.round(d.calls/s.totalCalls*100)}%`}})})]},m))})]})]})}}}function We(t){return{id:"explain",name:"Explain",render:({snapshots:n,selectedIndex:c})=>{const s=t==null?void 0:t.explain;if(!s||s.sources.length===0&&s.claims.length===0)return e.jsx(E,{message:"No grounding data. Run a sample with tools to see sources vs claims."});const o=F(n,c),p=[...o].some(a=>a.includes("call-llm")),u=[...o].some(a=>a.includes("execute-tool")||a.includes("tool-calls")),m=[...o].some(a=>a.includes("final"));if(!p)return e.jsx(E,{message:"LLM hasn't been called yet. Step forward."});if(!u&&s.decisions.length>0)return e.jsxs("div",{className:"rv-panel",children:[e.jsxs("div",{className:"rv-stats",children:[e.jsx(j,{value:0,label:"Sources"}),e.jsx(j,{value:0,label:"Claims"}),e.jsx(j,{value:s.decisions.length,label:"Decisions (pending)"})]}),e.jsx("div",{className:"rv-section",children:e.jsxs("div",{className:"rv-section-title rv-explain-summary",children:["LLM decided to call ",s.decisions.map(a=>a.toolName).join(", "),". Executing tools next."]})})]});const d=u?s.sources:[],v=u?s.decisions:[],i=m?s.claims:[];if(d.length===0&&i.length===0&&v.length===0)return e.jsx(E,{message:"No grounding data. Run a sample with tools to see sources vs claims."});const h=i.length>0?s.summary:`${d.length} source${d.length!==1?"s":""} collected. Claims arrive after finalize.`;return e.jsxs("div",{className:"rv-panel",children:[e.jsxs("div",{className:"rv-stats",children:[e.jsx(j,{value:d.length,label:"Sources"}),e.jsx(j,{value:i.length,label:"Claims"}),e.jsx(j,{value:v.length,label:"Decisions"})]}),e.jsx("div",{className:"rv-section",children:e.jsx("div",{className:"rv-section-title rv-explain-summary",children:h})}),d.length>0&&e.jsxs("div",{className:"rv-section",children:[e.jsx("div",{className:"rv-section-title",children:"Sources (tool results — ground truth)"}),e.jsx("div",{className:"rv-tool-list",children:d.map((a,f)=>e.jsxs("div",{className:"rv-tool-item",children:[e.jsxs("div",{className:"rv-tool-header",children:[e.jsx("span",{className:"rv-tool-name",children:a.toolName}),a.turnNumber!=null&&e.jsxs("span",{className:"rv-tool-calls",children:["turn ",a.turnNumber]})]}),e.jsx("div",{className:"rv-explain-content",children:a.result})]},f))})]}),i.length>0&&e.jsxs("div",{className:"rv-section",children:[e.jsx("div",{className:"rv-section-title",children:"Claims (LLM output — to verify)"}),e.jsx("div",{className:"rv-tool-list",children:i.map((a,f)=>e.jsxs("div",{className:"rv-tool-item",children:[e.jsxs("div",{className:"rv-tool-header",children:[e.jsxs("span",{className:"rv-tool-name",children:["Claim ",f+1]}),a.model&&e.jsx("span",{className:"rv-tool-calls",children:a.model})]}),e.jsx("div",{className:"rv-explain-content",children:a.content})]},f))})]}),v.length>0&&e.jsxs("div",{className:"rv-section",children:[e.jsx("div",{className:"rv-section-title",children:"Decisions (tool calls the LLM made)"}),e.jsx("div",{className:"rv-tool-list",children:v.map((a,f)=>e.jsxs("div",{className:"rv-tool-item",children:[e.jsxs("div",{className:"rv-tool-header",children:[e.jsx("span",{className:"rv-tool-name",children:a.toolName}),e.jsxs("span",{className:"rv-tool-latency",children:[Math.round(a.latencyMs),"ms"]})]}),e.jsx("div",{className:"rv-explain-content rv-explain-args",children:JSON.stringify(a.args)})]},f))})]})]})}}}function j({value:t,label:n,accent:c}){return e.jsxs("div",{className:`rv-stat ${c?`rv-stat--${c}`:""}`,children:[e.jsx("span",{className:"rv-stat-value",children:t}),e.jsx("span",{className:"rv-stat-label",children:n})]})}function Ye({execution:t,previewSpec:n,collapsed:c,onToggleCollapse:s,style:o}){const p=l.useMemo(()=>{if(!(t!=null&&t.snapshot))return[];try{return pe(t.snapshot,t.narrativeEntries??void 0)}catch{return[]}},[t]),u=(t==null?void 0:t.spec)??null,m=l.useMemo(()=>Pe((t==null?void 0:t.recorders)??void 0),[t]),d=t&&p.length>0,v=!d&&n;return e.jsxs("div",{className:`live-bts ${c?"live-bts--collapsed":""}`,style:o,children:[e.jsxs("div",{className:"live-bts-header",onClick:s,children:[e.jsx("button",{className:"live-collapse-btn","aria-label":c?"Expand":"Collapse",children:c?"◀":"▶"}),e.jsx("span",{className:"live-bts-title",children:"Behind the Scenes"}),e.jsx("span",{className:"live-bts-badge-label",children:"footprintjs"})]}),!c&&e.jsx("div",{className:"live-bts-body",children:d?e.jsxs(e.Fragment,{children:[e.jsx(me,{snapshots:p,spec:u,narrativeEntries:t.narrativeEntries??void 0,tabs:["explainable"],defaultTab:"narrative",hideTabs:["result"],size:"compact",recorderViews:m,panelLabels:{topology:"What Ran",details:"What Happened",timeline:"How Long"},renderFlowchart:u?({spec:i,snapshots:h,selectedIndex:a,onNodeClick:f})=>e.jsx(V,{spec:i,snapshots:h,snapshotIndex:a,onNodeClick:f}):void 0,style:{flex:1}}),e.jsx("div",{className:"live-bts-hint",children:"This trace was collected automatically during execution — no extra code."})]}):v?e.jsxs("div",{className:"live-bts-preview",children:[e.jsx("div",{className:"live-bts-preview-label",children:"Pattern Blueprint"}),e.jsx("div",{className:"live-bts-preview-hint",children:"This is what will run when you send a message. Each stage is a step in the flowchart."}),e.jsx("div",{className:"live-bts-preview-chart",children:e.jsx(V,{spec:n,snapshots:[],snapshotIndex:-1})})]}):e.jsxs("div",{className:"live-bts-empty",children:[e.jsx("div",{className:"live-bts-empty-icon",children:"🔭"}),e.jsx("div",{className:"live-bts-empty-text",children:"Select an example to see the pattern flowchart, or click “Behind the Scenes” on a message to inspect it."})]})})]})}function _e(t,n){const c=()=>{throw new Error("Live chat is being ported to agentfootprint v2 — try Samples for now.")};return{run:c,resume:c,reset:()=>{},getSpec:()=>{},getCapture:()=>{}}}function X({initialWidth:t,minWidth:n,maxWidth:c,direction:s,onResize:o,onCollapse:p}){const u=l.useRef(!1),m=l.useRef(0),d=l.useRef(0),v=l.useCallback(i=>{i.preventDefault(),u.current=!0,m.current=i.clientX,d.current=t,document.body.style.cursor="col-resize",document.body.style.userSelect="none"},[t]);return l.useEffect(()=>{const i=a=>{if(!u.current)return;const f=a.clientX-m.current,N=s==="right"?d.current+f:d.current-f;if(N<n*.6){p==null||p(),u.current=!1,document.body.style.cursor="",document.body.style.userSelect="",window.dispatchEvent(new Event("resize"));return}o(Math.min(Math.max(N,n),c))},h=()=>{u.current&&(u.current=!1,document.body.style.cursor="",document.body.style.userSelect="",window.dispatchEvent(new Event("resize")))};return document.addEventListener("mousemove",i),document.addEventListener("mouseup",h),()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",h)}},[s,n,c,o,p]),{onMouseDown:v}}function Be(t,n){throw new Error("Live pattern specs not yet ported to v2 — original at /tmp/patternSpecs.v1.ts")}const Fe=280,$e=180,Ge=500,He=420,qe=240,ze=900,O=40;function Ve(){var K;const[t,n]=l.useState(ye),[c,s]=l.useState([]),[o,p]=l.useState(""),[u,m]=l.useState(!1),[d,v]=l.useState(null),[i,h]=l.useState(!1),[a,f]=l.useState(!1),[N,r]=l.useState(!1),[C,S]=l.useState(null),[$,M]=l.useState(),[W,Y]=l.useState(null),I=l.useRef(!1),[G,Z]=l.useState(Fe),[H,ee]=l.useState(He),L=l.useRef(null),R=l.useRef(""),[P,te]=l.useState(()=>document.documentElement.classList.contains("light"));l.useEffect(()=>{document.documentElement.classList.toggle("light",P)},[P]);const se=X({initialWidth:i?O:G,minWidth:$e,maxWidth:Ge,direction:"right",onResize:g=>{i&&h(!1),Z(g)},onCollapse:()=>h(!0)}),ae=X({initialWidth:a?O:H,minWidth:qe,maxWidth:ze,direction:"left",onResize:g=>{a&&f(!1),ee(g)},onCollapse:()=>f(!0)}),D=l.useCallback(()=>{const g=B(),w=JSON.stringify({...t,...g});if(R.current!==w)try{L.current=_e(t,{anthropic:g.anthropic||void 0,openai:g.openai||void 0}),R.current=w,S(null)}catch(x){const T=x.message;return S(T),{error:T}}return L.current?{runner:L.current}:{error:"No runner available"}},[t]),ne=l.useCallback(async()=>{if(!o.trim()||u)return;const g={id:`user-${Date.now()}`,role:"user",content:o.trim(),timestamp:Date.now()};s(x=>[...x,g]),p(""),m(!0),S(null);let w=null;try{const x=D();if("error"in x){s(b=>[...b,{id:`error-${Date.now()}`,role:"assistant",content:`Error: ${x.error}`,timestamp:Date.now()}]),m(!1);return}w=x.runner;const T=I.current;Y("");const y=T&&w.resume?await w.resume(g.content):await w.run(g.content,{onToken:b=>{Y(k=>(k??"")+b)}});if(Y(null),y.paused){I.current=!0;const b={id:`pause-${Date.now()}`,role:"pause",content:"",timestamp:Date.now(),execution:y.execution,durationMs:y.durationMs,paused:!0,pauseQuestion:y.pauseQuestion};s(k=>[...k,b]),v(b.id)}else{I.current=!1;const b={id:`assistant-${Date.now()}`,role:"assistant",content:y.content,timestamp:Date.now(),execution:y.execution,durationMs:y.durationMs,...y.maxIterationsReached&&{maxIterationsReached:!0}};s(k=>[...k,b]),v(b.id)}}catch(x){const T=x.message;S(T);let y;if(w)try{y=w.getCapture()}catch{try{const k=w.getSpec();k&&(y={spec:k})}catch{}}const b=`error-${Date.now()}`;s(k=>[...k,{id:b,role:"assistant",content:`Error: ${T}`,timestamp:Date.now(),execution:y}]),y&&(v(b),a&&f(!1))}finally{m(!1)}},[o,u,D]),re=l.useCallback(async g=>{if(u)return;const w={id:`user-${Date.now()}`,role:"user",content:g,timestamp:Date.now()};s(x=>[...x,w]),m(!0),S(null);try{const x=D();if("error"in x){m(!1);return}const T=x.runner;if(!T.resume){m(!1);return}I.current=!1;const y=await T.resume(g);if(y.paused)I.current=!0,s(b=>[...b,{id:`pause-${Date.now()}`,role:"pause",content:"",timestamp:Date.now(),execution:y.execution,durationMs:y.durationMs,paused:!0,pauseQuestion:y.pauseQuestion}]);else{const b={id:`assistant-${Date.now()}`,role:"assistant",content:y.content,timestamp:Date.now(),execution:y.execution,durationMs:y.durationMs,...y.maxIterationsReached&&{maxIterationsReached:!0}};s(k=>[...k,b]),v(b.id)}}catch(x){S(x.message)}finally{m(!1)}},[u,D]),oe=l.useCallback(()=>{var g;(g=L.current)==null||g.reset(),s([]),v(null),R.current="",S(null)},[]),ie=l.useCallback(g=>{n(g),R.current=""},[]),le=l.useCallback(g=>{v(w=>w===g?null:g),a&&f(!1)},[a]),_=((K=c.find(g=>g.id===d))==null?void 0:K.execution)??null,ce=l.useMemo(()=>{if(_)return null;const g=Be(t.pattern,t.presetId);return g||console.warn("[LiveChat] No spec for pattern:",t.pattern,t.presetId),g},[_,t.pattern,t.presetId]),q=B(),z=q.anthropic.length>0||q.openai.length>0,de=i?O:G,ue=a?O:H;return e.jsxs("div",{className:"live-page",children:[e.jsxs("header",{className:"live-header",children:[e.jsxs("div",{className:"live-header-left",children:[e.jsxs(he,{to:"/",className:"live-back-link",children:["←"," Home"]}),e.jsx("span",{className:"live-header-title",children:"Live Chat"}),e.jsx("span",{className:"live-header-pattern",children:t.pattern})]}),e.jsxs("div",{className:"live-header-right",children:[C&&e.jsxs("span",{className:"live-header-error",title:C,children:["⚠"," Error"]}),e.jsxs("button",{onClick:()=>r(!0),className:`live-settings-btn ${z?"has-keys":""}`,title:"API key settings",children:[z?"⚡":"⚙"," Keys"]}),e.jsx("button",{onClick:()=>te(g=>!g),className:"live-theme-btn",title:P?"Dark mode":"Light mode",children:P?"☽":"☀"})]})]}),e.jsxs("div",{className:"live-panels",children:[e.jsx(Te,{config:t,onChange:ie,onReset:oe,collapsed:i,onToggleCollapse:()=>{h(g=>!g),setTimeout(()=>window.dispatchEvent(new Event("resize")),50)},running:u,style:{width:de},activePresetId:$,onPresetSelect:g=>{M(g.id),p(g.suggestedMessage)}}),e.jsx("div",{className:"live-drag-handle",onMouseDown:se.onMouseDown,onDoubleClick:()=>{h(g=>!g),setTimeout(()=>window.dispatchEvent(new Event("resize")),50)},title:"Drag to resize, double-click to collapse",children:e.jsx("div",{className:"live-drag-handle-line"})}),e.jsx(Ae,{messages:c,running:u,input:o,streamingContent:W,onInputChange:p,onSend:ne,onResume:re,onViewBTS:le,selectedBTSId:d}),e.jsx("div",{className:"live-drag-handle",onMouseDown:ae.onMouseDown,onDoubleClick:()=>{f(g=>!g),setTimeout(()=>window.dispatchEvent(new Event("resize")),50)},title:"Drag to resize, double-click to collapse",children:e.jsx("div",{className:"live-drag-handle-line"})}),e.jsx(Ye,{execution:_,previewSpec:ce,collapsed:a,onToggleCollapse:()=>{f(g=>!g),setTimeout(()=>window.dispatchEvent(new Event("resize")),50)},style:{width:ue}})]}),N&&e.jsx(ge,{onClose:()=>r(!1)})]})}export{Ve as LiveChatPage};
