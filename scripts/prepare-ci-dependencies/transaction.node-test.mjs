import assert from 'node:assert/strict';
import { chmodSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fixture } from './guard-fixtures.mjs';
import { hash, originalDocuments, replaceDocument } from './filesystem.mjs';
import { fetchInputs, prepare, readCheckpoint, verify, withOriginalDocuments } from './transaction.mjs';

test('unqualified fixed inputs refuse all three stages before filesystem, API or package effects', () => {
  const f = fixture();
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'footprintjs/agent-playground' };
  try {
    for (const command of [fetchInputs, prepare, verify]) {
      assert.throws(() => command({ root: join(f.base, 'source-does-not-exist'),
        helper: '/absent-source', out: join(f.out, 'not-created'), inspectorRoot: '/absent-inspector',
        inputs: { status: 'PENDING_QUALIFIED_LENS_AND_RENDERER' },
        env: command === fetchInputs ? { ...env, GH_TOKEN: 'inert-not-an-authentication' } : env }), /qualified Lens and renderer/);
    }
    assert.deepEqual(readdirSync(f.out), []);
    for (const command of [fetchInputs, prepare, verify]) assert.throws(() => command({ env: {}, inputs: {} }), /Actions workflow/);
  } finally { f.close(); }
});

test('partial projection/lock failure restores original source bytes and modes and keeps failure distinct', () => {
  const f = fixture();
  try {
    const originals = originalDocuments(f.root); let receipt;
    assert.throws(() => withOriginalDocuments(f.root, originals, () => {
      replaceDocument(join(f.root, 'package.json'), Buffer.from('{"temporary":true}'), 0o600);
      writeFileSync(join(f.root, 'package-lock.json'), 'partially generated lock');
      chmodSync(join(f.root, 'package-lock.json'), 0o600);
      throw new Error('controlled partial installation failure');
    }, result => { receipt = result; }), error => error instanceof AggregateError &&
      error.errors.some(e => e.message === 'controlled partial installation failure'));
    assert.equal(receipt.setupFailed, true); assert.equal(receipt.restorationFailed, false);
    assert(receipt.restored.every(row => row.actualSha256 === row.expectedSha256 && row.actualMode === row.expectedMode));
    assert.deepEqual(originalDocuments(f.root), originals);
  } finally { f.close(); }
});

test('external prior-step checkpoint digest refuses coordinated mutable state changes', () => {
  const f = fixture();
  try {
    const file = join(f.out, 'state.json'), initial = Buffer.from('{"admitted":"original","initial":"original"}');
    writeFileSync(file, initial); assert.deepEqual(readCheckpoint(file, hash(initial)), initial);
    writeFileSync(file, '{"admitted":"forged","initial":"forged"}');
    assert.throws(() => readCheckpoint(file, hash(initial)), /checkpoint changed/);
    assert.throws(() => readCheckpoint(file), /prior-step checkpoint/);
  } finally { f.close(); }
});

test('legitimate full member checkpoints use their explicit bounded JSON budget, not the manifest default', () => {
  const f = fixture();
  try {
    const port = process.env.NATIVE_ARCHIVE_PORT;
    assert(port, 'pinned shared DATA reader required for this source control');
    const { parseStrictJson } = createRequire(import.meta.url)(join(port, 'strict-json.cjs'));
    const data = { files: Array.from({ length: 11434 }, (_, i) => ({ path: 'package/dist/' + i + '-member.js',
      size: 1, sha256: '0'.repeat(64) })) };
    const bytes = Buffer.from(JSON.stringify(data)), path = join(f.out, 'large-state.json');
    assert(bytes.length > 1024 * 1024 && bytes.length < 8 * 1024 * 1024);
    assert.throws(() => parseStrictJson(bytes)); // Actual old manifest-default refusal, not malformed JSON.
    writeFileSync(path, bytes);
    assert.deepEqual(readCheckpoint(path, hash(bytes), parseStrictJson), data);
  } finally { f.close(); }
});
