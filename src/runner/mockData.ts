/**
 * Mock data for live chat presets — realistic domain data that makes
 * the playground feel like a production app.
 *
 * Each domain has:
 * - A database (array of records)
 * - Tool definitions that query the database
 * - RAG chunks for knowledge base scenarios
 * - Some tools randomly fail (10%) to demonstrate error instructions
 */

import { defineTool } from 'agentfootprint';
import type { ToolDefinition } from 'agentfootprint';

// ── Customer Orders Database ────────────────────────────────────

const ORDERS = [
  { orderId: 'ORD-1001', customer: 'Alice Chen', status: 'delivered', items: ['MacBook Pro 16"', 'USB-C Hub'], total: 2847.99, trackingId: 'PKG-9281-US', deliveredDate: '2026-03-28' },
  { orderId: 'ORD-1002', customer: 'Bob Martinez', status: 'shipped', items: ['AirPods Max'], total: 549.00, trackingId: 'PKG-4522-US', estimatedDelivery: '2026-04-05' },
  { orderId: 'ORD-1003', customer: 'Carol Williams', status: 'cancelled', items: ['iPad Air', 'Apple Pencil'], total: 878.00, cancelReason: 'Customer request — found better price elsewhere' },
  { orderId: 'ORD-1004', customer: 'David Kim', status: 'processing', items: ['iPhone 16 Pro', 'MagSafe Case', 'Screen Protector'], total: 1284.97, estimatedShip: '2026-04-03' },
  { orderId: 'ORD-1005', customer: 'Eva Johnson', status: 'returned', items: ['MacBook Air 13"'], total: 1299.00, returnReason: 'Defective keyboard — keys sticking after 2 weeks', refundStatus: 'processed' },
];

const PRODUCTS = [
  { id: 'PROD-001', name: 'MacBook Pro 16"', price: 2499.00, stock: 23, category: 'Laptops' },
  { id: 'PROD-002', name: 'MacBook Air 13"', price: 1299.00, stock: 0, category: 'Laptops' },
  { id: 'PROD-003', name: 'iPhone 16 Pro', price: 1099.00, stock: 156, category: 'Phones' },
  { id: 'PROD-004', name: 'iPad Air', price: 599.00, stock: 42, category: 'Tablets' },
  { id: 'PROD-005', name: 'AirPods Max', price: 549.00, stock: 8, category: 'Audio' },
  { id: 'PROD-006', name: 'Apple Watch Ultra', price: 799.00, stock: 0, category: 'Wearables' },
  { id: 'PROD-007', name: 'USB-C Hub', price: 79.99, stock: 200, category: 'Accessories' },
  { id: 'PROD-008', name: 'MagSafe Case', price: 49.00, stock: 340, category: 'Accessories' },
];

// ── Employee HR Database ────────────────────────────────────────

const EMPLOYEES = [
  { id: 'EMP-201', name: 'Sarah Chen', department: 'Engineering', role: 'Senior Engineer', tenure: '4 years', pto_balance: 12, manager: 'Mike Torres' },
  { id: 'EMP-202', name: 'James Wilson', department: 'Marketing', role: 'Marketing Lead', tenure: '2 years', pto_balance: 8, manager: 'Lisa Park' },
  { id: 'EMP-203', name: 'Maria Garcia', department: 'Engineering', role: 'Staff Engineer', tenure: '7 years', pto_balance: 18, manager: 'Mike Torres' },
  { id: 'EMP-204', name: 'Alex Brown', department: 'Sales', role: 'Account Executive', tenure: '1 year', pto_balance: 5, manager: 'Tom Harris' },
  { id: 'EMP-205', name: 'Priya Patel', department: 'Engineering', role: 'Engineering Manager', tenure: '5 years', pto_balance: 15, manager: 'CTO' },
];

const POLICIES = [
  { id: 'POL-PTO', title: 'PTO Policy', content: 'Employees accrue 1.5 days per month. Maximum carry-over is 5 days. PTO requests must be submitted 2 weeks in advance for periods longer than 3 days. Manager approval required for all requests.' },
  { id: 'POL-WFH', title: 'Remote Work Policy', content: 'Hybrid schedule: minimum 2 days in office per week (Tuesday and Thursday required). Full remote available after 1 year tenure with manager approval. Equipment stipend: $1,000 for home office setup.' },
  { id: 'POL-EXPENSE', title: 'Expense Policy', content: 'Meals: up to $25/day when traveling. Flights: economy class for trips under 5 hours. Hotel: up to $200/night. All expenses over $500 require VP approval. Submit receipts within 30 days.' },
];

// ── Tool Factories ──────────────────────────────────────────────

/** Simulate occasional errors (10% chance). */
function maybeError(errorMessage: string): string | null {
  return Math.random() < 0.1 ? errorMessage : null;
}

/** E-commerce support tools with realistic data. */
export function createEcommerceTools(): ToolDefinition[] {
  const lookupOrder = defineTool({
    id: 'lookup_order',
    description: 'Look up a customer order by order ID or customer name. Returns order status, items, tracking info.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID (e.g., ORD-1001)' },
        customerName: { type: 'string', description: 'Customer name to search' },
      },
    },
    handler: async ({ orderId, customerName }: { orderId?: string; customerName?: string }) => {
      const err = maybeError('Order service temporarily unavailable. Please try again.');
      if (err) return { content: JSON.stringify({ error: true, message: err }) };

      const order = orderId
        ? ORDERS.find((o) => o.orderId === orderId)
        : ORDERS.find((o) => o.customer.toLowerCase().includes((customerName || '').toLowerCase()));

      if (!order) return { content: JSON.stringify({ error: true, code: 'NOT_FOUND', message: `No order found for ${orderId || customerName}` }) };
      return { content: JSON.stringify(order) };
    },
  });

  const checkInventory = defineTool({
    id: 'check_inventory',
    description: 'Check product availability and stock levels. Can search by product name or category.',
    inputSchema: {
      type: 'object',
      properties: {
        productName: { type: 'string', description: 'Product name or partial match' },
        category: { type: 'string', description: 'Product category (Laptops, Phones, Tablets, Audio, Wearables, Accessories)' },
      },
    },
    handler: async ({ productName, category }: { productName?: string; category?: string }) => {
      let results = PRODUCTS;
      if (productName) results = results.filter((p) => p.name.toLowerCase().includes(productName.toLowerCase()));
      if (category) results = results.filter((p) => p.category.toLowerCase() === category.toLowerCase());

      const formatted = results.map((p) => ({
        ...p,
        availability: p.stock > 0 ? `In stock (${p.stock} units)` : 'Out of stock',
      }));
      return { content: JSON.stringify({ products: formatted, count: formatted.length }) };
    },
  });

  const trackPackage = defineTool({
    id: 'track_package',
    description: 'Track a package by tracking ID. Returns current location and delivery status.',
    inputSchema: {
      type: 'object',
      properties: {
        trackingId: { type: 'string', description: 'Package tracking ID (e.g., PKG-9281-US)' },
      },
      required: ['trackingId'],
    },
    handler: async ({ trackingId }: { trackingId: string }) => {
      const order = ORDERS.find((o) => (o as any).trackingId === trackingId);
      if (!order) return { content: JSON.stringify({ error: true, message: `Tracking ID ${trackingId} not found` }) };

      const events = [
        { timestamp: '2026-03-25 09:00', location: 'Warehouse — Cupertino, CA', status: 'Package picked up' },
        { timestamp: '2026-03-26 14:30', location: 'Distribution Center — Memphis, TN', status: 'In transit' },
        { timestamp: '2026-03-27 08:15', location: 'Local Facility — New York, NY', status: 'Out for delivery' },
      ];
      if (order.status === 'delivered') {
        events.push({ timestamp: '2026-03-28 11:42', location: 'Delivered — New York, NY', status: 'Delivered to front door' });
      }
      return { content: JSON.stringify({ trackingId, orderStatus: order.status, events }) };
    },
  });

  return [lookupOrder, checkInventory, trackPackage];
}

/** HR assistant tools with employee and policy data. */
export function createHRTools(): ToolDefinition[] {
  const lookupEmployee = defineTool({
    id: 'lookup_employee',
    description: 'Look up employee information by name or ID. Returns department, role, tenure, PTO balance.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Employee name (partial match)' },
        employeeId: { type: 'string', description: 'Employee ID (e.g., EMP-201)' },
      },
    },
    handler: async ({ name, employeeId }: { name?: string; employeeId?: string }) => {
      const emp = employeeId
        ? EMPLOYEES.find((e) => e.id === employeeId)
        : EMPLOYEES.find((e) => e.name.toLowerCase().includes((name || '').toLowerCase()));

      if (!emp) return { content: JSON.stringify({ error: true, message: `Employee not found: ${name || employeeId}` }) };
      return { content: JSON.stringify(emp) };
    },
  });

  const lookupPolicy = defineTool({
    id: 'lookup_policy',
    description: 'Look up a company HR policy by topic (PTO, remote work, expenses, etc).',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Policy topic keyword (e.g., PTO, remote, expense)' },
      },
      required: ['topic'],
    },
    handler: async ({ topic }: { topic: string }) => {
      const policy = POLICIES.find((p) => p.title.toLowerCase().includes(topic.toLowerCase()) || p.content.toLowerCase().includes(topic.toLowerCase()));
      if (!policy) return { content: JSON.stringify({ error: true, message: `No policy found for topic: ${topic}` }) };
      return { content: JSON.stringify(policy) };
    },
  });

  const checkPTO = defineTool({
    id: 'check_pto_balance',
    description: 'Check an employee\'s remaining PTO balance and accrual rate.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeName: { type: 'string', description: 'Employee name' },
      },
      required: ['employeeName'],
    },
    handler: async ({ employeeName }: { employeeName: string }) => {
      const emp = EMPLOYEES.find((e) => e.name.toLowerCase().includes(employeeName.toLowerCase()));
      if (!emp) return { content: JSON.stringify({ error: true, message: `Employee not found: ${employeeName}` }) };
      return {
        content: JSON.stringify({
          employee: emp.name,
          balance: emp.pto_balance,
          accrualRate: '1.5 days/month',
          maxCarryOver: '5 days',
          nextAccrual: '2026-05-01',
        }),
      };
    },
  });

  return [lookupEmployee, lookupPolicy, checkPTO];
}

// ── RAG Knowledge Bases ─────────────────────────────────────────

/** Product documentation knowledge base. */
export const PRODUCT_DOCS_CHUNKS = [
  { content: 'MacBook Pro 16" (2026): Features M4 Pro chip, 24GB unified memory, 512GB SSD base config. Battery life: up to 22 hours. Supports up to 3 external displays. Starts at $2,499. Available in Space Black and Silver.', metadata: { source: 'product-specs', page: 1 } },
  { content: 'Return Policy: Items can be returned within 14 days of delivery for a full refund. Items must be in original packaging. Opened software is non-returnable. Defective items can be returned within 90 days. Return shipping is free for defective items.', metadata: { source: 'return-policy', page: 1 } },
  { content: 'AppleCare+ for Mac: Covers accidental damage (2 incidents per year, $99 service fee for screen damage, $299 for other damage). Extends warranty to 3 years. Includes 24/7 priority support. Price: $199/year or $279 for 3 years upfront.', metadata: { source: 'applecare', page: 1 } },
  { content: 'Shipping Options: Standard (5-7 business days, free), Express (2-3 business days, $12.99), Next Day ($24.99). Hawaii and Alaska add 2 business days. International shipping available to 40+ countries.', metadata: { source: 'shipping-info', page: 1 } },
  { content: 'Trade-in Program: Trade in your old Mac, iPhone, iPad, or Apple Watch for credit toward a new purchase. Credit applied instantly in-store or via prepaid shipping kit. Values range from $50-$800 depending on device condition and model.', metadata: { source: 'trade-in', page: 1 } },
];

/** Company HR knowledge base. */
export const HR_DOCS_CHUNKS = [
  { content: 'PTO Policy (2026): Full-time employees accrue 1.5 days per month (18 days/year). Part-time employees accrue proportionally. Maximum carry-over is 5 days to the following year. PTO requests over 3 consecutive days require 2 weeks advance notice. Emergency PTO (illness, family) is exempt from advance notice requirement.', metadata: { source: 'hr-handbook', section: 'PTO' } },
  { content: 'Remote Work Policy: Hybrid schedule with minimum 2 in-office days per week (Tuesday and Thursday are mandatory in-office days). Employees with 1+ year tenure may apply for full-remote status with manager and VP approval. Equipment stipend: $1,000 one-time for home office setup, $200/year for maintenance.', metadata: { source: 'hr-handbook', section: 'Remote Work' } },
  { content: 'Benefits Overview: Health insurance (medical, dental, vision) — company pays 90% of premiums. 401(k) with 4% company match, vesting over 3 years. Annual learning budget: $2,500 per employee. Parental leave: 16 weeks paid for all parents. Gym membership reimbursement up to $100/month.', metadata: { source: 'hr-handbook', section: 'Benefits' } },
  { content: 'Performance Review Process: Reviews conducted twice yearly (June and December). Self-review due 2 weeks before review date. Peer feedback collected from 3-5 colleagues. Rating scale: Exceeds, Meets, Developing, Below Expectations. Compensation adjustments effective January 1.', metadata: { source: 'hr-handbook', section: 'Performance' } },
  { content: 'Expense Policy: Business travel meals up to $25/day for breakfast/lunch, $50/day for dinner. Flights: economy for trips under 5 hours, premium economy allowed for 5+ hours. Hotels: up to $200/night (higher in SF, NYC, London — $350 cap). All expenses over $500 require VP pre-approval. Submit receipts within 30 days via Concur.', metadata: { source: 'hr-handbook', section: 'Expenses' } },
];
