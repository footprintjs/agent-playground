import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ApiKeys {
  anthropic: string;
  openai: string;
}

const STORAGE_KEY = 'agent-playground:api-keys';

/** Read API keys from sessionStorage (cleared on tab close). */
export function loadApiKeys(): ApiKeys {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { anthropic: '', openai: '' };
}

/** Persist API keys to sessionStorage. */
function saveApiKeys(keys: ApiKeys) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<ApiKeys>(loadApiKeys);
  const navigate = useNavigate();

  useEffect(() => {
    saveApiKeys(keys);
  }, [keys]);

  const hasAnyKey = keys.anthropic.length > 0 || keys.openai.length > 0;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>API Keys</h3>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>

        {/* Privacy badge — prominent */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 20 }}>&#128274;</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success, #10b981)' }}>
              Your keys stay private
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Stored in <strong>sessionStorage</strong> only (cleared when you close this tab).
              Sent directly to the API provider. <strong>Never sent to any backend.</strong>
            </div>
          </div>
        </div>

        <div className="settings-field">
          <label>Anthropic API Key</label>
          <input
            type="password"
            placeholder="sk-ant-api03-..."
            value={keys.anthropic}
            onChange={(e) => setKeys((k) => ({ ...k, anthropic: e.target.value }))}
            autoComplete="off"
          />
        </div>

        <div className="settings-field">
          <label>OpenAI API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            value={keys.openai}
            onChange={(e) => setKeys((k) => ({ ...k, openai: e.target.value }))}
            autoComplete="off"
          />
        </div>

        <div className="settings-status">
          <span className={keys.anthropic ? 'key-active' : 'key-inactive'}>
            Anthropic: {keys.anthropic ? 'Set' : 'Not set'}
          </span>
          <span className={keys.openai ? 'key-active' : 'key-inactive'}>
            OpenAI: {keys.openai ? 'Set' : 'Not set'}
          </span>
        </div>

        {/* Actions */}
        {hasAnyKey && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--accent, #facc15)',
                color: '#1a1a00',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => {
                onClose();
                navigate('/live');
              }}
            >
              Try Live Chat &rarr;
            </button>
            <button
              style={{
                width: '100%',
                padding: '8px 16px',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
              onClick={() => {
                setKeys({ anthropic: '', openai: '' });
                sessionStorage.removeItem(STORAGE_KEY);
              }}
            >
              Clear all keys
            </button>
          </div>
        )}

        {!hasAnyKey && (
          <div style={{
            textAlign: 'center',
            padding: '12px 0',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}>
            No API key? No problem &mdash; all samples work with <strong>mock()</strong> for free.
            <br />
            <button
              style={{
                marginTop: 8,
                padding: '8px 16px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
              }}
              onClick={() => {
                onClose();
                navigate('/samples/simple-llm-call?mode=concepts');
              }}
            >
              Explore samples (free) &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
