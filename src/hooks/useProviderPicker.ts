import { useState, useEffect } from 'react';
import type { ProviderKind } from '../runner/buildProvider';

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

/** Hook — wires the picker state to localStorage so it persists. */
export function useProviderPicker(): [ProviderKind, (kind: ProviderKind) => void] {
  const [kind, setKind] = useState<ProviderKind>(readStored);
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, kind);
  }, [kind]);
  return [kind, setKind];
}
