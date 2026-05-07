/**
 * Pure projection: event log → activity timeline.
 *
 * Shared between ChatThinkKit (live, while running) and TurnView
 * (preserved into chat history after the turn completes). Same shape
 * for both — the turn's bubble can replay the timeline the user saw
 * during the run, click to inspect each step later.
 *
 * Activities are listed in event order. Status is determined by
 * matching close events in the same log:
 *
 *   llm.start              → 'llm' activity, closed by llm.end
 *   tool.start             → 'tool' activity, closed by tool.end
 *                            (matched by toolCallId for parallel safety)
 *   pause.request          → 'paused' activity, closed by pause.resume
 */

import type { AgentfootprintEvent, ThinkingTemplates } from 'agentfootprint';

export interface Activity {
  readonly id: string;
  readonly kind: 'llm' | 'tool' | 'paused';
  readonly status: 'in-progress' | 'completed';
  readonly toolName?: string;
  readonly question?: string;
}

export function buildThinkingActivities(
  events: readonly AgentfootprintEvent[],
): Activity[] {
  const activities: Activity[] = [];
  const open = new Map<string, number>(); // key → activity index

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    switch (e.type) {
      case 'agentfootprint.stream.llm_start': {
        activities.push({ id: `llm-${i}`, kind: 'llm', status: 'in-progress' });
        open.set('llm', activities.length - 1);
        break;
      }
      case 'agentfootprint.stream.llm_end': {
        const idx = open.get('llm');
        if (idx !== undefined) {
          activities[idx] = { ...activities[idx], status: 'completed' };
          open.delete('llm');
        }
        break;
      }
      case 'agentfootprint.stream.tool_start': {
        const p = e.payload as { toolName: string; toolCallId?: string };
        activities.push({
          id: `tool-${i}`,
          kind: 'tool',
          status: 'in-progress',
          toolName: p.toolName,
        });
        const key = `tool:${p.toolCallId ?? p.toolName}`;
        open.set(key, activities.length - 1);
        break;
      }
      case 'agentfootprint.stream.tool_end': {
        const p = e.payload as { toolCallId?: string };
        // Match by toolCallId; fall back to first open tool entry.
        for (const [key, idx] of open.entries()) {
          if (
            (p.toolCallId && key === `tool:${p.toolCallId}`) ||
            (!p.toolCallId && key.startsWith('tool:'))
          ) {
            activities[idx] = { ...activities[idx], status: 'completed' };
            open.delete(key);
            break;
          }
        }
        break;
      }
      case 'agentfootprint.pause.request': {
        const p = e.payload as { reason?: string };
        activities.push({
          id: `pause-${i}`,
          kind: 'paused',
          status: 'in-progress',
          question: p.reason ?? 'input required',
        });
        open.set('pause', activities.length - 1);
        break;
      }
      case 'agentfootprint.pause.resume': {
        const idx = open.get('pause');
        if (idx !== undefined) {
          activities[idx] = { ...activities[idx], status: 'completed' };
          open.delete('pause');
        }
        break;
      }
    }
  }

  return activities;
}

/**
 * Activity templates merged on top of the library's bundled
 * `defaultThinkingTemplates`. Adds:
 *
 *   • Per-tool labels for HITL-conventional tool names (`askOperator`,
 *     `askHuman`, `requestApproval`) so the chat reads "Waiting for
 *     your response" instead of "Working on `askOperator`".
 *   • `.done` variants — past-tense / acknowledgement labels that
 *     replace the in-progress label once the activity completes.
 *     "Waiting for your response" → "Received your response".
 *
 * Consumer-supplied `templates` (passed to `<ChatThinkKit/>` or
 * `<ActivityTimeline/>`) win over these — these are the playground's
 * defaults. Pure presentation; lives in the playground, not the
 * library, so consumers shipping their own UI pick their own labels.
 */
export const playgroundActivityTemplates: Record<string, string> = {
  // Status-aware variants. Renderer prefers `<key>.done` when
  // status === 'completed'; falls back to `<key>` otherwise.
  'idle':       'Thinking…',
  'idle.done':  'Thought it through',

  'tool':       'Working on `{{toolName}}`…',
  'tool.done':  'Finished `{{toolName}}`',

  'paused':       'Waiting for your response',
  'paused.done':  'Received your response',

  // Per-tool HITL labels — both in-progress and completed.
  'tool.askOperator':       'Waiting for your response',
  'tool.askOperator.done':  'Received your response',
  'tool.askHuman':          'Waiting for your response',
  'tool.askHuman.done':     'Received your response',
  'tool.requestApproval':       'Waiting for your approval',
  'tool.requestApproval.done':  'Got your decision',
};

/**
 * Resolve the right thinking-template key for an activity and
 * substitute `{{vars}}`. Resolution order (most-specific first):
 *
 *   completed activity:
 *     1. `tool.<name>.done`   ← per-tool past-tense label
 *     2. `<base>.done`         ← generic past-tense label
 *     3. `tool.<name>`         ← per-tool present (graceful fallback)
 *     4. `<base>`              ← generic present
 *
 *   in-progress activity:
 *     1. `tool.<name>`         ← per-tool present-tense label
 *     2. `<base>`              ← generic present-tense
 *
 * Missing keys render as the empty string. Consumer can override any
 * of these by passing a `templates` prop to ActivityTimeline.
 */
export function renderActivityLine(
  activity: Activity,
  appName: string,
  templates: ThinkingTemplates,
): string {
  // Compute base key + per-tool specific key.
  let baseKey: string;
  let specificKey: string | null = null;
  let vars: Record<string, string>;

  switch (activity.kind) {
    case 'llm':
      baseKey = 'idle';
      vars = { appName };
      break;
    case 'tool': {
      baseKey = 'tool';
      specificKey = `tool.${activity.toolName ?? ''}`;
      vars = { appName, toolName: activity.toolName ?? '' };
      break;
    }
    case 'paused':
      baseKey = 'paused';
      vars = { appName, question: activity.question ?? 'input required' };
      break;
  }

  // Lookup chain: specific.done → base.done → specific → base.
  const isDone = activity.status === 'completed';
  const candidates: string[] = [];
  if (isDone && specificKey) candidates.push(`${specificKey}.done`);
  if (isDone) candidates.push(`${baseKey}.done`);
  if (specificKey) candidates.push(specificKey);
  candidates.push(baseKey);

  let template = '';
  for (const key of candidates) {
    if (templates[key] !== undefined) {
      template = templates[key];
      break;
    }
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? '');
}
