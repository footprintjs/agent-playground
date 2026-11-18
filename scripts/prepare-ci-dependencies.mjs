// Fixed workflow-only native entry. Missing producer policy refuses before transport/setup effects.
import { pathToFileURL } from 'node:url';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireWorkflow } from './prepare-ci-dependencies/filesystem.mjs';
import { fetchInputs, prepare, verify } from './prepare-ci-dependencies/transaction.mjs';

export { prepareCiManifest, authoredLinks } from './prepare-ci-dependencies/projection.mjs';
export { nativeDependencyLayout } from './prepare-ci-dependencies/namespaces.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const command = process.argv[2];
    if (process.argv.length !== 3 || !['fetch', 'prepare', 'verify'].includes(command)) throw new Error('arguments');
    requireWorkflow(process.env, { token: command === 'fetch' });
    if (!process.env.RUNNER_TEMP || !process.env.GITHUB_WORKSPACE) throw new Error('workflow paths missing');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const inputs = JSON.parse(readFileSync(new URL('./prepare-ci-dependencies/inputs.json', import.meta.url)));
    const args = { root, helper: resolve(root, '../agentfootprint'),
      out: resolve(process.env.RUNNER_TEMP, 'app-native-inputs'),
      inspectorRoot: resolve(process.env.GITHUB_WORKSPACE, '.ci-tools'), inputs,
      expectedCheckpoint: process.env.EXPECTED_NATIVE_CHECKPOINT };
    if (command === 'prepare' && !process.env.GITHUB_OUTPUT) throw new Error('step output missing');
    const result = command === 'fetch' ? fetchInputs(args) : command === 'prepare' ? prepare(args) : verify(args);
    if (command === 'prepare') appendFileSync(process.env.GITHUB_OUTPUT, `checkpoint_sha256=${result.checkpointSha256}\n`);
    console.log(JSON.stringify(result));
  } catch (error) {
    const reason = ['producer-read-403', 'producer-read-404', 'producer-read-failed'].includes(error?.message)
      ? error.message : 'native-inputs-not-configured-or-refused';
    console.error(JSON.stringify({ status: 'REFUSED', reason })); process.exitCode = 2;
  }
}
