import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { prepareCiManifest } from '../prepare-ci-dependencies.mjs';

function manifest() {
  return { private: true, version: '0.1.0', dependencies: {
    agentfootprint: 'file:../agentfootprint',
    'agentfootprint-lens': 'file:../agentfootprint-lens',
    'footprint-explainable-ui': 'file:../explainable-ui',
    footprintjs: 'file:../footPrint', foottrace: '^2.0.0-rc.0', unrelated: '^4',
  }, scripts: { prepare: 'the-original-hook' }, optionalDependencies: { unrelated: '^3' } };
}
// Synthetic locators/published-policy bytes are fixture data, not a real Lens tuple.
function policy() {
  return { status: 'NATIVE_SOURCE_READY', archives: {
    agentfootprint: '/fixture/af-original.tgz', 'agentfootprint-lens': '/fixture/lens-original.tgz',
  }, renderer: { package: 'footprint-explainable-ui', version: '9.8.7',
    integrity: 'sha512-' + Buffer.alloc(64).toString('base64') } };
}

test('missing or unqualified native policy refuses instead of silently selecting the old cohort', () => {
  assert.throws(() => prepareCiManifest(manifest()), /qualified native input policy/);
  assert.throws(() => prepareCiManifest(manifest(), { ...policy(), status: 'DATA_ONLY' }), /qualified native input policy/);
});

test('only five closed requests project, preserving every authored original and unrelated field', () => {
  const input=manifest(),before=structuredClone(input),expected=structuredClone(input);
  expected.dependencies={...expected.dependencies,agentfootprint:'file:/fixture/af-original.tgz',
    'agentfootprint-lens':'file:/fixture/lens-original.tgz','footprint-explainable-ui':'9.8.7',
    footprintjs:'14.0.0-rc.0',foottrace:'2.1.0'};
  assert.deepEqual(prepareCiManifest(input,policy()),expected);
  assert.deepEqual(input,before);
});

test('unreviewed local links, moved authored requests and workspace additions refuse', () => {
  for (const section of ['dependencies','devDependencies','optionalDependencies','peerDependencies']) {
    const input=manifest();input[section]={...input[section],unknown:'file:../unexpected'};
    assert.throws(()=>prepareCiManifest(input,policy()),/Unexpected local dependency/);
  }
  const changed=manifest();changed.dependencies.foottrace='^1.0.0';
  assert.throws(()=>prepareCiManifest(changed,policy()),/Expected authored Foottrace/);
  const workspace=manifest();workspace.workspaces=['extra'];
  assert.throws(()=>prepareCiManifest(workspace,policy()),/unadmitted app workspace/);
});

test('only the two distinct original archives and an exact renderer policy are accepted as data',()=>{
  for(const mutate of [p=>{delete p.archives['agentfootprint-lens'];},p=>{p.archives.extra='/fixture/extra.tgz';},
    p=>{p.archives.agentfootprint='../relative.tgz';},p=>{p.archives.agentfootprint='/fixture/../bad.tgz';},
    p=>{p.archives.agentfootprint=p.archives['agentfootprint-lens'];},p=>{p.renderer.version='^9.8.7';},
    p=>{p.renderer.integrity='sha512-invalid';},p=>{p.renderer.package='other';}]) {
    const input=policy();mutate(input);assert.throws(()=>prepareCiManifest(manifest(),input));
  }
});

test('the incomplete direct CLI refuses before filesystem or install effects',()=>{
  const cwd=mkdtempSync(join(tmpdir(),'app-native-cli-'));
  try {
    const result=spawnSync(process.execPath,[new URL('../prepare-ci-dependencies.mjs',import.meta.url).pathname],
      {cwd,encoding:'utf8',timeout:5000});
    assert.equal(result.status,2);assert.match(result.stderr,/not configured/);
    assert.deepEqual(readdirSync(cwd),[]);assert.equal(result.stdout,'');
  } finally {rmSync(cwd,{recursive:true});}
});
