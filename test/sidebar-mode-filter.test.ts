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
import { getCategorizedSamples, getSample } from '../src/samples/catalog';
import {
  PRIMITIVE_CATEGORIES, CONTROL_FLOW_CATEGORIES, PATTERN_CATEGORIES,
  CONTEXT_CATEGORIES, FEATURE_CATEGORIES,
} from '../src/samples/welcomeCategories';

// Test the real Home-page links, never a second stale navigation catalogue.
const HOME_LINKS = [
  ...PRIMITIVE_CATEGORIES, ...CONTROL_FLOW_CATEGORIES, ...PATTERN_CATEGORIES,
  ...CONTEXT_CATEGORIES, ...FEATURE_CATEGORIES,
];

describe('Sidebar folder-mode contract', () => {
  const allCategories = getCategorizedSamples();

  it('resolves duplicate ids by the authored mode, never the promoted category order', () => {
    const context = getSample('dynamic-react', 'context-engineering');
    const primitive = getSample('dynamic-react', 'dynamic-react');
    expect(context?.group).toBe('context-engineering');
    expect(primitive?.group).toBe('dynamic-react');
    expect(context?.code).not.toBe(primitive?.code);
    expect(getSample('dynamic-react')).toBeUndefined();
    for (const link of HOME_LINKS) expect(getSample(link.sample, link.mode)?.group).toBe(link.mode);
  });

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
    expect(ids).toContain('self-consistency');
  });

  it('3. All four control-flow primitives remain discoverable', () => {
    const filtered = allCategories.filter((c) => c.group === 'core-flow');
    expect(filtered.length).toBe(1);
    expect(filtered[0].samples.map(sample => sample.id)).toEqual(expect.arrayContaining(['sequence', 'parallel', 'conditional', 'loop']));
  });

  it('4. Every FEATURE_CATEGORIES mode maps to a real category.group', () => {
    const groups = new Set(allCategories.map((c) => c.group));
    for (const fc of HOME_LINKS) {
      expect(
        groups.has(fc.mode),
        `mode="${fc.mode}" has no matching category.group. Available: ${[...groups].join(', ')}`,
      ).toBe(true);
    }
  });

  it('5. Every FEATURE_CATEGORIES default sample exists in the catalog', () => {
    for (const fc of HOME_LINKS) {
      const allSampleIds = new Set(allCategories.filter(category => category.group === fc.mode).flatMap(category => category.samples.map(sample => sample.id)));
      expect(
        allSampleIds.has(fc.sample),
        `default sample "${fc.sample}" (mode="${fc.mode}") not in catalog`,
      ).toBe(true);
    }
  });
});
