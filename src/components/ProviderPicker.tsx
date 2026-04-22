/**
 * ProviderPicker — small dropdown for selecting which LLM provider to
 * use when the user clicks Run. Sits in the chat panel's input bar.
 *
 * Selection persists per browser via localStorage so a user's preferred
 * provider survives page reloads. API-key requirements are resolved by
 * the Run handler (it opens the settings drawer if a key is missing).
 */

import { useState, useEffect } from 'react';
import { PROVIDER_OPTIONS, type ProviderKind } from '../runner/buildProvider';

const STORAGE_KEY = 'agent-playground.provider';

function readStored(): ProviderKind {
  if (typeof window === 'undefined') return 'mock';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (
    raw === 'anthropic' ||
    raw === 'openai' ||
    raw === 'openrouter' ||
    raw === 'ollama' ||
    raw === 'mock'
  ) {
    return raw;
  }
  return 'mock';
}

interface Props {
  value: ProviderKind;
  onChange: (kind: ProviderKind) => void;
}

export function ProviderPicker({ value, onChange }: Props) {
  return (
    <select
      className="provider-picker"
      value={value}
      onChange={(e) => onChange(e.target.value as ProviderKind)}
      title="LLM provider — Mock runs scripted responses; real providers need an API key"
      aria-label="LLM provider"
    >
      {PROVIDER_OPTIONS.map((opt) => (
        <option key={opt.kind} value={opt.kind}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/** Hook — wires the picker state to localStorage so it persists. */
export function useProviderPicker(): [ProviderKind, (kind: ProviderKind) => void] {
  const [kind, setKind] = useState<ProviderKind>(readStored);
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, kind);
  }, [kind]);
  return [kind, setKind];
}
