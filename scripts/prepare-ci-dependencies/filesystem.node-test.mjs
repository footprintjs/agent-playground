import assert from 'node:assert/strict';
import { chmodSync, lstatSync, readFileSync, readdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { clean, exampleSource, hash, npmEnvironment, originalDocuments, regular,
  replaceDocument, requireAbsent, requireOutside, requireWorkflow, restoreDocuments, sourceIdentity } from './filesystem.mjs';
import { fixture } from './guard-fixtures.mjs';

test('workflow and exact repository are required; token is confined to the API stage', () => {
  const good = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'footprintjs/agent-playground' };
  requireWorkflow(good);
  for (const bad of [{}, { ...good, GITHUB_ACTIONS: 'false' }, { ...good, GITHUB_REPOSITORY: 'other/repo' }]) {
    assert.throws(() => requireWorkflow(bad));
  }
  assert.throws(() => requireWorkflow({ ...good, GH_TOKEN: 'inert-fixture' }));
  assert.throws(() => requireWorkflow(good, { token: true }));
  requireWorkflow({ ...good, GH_TOKEN: 'inert-fixture' }, { token: true });
});

test('source restoration preserves exact committed bytes and file modes even after partial setup failure', () => {
  const f = fixture();
  try {
    const originals = originalDocuments(f.root);
    assert.throws(() => {
      try {
        replaceDocument(join(f.root, 'package.json'), Buffer.from('{"projected":true}'), 0o600);
        writeFileSync(join(f.root, 'package-lock.json'), 'partial lock');
        throw new Error('controlled setup failure');
      } finally { restoreDocuments(f.root, originals); }
    }, /controlled setup failure/);
    assert.deepEqual(originalDocuments(f.root), originals);
    assert.equal(lstatSync(join(f.root, 'package.json')).mode & 0o7777, 0o644);
    chmodSync(join(f.root, 'package.json'), 0o600);
    assert.throws(() => originalDocuments(f.root), /mode differs/);
    restoreDocuments(f.root, originals);
  } finally { f.close(); }
});

test('staged-only mutation with working bytes restored is still dirty', () => {
  const f = fixture();
  try {
    const path = join(f.root, 'package.json'), original = readFileSync(path);
    writeFileSync(path, '{"staged":true}'); f.run(f.root, 'add', 'package.json'); writeFileSync(path, original);
    assert.throws(() => clean(f.root));
  } finally { f.close(); }
});

test('proof output cannot hide inside source and npm configs are separate, empty and credential-free', () => {
  const f = fixture();
  try {
    requireOutside(f.root, f.out);
    assert.throws(() => requireOutside(f.root, join(f.root, '..evil')), /outside source/);
    const env = npmEnvironment(f.out, { PATH: process.env.PATH, HOME: process.env.HOME,
      GH_TOKEN: 'fixture-secret', NODE_OPTIONS: '--require=must-not-execute', npm_config_force: 'true' });
    assert.notEqual(env.NPM_CONFIG_USERCONFIG, env.NPM_CONFIG_GLOBALCONFIG);
    assert.equal(readFileSync(env.NPM_CONFIG_USERCONFIG).length, 0);
    assert.equal(readFileSync(env.NPM_CONFIG_GLOBALCONFIG).length, 0);
    for (const forbidden of ['GH_TOKEN', 'NODE_OPTIONS', 'npm_config_force']) assert(!Object.hasOwn(env, forbidden));
    assert.deepEqual(readdirSync(f.out).sort(), ['empty-global-npmrc', 'empty-user-npmrc']);
  } finally { f.close(); }
});

test('a dangling dependency link is not mistaken for an absent namespace', () => {
  const f = fixture();
  try {
    const path = join(f.helper, 'node_modules'); requireAbsent(path);
    symlinkSync(join(f.base, 'missing-target'), path);
    assert.throws(() => requireAbsent(path), /fresh dependency namespace/);
  } finally { f.close(); }
});

test('example helper binds actual AF source HEAD, raw documents and every tracked source byte, including ignored injection refusal', () => {
  const f = fixture();
  try {
    const expected = { ...sourceIdentity(f.helper), manifestSha256: hash(regular(join(f.helper, 'package.json'))),
      lockSha256: hash(regular(join(f.helper, 'package-lock.json'))) };
    const observed = exampleSource(f.helper, expected, JSON.parse);
    assert.equal(observed.members, 3); assert.equal(observed.tree, expected.tree);
    assert.throws(() => exampleSource(f.helper, { ...expected, head: '0'.repeat(40) }, JSON.parse));
    f.put(join(f.helper, 'ignored', 'hidden.ts'), 'throw new Error("unadmitted source");');
    assert.throws(() => exampleSource(f.helper, expected, JSON.parse), /ignored example input/);
  } finally { f.close(); }
});
