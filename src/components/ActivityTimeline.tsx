/**
 * ActivityTimeline — pure presentation component for the activity
 * list. Used by both ChatThinkKit (live, recorder-driven) and
 * TurnView (preserved, replays from a stored events snapshot).
 *
 *   ✓  Chatbot is thinking
 *   ✓  Working on `askOperator`
 *   ●●● Waiting on you: Approve $500 refund?
 */
import React from 'react';
import { type Activity, renderActivityLine } from './buildThinkingActivities';
import {
  defaultStatusTemplates,
  type StatusTemplates,
} from 'agentfootprint';

export interface ActivityTimelineProps {
  readonly activities: readonly Activity[];
  readonly appName?: string;
  readonly templates?: StatusTemplates;
}

export function ActivityTimeline({
  activities,
  appName = 'Chatbot',
  templates = defaultStatusTemplates,
}: ActivityTimelineProps) {
  if (activities.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 0',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} appName={appName} templates={templates} />
      ))}
    </div>
  );
}

const ActivityRow: React.FC<{
  activity: Activity;
  appName: string;
  templates: StatusTemplates;
}> = ({ activity, appName, templates }) => {
  const text = renderActivityLine(activity, appName, templates);
  const completed = activity.status === 'completed';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        color: completed ? '#475569' : '#92400e',
        fontWeight: completed ? 400 : 500,
        fontStyle: completed ? 'normal' : 'italic',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 18,
          textAlign: 'center',
          color: completed ? '#10b981' : '#f59e0b',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 12,
        }}
      >
        {completed ? '✓' : <PulsingDots />}
      </span>
      <span>{text}</span>
    </div>
  );
};

const PulsingDots: React.FC = () => (
  <span style={{ display: 'inline-flex', gap: 2 }}>
    <Dot delay="0s" />
    <Dot delay="0.2s" />
    <Dot delay="0.4s" />
  </span>
);

const Dot: React.FC<{ delay: string }> = ({ delay }) => (
  <span
    style={{
      display: 'inline-block',
      width: 4,
      height: 4,
      borderRadius: '50%',
      background: '#f59e0b',
      animation: `chat-thinkkit-dot 1s ease-in-out ${delay} infinite`,
    }}
  />
);

// Idempotent keyframes injection.
if (typeof document !== 'undefined' && !document.querySelector('style[data-chat-thinkkit]')) {
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-chat-thinkkit', 'v2');
  styleEl.textContent = `
    @keyframes chat-thinkkit-dot {
      0%, 60%, 100% { opacity: 0.3; }
      30% { opacity: 1; }
    }
  `;
  document.head.appendChild(styleEl);
}
