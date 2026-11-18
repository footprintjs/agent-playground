// Real npm metadata only, offline, with tiny inert local TAR fixtures and no dependency installation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, delimiter } from 'node:path';
import test from 'node:test';
import { npmEnvironment } from './filesystem.mjs';
import { nativeLockArguments } from './transaction.mjs';

test('metadata recipe respects original local archive peers without looking for an unpublished registry version', () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'app-inert-npm-peer-')));
  try {
    const project = join(base, 'project'), proof = join(base, 'proof'); mkdirSync(project); mkdirSync(proof);
    const writer = `import tarfile,io,json,sys\nfrom pathlib import Path\np=Path(sys.argv[1])\nfor name,manifest in [('agentfootprint',{'name':'agentfootprint','version':'15.0.0-rc.0','scripts':{'postinstall':'node must-not-execute.js'}}),('agentfootprint-lens',{'name':'agentfootprint-lens','version':'0.83.0','peerDependencies':{'agentfootprint':'^15.0.0-rc.0'}})]:\n raw=json.dumps(manifest).encode()\n with tarfile.open(p/(name+'.tgz'),'w:gz',format=tarfile.USTAR_FORMAT) as t:\n  i=tarfile.TarInfo('package/package.json');i.mode=0o644;i.size=len(raw);t.addfile(i,io.BytesIO(raw))\n`;
    const prepared = spawnSync('python3', ['-B', '-c', writer, base], { encoding: 'utf8', timeout: 5000 });
    assert.equal(prepared.status, 0, prepared.stderr);
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'inert-peer-fixture', private: true,
      dependencies: { agentfootprint: 'file:' + join(base, 'agentfootprint.tgz'),
        'agentfootprint-lens': 'file:' + join(base, 'agentfootprint-lens.tgz') } }));
    const env = npmEnvironment(proof, { ...process.env,
      PATH: dirname(process.execPath) + delimiter + process.env.PATH });
    const result = spawnSync('npm', [...nativeLockArguments(), '--offline'],
      { cwd: project, env, encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert(!existsSync(join(project, 'node_modules')), 'metadata recipe installed dependencies');
    const lock = JSON.parse(readFileSync(join(project, 'package-lock.json')));
    assert.equal(lock.packages['node_modules/agentfootprint'].version, '15.0.0-rc.0');
    assert.equal(lock.packages['node_modules/agentfootprint-lens'].peerDependencies.agentfootprint, '^15.0.0-rc.0');
    for (const name of ['agentfootprint', 'agentfootprint-lens']) {
      assert(lock.packages['node_modules/' + name].resolved.startsWith('file:'));
      assert(lock.packages['node_modules/' + name].integrity.startsWith('sha512-'));
    }
  } finally { rmSync(base, { recursive: true }); }
});
