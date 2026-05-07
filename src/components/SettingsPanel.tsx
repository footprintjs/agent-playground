import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface ApiKeys {
  anthropic: string;
  openai: string;
  /** OpenRouter — unified gateway for Claude / GPT / Gemini / Llama / 200+ models.
   *  One key, one endpoint, OpenAI-compatible API. */
  openrouter: string;
}

const STORAGE_KEY = 'agent-playground:api-keys';

/**
 * Read API keys from localStorage. Persists across tab closes and
 * browser restarts so the user doesn't paste the key every visit.
 *
 * Trade-off vs sessionStorage: keys live until the user clicks
 * "Clear all keys" or wipes browser data. The panel surfaces this
 * explicitly so the user can opt out at any time.
 */
export function loadApiKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Backfill openrouter for sessions that pre-date the field.
      return { anthropic: '', openai: '', openrouter: '', ...parsed };
    }
  } catch {}
  return { anthropic: '', openai: '', openrouter: '' };
}

/** Persist API keys to localStorage. */
function saveApiKeys(keys: ApiKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

/**
 * `'full'` (default) — behaves as before: status pills, "Try Live Chat",
 *   "Clear all keys", and the empty-state Explore-samples helper. Used
 *   when the user opens the drawer via the gear icon or via the
 *   AutoOpenSettings welcome flow.
 *
 * `'key-only'` — minimal mode for when the drawer was opened in
 *   response to picking a key-required provider in the dropdown. Hides
 *   the navigation CTAs so the user just enters their key and closes
 *   the drawer to keep working on the sample they were on. No
 *   navigation away from the current route.
 */
export type SettingsPanelVariant = 'full' | 'key-only';

export function SettingsPanel({
  onClose,
  variant = 'full',
}: {
  onClose: () => void;
  variant?: SettingsPanelVariant;
}) {
  const [keys, setKeys] = useState<ApiKeys>(loadApiKeys);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    saveApiKeys(keys);
  }, [keys]);

  const hasAnyKey =
    keys.anthropic.length > 0 || keys.openai.length > 0 || keys.openrouter.length > 0;
  const onLivePage = location.pathname === '/live';
  // Show full-mode CTAs only when not in key-only AND when navigating
  // would actually change the page. On /live, "Try Live Chat" is a no-op.
  const showLiveChatCta = variant === 'full' && !onLivePage;
  const showSamplesCta = variant === 'full';
  const showClearCta = variant === 'full';

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
              Stored in <strong>localStorage</strong> on this device only — survives reloads.
              Sent directly to the API provider. <strong>Never sent to any backend.</strong>
              Click <em>Clear all keys</em> below to remove anytime.
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

        <div className="settings-field">
          <label>
            OpenRouter API Key
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
              one key, 200+ models
            </span>
          </label>
          <input
            type="password"
            placeholder="sk-or-v1-..."
            value={keys.openrouter}
            onChange={(e) => setKeys((k) => ({ ...k, openrouter: e.target.value }))}
            autoComplete="off"
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            Unified gateway for Claude / GPT / Gemini / Llama / Mistral. Get a key at{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              openrouter.ai/keys
            </a>
            .
          </div>
        </div>

        <div className="settings-status">
          <span className={keys.anthropic ? 'key-active' : 'key-inactive'}>
            Anthropic: {keys.anthropic ? 'Set' : 'Not set'}
          </span>
          <span className={keys.openai ? 'key-active' : 'key-inactive'}>
            OpenAI: {keys.openai ? 'Set' : 'Not set'}
          </span>
          <span className={keys.openrouter ? 'key-active' : 'key-inactive'}>
            OpenRouter: {keys.openrouter ? 'Set' : 'Not set'}
          </span>
        </div>

        {/* Actions */}
        {hasAnyKey && (showLiveChatCta || showClearCta) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {showLiveChatCta && (
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
            )}
            {showClearCta && (
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
                  setKeys({ anthropic: '', openai: '', openrouter: '' });
                  localStorage.removeItem(STORAGE_KEY);
                }}
              >
                Clear all keys
              </button>
            )}
          </div>
        )}

        {/* When a key is set in key-only variant, give the user a clean
            way back to what they were doing without navigating away. */}
        {hasAnyKey && variant === 'key-only' && (
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
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}

        {!hasAnyKey && showSamplesCta && (
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
