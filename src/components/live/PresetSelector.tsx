import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getPresetsByCategory, type Preset } from './presets';
import type { PatternType } from './types';

interface PresetSelectorProps {
  activePresetId?: string;
  onSelect: (preset: Preset) => void;
  onViewCode: (preset: Preset) => void;
  disabled?: boolean;
}

const PATTERN_ICONS: Record<PatternType, string> = {
  'llm-call': '\u2728',
  'agent': '\uD83E\uDD16',
  'rag': '\uD83D\uDD0D',
  'swarm': '\uD83D\uDC1D',
};

const PATTERN_LABELS: Record<PatternType, string> = {
  'llm-call': 'LLM Call',
  'agent': 'Agent',
  'rag': 'RAG',
  'swarm': 'Swarm',
};

export function PresetSelector({ activePresetId, onSelect, onViewCode, disabled }: PresetSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => getPresetsByCategory(), []);

  const activePreset = useMemo(() => {
    for (const g of grouped) {
      const found = g.presets.find((p) => p.id === activePresetId);
      if (found) return found;
    }
    return null;
  }, [grouped, activePresetId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="preset-selector" ref={containerRef}>
      {/* Trigger */}
      <button
        className={`preset-trigger ${open ? 'preset-trigger--open' : ''} ${activePreset ? 'preset-trigger--active' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        type="button"
      >
        {activePreset ? (
          <>
            <span className="preset-trigger-icon">{PATTERN_ICONS[activePreset.pattern]}</span>
            <span className="preset-trigger-content">
              <span className="preset-trigger-label">{activePreset.label}</span>
              <span className="preset-trigger-pattern">{PATTERN_LABELS[activePreset.pattern]}</span>
            </span>
          </>
        ) : (
          <span className="preset-trigger-placeholder">Choose an example to explore...</span>
        )}
        <span className={`preset-trigger-chevron ${open ? 'preset-trigger-chevron--open' : ''}`}>
          {'\u25BE'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="preset-dropdown">
          {grouped.map(({ category, presets }) => (
            <div key={category.id} className="preset-group">
              <div className="preset-group-header">
                <span className="preset-group-label">{category.label}</span>
                <span className="preset-group-desc">{category.description}</span>
              </div>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  className={`preset-item ${activePresetId === preset.id ? 'preset-item--active' : ''}`}
                  onClick={() => {
                    onSelect(preset);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span className="preset-item-icon">{PATTERN_ICONS[preset.pattern]}</span>
                  <span className="preset-item-content">
                    <span className="preset-item-label">{preset.label}</span>
                    <span className="preset-item-desc">{preset.description}</span>
                  </span>
                  <span className="preset-item-badge">{PATTERN_LABELS[preset.pattern]}</span>
                  <button
                    className="preset-item-code"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewCode(preset);
                    }}
                    title="View code"
                    type="button"
                  >
                    {'</>'}
                  </button>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
