// Closed producer/provider/archive DATA admission. No effects or incoming package imports.
import assert from 'node:assert/strict';
import { hash } from './filesystem.mjs';

export const INSPECTOR_HEAD = '1ca5d7de9bde68c205b5d140c94dc475ae3b2520';
export const roles = ['agentfootprint', 'agentfootprint-lens'];
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);

export function requireInputs(inputs) {
  assert.equal(inputs?.status, 'NATIVE_SOURCE_READY', 'qualified Lens and renderer inputs not configured');
  assert.deepEqual(Object.keys(inputs).sort(), ['producers', 'registry', 'renderer', 'status']);
  assert.deepEqual(Object.keys(inputs.producers).sort(), [...roles].sort());
  assert.deepEqual(Object.keys(inputs.registry).sort(), ['footprintjs', 'foottrace']);
  for (const [name, version] of [['footprintjs', '14.0.0-rc.0'], ['foottrace', '2.1.0']]) {
    assert.equal(inputs.registry[name].version, version);
    assert.match(inputs.registry[name].integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  }
  assert.equal(inputs.renderer.package, 'footprint-explainable-ui');
  assert.match(inputs.renderer.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.match(inputs.renderer.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  assert(hex(inputs.renderer.reviewSha256, 64), 'renderer contract proof required');
  for (const role of roles) {
    const input = inputs.producers[role];
    assert.equal(input.status, 'NATIVE_SOURCE_READY');
    assert.equal(input.repository, 'footprintjs/' + role);
    assert.equal(input.archive.package, role);
    assert.match(input.archive.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    if (role === 'agentfootprint') assert.equal(input.archive.version, '15.0.0-rc.0');
    assert.equal(input.archive.filename, `${role}-${input.archive.version}.tgz`);
    for (const value of [input.repositoryId, input.run.id, input.run.run_attempt, input.run.workflow_id,
      input.sourceJob.id, input.sourceArtifact.id, input.sourceArtifact.size_in_bytes]) {
      assert(Number.isSafeInteger(value) && value > 0, 'positive fixed provider identity required');
    }
    assert(input.sourceArtifact.size_in_bytes <= 64 * 1024 * 1024);
    assert.equal(input.sourceArtifact.digest, 'sha256:' + input.outerSha256);
    assert(hex(input.outerSha256, 64));
    for (const object of [input.source, input.tested]) for (const key of ['head', 'tree']) assert(hex(object[key], 40));
    for (const key of ['manifestSha256', 'lockSha256']) assert(hex(input.source[key], 64));
    assert(hex(input.reviewSha256, 64), 'exact producer review required');
    assert(input.sourceProtocol && typeof input.sourceProtocol === 'string');
    assert(Array.isArray(input.archiveProfile) && input.archiveProfile.length > 0 && input.archiveProfile.length <= 16);
    assert(input.archiveProfile.every(value => typeof value === 'string' && value.length <= 128));
    assert(Array.isArray(input.qualifyingJobs) && input.qualifyingJobs.length > 0 && input.qualifyingJobs.length <= 100);
  }
  return inputs;
}

export function verifyProvider(input, provider) {
  const { run, job, artifact, sourceCommit, testedCommit, jobs } = provider;
  for (const key of ['id', 'run_attempt', 'workflow_id', 'name', 'event', 'head_branch', 'status', 'conclusion']) {
    assert.deepEqual(run[key], input.run[key], 'producer run differs');
  }
  assert.equal(run.status, 'completed');
  assert.equal(run.head_sha, input.source.head);
  assert.equal(run.head_commit.id, input.source.head); assert.equal(run.head_commit.tree_id, input.source.tree);
  assert.equal(run.repository.id, input.repositoryId); assert.equal(run.repository.full_name, input.repository);
  for (const key of ['id', 'name', 'status', 'conclusion']) assert.equal(job[key], input.sourceJob[key]);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(job.run_id, run.id); assert.equal(job.head_sha, input.source.head);
  if (Object.hasOwn(job, 'run_attempt')) assert.equal(job.run_attempt, run.run_attempt);
  for (const key of ['id', 'name', 'size_in_bytes', 'digest', 'expired']) assert.equal(artifact[key], input.sourceArtifact[key]);
  assert.equal(artifact.expired, false); assert.equal(artifact.workflow_run.id, run.id);
  assert.equal(artifact.workflow_run.repository_id, input.repositoryId);
  assert.equal(artifact.workflow_run.head_repository_id, input.repositoryId);
  assert.equal(artifact.workflow_run.head_branch, input.run.head_branch);
  assert.equal(artifact.workflow_run.head_sha, input.source.head);
  for (const [commit, expected] of [[sourceCommit, input.source], [testedCommit, input.tested]]) {
    assert.equal(commit.sha, expected.head); assert.equal(commit.tree.sha, expected.tree);
  }
  assert.equal(input.source.tree, input.tested.tree);
  assert.deepEqual(testedCommit.parents.map(parent => parent.sha), input.expectedTestedParents);
  assert.equal(input.expectedTestedParents.at(-1), input.source.head);
  assert.equal(jobs.total_count, input.qualifyingJobs.length); assert.equal(jobs.jobs.length, input.qualifyingJobs.length);
  const summary = row => ({ id: row.id, name: row.name, status: row.status, conclusion: row.conclusion });
  assert.deepEqual(jobs.jobs.map(summary).sort((a, b) => a.id - b.id), [...input.qualifyingJobs].sort((a, b) => a.id - b.id));
  for (const row of jobs.jobs) {
    assert.equal(row.run_id, run.id); assert.equal(row.head_sha, input.source.head); assert.equal(row.status, 'completed');
    if (Object.hasOwn(row, 'run_attempt')) assert.equal(row.run_attempt, run.run_attempt);
    if (row.conclusion !== 'success') {
      assert.equal(input.repository, 'footprintjs/agentfootprint'); assert.equal(row.name, 'docs');
      assert.deepEqual({ id: row.id, name: row.name, conclusion: row.conclusion }, input.allowedDocsFailure);
      assert.equal(row.conclusion, 'failure');
    }
  }
}

export function admitArchive(input, files, port) {
  const filename = input.archive.filename;
  assert.deepEqual(Object.keys(files).sort(), [filename, 'candidate.json', 'source-package.json', 'source-package-lock.json'].sort());
  const record = port.parseStrictJson(files['candidate.json'], { maxBytes: 8 * 1024 * 1024 });
  assert.equal(record.protocol, input.sourceProtocol);
  assert.deepEqual(record.source, input.source); assert.deepEqual(record.tested, input.tested);
  assert.equal(hash(files['source-package.json']), input.source.manifestSha256);
  assert.equal(hash(files['source-package-lock.json']), input.source.lockSha256);
  const manifest = port.parseManifest(files['source-package.json']);
  const lock = port.parseStrictJson(files['source-package-lock.json'], { maxBytes: 8 * 1024 * 1024 });
  for (const value of [manifest, lock]) {
    assert.equal(value.name, input.archive.package); assert.equal(value.version, input.archive.version);
  }
  const admitted = port.inspectArchive(files[filename], { sourceManifest: manifest, version: input.archive.version,
    archive: input.archiveProfile, maxArchiveBytes: 32 * 1024 * 1024, maxExpandedBytes: 128 * 1024 * 1024, maxFiles: 20000 });
  assert.deepEqual(record.archive, { filename, ...admitted });
  for (const key of ['package', 'version', 'sha256', 'shasum', 'integrity', 'bytes']) assert.equal(admitted[key], input.archive[key]);
  assert.equal(admitted.files.length, input.archive.memberCount);
  assert.equal(hash(JSON.stringify(admitted.files)), input.archive.memberCensusSha256);
  return { filename, ...admitted };
}
