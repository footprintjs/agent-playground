import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareCiLockBaseline } from './projection.mjs';

const baseline = () => JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url)));

test('actual committed source-link caches are invalidated without authoring replacement package identities', () => {
  const input = baseline(), before = structuredClone(input), result = prepareCiLockBaseline(input);
  assert.equal(input.packages['../agentfootprint'].version, '10.1.0');
  assert.equal(input.packages['node_modules/agentfootprint'].link, true);
  assert.equal(input.packages['node_modules/agentfootprint'].version, undefined);
  assert.deepEqual(result.removed, ['../agentfootprint', '../agentfootprint-lens', '../explainable-ui', '../footPrint',
    'node_modules/agentfootprint', 'node_modules/agentfootprint-lens', 'node_modules/footprint-explainable-ui',
    'node_modules/footprintjs', 'node_modules/foottrace']);
  for (const [path, row] of Object.entries(input.packages)) {
    if (result.removed.includes(path)) assert(!Object.hasOwn(result.lock.packages, path));
    else assert.deepEqual(result.lock.packages[path], row, 'unrelated/compiler cache changed: ' + path);
  }
  assert.deepEqual(input, before); // Public input remains byte-owner data, never a fabricated new lock.
  assert.deepEqual(result.lock.packages[''], before.packages['']);
  assert.equal(Object.keys(result.lock.packages).length, Object.keys(input.packages).length - 9);
});

test('unrelated rows are preserved and a shared/foreign source link refuses instead of deleting another owner cache', () => {
  const input = baseline(); input.packages['node_modules/unrelated'] = { version: '7.8.9', integrity: 'unchanged-inert-row' };
  assert.deepEqual(prepareCiLockBaseline(input).lock.packages['node_modules/unrelated'], input.packages['node_modules/unrelated']);
  input.packages['node_modules/other-alias'] = { link: true, resolved: '../agentfootprint' };
  const before = structuredClone(input);
  assert.throws(() => prepareCiLockBaseline(input), /unrelated alias/); assert.deepEqual(input, before);
  const foreign = baseline(); foreign.packages['node_modules/agentfootprint'].resolved = '../foreign';
  assert.throws(() => prepareCiLockBaseline(foreign), /expected controlled source-link/);
});
