import React, { useEffect, useRef } from 'react';
import type { ExecuteResult } from '../runner/executeCode';

export interface ChatTurn {
  input: string;
  result: ExecuteResult;
}

interface ResultPanelProps {
  history: ChatTurn[];
  running: boolean;
  pendingInput: string;
  onRun: () => void;
  onInputChange: (value: string) => void;
  onClear: () => void;
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

  return (
    <>
      {/* User bubble */}
      <div className="chat-bubble chat-bubble--user">
        <div className="chat-bubble__label">You</div>
        <div className="chat-bubble__body">{turn.input || '(no input)'}</div>
      </div>

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

export function ResultPanel({ history, running, pendingInput, onRun, onInputChange, onClear }: ResultPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length, running]);

  const isEmpty = history.length === 0 && !running;

  return (
    <div className="chat-panel">
      {/* Header with clear button */}
      <div className="chat-header">
        <span className="chat-header__title">Chat</span>
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

        {/* Typing indicator for in-flight run */}
        {running && (
          <>
            <div className="chat-bubble chat-bubble--user">
              <div className="chat-bubble__label">You</div>
              <div className="chat-bubble__body">{pendingInput || '(no input)'}</div>
            </div>
            <div className="chat-bubble chat-bubble--assistant">
              <div className="chat-bubble__label">Agent</div>
              <div className="chat-typing">
                <span /><span /><span />
              </div>
            </div>
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
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
