import React, { useState, useEffect } from 'react';

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

        <p className="settings-note">
          Keys are stored in <strong>sessionStorage</strong> only — cleared when you close this tab.
          They go directly to the API provider. Never sent to any backend.
        </p>

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

        {hasAnyKey && (
          <button
            className="settings-clear"
            onClick={() => {
              setKeys({ anthropic: '', openai: '' });
              sessionStorage.removeItem(STORAGE_KEY);
            }}
          >
            Clear all keys
          </button>
        )}

        <div className="settings-status">
          <span className={keys.anthropic ? 'key-active' : 'key-inactive'}>
            Anthropic: {keys.anthropic ? 'Set' : 'Not set'}
          </span>
          <span className={keys.openai ? 'key-active' : 'key-inactive'}>
            OpenAI: {keys.openai ? 'Set' : 'Not set'}
          </span>
        </div>
      </div>
    </div>
  );
}
