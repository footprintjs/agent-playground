// Installed images, locks and resolution owners only; never import incoming runtime code.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { hash, regular, exampleSource } from './filesystem.mjs';
import { physicalCensus, requireFamilyOwners } from './namespaces.mjs';

const lockFields = ['version', 'resolved', 'integrity', 'link'];
const posix = path => path.split('\\').join('/');
const selectedVersions = inputs => ({ footprintjs: '14.0.0-rc.0', foottrace: '2.1.0',
  agentfootprint: inputs.producers.agentfootprint.archive.version,
  'agentfootprint-lens': inputs.producers['agentfootprint-lens'].archive.version,
  'footprint-explainable-ui': inputs.renderer.version, contextfootprint: inputs.registry.contextfootprint.version });

export function requireSelectedOrigins(lock, inputs, archives, admitted, root) {
  for (const [name, version] of Object.entries(selectedVersions(inputs))) {
    const row = lock.packages['node_modules/' + name];
    assert(row && !row.link && row.version === version, 'selected lock origin/version differs: ' + name);
    if (Object.hasOwn(archives, name)) {
      assert.equal(row.integrity, admitted[name].integrity, 'selected source archive SRI differs');
      assert(row.resolved.startsWith('file:') && resolve(root, row.resolved.slice(5)) === archives[name], 'selected source archive origin differs');
    } else {
      assert.equal(row.resolved, `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, 'selected registry origin differs: ' + name);
      const pin = name === 'footprint-explainable-ui' ? inputs.renderer : inputs.registry[name];
      assert.equal(row.integrity, pin.integrity, 'selected registry SRI differs: ' + name);
    }
  }
}

export function inventory(root, { dependencies = false } = {}) {
  const files = [];
  let visits = 0, bytes = 0;
  function walk(path, depth) {
    assert(depth <= 64, 'image depth bound');
    for (const name of readdirSync(path).sort()) {
      assert(++visits <= 200000, 'image member bound');
      const file = join(path, name), stat = lstatSync(file), key = posix(relative(root, file));
      assert(!stat.isSymbolicLink(), 'linked image member');
      if (stat.isDirectory()) {
        if (!(dependencies && key === 'node_modules')) walk(file, depth + 1);
      } else {
        const data = regular(file); bytes += data.length; assert(bytes <= 128 * 1024 * 1024, 'image byte bound');
        files.push({ path: 'package/' + key, size: data.length, sha256: hash(data) });
      }
    }
  }
  walk(root, 0);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function packageOwner(entry, name, parse) {
  let root = dirname(realpathSync(entry));
  for (;;) {
    try { if (parse(regular(join(root, 'package.json'))).name === name) return root; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(root); assert.notEqual(parent, root, 'resolution owner missing'); root = parent;
  }
}

export function inspectInstalled({ root, helper, originalLock, nativeLock, admitted, archives, inputs, port }) {
  const parse = bytes => port.parseStrictJson(bytes, { maxBytes: 8 * 1024 * 1024 });
  const lock = parse(nativeLock), baseline = parse(originalLock);
  assert.equal(lock.lockfileVersion, 3); assert(lock.packages && baseline.packages);
  const compilerLock = baseline.packages['node_modules/typescript'];
  assert(compilerLock && !compilerLock.link, 'existing compiler lock required');
  assert.deepEqual(lock.packages['node_modules/typescript'], compilerLock, 'compiler lock changed');
  requireSelectedOrigins(lock, inputs, archives, admitted, root);
  const census = physicalCensus(root, helper, parse);
  const selected = selectedVersions(inputs);
  const owners = requireFamilyOwners(census, selected);
  const hidden = census.hiddenLocks;
  assert(hidden.some(row => row.path === join(root, 'node_modules/.package-lock.json')), 'root hidden lock required');
  for (const observed of hidden) for (const [path, record] of Object.entries(observed.packages)) {
    const key = posix(relative(root, resolve(observed.base, path)));
    const expected = lock.packages[key]; assert(expected, 'unrecorded hidden-lock package');
    for (const field of lockFields) assert.deepEqual(record[field], expected[field], 'hidden lock differs from native lock');
  }
  for (const [name, owner] of Object.entries(owners)) {
    const key = posix(relative(root, owner.root));
    assert.equal(key, 'node_modules/' + name, 'selected package has a different physical origin');
    assert(hidden.some(row => row.packages[posix(relative(row.base, owner.root))]), 'selected owner absent from hidden locks');
  }
  const ownerRoots = [root, helper, ...Object.values(owners).map(row => row.root)];
  for (const path of ownerRoots) {
    const here = createRequire(join(path, 'package.json'));
    for (const name of ['footprintjs', 'foottrace', 'contextfootprint']) {
      assert.equal(packageOwner(here.resolve(name), name, parse), owners[name].root, 'resolution uses another physical owner');
    }
  }
  const sourceMembers = {};
  for (const name of ['agentfootprint', 'agentfootprint-lens']) {
    const files = inventory(owners[name].root, { dependencies: true });
    assert.deepEqual(files, [...admitted[name].files].sort((a, b) => a.path.localeCompare(b.path)), 'installed source members differ from original');
    sourceMembers[name] = { count: files.length, censusSha256: hash(JSON.stringify(files)) };
  }
  const originalFamilyImages = {};
  for (const name of ['footprintjs', 'foottrace', 'contextfootprint']) {
    const original = admitted['agentfootprint-lens'].family[name], actual = inventory(owners[name].root, { dependencies: true });
    assert.deepEqual(actual, [...original.files].sort((a, b) => a.path.localeCompare(b.path)), 'installed family image differs from admitted original');
    originalFamilyImages[name] = { archiveSha256: original.sha256, integrity: original.integrity,
      count: actual.length, censusSha256: hash(JSON.stringify(actual)) };
  }
  const renderer = inventory(owners['footprint-explainable-ui'].root, { dependencies: true });
  assert.equal(renderer.length, inputs.renderer.memberCount);
  assert.deepEqual(Object.fromEntries(renderer.map(row => [row.path.slice(8), row.sha256])), inputs.renderer.memberHashes,
    'installed published renderer differs from the qualified matrix original');
  const compilerRoot = packageOwner(createRequire(join(root, 'package.json')).resolve('typescript'), 'typescript', parse);
  assert.equal(parse(regular(join(helper, 'package.json'))).version, selected.agentfootprint, 'example source version differs from packed AF');
  const compiler = parse(regular(join(compilerRoot, 'package.json')));
  assert.equal(compiler.version, compilerLock.version);
  const entry = resolve(compilerRoot, compiler.bin.tsc);
  assert(entry.startsWith(compilerRoot + '/'), 'compiler entry escapes package');
  return { packages: census.packages, ownerRoots, dependencyNamespaces: census.dependencyNamespaces,
    links: census.links, hiddenLocks: hidden.map(({ path, sha256 }) => ({ path, sha256 })),
    sourceMembers, originalFamilyImages, rendererImage: { count: renderer.length, censusSha256: hash(JSON.stringify(renderer)) },
    exampleSource: exampleSource(helper, inputs.producers.agentfootprint.source, parse),
    familyImages: Object.values(owners).map(row => ({ name: row.name, root: row.root,
      censusSha256: hash(JSON.stringify(inventory(row.root, { dependencies: true }))) })),
    nativeLockSha256: hash(nativeLock), compiler: { root: compilerRoot, version: compiler.version,
      manifestSha256: hash(regular(join(compilerRoot, 'package.json'))), entry,
      entrySha256: hash(regular(entry)), imageSha256: hash(JSON.stringify(inventory(compilerRoot))) } };
}
