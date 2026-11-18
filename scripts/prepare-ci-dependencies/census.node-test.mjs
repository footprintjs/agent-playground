import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { physicalCensus, requireFamilyOwners } from './namespaces.mjs';
import { fixture } from './guard-fixtures.mjs';

test('actual app, helper and common-parent namespaces are observed once without executing package entry text', () => {
  const f = fixture();
  try {
    const census = physicalCensus(f.root, f.helper, JSON.parse);
    const owners = requireFamilyOwners(census, f.selected);
    assert.equal(Object.keys(owners).length, 6);
    assert.deepEqual(census.dependencyNamespaces, [join(f.root, 'node_modules'), join(f.helper, 'node_modules')]);
    assert.equal(census.links.length, 1);
  } finally { f.close(); }
});

test('hidden and nested aliases in EVERY actual source namespace expose duplicate or obsolete reader images', () => {
  for (const namespace of ['root', 'helper']) for (const suffix of ['.hidden/inert-alias', 'nested/node_modules/alias']) {
    const f = fixture();
    try {
      const base = namespace === 'root' ? f.root : f.helper;
      f.put(join(base, 'node_modules', suffix, 'package.json'), '{"name":"foottrace","version":"1.0.0"}');
      assert.throws(() => requireFamilyOwners(physicalCensus(f.root, f.helper, JSON.parse), f.selected), /one physical foottrace/);
    } finally { f.close(); }
  }
});

test('hidden locks in the helper namespace are observed and linked dependency directories refuse', () => {
  const f = fixture();
  try {
    f.put(join(f.helper, 'node_modules/.package-lock.json'), '{"packages":{}}');
    const census = physicalCensus(f.root, f.helper, JSON.parse);
    assert.equal(census.hiddenLocks.length, 1); assert.equal(census.hiddenLocks[0].base, f.helper);
    const foreign = join(f.base, 'foreign'); mkdirSync(foreign);
    symlinkSync(foreign, join(f.root, 'node_modules', 'concealed'));
    assert.throws(() => physicalCensus(f.root, f.helper, JSON.parse), /unadmitted dependency link/);
  } finally { f.close(); }
});

test('common parent link cannot redirect to an unobserved dependency graph', () => {
  const f = fixture();
  try {
    unlinkSync(join(f.base, 'node_modules'));
    mkdirSync(join(f.helper, 'node_modules'));
    symlinkSync(join(f.helper, 'node_modules'), join(f.base, 'node_modules'));
    assert.throws(() => physicalCensus(f.root, f.helper, JSON.parse), /common parent/);
  } finally { f.close(); }
});
