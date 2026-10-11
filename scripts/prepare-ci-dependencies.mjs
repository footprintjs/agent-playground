import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// CI tests the published package boundary; authored local-development links stay
// in Git. Version changes here must be reviewed with the consumer upgrade.
export const replacements = {
  "agentfootprint": {
    "from": "file:../agentfootprint",
    "to": "10.1.0"
  },
  "agentfootprint-lens": {
    "from": "file:../agentfootprint-lens",
    "to": "0.76.0"
  },
  "footprint-explainable-ui": {
    "from": "file:../explainable-ui",
    "to": "0.38.0"
  },
  "footprintjs": {
    "from": "file:../footPrint",
    "to": "10.0.0"
  }
};
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

export function prepareCiManifest(manifest) {
  const result = structuredClone(manifest);
  for (const section of sections) {
    for (const [name, value] of Object.entries(manifest[section] ?? {})) {
      if (typeof value !== 'string' || !value.startsWith('file:')) continue;
      const rule = section === 'dependencies' ? replacements[name] : undefined;
      if (!rule || rule.from !== value) throw new Error(`Unexpected local dependency: ${section}.${name}=${value}`);
      result[section][name] = rule.to;
    }
  }
  for (const [name, rule] of Object.entries(replacements)) {
    if (manifest.dependencies?.[name] !== rule.from) throw new Error(`Expected authored link: dependencies.${name}=${rule.from}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filename = new URL('../package.json', import.meta.url);
  const original = JSON.parse(await readFile(filename, 'utf8'));
  const prepared = prepareCiManifest(original);
  for (const [name, rule] of Object.entries(replacements)) console.log(`${name}: ${rule.from} -> ${rule.to}`);
  await writeFile(filename, JSON.stringify(prepared, null, 2) + '\n');
}
