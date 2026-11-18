import assert from 'node:assert/strict';
import { isAbsolute, normalize } from 'node:path';

export const authoredLinks = Object.freeze({
  agentfootprint: 'file:../agentfootprint',
  'agentfootprint-lens': 'file:../agentfootprint-lens',
  'footprint-explainable-ui': 'file:../explainable-ui',
  footprintjs: 'file:../footPrint',
});
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());

function archiveLocators(policy) {
  assert(policy && policy.status === 'NATIVE_SOURCE_READY', 'qualified native input policy required');
  keys(policy, ['status', 'archives', 'renderer']);
  keys(policy.archives, ['agentfootprint', 'agentfootprint-lens']);
  for (const path of Object.values(policy.archives)) {
    assert(typeof path === 'string' && isAbsolute(path) && path === normalize(path) &&
      path.endsWith('.tgz') && !/[\u0000-\u001f\u007f]/.test(path), 'original archive locator required');
  }
  assert.notEqual(policy.archives.agentfootprint, policy.archives['agentfootprint-lens']);
  keys(policy.renderer, ['package', 'version', 'integrity']);
  assert.equal(policy.renderer.package, 'footprint-explainable-ui');
  assert.match(policy.renderer.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
  const sri = policy.renderer.integrity;
  assert(typeof sri === 'string' && sri.startsWith('sha512-'));
  const bytes = Buffer.from(sri.slice(7), 'base64');
  assert(bytes.length === 64 && bytes.toString('base64') === sri.slice(7), 'published renderer SRI required');
  return policy.archives;
}

/** Pure projection, NOT producer admission. The future fixed native adapter owns provenance. */
export function prepareCiManifest(manifest, policy) {
  const archives = archiveLocators(policy);
  assert.equal(manifest.private, true);
  assert(!Object.hasOwn(manifest, 'workspaces'), 'unadmitted app workspace declarations');
  for (const section of sections) {
    for (const [name, value] of Object.entries(manifest[section] ?? {})) {
      if (typeof value !== 'string' || !value.startsWith('file:')) continue;
      assert(section === 'dependencies' && authoredLinks[name] === value,
        'Unexpected local dependency: ' + section + '.' + name);
    }
  }
  for (const [name, link] of Object.entries(authoredLinks)) {
    assert.equal(manifest.dependencies?.[name], link, 'Expected authored link: ' + name);
  }
  assert.equal(manifest.dependencies.foottrace, '^2.0.0-rc.0', 'Expected authored Foottrace request');
  const result = structuredClone(manifest);
  Object.assign(result.dependencies, {
    agentfootprint: 'file:' + archives.agentfootprint,
    'agentfootprint-lens': 'file:' + archives['agentfootprint-lens'],
    'footprint-explainable-ui': policy.renderer.version, footprintjs: '14.0.0-rc.0', foottrace: '2.1.0',
  });
  return result;
}
