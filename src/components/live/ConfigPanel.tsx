import React, { useState, useMemo, useEffect } from 'react';
import type { LiveConfig, PatternType, MemoryStrategyType, ProviderType } from './types';
import { PATTERNS, MEMORY_STRATEGIES } from './types';
import { PRESETS, getPresetsByPattern, type Preset } from './presets';
import { loadApiKeys } from '../SettingsPanel';
import { fetchAvailableModels, FALLBACK_MODELS, type AvailableModel } from '../../runner/fetchModels';

interface ConfigPanelProps {
  config: LiveConfig;
  onChange: (config: LiveConfig) => void;
  onReset: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  running: boolean;
  style?: React.CSSProperties;
  /** Called when a preset is selected — parent pre-fills the input. */
  onPresetSelect?: (preset: Preset) => void;
  /** Currently active preset ID (for highlight). */
  activePresetId?: string;
}

export function ConfigPanel({ config, onChange, onReset, collapsed, onToggleCollapse, running, style, onPresetSelect, activePresetId }: ConfigPanelProps) {
  const [showCode, setShowCode] = useState<Preset | null>(null);
  const update = <K extends keyof LiveConfig>(key: K, value: LiveConfig[K]) => {
    const next = { ...config, [key]: value, presetId: undefined }; // Clear preset on manual change
    // Auto-switch provider when model changes
    if (key === 'modelId') {
      const models = dynamicModels ?? FALLBACK_MODELS;
      const model = models.find((m) => m.id === value);
      if (model) next.provider = model.provider;
    }
    onChange(next);
  };

  // Fetch models dynamically from provider APIs based on configured keys
  const [dynamicModels, setDynamicModels] = useState<AvailableModel[] | null>(null);

  useEffect(() => {
    const keys = loadApiKeys();
    if (!keys.anthropic && !keys.openai) {
      setDynamicModels(null); // no keys → use fallback
      return;
    }
    fetchAvailableModels({
      anthropic: keys.anthropic || undefined,
      openai: keys.openai || undefined,
    }).then((models) => {
      setDynamicModels(models.length > 0 ? models : null);
    });
  }, [config.provider]); // re-fetch when provider changes (settings updated)

  const availableModels = dynamicModels ?? FALLBACK_MODELS;

  return (
    <div className={`live-config ${collapsed ? 'live-config--collapsed' : ''}`} style={style}>
      <div className="live-config-header" onClick={onToggleCollapse}>
        <span className="live-config-title">Configuration</span>
        <button className="live-collapse-btn" aria-label={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
      </div>

      {!collapsed && (
        <div className="live-config-body">
          {/* Try an Example */}
          <Section label="Try an Example">
            <div className="live-preset-list">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`live-preset-btn ${activePresetId === preset.id ? 'active' : ''}`}
                  onClick={() => {
                    onChange(preset.config);
                    onPresetSelect?.(preset);
                    onReset();
                  }}
                  disabled={running}
                  title={preset.description}
                >
                  <span className="live-preset-icon">{patternIcon(preset.pattern)}</span>
                  <span className="live-preset-info">
                    <span className="live-preset-label">{preset.label}</span>
                    <span className="live-preset-desc">{preset.description}</span>
                  </span>
                  <button
                    className="live-preset-code-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCode(preset);
                    }}
                    title="View code"
                  >
                    {'</>'}
                  </button>
                </button>
              ))}
            </div>
          </Section>

          {/* Pattern Picker */}
          <Section label="Pattern">
            <div className="live-pattern-grid">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  className={`live-pattern-btn ${config.pattern === p.id ? 'active' : ''}`}
                  onClick={() => update('pattern', p.id)}
                  disabled={running}
                  title={p.description}
                >
                  <span className="live-pattern-icon">{patternIcon(p.id)}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Model Picker */}
          <Section label="Model">
            <select
              className="live-select"
              value={config.modelId}
              onChange={(e) => update('modelId', e.target.value)}
              disabled={running}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.provider})
                </option>
              ))}
            </select>
          </Section>

          {/* System Prompt */}
          <Section label="System Prompt">
            <textarea
              className="live-textarea"
              value={config.systemPrompt}
              onChange={(e) => update('systemPrompt', e.target.value)}
              rows={3}
              disabled={running}
              placeholder="You are a helpful assistant..."
            />
          </Section>

          {/* Tools Toggle (Agent/Swarm only) */}
          {(config.pattern === 'agent' || config.pattern === 'swarm') && (
            <Section label="Tools">
              <label className="live-toggle">
                <input
                  type="checkbox"
                  checked={config.enableTools}
                  onChange={(e) => update('enableTools', e.target.checked)}
                  disabled={running}
                />
                <span>Enable tools (calculator, datetime, web search)</span>
              </label>
            </Section>
          )}

          {/* Streaming */}
          <Section label="Streaming">
            <label className="live-toggle">
              <input
                type="checkbox"
                checked={config.enableStreaming}
                onChange={(e) => update('enableStreaming', e.target.checked)}
                disabled={running}
              />
              <span>Stream tokens (see response as it types)</span>
            </label>
          </Section>

          {/* Memory Strategy */}
          <Section label="Memory Strategy">
            <div className="live-memory-options">
              {MEMORY_STRATEGIES.map((s) => (
                <label key={s.id} className="live-radio" title={s.description}>
                  <input
                    type="radio"
                    name="memory-strategy"
                    value={s.id}
                    checked={config.memoryStrategy === s.id}
                    onChange={() => update('memoryStrategy', s.id)}
                    disabled={running || config.pattern === 'rag'}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
            {config.memoryStrategy !== 'none' && config.pattern !== 'rag' && (
              <div className="live-param-row">
                <label className="live-param-label">
                  {config.memoryStrategy === 'sliding-window' ? 'Max Messages' : 'Max Chars'}
                </label>
                <input
                  type="number"
                  className="live-input-number"
                  value={config.memoryParam}
                  onChange={(e) => update('memoryParam', Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  disabled={running}
                />
              </div>
            )}
          </Section>

          {/* Reset Button */}
          <button
            className="live-reset-btn"
            onClick={onReset}
            disabled={running}
          >
            Reset Conversation
          </button>
        </div>
      )}

      {/* Code Modal */}
      {showCode && (
        <div className="live-code-overlay" onClick={() => setShowCode(null)}>
          <div className="live-code-modal" onClick={(e) => e.stopPropagation()}>
            <div className="live-code-header">
              <span>{showCode.label} — Code</span>
              <button onClick={() => setShowCode(null)}>✕</button>
            </div>
            <pre className="live-code-body"><code>{showCode.code}</code></pre>
            <button
              className="live-code-copy"
              onClick={() => {
                navigator.clipboard.writeText(showCode.code);
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="live-section">
      <div className="live-section-label">{label}</div>
      {children}
    </div>
  );
}

function patternIcon(pattern: PatternType): string {
  switch (pattern) {
    case 'llm-call': return '\u2728';
    case 'agent': return '\uD83E\uDD16';
    case 'rag': return '\uD83D\uDD0D';
    case 'swarm': return '\uD83D\uDC1D';
  }
}
