// Inert installed images and genuine temporary files; no npm/producer/compiler execution.
import { join } from 'node:path';
import { fixture } from './guard-fixtures.mjs';
import { hash, regular, sourceIdentity } from './filesystem.mjs';
import { inventory } from './installed.mjs';

export function installedFixture() {
  const f = fixture(), packages = {}, admitted = {}, archives = {};
  const inputs = { producers: {}, renderer: { package: 'footprint-explainable-ui', version: f.selected['footprint-explainable-ui'], integrity: 'sha512-fixture-renderer' }, registry: {} };
  for (const [name, version] of Object.entries(f.selected)) {
    packages['node_modules/' + name] = { version, resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, integrity: 'sha512-fixture-' + name };
    if (['footprintjs', 'foottrace', 'contextfootprint'].includes(name)) inputs.registry[name] = { version, integrity: packages['node_modules/' + name].integrity };
  }
  packages['node_modules/footprint-explainable-ui'].integrity = inputs.renderer.integrity;
  for (const name of ['agentfootprint', 'agentfootprint-lens']) {
    archives[name] = join(f.out, name + '.tgz');
    admitted[name] = { integrity: 'sha512-fixture-' + name, files: inventory(join(f.root, 'node_modules', name)) };
    packages['node_modules/' + name].resolved = 'file:' + archives[name];
    inputs.producers[name] = { archive: { package: name, version: f.selected[name] } };
  }
  inputs.producers.agentfootprint.source = { ...sourceIdentity(f.helper),
    manifestSha256: hash(regular(join(f.helper, 'package.json'))), lockSha256: hash(regular(join(f.helper, 'package-lock.json'))) };
  admitted['agentfootprint-lens'].family = Object.fromEntries(['footprintjs', 'foottrace', 'contextfootprint'].map(name =>
    [name, { files: inventory(join(f.root, 'node_modules', name)), sha256: 'fixture-' + name,
      integrity: inputs.registry[name].integrity }]));
  const renderer = inventory(join(f.root, 'node_modules/footprint-explainable-ui'));
  inputs.renderer.memberCount = renderer.length;
  inputs.renderer.memberHashes = Object.fromEntries(renderer.map(row => [row.path.slice(8), row.sha256]));
  const compiler = { name: 'typescript', version: '5.4.5', main: 'index.js', bin: { tsc: 'bin/tsc' } };
  f.put(join(f.root, 'node_modules/typescript/package.json'), JSON.stringify(compiler));
  for (const path of ['index.js', 'bin/tsc']) f.put(join(f.root, 'node_modules/typescript', path), 'throw new Error("compiler must not execute");');
  packages['node_modules/typescript'] = { version: '5.4.5', resolved: 'https://registry.npmjs.org/typescript/-/typescript-5.4.5.tgz', integrity: 'sha512-fixture-compiler' };
  const nativeLock = Buffer.from(JSON.stringify({ lockfileVersion: 3, packages }));
  f.put(join(f.root, 'node_modules/.package-lock.json'), nativeLock);
  return { ...f, inputs, nativeLock, originalLock: nativeLock, admitted, archives,
    port: { parseStrictJson: JSON.parse } };
}
