import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareCiManifest, replacements } from '../scripts/prepare-ci-dependencies.mjs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
// This test also runs in the disposable CI checkout after its pins are applied.
for (const [name, rule] of Object.entries(replacements)) manifest.dependencies[name] = rule.from;

describe('disposable CI dependency boundary', () => {
  it('changes only the named runtime links, retaining unrelated declarations and the original', () => {
    const input = { ...manifest, peerDependencies: { unrelated: '^2' }, optionalDependencies: { optional: '^3' } };
    const before = structuredClone(input);
    const result = prepareCiManifest(input);
    const expected = structuredClone(input);
    for (const [name, rule] of Object.entries(replacements)) expected.dependencies[name] = rule.to;
    expect(result).toEqual(expected);
    expect(input).toEqual(before);
  });

  it.each(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'])('rejects an unreviewed file link in %s', section => {
    const input = { ...manifest, [section]: { ...manifest[section], unexpected: 'file:../other' } };
    expect(() => prepareCiManifest(input)).toThrow('Unexpected local dependency');
  });

  it('rejects a moved or already-replaced link instead of masking a manifest change', () => {
    const name = Object.keys(replacements)[0];
    const input = { ...manifest, dependencies: { ...manifest.dependencies, [name]: 'file:../unexpected' } };
    expect(() => prepareCiManifest(input)).toThrow('Unexpected local dependency');
    input.dependencies[name] = replacements[name].to;
    expect(() => prepareCiManifest(input)).toThrow('Expected authored link');
  });
});

