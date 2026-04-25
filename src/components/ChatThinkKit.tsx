/**
 * ChatThinkKit — STUB post Lens v2 migration.
 *
 * Previously read v1 `AgentTimelineRecorder.selectStatus()` /
 * `selectActivities()` and rendered a typing-bubble. Those v1
 * selectors are gone. Lens v2 exposes `selectRunTree/EventLog/Summary`
 * on `LensRecorder` — a similar in-chat bubble can be rebuilt on top of
 * those, but the SamplePage no longer passes thinkKit={<ChatThinkKit/>}
 * (it passes `null`), so the stub here is never rendered.
 */
import React from 'react';

export interface ChatThinkKitProps {
  readonly recorder?: unknown;
  readonly version?: number;
}

export function ChatThinkKit(_props: ChatThinkKitProps) {
  return null;
}
