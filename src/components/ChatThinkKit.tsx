/**
 * ChatThinkKit — live activity timeline rendered in the chat panel
 * while a run is in flight (or paused waiting for human input).
 *
 * Subscribes to the Lens recorder, projects its event log into an
 * Activity list (via `buildThinkingActivities`), and hands the list
 * to `<ActivityTimeline/>` for rendering. Same projection is reused
 * by TurnView when the run completes — preserving the timeline into
 * chat history.
 *
 * No new library APIs. Reuses recorder events + the existing
 * `defaultThinkingTemplates` already shipped by agentfootprint. Same
 * pattern Lens uses for commentary, just rendered as a vertical list.
 */
import React, { useSyncExternalStore } from 'react';
import {
  defaultThinkingTemplates,
  type ThinkingTemplates,
} from 'agentfootprint';
import type { LensRecorder } from 'agentfootprint-lens';
import { buildThinkingActivities } from './buildThinkingActivities';
import { ActivityTimeline } from './ActivityTimeline';

export interface ChatThinkKitProps {
  /** Recorder observing the run — same instance Lens uses. */
  readonly recorder: LensRecorder;
  /** Active actor name substituted as `{{appName}}` in templates.
   *  Default: `'Chatbot'`. The agent's `agent.appName` should be
   *  threaded here when available. */
  readonly appName?: string;
  /** Override the bundled thinking templates. Defaults are used as
   *  fallback for any key not present. */
  readonly templates?: ThinkingTemplates;
  /** Compatibility prop — ignored; kept so SamplePage call sites
   *  don't have to change after the version-counter removal. */
  readonly version?: number;
}

export function ChatThinkKit({
  recorder,
  appName = 'Chatbot',
  templates = defaultThinkingTemplates,
}: ChatThinkKitProps) {
  // Push-based reactivity. Re-render every event tick.
  useSyncExternalStore(
    (listener) => recorder.subscribe(listener),
    () => recorder.getVersion(),
    () => recorder.getVersion(),
  );

  const events = recorder.selectEventLog().map((e) => e.event);
  const activities = buildThinkingActivities(events);

  return <ActivityTimeline activities={activities} appName={appName} templates={templates} />;
}
