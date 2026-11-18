import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture } from './guard-fixtures.mjs';
import { workflowApi } from './transport.mjs';

test('CLI-created state is contained in intake, never the consumer checkout', () => {
  const f = fixture(), cwd = process.cwd();
  try {
    const bin = join(f.base, 'bin'); mkdirSync(bin);
    const script = '#!' + process.execPath + '\n' +
      'const fs=require("node:fs"),path=require("node:path");' +
      'fs.writeFileSync(path.join(process.cwd(),"device-id"),"inert fixture state");' +
      'for(const k of ["GH_CONFIG_DIR","XDG_STATE_HOME","XDG_CACHE_HOME","XDG_DATA_HOME"]){' +
      'const d=process.env[k]||process.cwd();fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,k+"-marker"),"inert");}' +
      'console.log(JSON.stringify({status:"fixture-data"}));';
    writeFileSync(join(bin, 'gh'), script); chmodSync(join(bin, 'gh'), 0o755);
    process.chdir(f.root);
    const client = workflowApi(f.out, { PATH: bin, HOME: process.env.HOME, GH_TOKEN: 'inert-not-a-credential' }, { parseStrictJson: JSON.parse });
    assert.deepEqual(client.json('inert/read-only-fixture'), { status: 'fixture-data' });
    assert(!existsSync(join(f.root, 'device-id')), 'gh state leaked under consumer checkout');
    assert.equal(readFileSync(join(f.out, 'device-id'), 'utf8'), 'inert fixture state');
    for (const [key, directory] of [['GH_CONFIG_DIR', 'empty-gh-config'], ['XDG_STATE_HOME', 'gh-state'],
      ['XDG_CACHE_HOME', 'gh-cache'], ['XDG_DATA_HOME', 'gh-data']]) {
      assert.deepEqual(readdirSync(join(f.out, directory)), [key + '-marker']);
    }
  } finally { process.chdir(cwd); f.close(); }
});
