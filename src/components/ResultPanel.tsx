import React, { useEffect, useRef } from 'react';
import type { ExecuteResult } from '../runner/executeCode';
import type { AgentfootprintEvent } from 'agentfootprint';
import { buildThinkingActivities } from './buildThinkingActivities';
import { ActivityTimeline } from './ActivityTimeline';

export interface ChatTurn {
  input: string;
  result: ExecuteResult;
  /**
   * Snapshot of the recorder's event log at the moment this turn
   * completed. Lets `TurnView` replay the activity timeline (the same
   * list ChatThinkKit showed live) so the user can scroll back through
   * chat history and click any prior turn to inspect what happened.
   *
   * Optional — historical turns from before this feature shipped, or
   * turns with no recorder events, leave it undefined.
   */
  events?: readonly AgentfootprintEvent[];
}

interface ResultPanelProps {
  history: ChatTurn[];
  running: boolean;
  pendingInput: string;
  onRun: () => void;
  onInputChange: (value: string) => void;
  onClear: () => void;
  /** Optional provider picker — rendered next to the Run button when supplied. */
  providerPicker?: React.ReactNode;
  /** Token-by-token in-progress response, rendered as a live bubble
   *  while a Run is in flight. Cleared once the run finalizes and
   *  the full turn lands in `history`. Empty string = no live bubble. */
  streamingResponse?: string;
  /**
   * ThinkKit content rendered inside the in-flight assistant bubble
   * while `running` is true AND no tokens have streamed yet. Renders
   * the humanized status / activity breadcrumb driven by
   * `recorder.selectStatus()` + `selectActivities()`. Pattern mirrors
   * NEO's ChatFeed typing-bubble — users see "Running add..." / "Got
   * result" live in the chat, not only in the side panel.
   */
  thinkKit?: React.ReactNode;
  /**
   * Human-in-the-loop pause form. Rendered when the agent's run paused
   * for human input. Mounted at the bottom of the chat panel after
   * the user's question bubble — replaces the live thinkKit bubble
   * while the user composes an answer. SamplePage passes a
   * `<HitlPauseForm/>` here when `pausedOutcome` is set; null
   * otherwise.
   */
  hitlForm?: React.ReactNode;
}

function extractContent(output: unknown): string | null {
  if (!output || typeof output !== 'object') return null;
  const obj = output as Record<string, unknown>;
  if (typeof obj.content === 'string' && obj.content) return obj.content;
  return null;
}

function extractTurns(output: unknown): { label: string; text: string }[] | null {
  if (!output || typeof output !== 'object') return null;
  const obj = output as Record<string, unknown>;
  const turns: { label: string; text: string }[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (/^turn\d+$/.test(key) && typeof val === 'string') {
      turns.push({ label: key, text: val });
    }
  }
  return turns.length > 0 ? turns : null;
}

function TurnView({ turn }: { turn: ChatTurn }) {
  const { result } = turn;
  const content = result.output ? extractContent(result.output) : null;
  const turns = result.output ? extractTurns(result.output) : null;
  // Replay the live timeline from the recorder snapshot captured at
  // turn-completion. Same projection ChatThinkKit used live.
  const activities = turn.events ? buildThinkingActivities(turn.events) : [];

  return (
    <>
      {/* User bubble */}
      <div className="chat-bubble chat-bubble--user">
        <div className="chat-bubble__label">You</div>
        <div className="chat-bubble__body">{turn.input || '(no input)'}</div>
      </div>

      {/* Preserved activity timeline — the user can revisit what
          happened during this turn. Collapsed by default; click to
          expand. Skipped when no events were captured. */}
      {activities.length > 0 && (
        <details className="chat-activity-history" style={{ margin: '4px 0 0 0' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 12,
              color: '#64748b',
              padding: '2px 6px',
            }}
          >
            {activities.length} step{activities.length === 1 ? '' : 's'} —
            click to inspect
          </summary>
          <div style={{ padding: '4px 0 4px 12px' }}>
            <ActivityTimeline activities={activities} />
          </div>
        </details>
      )}

      {/* Error */}
      {result.error && (
        <div className="chat-bubble chat-bubble--error">
          <div className="chat-bubble__label">Error</div>
          <div className="chat-bubble__body">{result.error}</div>
        </div>
      )}

      {/* Console logs */}
      {!result.error && result.logs.length > 0 && (
        <div className="chat-console">
          {result.logs.map((log, i) => (
            <div
              key={i}
              className={`chat-console__line${log.startsWith('[ERROR]') ? ' chat-console__line--error' : log.startsWith('[WARN]') ? ' chat-console__line--warn' : ''}`}
            >
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Multi-turn output */}
      {!result.error && turns && turns.map((t, i) => (
        <div key={i} className="chat-bubble chat-bubble--assistant">
          <div className="chat-bubble__label">Agent · {t.label}</div>
          <div className="chat-bubble__body">{t.text}</div>
        </div>
      ))}

      {/* Single content response */}
      {!result.error && !turns && content && (
        <div className="chat-bubble chat-bubble--assistant">
          <div className="chat-bubble__label">Agent</div>
          <div className="chat-bubble__body">{content}</div>
        </div>
      )}

      {/* JSON fallback */}
      {!result.error && !turns && !content && result.output !== undefined && result.output !== null && (
        <div className="chat-bubble chat-bubble--assistant">
          <div className="chat-bubble__label">Output</div>
          <div className="chat-bubble__body chat-bubble__body--mono">
            {JSON.stringify(result.output, null, 2)}
          </div>
        </div>
      )}

      {!result.error && (
        <div className="chat-meta">{result.durationMs}ms</div>
      )}
    </>
  );
}

export function ResultPanel({ history, running, pendingInput, onRun, onInputChange, onClear, providerPicker, streamingResponse, thinkKit, hitlForm }: ResultPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length, running, !!hitlForm]);

  const isEmpty = history.length === 0 && !running;

  return (
    <div className="chat-panel">
      {/* Header: title + provider picker + clear button. Provider picker
          sits in the header (not the input bar) so the input row stays
          a clean "type + Run" pair — larger tap target for Run, no
          visual competition between provider and send actions. */}
      <div className="chat-header">
        <span className="chat-header__title">Chat</span>
        {providerPicker && (
          <span className="chat-header__provider">{providerPicker}</span>
        )}
        {history.length > 0 && (
          <button className="chat-clear-btn" onClick={onClear} title="Clear history">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {isEmpty && (
          <div className="chat-empty">
            Type a message below and click <strong>Run</strong>
          </div>
        )}

        {history.map((turn, i) => (
          <TurnView key={i} turn={turn} />
        ))}

        {/* HITL pause form — rendered when the agent paused waiting on
            the user. Sits BELOW prior history (so the user sees the
            question they asked) and ABOVE the in-flight bubble (so the
            form is the prominent next-action). The form mounts only
            while a pause is open; on submit it's cleared by SamplePage
            and the resume's running bubble takes over. */}
        {hitlForm && <div className="chat-hitl">{hitlForm}</div>}

        {/* In-flight bubble — shows the user's message + a live agent
            response. Visible while:
              • running is true               (active LLM call / tool / streaming)
              • OR hitlForm is mounted        (paused, waiting for user input)
            The activity timeline and HITL form are part of one continuous
            "this turn is in progress" view — the timeline must NOT
            disappear the moment the agent pauses for a human answer.
            While streamingResponse is empty, the agent bubble renders
            thinkKit (Neo-style activity timeline). Once tokens arrive,
            it switches to the progressive token bubble + cursor. */}
        {(running || hitlForm) && (
          <>
            <div className="chat-bubble chat-bubble--user">
              <div className="chat-bubble__label">You</div>
              <div className="chat-bubble__body">{pendingInput || '(no input)'}</div>
            </div>
            <div className="chat-bubble chat-bubble--assistant">
              <div className="chat-bubble__label">Agent</div>
              {streamingResponse ? (
                <div className="chat-bubble__body">
                  {streamingResponse}
                  <span className="chat-stream-cursor">▍</span>
                </div>
              ) : thinkKit ? (
                <div className="chat-bubble__body chat-thinkkit">{thinkKit}</div>
              ) : (
                <div className="chat-typing">
                  <span /><span /><span />
                </div>
              )}
            </div>
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar — clean pair: input pill + Run. Provider picker
          lives in the header so Run gets room to breathe. */}
      <div className="chat-input-bar">
        <input
          className="chat-input"
          type="text"
          value={pendingInput}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Enter input for the sample…"
          onKeyDown={(e) => e.key === 'Enter' && !running && onRun()}
        />
        <button className="chat-run-btn" onClick={onRun} disabled={running}>
          {running ? '…' : 'Run ▶'}
        </button>
      </div>
    </div>
  );
}
