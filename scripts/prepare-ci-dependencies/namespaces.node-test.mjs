import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { nativeDependencyLayout } from '../prepare-ci-dependencies.mjs';

test('layout includes independent consumer and exact-source-helper namespaces',()=>{
  const base=mkdtempSync(join(tmpdir(),'app-native-layout-'));
  try {
    const consumer=join(base,'agent-playground'),examples=join(base,'agentfootprint');
    const plan=nativeDependencyLayout(consumer,examples);
    for(const root of [consumer,examples]) {
      const packageRoot=join(root,'node_modules/.hidden/inert-alias');mkdirSync(packageRoot,{recursive:true});
      writeFileSync(join(packageRoot,'package.json'),JSON.stringify({name:'foottrace',version:'1.0.0'}));
    }
    const observed=plan.dependencyNamespaces.map(path=>JSON.parse(readFileSync(join(path,'.hidden/inert-alias/package.json'))));
    assert.equal(observed.length,2);assert(observed.every(p=>p.name==='foottrace'));
    assert.deepEqual(plan.sharedLink,{path:join(base,'node_modules'),target:join(consumer,'node_modules')});
  } finally {rmSync(base,{recursive:true});}
});

test('a relative, non-normalized, foreign or overlapping helper layout refuses',()=>{
  for(const [root,helper] of [['agent-playground','/fixture/agentfootprint'],
    ['/fixture/x/../agent-playground','/fixture/agentfootprint'],
    ['/fixture/agent-playground','/foreign/agentfootprint'],
    ['/fixture/agent-playground','/fixture/agent-playground'],
    ['/fixture/agent-playground','/fixture/agentfootprint/']]) {
    assert.throws(()=>nativeDependencyLayout(root,helper));
  }
});
