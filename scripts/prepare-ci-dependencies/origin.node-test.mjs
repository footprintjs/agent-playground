import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareCiManifest, refreshRegistryOrigins } from './projection.mjs';
import { requireSelectedOrigins } from './installed.mjs';
import { installedFixture } from './installed-fixture.mjs';

const baseline = () => JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url)));
const projected = () => prepareCiManifest(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url))), {
  status: 'NATIVE_SOURCE_READY', archives: { agentfootprint: '/fixture/af.tgz', 'agentfootprint-lens': '/fixture/lens.tgz' },
  renderer: { package: 'footprint-explainable-ui', version: '0.38.0', integrity: 'sha512-' + Buffer.alloc(64).toString('base64') },
});

test('real same-version source-to-registry cache refresh removes only the two proven origin rows', () => {
  const lock = baseline(), before = structuredClone(lock), result = refreshRegistryOrigins(lock, projected());
  assert.deepEqual(result.removed, ['../explainable-ui', 'node_modules/footprint-explainable-ui']);
  for (const [path, row] of Object.entries(lock.packages)) {
    if (result.removed.includes(path)) assert(!Object.hasOwn(result.lock.packages, path));
    else assert.deepEqual(result.lock.packages[path], row, 'unrelated/compiler row changed');
  }
  assert.deepEqual(lock, before); assert.equal(Object.keys(result.lock.packages).length, Object.keys(lock.packages).length - 2);
});

test('foreign or shared origin targets refuse; unrelated registry cache rows stay unchanged', () => {
  const foreign = baseline(); foreign.packages['node_modules/footprint-explainable-ui'].resolved = '../other';
  assert.throws(() => refreshRegistryOrigins(foreign, projected()), /unrecognized authored/);
  const shared = baseline(); shared.packages['node_modules/other'] = { link: true, resolved: '../explainable-ui' };
  assert.throws(() => refreshRegistryOrigins(shared, projected()), /shared source-link/);
});

test('one pure selected-origin validator refuses a matching-version link before ci and after install', () => {
  const f = installedFixture();
  try {
    const lock = JSON.parse(f.nativeLock); requireSelectedOrigins(lock, f.inputs, f.archives, f.admitted, f.root);
    lock.packages['node_modules/footprint-explainable-ui'] = { link: true, resolved: '../explainable-ui' };
    assert.throws(() => requireSelectedOrigins(lock, f.inputs, f.archives, f.admitted, f.root), /origin\/version differs: footprint-explainable-ui/);
  } finally { f.close(); }
});
