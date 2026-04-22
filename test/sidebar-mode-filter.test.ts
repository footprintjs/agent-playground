/**
 * Sidebar / Home contract — the URL `?mode=<folder>` maps 1:1 to a
 * category, where `<folder>` is the literal folder name in
 * `agentfootprint/examples/`. No translation table: folder IS the mode.
 *
 * Five pattern tests exercise the full consumer circle (folder →
 * catalog → sidebar → chip → click):
 *   1. Every category has a `group` set from its source folder
 *   2. A feature mode (patterns) scopes to exactly one category
 *   3. Concepts folder auto-wires as the curriculum landing
 *   4. Every Home FEATURE_CATEGORIES mode maps to a real category.group
 *   5. Every FEATURE_CATEGORIES default sample exists in the catalog
 */
import { describe, expect, it } from 'vitest';
import { getCategorizedSamples } from '../src/samples/catalog';

// Same list as Welcome.tsx — the Home-page chip grid.
const FEATURE_CATEGORIES = [
  { mode: 'patterns',          sample: 'regular-vs-dynamic' },
  { mode: 'providers',         sample: 'prompt' },
  { mode: 'runtime-features',  sample: 'events' },
  { mode: 'observability',     sample: 'recorders' },
  { mode: 'security',          sample: 'gated-tools' },
  { mode: 'resilience',        sample: 'runner-wrappers' },
  { mode: 'integrations',      sample: 'full-integration' },
];

describe('Sidebar folder-mode contract', () => {
  const allCategories = getCategorizedSamples();

  it('1. Every category carries a `group` derived from its source folder', () => {
    // Every category auto-discovered from `examples/` must have a group.
    // (Inline samples now also set group, so this should be total.)
    const withoutGroup = allCategories.filter((c) => !c.group);
    expect(
      withoutGroup.map((c) => c.name),
      'categories missing .group',
    ).toEqual([]);
  });

  it('2. A feature mode (patterns) scopes to exactly one category', () => {
    const filtered = allCategories.filter((c) => c.group === 'patterns');
    expect(filtered.length).toBe(1);
    const ids = filtered[0].samples.map((s) => s.id);
    expect(ids).toContain('regular-vs-dynamic');
  });

  it('3. Concepts folder auto-wires as the curriculum landing', () => {
    const filtered = allCategories.filter((c) => c.group === 'concepts');
    expect(filtered.length).toBe(1);
    expect(filtered[0].samples.length).toBeGreaterThanOrEqual(6);
  });

  it('4. Every FEATURE_CATEGORIES mode maps to a real category.group', () => {
    const groups = new Set(allCategories.map((c) => c.group));
    for (const fc of FEATURE_CATEGORIES) {
      expect(
        groups.has(fc.mode),
        `mode="${fc.mode}" has no matching category.group. Available: ${[...groups].join(', ')}`,
      ).toBe(true);
    }
  });

  it('5. Every FEATURE_CATEGORIES default sample exists in the catalog', () => {
    const allSampleIds = new Set(allCategories.flatMap((c) => c.samples.map((s) => s.id)));
    for (const fc of FEATURE_CATEGORIES) {
      expect(
        allSampleIds.has(fc.sample),
        `default sample "${fc.sample}" (mode="${fc.mode}") not in catalog`,
      ).toBe(true);
    }
  });
});
