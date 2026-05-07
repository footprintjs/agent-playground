/**
 * Sample catalog — auto-discovers examples from agentfootprint/examples.
 *
 * `import.meta.glob` walks `@samples/**` (resolved via the `@samples`
 * alias to `../agentfootprint/examples/*` — see vite.config.ts) and
 * pulls each example as both:
 *   - the module's exported `meta` object (catalog metadata)
 *   - the raw source string (playground sandbox)
 *   - the paired `.md` explainer (rendered in the Explain tab)
 *
 * Add a new example to agentfootprint/examples/<group>/<NN>-name.ts
 * with a proper `export const meta = {...}` and it appears here
 * automatically — no catalog edit required. Same for the paired `.md`.
 *
 * Playground-only inline samples (live chat, multimodal, MCP demo, etc.)
 * live below the auto-discovered list — they have no agentfootprint
 * counterpart and remain hand-maintained.
 */

// Inline copy of agentfootprint's ExampleMeta type so we don't import from
// outside this project's rootDir. Keep this in sync with
// ../../agentfootprint/examples/helpers/cli.ts.
interface ExampleMeta {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly description: string;
  readonly defaultInput: string | null;
  readonly providerSlots: readonly string[];
  readonly tags: readonly string[];
}

// ── Types ────────────────────────────────────────────────────

export interface Sample {
  id: string;
  number: number;
  title: string;
  description: string;
  /** Display label (Title Case) — derived from the folder. */
  category: string;
  /** URL-mode key = source folder name (kebab-case). Drives `?mode=...`.
   *  Inline samples omit this — they're not folder-auto-discovered. */
  group?: string;
  code: string;
  /** Markdown explainer (paired `.md`). Optional — inline samples don't have one. */
  explainer?: string;
}

export interface SampleCategory {
  name: string;
  samples: Sample[];
  /** URL-mode key — same as Sample.group, hoisted so Sidebar can filter
   *  by `?mode=<group>` without opening a sample. Undefined for inline
   *  groupings (they can't be linked-to via the mode param). */
  group?: string;
}

/**
 * Category = the example's `group` field, which by convention matches the
 * folder it lives in (`examples/patterns/` → group `patterns`). No manual
 * mapping table — the folder structure IS the taxonomy. Display labels
 * are derived by `prettifyGroup()`; URL modes use the raw group name.
 *
 * Curriculum-first ordering: Concepts + Patterns lead, everything else
 * falls in alphabetically. Add groups here ONLY if you want them ahead
 * of the default sort — otherwise new folders auto-slot in.
 */
const GROUP_PROMOTE_ORDER = ['concepts', 'patterns'];

/** kebab-case folder name → Title Case display label.
 *  `runtime-features` → `Runtime Features`. Stable, invertible, no map. */
function prettifyGroup(group: string): string {
  return group
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

// ── Auto-discover from agentfootprint/examples ───────────────

// Glob patterns must be literal strings/array literals — Vite's transform
// can't resolve them through variables. Exclude helpers/ (imports Node's
// `url` module, breaks browser bundle) and DESIGN/README (not example md).
const exampleModules = import.meta.glob(
  ['@samples/**/*.ts', '!@samples/helpers/**'],
  { eager: true },
);
const exampleRaw = import.meta.glob(
  ['@samples/**/*.ts', '!@samples/helpers/**'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;
const explainerRaw = import.meta.glob(
  ['@samples/**/*.md', '!@samples/DESIGN.md', '!@samples/README.md'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

/**
 * Strip JSDoc / `meta` export / CLI guard from an example's `.ts`
 * source, leaving the function declarations intact. Returns code that
 * can be inlined into the sandbox's async IIFE and dispatched by
 * mode.
 *
 * Two phases per example:
 *   • `run(input, provider?)`           — required; kicks off the run.
 *   • `resume(checkpoint, answer, p?)`  — optional; the HITL second
 *                                          phase. Pause/Resume sample
 *                                          ships it; most others don't.
 *
 * The dispatcher appended at the end picks one based on `__mode`
 * (sandbox-injected) so the same compiled snippet handles both
 * phases. Helper functions defined in the source (e.g. `buildAgent`)
 * are preserved as-is — only the leading `export` keyword is dropped
 * from `run` / `resume` so they're locals in the IIFE scope.
 *
 * Sandbox injects (executeCode.ts):
 *   `__input`, `__provider`,
 *   `__mode` ∈ 'run' | 'resume',
 *   `__checkpoint`, `__resumeInput` (only on resume mode)
 */
function fromSample(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let inJsDoc = false;
  let skipBlockUntilClose = false;
  let skipBraceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed.startsWith('/**') && i < 10 && !inJsDoc) {
      inJsDoc = true;
      if (trimmed.includes('*/')) inJsDoc = false;
      continue;
    }
    if (inJsDoc) {
      if (trimmed.includes('*/')) inJsDoc = false;
      continue;
    }

    if (skipBlockUntilClose) {
      for (const ch of line) {
        if (ch === '{') skipBraceDepth++;
        else if (ch === '}') skipBraceDepth--;
      }
      if (skipBraceDepth <= 0) skipBlockUntilClose = false;
      continue;
    }

    // Skip `export const meta = {...}` block.
    if (trimmed.startsWith('export const meta')) {
      skipBraceDepth = 0;
      for (const ch of line) {
        if (ch === '{') skipBraceDepth++;
        else if (ch === '}') skipBraceDepth--;
      }
      skipBlockUntilClose = skipBraceDepth > 0;
      continue;
    }

    // Skip CLI-only entry guards.
    if (
      trimmed.startsWith('if (isCliEntry(') ||
      trimmed.startsWith('if (process.argv') ||
      trimmed.startsWith('if (import.meta.url')
    ) {
      skipBraceDepth = 0;
      for (const ch of line) {
        if (ch === '{') skipBraceDepth++;
        else if (ch === '}') skipBraceDepth--;
      }
      skipBlockUntilClose = skipBraceDepth > 0;
      continue;
    }

    // Drop the `export ` keyword off function declarations so they
    // become valid IIFE-scope locals. Catches the `export function`,
    // `export async function`, and `export const NAME =` forms.
    let outputLine = line;
    if (
      /^export\s+(async\s+)?function\b/.test(trimmed) ||
      /^export\s+const\b/.test(trimmed)
    ) {
      // Strip the leading `export ` (preserve indentation).
      outputLine = line.replace(/^(\s*)export\s+/, '$1');
    }
    out.push(outputLine);
  }

  while (out.length > 0 && out[0].trim() === '') out.shift();
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();

  const body = out.join('\n');

  // Dispatcher. `run` is required by every sample; `resume` only the
  // pause/resume sample defines today. The runtime check on `resume`
  // keeps the dispatcher safe for samples that never define it.
  // Note: `input` is the IIFE parameter name (preserved for back-compat
  // with prior catalog versions); `__mode` / `__checkpoint` /
  // `__resumeInput` are new params injected by executeCode.ts.
  const dispatcher =
    `\n// ── Sandbox dispatcher (injected by playground) ──\n` +
    `if (typeof __mode !== 'undefined' && __mode === 'resume' && typeof resume === 'function') {\n` +
    `  return await resume(__checkpoint, __resumeInput, __provider);\n` +
    `}\n` +
    `return await run(input, __provider);\n`;

  return body + dispatcher;
}

function toSampleId(metaId: string): string {
  const parts = metaId.split('/');
  const last = parts[parts.length - 1] ?? metaId;
  return last.replace(/^\d+-/, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

function deriveNumber(path: string): number {
  const file = path.split('/').pop() ?? '';
  const match = file.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : 99;
}

const fileBased: Sample[] = Object.entries(exampleModules)
  .filter(([path]) => !path.includes('/helpers/'))
  .map(([path, mod]): Sample | null => {
    const meta = (mod as { meta?: ExampleMeta }).meta;
    if (!meta) {
      console.warn(`[catalog] ${path} missing 'meta' export — skipping`);
      return null;
    }
    const raw = exampleRaw[path];
    const mdPath = path.replace(/\.ts$/, '.md');
    const explainer = explainerRaw[mdPath];
    return {
      id: toSampleId(meta.id),
      number: deriveNumber(path),
      title: meta.title,
      description: meta.description,
      // `category` holds the display label; the sample's folder (meta.group)
      // is the URL-mode key. `getCategorizedSamples()` groups by label.
      category: prettifyGroup(meta.group),
      group: meta.group,
      code: fromSample(raw),
      ...(explainer ? { explainer } : {}),
    };
  })
  .filter((s): s is Sample => s !== null)
  .sort((a, b) => {
    // Promoted groups come first in their declared order; everything else
    // sorts alphabetically by display label, then by the file's leading
    // number (01-..., 02-...) to preserve the curriculum flow.
    const ag = (a as Sample & { group?: string }).group ?? '';
    const bg = (b as Sample & { group?: string }).group ?? '';
    const ai = GROUP_PROMOTE_ORDER.indexOf(ag);
    const bi = GROUP_PROMOTE_ORDER.indexOf(bg);
    if (ai !== -1 && bi !== -1 && ai !== bi) return ai - bi;
    if (ai !== -1 && bi === -1) return -1;
    if (bi !== -1 && ai === -1) return 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.number - b.number;
  });

// ── Final catalog ────────────────────────────────────────────

export const samples: Sample[] = fileBased;

export function getCategorizedSamples(): SampleCategory[] {
  const map = new Map<string, Sample[]>();
  for (const sample of samples) {
    if (!map.has(sample.category)) map.set(sample.category, []);
    map.get(sample.category)!.push(sample);
  }
  // Samples are already sorted by group-promotion + alpha; iteration
  // order of the Map matches insertion order, so this preserves the
  // curriculum-first layout without a separate ORDER table.
  return Array.from(map.entries()).map(([name, samples]) => ({
    name,
    samples,
    // Hoist the group from the first sample — every sample in a given
    // category shares the same group (folder), so this is well-defined.
    ...(samples[0]?.group ? { group: samples[0].group } : {}),
  }));
}
