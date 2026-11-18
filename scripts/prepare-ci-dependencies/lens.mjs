// The actual Lens compatibility wire format. No AF wrapper, producer rebuild or package import.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hash } from './filesystem.mjs';

export function inspectOriginalDataImage(bytes, pin, profile, port, sourceBytes) {
  assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  assert.equal(integrity, pin.integrity); // Pin the original before asking the shared DATA reader for members.
  const members = port.readArchiveMembers(bytes, { maxArchiveBytes: 32 * 1024 * 1024,
    maxExpandedBytes: 128 * 1024 * 1024, maxFiles: pin.memberCount });
  const raw = members.find(row => row.path === 'package/package.json').data;
  if (sourceBytes) assert.deepEqual(raw, sourceBytes, 'packed manifest differs from immutable raw source');
  const manifest = port.parseManifest(raw);
  assert.equal(manifest.name, pin.package); assert.equal(manifest.version, pin.version);
  const files = members.map(row => {
    const path = row.path.slice(8), pieces = path.split('/');
    assert(row.path.startsWith('package/') && !pieces.includes('node_modules') && !pieces.includes('.npmrc'));
    assert(!['binding.gyp', 'server.js', 'npm-shrinkwrap.json'].includes(path), 'npm authority file refused');
    assert(['package.json', 'README.md', 'LICENSE'].includes(path) || profile.some(rule =>
      rule.endsWith('/') ? path.startsWith(rule) : path === rule), 'member outside fixed DATA profile');
    return { path: row.path, size: row.size, sha256: hash(row.data) };
  });
  assert.equal(files.length, pin.memberCount);
  return { package: manifest.name, version: manifest.version, sha256: hash(bytes),
    shasum: createHash('sha1').update(bytes).digest('hex'), integrity, bytes: bytes.length, files };
}

export function inspectRegistryImage(name, bytes, pin, port) {
  if (pin.inspection === 'digest-pinned-data') {
    return inspectOriginalDataImage(bytes, { ...pin, package: name }, pin.archiveProfile, port);
  }
  assert.equal(pin.inspection, 'publication-profile');
  assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), pin.integrity);
  const members = port.readArchiveMembers(bytes);
  const manifest = port.parseManifest(members.find(row => row.path === 'package/package.json').data);
  assert.equal(manifest.name, name); assert.equal(manifest.version, pin.version);
  // Published engine14 has its real approved packed manifest, not raw source13 with a relabel.
  const result = port.inspectArchive(bytes, { sourceManifest: manifest, version: pin.version, archive: pin.archiveProfile });
  assert.equal(result.package, name); assert.equal(result.sha256, pin.sha256);
  assert.equal(result.integrity, pin.integrity); assert.equal(result.files.length, pin.memberCount);
  return result;
}

export function admitLens(input, files, port, sourceDocuments, cohort) {
  assert.equal(input.strategy, 'lens-compatibility-v1');
  assert.deepEqual(Object.keys(files).sort(), [...input.wireProfile.zipMembers].sort());
  for (const [name, binding] of Object.entries(input.zipBodies)) {
    assert.equal(files[name].length, binding.size); assert.equal(hash(files[name]), binding.sha256);
  }
  assert.equal(hash(sourceDocuments['package.json']), input.source.manifestSha256);
  assert.equal(hash(sourceDocuments['package-lock.json']), input.source.lockSha256);
  const manifest = port.parseManifest(sourceDocuments['package.json']);
  port.parseStrictJson(sourceDocuments['package-lock.json'], { maxBytes: 8 * 1024 * 1024 });
  const parse = name => port.parseStrictJson(files[name], { maxBytes: 8 * 1024 * 1024, maxValues: 200000 });
  for (const [name, key] of [['contract.json', 'contractSha256'], ['input.json', 'inputSha256'], ['agent-source.json', 'agentSourceSha256']]) {
    assert.equal(hash(files[name]), input.wireProfile[key]);
  }
  const contract = parse('contract.json'), upstream = parse('input.json'), agentSource = parse('agent-source.json');
  assert.equal(contract.schema, input.wireProfile.contractSchema);
  assert.equal(contract.cohort.kind, input.wireProfile.cohortKind);
  assert.deepEqual(contract.source, input.buildSource); // Explicit native lock-dirty observation is preserved.
  assert.equal(contract.source.whyCommit, input.tested.head); assert.equal(contract.source.whyTree, input.tested.tree);
  assert.equal(contract.source.workflowRun, String(input.run.id)); assert.equal(contract.source.workflowAttempt, String(input.run.run_attempt));
  assert.equal(input.rawSourceLockQualification, 'COMMITTED_GIT_ANCHOR_ONLY_NATIVE_BUILD_LOCK_DIRTY');
  assert.equal(contract.source.dirtyTracked, 'M package-lock.json');
  assert.deepEqual(contract.whyIdentity, { name: input.archive.package, version: input.archive.version, filename: input.archive.filename });
  assert.deepEqual(contract.why.manifest, manifest);
  assert.equal(contract.why.sha256, input.archive.sha256);
  assert.equal(contract.why.path, input.archive.filename);
  const af = cohort.producers.agentfootprint;
  assert.deepEqual(contract.agentSource, agentSource);
  assert.deepEqual(agentSource.source, af.source); assert.equal(agentSource.archiveSha256, af.archive.sha256);
  assert.deepEqual(upstream.candidate.source, af.source);
  assert.deepEqual(contract.cohort.pins, { agentfootprint: af.archive.version,
    footprintjs: cohort.registry.footprintjs.version, foottrace: cohort.registry.foottrace.version });
  for (const [filename, digest] of Object.entries(input.embeddedSha256)) assert.equal(hash(files[filename]), digest);
  assert.equal(hash(files[af.archive.filename]), af.archive.sha256);
  const result = inspectOriginalDataImage(files[input.archive.filename], input.archive,
    input.archiveProfile, port, sourceDocuments['package.json']);
  for (const key of ['package', 'version', 'sha256', 'shasum', 'integrity', 'bytes']) assert.equal(result[key], input.archive[key]);
  assert.equal(result.files.length, input.archive.memberCount);
  const memberHashes = Object.fromEntries(result.files.map(row => [row.path.slice(8), row.sha256]));
  assert.deepEqual(memberHashes, input.archive.memberHashes);
  assert.deepEqual(contract.why.files, memberHashes);
  const family = {};
  for (const name of ['footprintjs', 'foottrace', 'contextfootprint']) {
    const pin = cohort.registry[name];
    family[name] = inspectRegistryImage(name, files[`${name}-${pin.version}.tgz`], pin, port);
  }
  return { filename: input.archive.filename, ...result, family,
    buildSource: input.buildSource, sourceLockQualification: input.rawSourceLockQualification };
}
