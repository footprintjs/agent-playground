import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyProvider } from './admission.mjs';

function fixture() {
  const source = { head: '1'.repeat(40), tree: '2'.repeat(40) }, tested = { head: '3'.repeat(40), tree: source.tree };
  const run = { id: 11, run_attempt: 1, workflow_id: 12, name: 'CI', event: 'pull_request', head_branch: 'source', status: 'completed', conclusion: 'success' };
  const sourceJob = { id: 13, name: 'package', status: 'completed', conclusion: 'success' };
  const sourceArtifact = { id: 14, name: 'source-original', size_in_bytes: 100, digest: 'sha256:' + '4'.repeat(64), expired: false };
  const input = { repository: 'footprintjs/agentfootprint-lens', repositoryId: 15, source, tested, run, sourceJob, sourceArtifact,
    expectedTestedParents: ['5'.repeat(40), source.head], qualifyingJobs: [sourceJob] };
  const job = { ...sourceJob, run_id: run.id, run_attempt: 1, head_sha: source.head };
  const provider = { run: { ...run, head_sha: source.head, head_commit: { id: source.head, tree_id: source.tree }, repository: { id: 15, full_name: input.repository } },
    job, artifact: { ...sourceArtifact, workflow_run: { id: run.id, repository_id: 15, head_repository_id: 15, head_sha: source.head, head_branch: run.head_branch } },
    sourceCommit: { sha: source.head, tree: { sha: source.tree } }, testedCommit: { sha: tested.head, tree: { sha: tested.tree }, parents: input.expectedTestedParents.map(sha => ({ sha })) },
    jobs: { total_count: 1, jobs: [job] } };
  return { input, provider };
}

test('exact attempt, source, tested parents, repository, package job, complete gates and original artifact must all join', () => {
  const f = fixture(); verifyProvider(f.input, f.provider);
  for (const fault of [p => { p.run.head_commit.id = '0'.repeat(40); }, p => { p.run.run_attempt++; },
    p => { p.run.repository.full_name = 'other/repo'; }, p => { p.job.conclusion = 'failure'; },
    p => { p.artifact.digest = 'sha256:' + '0'.repeat(64); }, p => { p.artifact.workflow_run.id++; },
    p => { p.artifact.workflow_run.head_branch = 'other'; },
    p => { p.testedCommit.parents.reverse(); }, p => { p.testedCommit.tree.sha = '0'.repeat(40); },
    p => { p.jobs.total_count++; }, p => { p.jobs.jobs.push({ ...p.job, id: 99, conclusion: 'failure' }); }]) {
    const changed = structuredClone(f.provider); fault(changed); assert.throws(() => verifyProvider(f.input, changed));
  }
});

test('a failed Lens gate cannot borrow the named AF-only docs exception', () => {
  const f = fixture(), docs = { id: 16, name: 'docs', status: 'completed', conclusion: 'failure' };
  f.input.qualifyingJobs.push(docs); f.input.allowedDocsFailure = { id: docs.id, name: docs.name, conclusion: docs.conclusion };
  f.provider.jobs.total_count++; f.provider.jobs.jobs.push({ ...docs, run_id: 11, run_attempt: 1, head_sha: f.input.source.head });
  assert.throws(() => verifyProvider(f.input, f.provider));
});
