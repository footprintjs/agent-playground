// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sample } from '../src/samples/catalog';
import type { ExecuteResult } from '../src/runner/executeCode';
import type { AvailableModel } from '../src/runner/fetchModels';
import { SamplePage } from '../src/components/SamplePage';
import { ConfigPanel } from '../src/components/live/ConfigPanel';
import { DEFAULT_CONFIG } from '../src/components/live/types';
import { ViewerPage } from '../src/components/viewer/ViewerPage';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), fetchModels: vi.fn() }));
vi.mock('../src/runner/executeCode', () => ({ executeCode: mocks.execute }));
vi.mock('../src/runner/fetchModels', () => ({
  fetchAvailableModels: mocks.fetchModels,
  FALLBACK_MODELS: [{ id: 'fallback', label: 'Fallback', provider: 'anthropic' }],
}));
vi.mock('../src/samples/catalog', () => {
  const samples: Sample[] = ['one', 'two'].map((id) => ({
    id, number: 1, title: id, description: id, category: 'Test', group: 'test', code: `code-${id}`,
  }));
  return { getSample: (id: string) => samples.find((sample) => sample.id === id) };
});
vi.mock('../src/components/CodePanel', () => ({ CodePanel: ({ code }: { code: string }) => <pre>{code}</pre> }));
vi.mock('../src/components/SampleExplainer', () => ({ SampleExplainer: () => null }));
vi.mock('../src/components/Modal', () => ({ Modal: () => null }));
vi.mock('../src/components/ChatThinkKit', () => ({ ChatThinkKit: () => null }));
vi.mock('../src/components/live/PresetSelector', () => ({ PresetSelector: () => null }));
vi.mock('../src/components/ResultPanel', () => ({ ResultPanel: (props: {
  history: { result: ExecuteResult }[]; onRun: () => void; pendingInput: string; onInputChange: (value: string) => void;
}) => <section><button onClick={props.onRun}>Run test sample</button>
  <input aria-label="Question" value={props.pendingInput} onChange={(event) => props.onInputChange(event.target.value)} />
  <output>{props.history.map((turn) => String(turn.result.output)).join('|')}</output></section> }));
vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Separator: () => null,
}));
vi.mock('agentfootprint-lens', () => ({
  Lens: () => null,
  LensRecorder: class { selectSummary() { return { status: 'idle' }; } selectEventLog() { return []; } },
  structureGraphFromRunner: () => ({ nodes: [], edges: [] }),
}));
vi.mock('footprint-explainable-ui', async (original) => ({
  ...await original<typeof import('footprint-explainable-ui')>(), TraceViewer: () => null,
}));

let root: Root;
let container: HTMLDivElement;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.execute.mockReset(); mocks.fetchModels.mockReset(); mocks.fetchModels.mockResolvedValue([]);
  localStorage.clear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

describe('page lifecycle boundaries', () => {
  it('navigates from a loaded sample to an unknown id and back without changing hook order', async () => {
    const router = createMemoryRouter([{ path: '/samples/:sampleId', element: <SamplePage /> }], { initialEntries: ['/samples/one?mode=test'] });
    await act(async () => root.render(<RouterProvider router={router} />));
    expect(container.textContent).toContain('Run test sample');
    await act(async () => { await router.navigate('/samples/missing?mode=test'); });
    expect(container.textContent).toContain('Sample not found');
    expect(container.textContent).not.toContain('Rendered fewer hooks');
    await act(async () => { await router.navigate('/samples/two?mode=test'); });
    expect(container.textContent).toContain('Run test sample');
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('does not attach a previous sample’s pending answer to a newly selected sample', async () => {
    const pending = deferred<ExecuteResult>(); mocks.execute.mockReturnValue(pending.promise);
    const router = createMemoryRouter([{ path: '/samples/:sampleId', element: <SamplePage /> }], { initialEntries: ['/samples/one?mode=test'] });
    await act(async () => root.render(<RouterProvider router={router} />));
    const question = container.querySelector<HTMLInputElement>('input[aria-label="Question"]')!;
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { nativeSet.call(question, 'Keep this question'); question.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { [...container.querySelectorAll('button')].find((button) => button.textContent === 'Run test sample')!.click(); });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    await act(async () => { await router.navigate('/samples/two?mode=test'); });
    await act(async () => pending.resolve({ output: 'old sample answer', logs: [], durationMs: 1 }));
    expect(container.textContent).not.toContain('old sample answer');
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Question"]')!.value).toBe('Keep this question');
  });

  it('ignores an outdated provider-model response after switching providers', async () => {
    const first = deferred<AvailableModel[]>(), second = deferred<AvailableModel[]>();
    mocks.fetchModels.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    // Load through the public settings key; no actual fetch/provider request occurs.
    localStorage.setItem('agent-playground:api-keys', JSON.stringify({ anthropic: 'offline-test', openai: 'offline-test', openrouter: '' }));
    const props = { onChange: vi.fn(), onReset: vi.fn(), collapsed: false, onToggleCollapse: vi.fn(), running: false };
    await act(async () => root.render(<ConfigPanel {...props} config={DEFAULT_CONFIG} />));
    await act(async () => root.render(<ConfigPanel {...props} config={{ ...DEFAULT_CONFIG, provider: 'openai' }} />));
    await act(async () => second.resolve([{ id: 'new', label: 'Current response', provider: 'openai' }]));
    await act(async () => first.resolve([{ id: 'old', label: 'Outdated response', provider: 'anthropic' }]));
    expect(container.textContent).toContain('Current response');
    expect(container.textContent).not.toContain('Outdated response');
  });

  it('clears informational metadata when new pasted JSON is not a trace object', async () => {
    await act(async () => root.render(<ViewerPage />));
    const textarea = container.querySelector('textarea')!;
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    const paste = async (value: string) => act(async () => { nativeSet.call(textarea, value); textarea.dispatchEvent(new Event('input', { bubbles: true })); });
    await paste('{"schemaVersion":1,"redacted":false}');
    expect(container.textContent).toContain('Trace is NOT redacted');
    await paste('42');
    expect(container.textContent).not.toContain('Trace is NOT redacted');
    expect(container.textContent).not.toContain('schemaVersion: 1');
  });
});
