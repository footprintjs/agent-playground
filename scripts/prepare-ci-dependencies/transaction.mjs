// Fixed native transaction: fetch DATA, install a disposable projection, restore, then observe.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, lstatSync, mkdirSync, openSync, realpathSync,
  symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { requireInputs, roles } from './admission.mjs';
import { clean, documents, exampleSource, hash, jsonBytes, npmEnvironment, originalDocuments,
  regular, replaceDocument, requireAbsent, requireOutside, requireWorkflow, restoreDocuments, sourceIdentity } from './filesystem.mjs';
import { prepareCiManifest } from './projection.mjs';
import { nativeDependencyLayout } from './namespaces.mjs';
import { inspectInstalled } from './installed.mjs';
import { dataPort, fetchInput, savedInput } from './transport.mjs';

function readInputs(root, inputs, out, port) {
  const admitted = {}, archives = {};
  for (const role of roles) {
    const item = savedInput(root, inputs.producers[role], join(out, role), port);
    admitted[role] = item.admitted; archives[role] = item.archive;
  }
  return { admitted, archives };
}

export function fetchInputs({ root, out, inspectorRoot, inputs, env = process.env }) {
  requireWorkflow(env, { token: true }); requireInputs(inputs); // Before filesystem/API effects.
  root = realpathSync(root); clean(root); requireOutside(root, out);
  const port = dataPort(inspectorRoot);
  mkdirSync(out, { mode: 0o700 });
  for (const role of roles) fetchInput(root, inputs.producers[role], join(out, role), port, env);
  return { status: 'SOURCE_DATA_FETCHED', inputsSha256: hash(JSON.stringify(inputs)),
    qualification: 'DATA transport only; no installation or compatibility claim' };
}

function npm(root, out, env, step, args, timeout) {
  const fd = openSync(join(out, step + '.log'), 'wx', 0o600);
  let result;
  try { result = spawnSync('npm', args, { cwd: root, env, timeout, stdio: ['ignore', fd, fd] }); }
  finally { closeSync(fd); }
  writeFileSync(join(out, step + '.json'), jsonBytes({ step, args, exitCode: result.status,
    signal: result.signal, toolError: Boolean(result.error) }), { flag: 'wx', mode: 0o600 });
  assert(!result.error && !result.signal && result.status === 0, step + ' failed');
}

/** Unconditional byte/mode restoration is also used on partial-lock/install refusal. */
export function withOriginalDocuments(root, originals, work, report) {
  let value, setupFailure, restorationFailure;
  try { value = work(); } catch (error) { setupFailure = error; }
  finally {
    try { restoreDocuments(root, originals); originalDocuments(root); }
    catch (error) { restorationFailure = error; }
    report({ setupFailed: Boolean(setupFailure), restorationFailed: Boolean(restorationFailure),
      restored: documents.map(path => {
        let actualSha256 = null, actualMode = null;
        try { actualSha256 = hash(regular(join(root, path))); actualMode = lstatSync(join(root, path)).mode & 0o7777; } catch {}
        return { path, expectedSha256: hash(originals[path].bytes), actualSha256,
          expectedMode: originals[path].mode, actualMode };
      }) });
  }
  if (setupFailure || restorationFailure) throw new AggregateError(
    [setupFailure, restorationFailure].filter(Boolean), 'native setup refused');
  return value;
}

function install({ root, helper, out, inputs, env, port, originals, projected, admitted, archives }) {
  replaceDocument(join(root, 'package.json'), projected, originals['package.json'].mode);
  const childEnv = npmEnvironment(out, env);
  const strict = ['--strict-peer-deps', '--legacy-peer-deps=false', '--force=false', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org'];
  npm(root, out, childEnv, 'lock-update', ['update', '--package-lock-only', '--ignore-scripts', ...strict,
    'agentfootprint', 'agentfootprint-lens', 'footprint-explainable-ui', 'footprintjs', 'foottrace'], 90000);
  const nativeLock = regular(join(root, 'package-lock.json'), 8 * 1024 * 1024);
  const baseline = port.parseStrictJson(originals['package-lock.json'].bytes, { maxBytes: 8 * 1024 * 1024 });
  const updated = port.parseStrictJson(nativeLock, { maxBytes: 8 * 1024 * 1024 });
  assert.deepEqual(updated.packages['node_modules/typescript'], baseline.packages['node_modules/typescript'], 'compiler baseline changed');
  writeFileSync(join(out, 'native-package-lock.json'), nativeLock, { flag: 'wx', mode: 0o600 });
  npm(root, out, childEnv, 'strict-ci', ['ci', '--ignore-scripts=false', ...strict], 300000);
  assert.deepEqual(regular(join(root, 'package.json')), projected, 'setup manifest changed');
  assert.deepEqual(regular(join(root, 'package-lock.json')), nativeLock, 'install changed native lock');
  const plan = nativeDependencyLayout(root, helper);
  symlinkSync(plan.sharedLink.target, plan.sharedLink.path);
  const initial = inspectInstalled({ root, helper, originalLock: originals['package-lock.json'].bytes,
    nativeLock, admitted, archives, inputs, port });
  return { nativeLock, initial };
}

export function prepare({ root, helper, out, inspectorRoot, inputs, env = process.env }) {
  requireWorkflow(env); requireInputs(inputs); // Missing qualification cannot reach an install.
  root = realpathSync(root); helper = realpathSync(helper); requireOutside(root, out);
  assert.equal(realpathSync(out), out); assert(lstatSync(out).isDirectory());
  const plan = nativeDependencyLayout(root, helper);
  for (const path of [...plan.dependencyNamespaces, plan.sharedLink.path]) requireAbsent(path);
  const port = dataPort(inspectorRoot), consumer = sourceIdentity(root), originals = originalDocuments(root);
  exampleSource(helper, inputs.producers.agentfootprint.source, port.parseStrictJson);
  const fd = openSync(join(out, 'prepare-attempt'), 'wx', 0o600); closeSync(fd);
  const { admitted, archives } = readInputs(root, inputs, out, port);
  const policy = { status: 'NATIVE_SOURCE_READY', archives, renderer: {
    package: inputs.renderer.package, version: inputs.renderer.version, integrity: inputs.renderer.integrity } };
  const projected = jsonBytes(prepareCiManifest(port.parseManifest(originals['package.json'].bytes), policy));
  writeFileSync(join(out, 'originals.json'), jsonBytes(Object.fromEntries(documents.map(path => [path,
    { bytes: originals[path].bytes.toString('base64'), mode: originals[path].mode }]))), { flag: 'wx', mode: 0o600 });
  writeFileSync(join(out, 'setup-manifest.json'), projected, { flag: 'wx', mode: 0o600 });
  let installed;
  try {
    installed = withOriginalDocuments(root, originals,
      () => install({ root, helper, out, inputs, env, port, originals, projected, admitted, archives }),
      receipt => writeFileSync(join(out, 'restoration.json'), jsonBytes(receipt), { flag: 'wx', mode: 0o600 }));
  } catch (error) {
    // Remove only the exact link this attempt could have created. Never remove another dependency tree.
    try { if (lstatSync(plan.sharedLink.path).isSymbolicLink() && realpathSync(plan.sharedLink.path) === plan.sharedLink.target) unlinkSync(plan.sharedLink.path); }
    catch (cleanup) { if (cleanup.code !== 'ENOENT') throw new AggregateError([error, cleanup], 'setup cleanup failed'); }
    throw error;
  }
  const { nativeLock, initial } = installed;
  const state = { consumer, inputsSha256: hash(JSON.stringify(inputs)), admitted, archives, initial,
    originalHashes: Object.fromEntries(documents.map(path => [path, hash(originals[path].bytes)])),
    originalModes: Object.fromEntries(documents.map(path => [path, originals[path].mode])),
    projectedSha256: hash(projected), nativeLockSha256: hash(nativeLock) };
  const checkpointSha256 = hash(jsonBytes(state));
  writeFileSync(join(out, 'native-state.json'), jsonBytes(state), { flag: 'wx', mode: 0o600 });
  writeFileSync(join(out, 'setup-receipt.json'), jsonBytes({ consumer, checkpointSha256,
    originalHashes: state.originalHashes, originalModes: state.originalModes, projectedSha256: state.projectedSha256,
    nativeLockSha256: state.nativeLockSha256, observed: { packages: initial.packages,
      sourceMembers: initial.sourceMembers, exampleSource: initial.exampleSource, compiler: initial.compiler,
      dependencyNamespaces: initial.dependencyNamespaces, hiddenLocks: initial.hiddenLocks,
      ownerRoots: initial.ownerRoots, linksSha256: hash(JSON.stringify(initial.links)),
      familyImages: initial.familyImages }, qualification: 'Setup only; all four original consumer gates remain required' }), { flag: 'wx', mode: 0o600 });
  return { status: 'SOURCE_SETUP_COMPLETE', consumer, checkpointSha256, nativeLockSha256: state.nativeLockSha256 };
}

export function readCheckpoint(path, expected, parse) {
  assert.match(expected, /^[a-f0-9]{64}$/, 'prior-step checkpoint digest required');
  const bytes = regular(path, 8 * 1024 * 1024); assert.equal(hash(bytes), expected, 'checkpoint changed');
  return parse ? parse(bytes, { maxBytes: 8 * 1024 * 1024, maxValues: 200000 }) : bytes;
}

export function verify({ root, helper, out, inspectorRoot, inputs, expectedCheckpoint, env = process.env }) {
  requireWorkflow(env); requireInputs(inputs);
  root = realpathSync(root); helper = realpathSync(helper); requireOutside(root, out);
  const port = dataPort(inspectorRoot), state = readCheckpoint(join(out, 'native-state.json'), expectedCheckpoint, port.parseStrictJson);
  const fresh = readInputs(root, inputs, out, port); // Re-hash originals and re-admit against fixed source policy.
  assert.deepEqual(state.admitted, fresh.admitted); assert.deepEqual(state.archives, fresh.archives);
  assert.equal(state.inputsSha256, hash(JSON.stringify(inputs)));
  assert.deepEqual(state.consumer, sourceIdentity(root));
  const originals = originalDocuments(root);
  for (const path of documents) {
    assert.equal(hash(originals[path].bytes), state.originalHashes[path]);
    assert.equal(originals[path].mode, state.originalModes[path]);
  }
  const nativeLock = regular(join(out, 'native-package-lock.json'), 8 * 1024 * 1024);
  assert.equal(hash(nativeLock), state.nativeLockSha256);
  assert.equal(hash(regular(join(out, 'setup-manifest.json'))), state.projectedSha256);
  const current = inspectInstalled({ root, helper, nativeLock, originalLock: originals['package-lock.json'].bytes,
    admitted: fresh.admitted, archives: fresh.archives, inputs, port });
  assert.deepEqual(current, state.initial, 'source/install/compiler/locks changed during consumer gates');
  return { status: 'SOURCE_INPUTS_UNCHANGED', consumer: state.consumer, nativeLockSha256: state.nativeLockSha256,
    qualification: 'Byte/owner guard only; consumer command results are separate' };
}
