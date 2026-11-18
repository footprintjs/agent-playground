// Source and file boundaries only. No network, package loading or installation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants, openSync, closeSync, fstatSync, readFileSync, writeFileSync,
  ftruncateSync, fchmodSync, realpathSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const documents = ['package.json', 'package-lock.json'];
export const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export const git = (root, args) => execFileSync('git', ['-C', root, ...args],
  { timeout: 10000, maxBuffer: 16 * 1024 * 1024 });

export function requireWorkflow(env, { token = false } = {}) {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Actions workflow required');
  assert.equal(env.GITHUB_REPOSITORY, 'footprintjs/agent-playground', 'intended repository required');
  if (token) assert(typeof env.GH_TOKEN === 'string' && env.GH_TOKEN.length > 0, 'workflow token required');
  else for (const name of ['GH_TOKEN', 'GITHUB_TOKEN']) {
    assert(!Object.hasOwn(env, name), 'package stage must have no API token');
  }
}

export function regular(file, limit = 64 * 1024 * 1024) {
  assert.equal(realpathSync(file), resolve(file), 'aliased file');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    assert(before.isFile() && before.nlink === 1 && before.size <= limit, 'regular bounded file required');
    const data = readFileSync(fd), after = fstatSync(fd);
    assert(data.length === before.size && after.size === before.size &&
      before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'file changed during read');
    return data;
  } finally { closeSync(fd); }
}

export function requireOutside(root, out) {
  assert(isAbsolute(out) && resolve(out) === out, 'normalized absolute proof directory required');
  const path = relative(root, out);
  assert(path === '..' || path.startsWith('..' + sep) || isAbsolute(path), 'proof directory must be outside source');
  assert.equal(realpathSync(dirname(out)), dirname(out), 'aliased proof parent');
}

export function clean(root) {
  git(root, ['diff', '--exit-code', '--']);
  git(root, ['diff', '--cached', '--exit-code', '--']);
  assert.equal(git(root, ['ls-files', '--others', '--exclude-standard']).length, 0, 'untracked source');
}

export function requireAbsent(path) {
  try { lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  assert.fail('fresh dependency namespace required'); // Includes dangling symlinks.
}

export function sourceIdentity(root) {
  clean(root);
  return { head: git(root, ['rev-parse', 'HEAD']).toString().trim(),
    tree: git(root, ['rev-parse', 'HEAD^{tree}']).toString().trim() };
}

export function originalDocuments(root) {
  clean(root);
  return Object.fromEntries(documents.map(path => {
    const bytes = regular(join(root, path)), committed = git(root, ['show', 'HEAD:' + path]);
    const mode = parseInt(git(root, ['ls-tree', 'HEAD', '--', path]).toString().split(' ')[0], 8) & 0o7777;
    assert.deepEqual(bytes, committed, 'document differs from immutable Git');
    assert.equal(lstatSync(join(root, path)).mode & 0o7777, mode, 'document mode differs from Git');
    return [path, { bytes, mode }];
  }));
}

export function replaceDocument(path, bytes, mode) {
  assert.equal(realpathSync(path), resolve(path), 'aliased destination');
  const fd = openSync(path, constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd); assert(before.isFile() && before.nlink === 1, 'regular destination required');
    ftruncateSync(fd, 0); writeFileSync(fd, bytes); fchmodSync(fd, mode);
  } finally { closeSync(fd); }
}

export function restoreDocuments(root, originals) {
  assert.deepEqual(Object.keys(originals).sort(), [...documents].sort());
  const failures = [];
  for (const [path, { bytes, mode }] of Object.entries(originals)) {
    try {
      replaceDocument(join(root, path), bytes, mode);
      assert.deepEqual(regular(join(root, path)), bytes);
      assert.equal(lstatSync(join(root, path)).mode & 0o7777, mode);
    } catch { failures.push(path); }
  }
  assert.equal(failures.length, 0, 'source document restoration failed');
}

export function npmEnvironment(out, env) {
  const user = join(out, 'empty-user-npmrc'), global = join(out, 'empty-global-npmrc');
  for (const file of [user, global]) writeFileSync(file, '', { flag: 'wx', mode: 0o600 });
  return { ...Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL']
    .filter(key => typeof env[key] === 'string').map(key => [key, env[key]])),
    NPM_CONFIG_USERCONFIG: user, NPM_CONFIG_GLOBALCONFIG: global,
    NPM_CONFIG_CACHE: join(out, 'npm-cache'), NPM_CONFIG_UPDATE_NOTIFIER: 'false' };
}

export function exampleSource(root, expected, parse) {
  assert.equal(realpathSync(root), resolve(root), 'aliased example source');
  assert.deepEqual(sourceIdentity(root), { head: expected.head, tree: expected.tree }, 'example source must be admitted AF head');
  assert.equal(git(root, ['ls-files', '--others', '--ignored', '--exclude-standard']).length, 0, 'untracked ignored example input');
  const manifest = regular(join(root, 'package.json')), lock = regular(join(root, 'package-lock.json'));
  assert.equal(hash(manifest), expected.manifestSha256); assert.equal(hash(lock), expected.lockSha256);
  assert.equal(parse(manifest).name, 'agentfootprint');
  // Record every tracked source member, including modes, without importing the example helper.
  const files = git(root, ['ls-files', '-z']).toString().split('\0').filter(Boolean).sort().map(path => {
    const file = join(root, path), stat = lstatSync(file);
    assert(stat.isFile() && !stat.isSymbolicLink(), 'linked example source');
    return { path, mode: stat.mode & 0o7777, sha256: hash(regular(file)) };
  });
  return { head: expected.head, tree: expected.tree, members: files.length, censusSha256: hash(JSON.stringify(files)) };
}
