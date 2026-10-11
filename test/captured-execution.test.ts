import { describe, expect, expectTypeOf, it } from 'vitest';
import type { FlowChartExecutor } from 'footprintjs';
import { toVisualizationSnapshots } from 'footprint-explainable-ui';
import type { LiveRunner, LiveTurnResult } from '../src/runner/buildLiveRunner';
import { buildLiveRunner } from '../src/runner/buildLiveRunner';
import { executeCode } from '../src/runner/executeCode';
import type { CapturedExecution, ExecuteOptions } from '../src/runner/executeCode';

describe('public capture producer contract', () => {
  it('retains official snapshot and narrative types through both consumer paths', () => {
    expectTypeOf<CapturedExecution['snapshot']>()
      .toEqualTypeOf<ReturnType<FlowChartExecutor['getSnapshot']> | undefined>();
    expectTypeOf<CapturedExecution['narrativeEntries']>()
      .toEqualTypeOf<ReturnType<FlowChartExecutor['getNarrativeEntries']> | undefined>();
    expectTypeOf<NonNullable<ExecuteOptions['onLiveSnapshot']>>()
      .parameter(0).toEqualTypeOf<ReturnType<FlowChartExecutor['getSnapshot']>>();
    expectTypeOf<ReturnType<LiveRunner['getCapture']>>()
      .toEqualTypeOf<CapturedExecution | undefined>();
    expectTypeOf<LiveTurnResult['execution']>().toEqualTypeOf<CapturedExecution | undefined>();

    // Live chat is an explicit existing stub, not a fabricated recording.
    const liveRunner = buildLiveRunner({});
    expect(liveRunner.getCapture()).toBeUndefined();
    expect(() => liveRunner.run('Test')).toThrow('Live chat is being ported');
  });

  it('passes the real generated executor snapshot and narrative through unchanged', async () => {
    const liveSnapshots: NonNullable<CapturedExecution['snapshot']>[] = [];
    const result = await executeCode(`
      import { FlowChartExecutor, flowChart } from 'footprintjs';
      const runner = new FlowChartExecutor(flowChart('record', () => {}).build());
      runner.enableNarrative();
      await runner.run();
      return { snapshot: runner.getSnapshot(), narrative: runner.getNarrativeEntries() };
    `, '', undefined, undefined, {
      onLiveSnapshot: snapshot => liveSnapshots.push(snapshot),
    });
    expect(result.error).toBeUndefined();
    const capture = result.execution;
    if (!capture?.snapshot) throw new Error('Expected the public executor capture');
    expect(result.output).toEqual({ snapshot: capture.snapshot, narrative: capture.narrativeEntries });
    expect(capture.narrativeEntries?.length).toBeGreaterThan(0);
    expect(liveSnapshots.length).toBeGreaterThan(0);
    expect(liveSnapshots.at(-1)).toEqual(capture.snapshot);
    expect(toVisualizationSnapshots(capture.snapshot, capture.narrativeEntries).length).toBeGreaterThan(0);
  });

  it('retains mock-only Agent runner snapshots on the same public contract', async () => {
    const liveSnapshots: NonNullable<CapturedExecution['snapshot']>[] = [];
    const result = await executeCode(`
      import { LLMCall } from 'agentfootprint';
      import { MockProvider } from 'agentfootprint/providers';
      const runner = LLMCall.create({ provider: new MockProvider({ reply: 'Recorded answer' }), model: 'mock' }).build();
      await runner.run({ message: input });
      return runner.getSnapshot();
    `, 'Test', undefined, undefined, {
      onLiveSnapshot: snapshot => liveSnapshots.push(snapshot),
    });
    expect(result.error).toBeUndefined();
    const capture = result.execution;
    if (!capture?.snapshot) throw new Error('Expected the public agent capture');
    expect(result.output).toEqual(capture.snapshot);
    expect(liveSnapshots.length).toBeGreaterThan(0);
    expect(liveSnapshots.at(-1)).toEqual(capture.snapshot);
    expect(toVisualizationSnapshots(capture.snapshot, capture.narrativeEntries).length).toBeGreaterThan(0);
  });
});
