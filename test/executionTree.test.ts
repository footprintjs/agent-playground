import { describe, expect, it } from 'vitest';
import { toVisualizationSnapshots } from 'footprint-explainable-ui';
import { executionStages, linkedRunSnapshot, stageBranches } from '../src/runner/executionTree';

const stage = (id: string, extra: Record<string, unknown> = {}) => ({
  id, runtimeStageId: `${id}#0`, logs: {}, errors: {}, metrics: {}, evals: {}, ...extra,
});

// The same run, a → fork(b, c → d) → e, in both forms.
const listTree = [
  stage('a'),
  stage('fork', { isFork: true, branches: [[stage('b')], [stage('c'), stage('d')]] }),
  stage('e'),
];
const linkedTree = {
  ...stage('a'),
  next: {
    ...stage('fork', { isFork: true, children: [stage('b'), { ...stage('c'), next: stage('d') }] }),
    next: stage('e'),
  },
};
const run = (executionTree: unknown, subflowResults?: unknown) => ({
  sharedState: { answer: 42 }, executionTree, commitLog: [], ...(subflowResults ? { subflowResults } : {}),
});

describe('execution tree: both shapes', () => {
  it('lists the stages of a chain in run order from either form', () => {
    expect(executionStages(listTree).map((s) => s.id)).toEqual(['a', 'fork', 'e']);
    expect(executionStages(linkedTree).map((s) => s.id)).toEqual(['a', 'fork', 'e']);
    expect(executionStages(undefined)).toEqual([]);
    expect(executionStages([])).toEqual([]);
  });

  it("reads a fork's branches from either form", () => {
    const ids = (tree: unknown) => stageBranches(executionStages(tree)[1]).map((b) => b.map((s) => s.id));
    expect(ids(listTree)).toEqual([['b'], ['c', 'd']]);
    expect(ids(linkedTree)).toEqual([['b'], ['c', 'd']]);
    expect(stageBranches(stage('plain'))).toEqual([]);
  });

  it('turns the list form into the linked form', () => {
    expect(linkedRunSnapshot(run(listTree))).toEqual(run(linkedTree));
  });

  it('returns a linked-form snapshot as the same object', () => {
    const snapshot = run(linkedTree, { sf: { treeContext: { stageContexts: linkedTree } } });
    expect(linkedRunSnapshot(snapshot)).toBe(snapshot);
  });

  it("links each mounted subflow's stages", () => {
    const listed = run([stage('mount')], { sf: { subflowId: 'sf', treeContext: { globalContext: {}, stageContexts: listTree } } });
    const linked = linkedRunSnapshot(listed) as unknown as Record<string, unknown>;
    expect(linked.executionTree).toEqual(stage('mount'));
    expect(linked.subflowResults).toEqual({ sf: { subflowId: 'sf', treeContext: { globalContext: {}, stageContexts: linkedTree } } });
    expect(listed.executionTree).toEqual([stage('mount')]); // the input is not changed
  });

  it('links a long run without running out of stack', () => {
    const long = Array.from({ length: 30_000 }, (_, i) => stage(`s${i}`));
    const linked = linkedRunSnapshot(run(long)) as unknown as { executionTree: { next?: unknown } };
    expect(linked.executionTree.next).toBeDefined();
  });

  it('gives the visualizer the same stages from either form', () => {
    const ids = (snapshot: object) => toVisualizationSnapshots(linkedRunSnapshot(snapshot)).map((s) => s.stageName);
    expect(ids(run(listTree))).toEqual(ids(run(linkedTree)));
    expect(ids(run(listTree)).length).toBeGreaterThan(0);
  });
});
