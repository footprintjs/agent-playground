/**
 * useTheme — reactive read of the light/dark mode toggle.
 *
 * The toggle lives in App.tsx's SamplesToolbar and writes to
 * `<html class="light">` / removes the class for dark mode. Components
 * that need to switch styling (CodePanel's Monaco theme, SampleExplainer's
 * markdown chrome) subscribe via this hook and re-render when the
 * class flips.
 */
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const observer = new MutationObserver(() => {
      const next = readTheme();
      setTheme((prev) => (prev === next ? prev : next));
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
