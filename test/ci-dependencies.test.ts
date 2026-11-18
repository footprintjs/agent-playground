import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareCiManifest, authoredLinks } from '../scripts/prepare-ci-dependencies.mjs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
// This test also runs in the disposable CI checkout after its pins are applied.
for (const [name, link] of Object.entries(authoredLinks)) manifest.dependencies[name] = link;
manifest.dependencies.foottrace = '^2.0.0-rc.0';
// Synthetic input data, not a real admitted producer or renderer selection.
const policy = () => ({ status: 'NATIVE_SOURCE_READY', archives: {
  agentfootprint: '/fixture/af.tgz', 'agentfootprint-lens': '/fixture/lens.tgz',
}, renderer: { package: 'footprint-explainable-ui', version: '9.8.7',
  integrity: 'sha512-' + Buffer.alloc(64).toString('base64') } });

describe('disposable CI dependency boundary', () => {
  it('changes only the named runtime links, retaining unrelated declarations and the original', () => {
    const input = { ...manifest, peerDependencies: { unrelated: '^2' }, optionalDependencies: { optional: '^3' } };
    const before = structuredClone(input);
    const result = prepareCiManifest(input, policy());
    const expected = structuredClone(input);
    Object.assign(expected.dependencies, { agentfootprint: 'file:/fixture/af.tgz',
      'agentfootprint-lens': 'file:/fixture/lens.tgz', 'footprint-explainable-ui': '9.8.7',
      footprintjs: '14.0.0-rc.0', foottrace: '2.1.0' });
    expect(result).toEqual(expected);
    expect(input).toEqual(before);
  });

  it.each(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'])('rejects an unreviewed file link in %s', section => {
    const input = { ...manifest, [section]: { ...manifest[section], unexpected: 'file:../other' } };
    expect(() => prepareCiManifest(input, policy())).toThrow('Unexpected local dependency');
  });

  it('rejects a moved or already-replaced link instead of masking a manifest change', () => {
    const name = Object.keys(authoredLinks)[0];
    const input = { ...manifest, dependencies: { ...manifest.dependencies, [name]: 'file:../unexpected' } };
    expect(() => prepareCiManifest(input, policy())).toThrow('Unexpected local dependency');
    input.dependencies[name] = '15.0.0-rc.0';
    expect(() => prepareCiManifest(input, policy())).toThrow('Expected authored link');
  });
});

