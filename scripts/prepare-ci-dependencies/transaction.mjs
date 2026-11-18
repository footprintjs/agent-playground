// Fixed native transaction: fetch DATA, install a disposable projection, restore, then observe.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, lstatSync, mkdirSync, openSync, realpathSync,
  symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { requireInputs, roles } from './admission.mjs';
import { clean, documents, exampleSource, hash, jsonBytes, npmEnvironment, originalDocuments,
  regular, replaceDocument, requireAbsent, requireOutside, requireWorkflow, restoreDocuments, sourceIdentity } from './filesystem.mjs';
import { prepareCiManifest, refreshRegistryOrigins } from './projection.mjs';
import { nativeDependencyLayout } from './namespaces.mjs';
import { inspectInstalled, requireSelectedOrigins } from './installed.mjs';
import { dataPort, fetchInput, savedInput } from './transport.mjs';

const strictNpm = ['--strict-peer-deps', '--legacy-peer-deps=false', '--force=false', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org'];
export const nativeLockArguments = () => ['install', '--package-lock-only', '--ignore-scripts', ...strictNpm];

function readInputs(root, inputs, out, port) {
  const admitted = {}, archives = {};
  for (const role of roles) {
    const item = savedInput(root, inputs.producers[role], join(out, role), port, inputs);
    admitted[role] = item.admitted; archives[role] = item.archive;
  }
  return { admitted, archives };
}

export function preflight({ root, helper, inspectorRoot, inputs, env = process.env }) {
  requireWorkflow(env); requireInputs(inputs); // No API, npm, output directory or archive staging.
  root = realpathSync(root); helper = realpathSync(helper);
  const port = dataPort(inspectorRoot), consumer = sourceIdentity(root);
  originalDocuments(root);
  const examples = exampleSource(helper, inputs.producers.agentfootprint.source, port.parseStrictJson);
  return { status: 'FIXED_SOURCE_POLICY_QUALIFIED', consumer, inputsSha256: hash(JSON.stringify(inputs)),
    exampleSource: examples, qualification: 'Metadata/source preflight only; provider/data/setup/consumer checks remain required' };
}

export function fetchInputs({ root, out, inspectorRoot, inputs, env = process.env }) {
  requireWorkflow(env, { token: true }); requireInputs(inputs); // Before filesystem/API effects.
  root = realpathSync(root); clean(root); requireOutside(root, out);
  const port = dataPort(inspectorRoot);
  mkdirSync(out, { mode: 0o700 });
  for (const role of roles) fetchInput(root, inputs.producers[role], join(out, role), port, env, inputs);
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

export function verifyNativeGraph(root, out, env) {
  npm(root, out, env, 'native-graph', ['ls', 'agentfootprint', 'agentfootprint-lens', 'footprint-explainable-ui',
    'footprintjs', 'foottrace', 'contextfootprint', '--all'], 30000);
  return nativeGraphProof(out);
}

export function nativeGraphProof(out, expected) {
  const proof = { receiptSha256: hash(regular(join(out, 'native-graph.json'))),
    logSha256: hash(regular(join(out, 'native-graph.log'))) };
  if (expected) assert.deepEqual(proof, expected, 'mandatory native graph proof changed');
  return proof;
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
  const baseline = port.parseStrictJson(originals['package-lock.json'].bytes, { maxBytes: 8 * 1024 * 1024 });
  const refresh = refreshRegistryOrigins(baseline, port.parseManifest(projected));
  if (refresh.removed.length) replaceDocument(join(root, 'package-lock.json'), jsonBytes(refresh.lock), originals['package-lock.json'].mode);
  writeFileSync(join(out, 'origin-refresh.json'), jsonBytes({ removed: refresh.removed,
    qualification: 'Same-version authored source-link to exact-registry origin refresh; npm authors replacements' }), { flag: 'wx', mode: 0o600 });
  const childEnv = npmEnvironment(out, env);
  npm(root, out, childEnv, 'lock-update', nativeLockArguments(), 90000);
  const nativeLock = regular(join(root, 'package-lock.json'), 8 * 1024 * 1024);
  const updated = port.parseStrictJson(nativeLock, { maxBytes: 8 * 1024 * 1024 });
  assert.deepEqual(updated.packages['node_modules/typescript'], baseline.packages['node_modules/typescript'], 'compiler baseline changed');
  writeFileSync(join(out, 'native-package-lock.json'), nativeLock, { flag: 'wx', mode: 0o600 });
  requireSelectedOrigins(updated, inputs, archives, admitted, root); // Reject stale/unqualified sources BEFORE install.
  npm(root, out, childEnv, 'strict-ci', ['ci', '--ignore-scripts=false', ...strictNpm], 300000);
  assert.deepEqual(regular(join(root, 'package.json')), projected, 'setup manifest changed');
  assert.deepEqual(regular(join(root, 'package-lock.json')), nativeLock, 'install changed native lock');
  const nativeGraph = verifyNativeGraph(root, out, childEnv); // Same mandatory check, while requests match the native install.
  const plan = nativeDependencyLayout(root, helper);
  symlinkSync(plan.sharedLink.target, plan.sharedLink.path);
  const initial = inspectInstalled({ root, helper, originalLock: originals['package-lock.json'].bytes,
    nativeLock, admitted, archives, inputs, port });
  return { nativeLock, initial, nativeGraph };
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
  const { nativeLock, initial, nativeGraph } = installed;
  const state = { consumer, inputsSha256: hash(JSON.stringify(inputs)), admitted, archives, initial, nativeGraph,
    originalHashes: Object.fromEntries(documents.map(path => [path, hash(originals[path].bytes)])),
    originalModes: Object.fromEntries(documents.map(path => [path, originals[path].mode])),
    projectedSha256: hash(projected), nativeLockSha256: hash(nativeLock) };
  const checkpointSha256 = hash(jsonBytes(state));
  writeFileSync(join(out, 'native-state.json'), jsonBytes(state), { flag: 'wx', mode: 0o600 });
  writeFileSync(join(out, 'setup-receipt.json'), jsonBytes({ consumer, checkpointSha256, nativeGraph,
    originalHashes: state.originalHashes, originalModes: state.originalModes, projectedSha256: state.projectedSha256,
    nativeLockSha256: state.nativeLockSha256, observed: { packages: initial.packages,
      sourceMembers: initial.sourceMembers, originalFamilyImages: initial.originalFamilyImages,
      rendererImage: initial.rendererImage, exampleSource: initial.exampleSource, compiler: initial.compiler,
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
  nativeGraphProof(out, state.nativeGraph);
  const current = inspectInstalled({ root, helper, nativeLock, originalLock: originals['package-lock.json'].bytes,
    admitted: fresh.admitted, archives: fresh.archives, inputs, port });
  assert.deepEqual(current, state.initial, 'source/install/compiler/locks changed during consumer gates');
  return { status: 'SOURCE_INPUTS_UNCHANGED', consumer: state.consumer, nativeLockSha256: state.nativeLockSha256,
    qualification: 'Byte/owner guard only; consumer command results are separate' };
}
