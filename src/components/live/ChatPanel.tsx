import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from './types';

interface ChatPanelProps {
  messages: ChatMessage[];
  running: boolean;
  input: string;
  streamingContent: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onResume?: (response: string) => void;
  onViewBTS: (messageId: string) => void;
  selectedBTSId: string | null;
}

export function ChatPanel({ messages, running, input, streamingContent, onInputChange, onSend, onResume, onViewBTS, selectedBTSId }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, running]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!running && input.trim()) onSend();
    }
  };

  return (
    <div className="live-chat">
      <div className="live-chat-messages">
        {messages.length === 0 && !running && (
          <div className="live-chat-empty">
            <div className="live-chat-empty-icon">{'\uD83D\uDCAC'}</div>
            <div className="live-chat-empty-text">Send a message to start the conversation</div>
            <div className="live-chat-empty-hint">Behind the Scenes data is captured every turn</div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`live-msg live-msg--${msg.role === 'pause' ? 'assistant' : msg.role}${msg.paused ? ' live-msg--paused' : ''}`}>
            <div className="live-msg-header">
              <span className="live-msg-role">
                {msg.role === 'user' ? 'You' : msg.paused ? 'Agent (waiting)' : 'Assistant'}
              </span>
              {msg.durationMs != null && (
                <span className="live-msg-meta">{msg.durationMs}ms</span>
              )}
            </div>
            {msg.paused ? (
              <PauseActionCard
                question={msg.pauseQuestion ?? 'Waiting for your response...'}
                onResume={onResume}
                disabled={running}
              />
            ) : (
              <>
                {msg.maxIterationsReached && (
                  <div className="live-max-iter-banner" role="alert">
                    <span className="live-max-iter-icon">{'\u26A0\uFE0F'}</span>
                    <span className="live-max-iter-text">
                      Agent hit the iteration cap before finishing. It may have been stuck
                      retrying a failing tool call — check Behind the Scenes for details.
                    </span>
                  </div>
                )}
                <div className="live-msg-content">{msg.content}</div>
              </>
            )}
            {msg.execution && (
              <button
                className={`live-bts-badge ${selectedBTSId === msg.id ? 'active' : ''}`}
                onClick={() => onViewBTS(msg.id)}
              >
                {'\uD83D\uDD0D'} Behind the Scenes
              </button>
            )}
          </div>
        ))}

        {running && (
          <div className="live-msg live-msg--assistant live-msg--loading">
            <div className="live-msg-header">
              <span className="live-msg-role">Assistant</span>
            </div>
            <div className="live-msg-content">
              {streamingContent ? (
                <span>{streamingContent}<span className="live-cursor">|</span></span>
              ) : (
                <span className="live-typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="live-chat-input-bar">
        <textarea
          ref={inputRef}
          className="live-chat-input"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          disabled={running}
        />
        <button
          className="live-send-btn"
          onClick={onSend}
          disabled={running || !input.trim()}
        >
          {running ? '\u23F3' : '\u2191'}
        </button>
      </div>
    </div>
  );
}

// ── Pause Action Card — inline approval UI ──────────────────

function PauseActionCard({
  question,
  onResume,
  disabled,
}: {
  question: string;
  onResume?: (response: string) => void;
  disabled: boolean;
}) {
  const [customResponse, setCustomResponse] = useState('');
  const [responded, setResponded] = useState(false);

  const handleAction = (response: string) => {
    if (responded || disabled) return;
    setResponded(true);
    onResume?.(response);
  };

  return (
    <div className="pause-card">
      <div className="pause-card-header">
        <span className="pause-card-icon">{'\u23F8'}</span>
        <span className="pause-card-label">Approval Required</span>
      </div>
      <div className="pause-card-question">{question}</div>
      {!responded ? (
        <>
          <div className="pause-card-actions">
            <button
              className="pause-card-btn pause-card-btn--approve"
              onClick={() => handleAction('Approved. Please proceed with the refund.')}
              disabled={disabled}
            >
              {'\u2713'} Approve
            </button>
            <button
              className="pause-card-btn pause-card-btn--deny"
              onClick={() => handleAction('Denied. The refund request is rejected.')}
              disabled={disabled}
            >
              {'\u2717'} Deny
            </button>
          </div>
          <div className="pause-card-custom">
            <input
              type="text"
              className="pause-card-input"
              value={customResponse}
              onChange={(e) => setCustomResponse(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customResponse.trim()) {
                  handleAction(customResponse.trim());
                }
              }}
              placeholder="Or type a custom response..."
              disabled={disabled}
            />
            {customResponse.trim() && (
              <button
                className="pause-card-btn pause-card-btn--send"
                onClick={() => handleAction(customResponse.trim())}
                disabled={disabled}
              >
                Send
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="pause-card-responded">Response sent</div>
      )}
    </div>
  );
}
