import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ConfigPanel } from './ConfigPanel';
import { ChatPanel } from './ChatPanel';
import { BTSPanel } from './BTSPanel';
import { SettingsPanel, loadApiKeys } from '../SettingsPanel';
import { buildLiveRunner } from '../../runner/buildLiveRunner';
import type { LiveRunner } from '../../runner/buildLiveRunner';
import type { LiveConfig, ChatMessage } from './types';
import type { CapturedExecution } from '../../runner/executeCode';
import { DEFAULT_CONFIG } from './types';
import { useDragResize } from './useDragResize';
import '../../styles/live-chat.css';

const CONFIG_DEFAULT_W = 280;
const CONFIG_MIN_W = 180;
const CONFIG_MAX_W = 500;
const BTS_DEFAULT_W = 420;
const BTS_MIN_W = 240;
const BTS_MAX_W = 900;
const COLLAPSED_W = 40;

export function LiveChatPage() {
  const [config, setConfig] = useState<LiveConfig>(DEFAULT_CONFIG);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [selectedBTSId, setSelectedBTSId] = useState<string | null>(null);
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [btsCollapsed, setBtsCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | undefined>();

  // Drag-resizable panel widths
  const [configWidth, setConfigWidth] = useState(CONFIG_DEFAULT_W);
  const [btsWidth, setBtsWidth] = useState(BTS_DEFAULT_W);

  // Runner lifecycle — recreated on config change
  const runnerRef = useRef<LiveRunner | null>(null);
  const configKeyRef = useRef('');

  const [light, setLight] = useState(() => document.documentElement.classList.contains('light'));
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
  }, [light]);

  // Drag handles
  const configDrag = useDragResize({
    initialWidth: configCollapsed ? COLLAPSED_W : configWidth,
    minWidth: CONFIG_MIN_W,
    maxWidth: CONFIG_MAX_W,
    direction: 'right',
    onResize: (w) => {
      if (configCollapsed) setConfigCollapsed(false);
      setConfigWidth(w);
    },
    onCollapse: () => setConfigCollapsed(true),
  });

  const btsDrag = useDragResize({
    initialWidth: btsCollapsed ? COLLAPSED_W : btsWidth,
    minWidth: BTS_MIN_W,
    maxWidth: BTS_MAX_W,
    direction: 'left',
    onResize: (w) => {
      if (btsCollapsed) setBtsCollapsed(false);
      setBtsWidth(w);
    },
    onCollapse: () => setBtsCollapsed(true),
  });

  const getRunner = useCallback((): { runner: LiveRunner } | { error: string } => {
    const keys = loadApiKeys();
    const configKey = JSON.stringify({ ...config, ...keys });

    if (configKeyRef.current !== configKey) {
      try {
        runnerRef.current = buildLiveRunner(config, {
          anthropic: keys.anthropic || undefined,
          openai: keys.openai || undefined,
        });
        configKeyRef.current = configKey;
        setError(null);
      } catch (e) {
        const msg = (e as Error).message;
        setError(msg);
        return { error: msg };
      }
    }
    return runnerRef.current ? { runner: runnerRef.current } : { error: 'No runner available' };
  }, [config]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || running) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setRunning(true);
    setError(null);

    let currentRunner: LiveRunner | null = null;

    try {
      const result$ = getRunner();
      if ('error' in result$) {
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant' as const,
          content: `Error: ${result$.error}`,
          timestamp: Date.now(),
        }]);
        setRunning(false);
        return;
      }

      currentRunner = result$.runner;
      const result = await currentRunner.run(userMsg.content);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.content,
        timestamp: Date.now(),
        execution: result.execution,
        durationMs: result.durationMs,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setSelectedBTSId(assistantMsg.id);
    } catch (e) {
      const errMsg = (e as Error).message;
      setError(errMsg);

      // Try to capture partial execution even on error — shows WHERE it broke in BTS
      let partialExecution: CapturedExecution | undefined;
      if (currentRunner) {
        try {
          const spec = currentRunner.getSpec();
          if (spec) partialExecution = { spec };
        } catch {}
      }

      const errorMsgId = `error-${Date.now()}`;
      setMessages((prev) => [...prev, {
        id: errorMsgId,
        role: 'assistant' as const,
        content: `Error: ${errMsg}`,
        timestamp: Date.now(),
        execution: partialExecution,
      }]);
      if (partialExecution) {
        setSelectedBTSId(errorMsgId);
        if (btsCollapsed) setBtsCollapsed(false);
      }
    } finally {
      setRunning(false);
    }
  }, [input, running, getRunner]);

  const handleReset = useCallback(() => {
    runnerRef.current?.reset();
    setMessages([]);
    setSelectedBTSId(null);
    configKeyRef.current = ''; // force rebuild on next send
    setError(null);
  }, []);

  const handleConfigChange = useCallback((newConfig: LiveConfig) => {
    setConfig(newConfig);
    configKeyRef.current = ''; // force rebuild
  }, []);

  const handleViewBTS = useCallback((msgId: string) => {
    setSelectedBTSId((prev) => prev === msgId ? null : msgId);
    if (btsCollapsed) setBtsCollapsed(false);
  }, [btsCollapsed]);

  const selectedExecution: CapturedExecution | null =
    messages.find((m) => m.id === selectedBTSId)?.execution ?? null;

  const keys = loadApiKeys();
  const hasKeys = keys.anthropic.length > 0 || keys.openai.length > 0;

  const configW = configCollapsed ? COLLAPSED_W : configWidth;
  const btsW = btsCollapsed ? COLLAPSED_W : btsWidth;

  return (
    <div className="live-page">
      {/* Header */}
      <header className="live-header">
        <div className="live-header-left">
          <Link to="/" className="live-back-link">{'\u2190'} Home</Link>
          <span className="live-header-title">Live Chat</span>
          <span className="live-header-pattern">{config.pattern}</span>
        </div>
        <div className="live-header-right">
          {error && <span className="live-header-error" title={error}>{'\u26A0'} Error</span>}
          <button
            onClick={() => setShowSettings(true)}
            className={`live-settings-btn ${hasKeys ? 'has-keys' : ''}`}
            title="API key settings"
          >
            {hasKeys ? '\u26A1' : '\u2699'} Keys
          </button>
          <button
            onClick={() => setLight((v) => !v)}
            className="live-theme-btn"
            title={light ? 'Dark mode' : 'Light mode'}
          >
            {light ? '\u263D' : '\u2600'}
          </button>
        </div>
      </header>

      {/* Three-panel layout with drag handles */}
      <div className="live-panels">
        <ConfigPanel
          config={config}
          onChange={handleConfigChange}
          onReset={handleReset}
          collapsed={configCollapsed}
          onToggleCollapse={() => { setConfigCollapsed((v) => !v); setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }}
          running={running}
          style={{ width: configW }}
          activePresetId={activePresetId}
          onPresetSelect={(preset) => {
            setActivePresetId(preset.id);
            setInput(preset.suggestedMessage);
          }}
        />

        {/* Drag handle: config ↔ chat */}
        <div
          className="live-drag-handle"
          onMouseDown={configDrag.onMouseDown}
          onDoubleClick={() => { setConfigCollapsed((v) => !v); setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }}
          title="Drag to resize, double-click to collapse"
        >
          <div className="live-drag-handle-line" />
        </div>

        <ChatPanel
          messages={messages}
          running={running}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onViewBTS={handleViewBTS}
          selectedBTSId={selectedBTSId}
        />

        {/* Drag handle: chat ↔ BTS */}
        <div
          className="live-drag-handle"
          onMouseDown={btsDrag.onMouseDown}
          onDoubleClick={() => { setBtsCollapsed((v) => !v); setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }}
          title="Drag to resize, double-click to collapse"
        >
          <div className="live-drag-handle-line" />
        </div>

        <BTSPanel
          execution={selectedExecution}
          collapsed={btsCollapsed}
          onToggleCollapse={() => { setBtsCollapsed((v) => !v); setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }}
          style={{ width: btsW }}
        />
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
