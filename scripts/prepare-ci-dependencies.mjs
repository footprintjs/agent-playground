// Pure setup planning only. No native install route is wired until all inputs qualify.
import { pathToFileURL } from 'node:url';

export { prepareCiManifest, authoredLinks } from './prepare-ci-dependencies/projection.mjs';
export { nativeDependencyLayout } from './prepare-ci-dependencies/namespaces.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stderr.write('Qualified native inputs and complete runtime integration are not configured.\n');
  process.exitCode = 2; // Refuse before reading/writing manifests or invoking any child.
}
