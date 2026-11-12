/**
 * The one place this app reads the shape of a run's execution tree.
 *
 * WHY TWO SHAPES. footprintjs 12 and older serve `getSnapshot().executionTree`
 * as ONE stage object: the stage that ran next is its `next`, a fork's
 * children are its `children` (the "linked form", one level deeper per stage).
 * footprintjs 13 serves a LIST of the stages in the order they ran, and a
 * fork's children as `branches` (one list per child) — the "list form". Saved
 * runs (the trace JSON the /viewer reads) and footprintjs 12 use the linked
 * form, and the published visualizers this app hands snapshots to
 * (`footprint-explainable-ui`'s `toVisualizationSnapshots` and trace viewer)
 * read only the linked form. So until the app and those packages move to the
 * list form, every snapshot leaves the app through {@link linkedRunSnapshot}.
 *
 * The same shape rule holds for a mounted subflow's
 * `subflowResults[...].treeContext.stageContexts`.
 */
import type { toVisualizationSnapshots } from 'footprint-explainable-ui';

/** A stage of either form; only the fields that carry the shape are named. */
export interface TreeStage {
  readonly next?: unknown;
  readonly children?: unknown;
  readonly branches?: unknown;
  readonly [field: string]: unknown;
}

/** The run snapshot the published visualizers read (linked form). */
export type VisualizationSnapshot = Parameters<typeof toVisualizationSnapshots>[0];

const isStage = (value: unknown): value is TreeStage =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Walks a linked chain along `next`, without recursion. */
function chainOf(first: unknown): TreeStage[] {
  const stages: TreeStage[] = [];
  const seen = new Set<unknown>();
  for (let stage = first; isStage(stage) && !seen.has(stage); stage = stage.next) {
    seen.add(stage);
    stages.push(stage);
  }
  return stages;
}

/**
 * The stages of one chain in the order they ran, from either form: the list
 * form as served, the linked form followed along `next`. Anything else is no
 * stages.
 */
export function executionStages(tree: unknown): TreeStage[] {
  if (Array.isArray(tree)) return tree.filter(isStage);
  return chainOf(tree);
}

/** A stage's child branches (a fork's children), each in run order, from either form. */
export function stageBranches(stage: TreeStage): TreeStage[][] {
  if (Array.isArray(stage.branches)) return stage.branches.map(executionStages);
  if (Array.isArray(stage.children)) return stage.children.map(executionStages);
  return [];
}

/**
 * One chain as the linked form: each stage a copy without `branches`, its
 * children (if any) linked the same way, the following stage as `next`.
 * Built from the end, so a long run costs no stack; recursion only follows
 * fork nesting. No stages is `undefined`, which the visualizers read as an
 * empty run.
 */
function linkChain(stages: readonly TreeStage[]): TreeStage | undefined {
  let following: TreeStage | undefined;
  for (let i = stages.length - 1; i >= 0; i--) {
    const branches = stageBranches(stages[i]);
    const linked: Record<string, unknown> = { ...stages[i] };
    delete linked.next;
    delete linked.children;
    delete linked.branches;
    if (branches.length > 0) linked.children = branches.map(linkChain).filter(isStage);
    if (following) linked.next = following;
    following = linked;
  }
  return following;
}

/** `true` when the tree is already in the linked form (or absent): nothing to change. */
const isLinked = (tree: unknown): boolean => !Array.isArray(tree);

function linkedSubflowResults(results: unknown): unknown {
  if (!isStage(results)) return results;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, result] of Object.entries(results)) {
    const context = isStage(result) ? result.treeContext : undefined;
    const stages = isStage(context) ? context.stageContexts : undefined;
    if (isStage(result) && isStage(context) && !isLinked(stages)) {
      changed = true;
      out[key] = { ...result, treeContext: { ...context, stageContexts: linkChain(executionStages(stages)) } };
    } else {
      out[key] = result;
    }
  }
  return changed ? out : results;
}

/**
 * The snapshot in the linked form the published visualizers read. A snapshot
 * already in the linked form (footprintjs 12, a saved run) is returned as is —
 * the same object — so nothing changes for it.
 */
export function linkedRunSnapshot(snapshot: object): VisualizationSnapshot {
  const run = snapshot as { executionTree?: unknown; subflowResults?: unknown };
  const subflowResults = linkedSubflowResults(run.subflowResults);
  if (isLinked(run.executionTree) && subflowResults === run.subflowResults) {
    return snapshot as VisualizationSnapshot;
  }
  const linked: Record<string, unknown> = { ...snapshot, subflowResults };
  if (!isLinked(run.executionTree)) linked.executionTree = linkChain(executionStages(run.executionTree));
  if (subflowResults === undefined) delete linked.subflowResults;
  return linked as unknown as VisualizationSnapshot;
}
