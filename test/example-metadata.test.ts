import { describe, expect, it } from 'vitest';
import { discoverExample } from '../scripts/exampleMetadata';

describe('inert example metadata', () => {
  it('reads typed literal metadata without executing any example statement', () => {
    const result = discoverExample(`
      throw new Error('This must never execute');
      export const meta: ExampleMeta = {
        id: 'features/demo', title: 'Demo', description: 'A ' + 'description',
        group: 'stale-group', get unused() { throw new Error('Getter must not run'); },
      } satisfies ExampleMeta;
      export async function run() { return 42; }
    `, '/examples/features/demo.ts');
    expect(result).toEqual({ kind: 'runnable', meta: { id: 'features/demo', title: 'Demo', description: 'A description', group: 'features' } });
  });

  it('derives a missing group from the source folder, without losing the example', () => {
    expect(discoverExample(`export const meta = { id: 'x', title: 'X', description: 'Description' }; export function run() {}`, '/examples/observability/x.ts'))
      .toMatchObject({ kind: 'runnable', meta: { group: 'observability' } });
  });

  it('reports CLI-only scripts rather than importing their top-level main call', () => {
    expect(discoverExample(`main(); export const meta = {id: 'x'};`, '/examples/features/x.ts'))
      .toMatchObject({ kind: 'cli-only', reason: expect.stringContaining('No exported run()') });
  });

  it.each([
    `export const meta = buildMeta();`,
    `export const meta = { id: 'x', title: sideEffect(), description: 'D' };`,
    `export const meta = { id: 'x', get title() { return 'X'; }, description: 'D' };`,
    `export const meta = { ...external };`,
    `export const meta = { id: 'x', title: 'X', description: 'D', ...external };`,
    `export const meta = { id: 'x', title: 'X', description: 'D', get title() { return 'Other'; } };`,
    `export const meta = { id: 'x', title: 'X', description: 'D', ['title']: 'Other' };`,
    `export const meta = { id: 'x', title: 'X', description: 'D', title: 'Other' };`,
  ])('refuses executable metadata: %s', declaration => {
    expect(discoverExample(`${declaration} export async function run() {}`, '/examples/features/x.ts').kind).toBe('unsupported');
  });
});
