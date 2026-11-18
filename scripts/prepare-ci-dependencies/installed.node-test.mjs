import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { inspectInstalled } from './installed.mjs';
import { installedFixture } from './installed-fixture.mjs';

test('observes exact source images, all owners, hidden lock and compiler without runtime imports', () => {
  const f = installedFixture();
  try {
    const result = inspectInstalled(f);
    assert.equal(result.packages.length, 6); assert.equal(result.compiler.version, '5.4.5');
    assert.equal(result.sourceMembers.agentfootprint.count, 2);
    assert.equal(result.exampleSource.head, f.inputs.producers.agentfootprint.source.head);
    assert.equal(result.hiddenLocks.length, 1);
  } finally { f.close(); }
});

test('modified original members, compiler, normal/hidden locks and immutable source cannot hide behind a checkpoint', () => {
  for (const fault of ['source-image', 'compiler-lock', 'hidden-lock', 'example-source', 'renderer-sri']) {
    const f = installedFixture();
    try {
      if (fault === 'source-image') f.put(join(f.root, 'node_modules/agentfootprint/index.js'), 'changed image');
      if (fault === 'compiler-lock') {
        const lock = JSON.parse(f.nativeLock); lock.packages['node_modules/typescript'].version = '9.9.9';
        f.nativeLock = Buffer.from(JSON.stringify(lock));
      }
      if (fault === 'hidden-lock') {
        const hidden = JSON.parse(f.nativeLock); hidden.packages['node_modules/foottrace'].integrity = 'sha512-changed';
        f.put(join(f.root, 'node_modules/.package-lock.json'), JSON.stringify(hidden));
      }
      if (fault === 'example-source') f.put(join(f.helper, 'package.json'), '{"name":"agentfootprint","version":"wrong"}');
      if (fault === 'renderer-sri') f.inputs.renderer.integrity = 'sha512-changed';
      assert.throws(() => inspectInstalled(f), fault);
    } finally { f.close(); }
  }
});

test('hidden extra images in either source namespace refuse even when the normal root graph is valid', () => {
  for (const role of ['root', 'helper']) {
    const f = installedFixture();
    try {
      f.put(join(f[role], 'node_modules/.hidden/alias/package.json'), '{"name":"foottrace","version":"1.0.0"}');
      assert.throws(() => inspectInstalled(f), /one physical foottrace/);
    } finally { f.close(); }
  }
});

test('context expected version comes from the admitted original, never a self-consistent changed lock', () => {
  const f = installedFixture();
  try {
    const lock = JSON.parse(f.nativeLock);
    lock.packages['node_modules/contextfootprint'].version = '0.2.0';
    lock.packages['node_modules/contextfootprint'].resolved = 'https://registry.npmjs.org/contextfootprint/-/contextfootprint-0.2.0.tgz';
    f.nativeLock = Buffer.from(JSON.stringify(lock));
    f.put(join(f.root, 'node_modules/.package-lock.json'), f.nativeLock);
    f.put(join(f.root, 'node_modules/contextfootprint/package.json'), '{"name":"contextfootprint","version":"0.2.0","main":"index.js"}');
    assert.throws(() => inspectInstalled(f), /wrong physical contextfootprint version/);
  } finally { f.close(); }
});

test('engine, reader and context member bytes must equal their originals before the first consumer gate', () => {
  for (const name of ['footprintjs', 'foottrace', 'contextfootprint']) {
    const f = installedFixture();
    try {
      f.put(join(f.root, 'node_modules', name, 'index.js'), 'changed member with original lock and version');
      assert.throws(() => inspectInstalled(f), /installed family image differs/);
    } finally { f.close(); }
  }
});
