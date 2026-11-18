// One-attempt read-only workflow-token transport; package stages only re-admit saved DATA.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSPECTOR_HEAD, admitArchive, verifyProvider } from './admission.mjs';
import { clean, git, hash, jsonBytes, regular } from './filesystem.mjs';

export function dataPort(root) {
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), INSPECTOR_HEAD);
  clean(root);
  const require = createRequire(import.meta.url), path = resolve(root, 'src/release-route/archive');
  return { ...require(join(path, 'inspector.cjs')), ...require(join(path, 'strict-json.cjs')) };
}

function api(directory, env, port) {
  const config = join(directory, 'empty-gh-config'); mkdirSync(config, { mode: 0o700 });
  const childEnv = { ...Object.fromEntries(['HOME', 'PATH', 'LANG', 'LC_ALL']
    .filter(key => typeof env[key] === 'string').map(key => [key, env[key]])),
    GH_TOKEN: env.GH_TOKEN, GH_HOST: 'github.com', GH_CONFIG_DIR: config,
    GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat' };
  function get(path, output) {
    try {
      return execFileSync('gh', ['api', path], { env: childEnv, timeout: 60000,
        maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', output ?? 'pipe', 'pipe'] });
    } catch (error) {
      const status = /(?:HTTP |status code: )(403|404)/.exec(error.stderr?.toString() ?? '')?.[1];
      throw new Error(status ? `producer-read-${status}` : 'producer-read-failed');
    }
  }
  return { json: path => port.parseStrictJson(get(path), { maxBytes: 8 * 1024 * 1024 }),
    zip(path, file) {
      const fd = openSync(file, 'wx', 0o600);
      try { get(path, fd); } finally { closeSync(fd); }
    } };
}

function namedBodies(root, input, directory, command) {
  const original = join(directory, 'ORIGINAL.zip'), bytes = regular(original);
  assert.equal(bytes.length, input.sourceArtifact.size_in_bytes);
  assert.equal('sha256:' + hash(bytes), input.sourceArtifact.digest, 'outer archive changed');
  const out = join(directory, 'original');
  const expected = { filename: input.archive.filename, size: bytes.length, sha256: hash(bytes) };
  execFileSync('python3', ['-B', join(root, 'scripts/native_source_zip.py'), command, original,
    JSON.stringify(expected), out], { timeout: 60000, maxBuffer: 4096, stdio: ['ignore', 'pipe', 'pipe'] });
  const files = Object.fromEntries([input.archive.filename, 'candidate.json', 'source-package.json', 'source-package-lock.json']
    .map(name => [name, regular(join(out, name), name.endsWith('.tgz') ? 32 * 1024 * 1024 : 8 * 1024 * 1024)]));
  return { out, files };
}

export function savedInput(root, input, directory, port) {
  const provider = port.parseStrictJson(regular(join(directory, 'provider.json')), { maxBytes: 8 * 1024 * 1024 });
  verifyProvider(input, provider);
  const { out, files } = namedBodies(root, input, directory, 'verify');
  return { archive: join(out, input.archive.filename), admitted: admitArchive(input, files, port) };
}

export function fetchInput(root, input, directory, port, env) {
  mkdirSync(directory, { mode: 0o700 });
  const client = api(directory, env, port), base = 'repos/' + input.repository;
  const run = client.json(`${base}/actions/runs/${input.run.id}`);
  const jobs = client.json(`${base}/actions/runs/${input.run.id}/attempts/${input.run.run_attempt}/jobs?per_page=100`);
  const provider = { run, jobs, job: jobs.jobs.find(row => row.id === input.sourceJob.id),
    artifact: client.json(`${base}/actions/artifacts/${input.sourceArtifact.id}`),
    sourceCommit: client.json(`${base}/git/commits/${input.source.head}`),
    testedCommit: client.json(`${base}/git/commits/${input.tested.head}`) };
  verifyProvider(input, provider); // Mismatch refuses before the original binary read.
  const commit = ({ sha, tree, parents }) => ({ sha, tree: { sha: tree.sha }, parents: parents.map(p => ({ sha: p.sha })) });
  const job = row => Object.fromEntries(['id', 'name', 'status', 'conclusion', 'run_id', 'run_attempt', 'head_sha']
    .filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]));
  const safe = { ...provider, sourceCommit: commit(provider.sourceCommit), testedCommit: commit(provider.testedCommit),
    run: { ...input.run, head_sha: run.head_sha, head_commit: { id: run.head_commit.id, tree_id: run.head_commit.tree_id },
      repository: { id: run.repository.id, full_name: run.repository.full_name } }, job: job(provider.job),
    jobs: { total_count: jobs.total_count, jobs: jobs.jobs.map(job) },
    artifact: { ...input.sourceArtifact, workflow_run: provider.artifact.workflow_run } };
  writeFileSync(join(directory, 'provider.json'), jsonBytes(safe), { flag: 'wx', mode: 0o600 });
  client.zip(`${base}/actions/artifacts/${input.sourceArtifact.id}/zip`, join(directory, 'ORIGINAL.zip'));
  const { out, files } = namedBodies(root, input, directory, 'stage');
  const admitted = admitArchive(input, files, port);
  writeFileSync(join(directory, 'admission.json'), jsonBytes({ source: input.source, tested: input.tested,
    sourceArtifact: input.sourceArtifact, archive: input.archive, providerSha256: hash(jsonBytes(safe)),
    qualification: 'Exact original source DATA; consumer gates still required' }), { flag: 'wx', mode: 0o600 });
  return { archive: join(out, input.archive.filename), admitted };
}
