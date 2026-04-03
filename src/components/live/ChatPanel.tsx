import React, { useRef, useEffect } from 'react';
import type { ChatMessage } from './types';

interface ChatPanelProps {
  messages: ChatMessage[];
  running: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onViewBTS: (messageId: string) => void;
  selectedBTSId: string | null;
}

export function ChatPanel({ messages, running, input, onInputChange, onSend, onViewBTS, selectedBTSId }: ChatPanelProps) {
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
          <div key={msg.id} className={`live-msg live-msg--${msg.role}`}>
            <div className="live-msg-header">
              <span className="live-msg-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
              {msg.durationMs != null && (
                <span className="live-msg-meta">{msg.durationMs}ms</span>
              )}
            </div>
            <div className="live-msg-content">{msg.content}</div>
            {msg.role === 'assistant' && msg.execution && (
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
              <span className="live-typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
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
