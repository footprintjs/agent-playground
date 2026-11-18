// Inert filesystem fixtures. No package install, compiler or runtime is executed.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export function fixture() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'app-native-guard-')));
  const root = join(base, 'agent-playground'), helper = join(base, 'agentfootprint'), out = join(base, 'proof');
  for (const path of [root, helper, out]) mkdirSync(path);
  const put = (file, data) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, data); };
  const run = (where, ...args) => execFileSync('git', ['-C', where, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (const path of [root, helper]) {
    put(join(path, 'package.json'), JSON.stringify({ name: path === root ? 'agent-playground' : 'agentfootprint', version: path === root ? '0.0.0' : '15.0.0-rc.0', private: true }));
    put(join(path, 'package-lock.json'), '{"lockfileVersion":3}');
    put(join(path, '.gitignore'), 'node_modules\nignored\n');
    run(path, 'init', '-q'); run(path, 'add', '.');
    run(path, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'inert input');
  }
  const selected = { agentfootprint: '15.0.0-rc.0', 'agentfootprint-lens': '9.8.7',
    'footprint-explainable-ui': '9.8.6', footprintjs: '14.0.0-rc.0', foottrace: '2.1.0', contextfootprint: '0.1.1' };
  for (const [name, version] of Object.entries(selected)) {
    put(join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version, main: 'index.js' }));
    put(join(root, 'node_modules', name, 'index.js'), 'throw new Error("fixture package must never execute");');
  }
  symlinkSync(join(root, 'node_modules'), join(base, 'node_modules'));
  return { base, root, helper, out, selected, put, run, close: () => rmSync(base, { recursive: true }) };
}
