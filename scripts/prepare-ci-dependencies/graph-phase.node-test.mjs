// Real npm ls over inert fixture files only. No dependency install, archive or package execution.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, delimiter } from 'node:path';
import test from 'node:test';
import { fixture } from './guard-fixtures.mjs';
import { authoredLinks } from './projection.mjs';
import { jsonBytes, npmEnvironment, originalDocuments, replaceDocument } from './filesystem.mjs';
import { nativeGraphProof, verifyNativeGraph, withOriginalDocuments } from './transaction.mjs';

test('mandatory native graph succeeds before restoration, while the same command refuses restored source-link requests', () => {
  const f = fixture();
  try {
    const path = join(f.root, 'package.json');
    const authored = { name: 'agent-playground', version: '0.1.0', private: true,
      dependencies: { ...f.selected, ...authoredLinks } };
    writeFileSync(path, jsonBytes(authored)); f.run(f.root, 'add', 'package.json');
    f.run(f.root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'authored source links');
    const originals = originalDocuments(f.root), good = join(f.out, 'native'), bad = join(f.out, 'restored');
    mkdirSync(good); mkdirSync(bad);
    const env = folder => ({ ...npmEnvironment(folder, { ...process.env,
      PATH: dirname(process.execPath) + delimiter + process.env.PATH }), NPM_CONFIG_OFFLINE: 'true' });
    const goodEnv = env(good), badEnv = env(bad);
    const graph = withOriginalDocuments(f.root, originals, () => {
      replaceDocument(path, jsonBytes({ ...authored, dependencies: f.selected }), originals['package.json'].mode);
      return verifyNativeGraph(f.root, good, goodEnv);
    }, () => {});
    assert.equal(JSON.parse(readFileSync(join(good, 'native-graph.json'))).exitCode, 0);
    assert.deepEqual(originalDocuments(f.root), originals);
    nativeGraphProof(good, graph);
    writeFileSync(join(good, 'native-graph.log'), 'forged graph success');
    assert.throws(() => nativeGraphProof(good, graph), /graph proof changed/);
    assert.throws(() => verifyNativeGraph(f.root, bad, badEnv), /native-graph failed/);
    assert.equal(JSON.parse(readFileSync(join(bad, 'native-graph.json'))).exitCode, 1);
    assert.match(readFileSync(join(bad, 'native-graph.log'), 'utf8'), /ELSPROBLEMS/);
  } finally { f.close(); }
});

test('workflow leaves the four original commands after PREPARE and contains no restored-origin npm ls duplicate', () => {
  const text = readFileSync(new URL('../../.github/workflows/checks.yml', import.meta.url), 'utf8');
  const prepare = text.indexOf('node scripts/prepare-ci-dependencies.mjs prepare');
  for (const command of ['npm test', 'npm run test:types', 'npm run lint', 'npm run build']) {
    assert(text.indexOf('- run: ' + command) > prepare);
  }
  assert(!/^\s*run: npm ls /m.test(text));
});
