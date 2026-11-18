import assert from 'node:assert/strict';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { lstatSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { hash, regular } from './filesystem.mjs';

const family = new Set(['agentfootprint', 'agentfootprint-lens', 'footprint-explainable-ui',
  'footprintjs', 'foottrace', 'contextfootprint']);
const inside = (root, file) => file === root || file.startsWith(root + '/');

/** Pure layout for the app plus its existing exact-source example helper, not a census. */
export function nativeDependencyLayout(consumerRoot, exampleSourceRoot) {
  for (const path of [consumerRoot, exampleSourceRoot]) {
    assert(typeof path === 'string' && isAbsolute(path) && resolve(path) === path &&
      !/[\u0000-\u001f\u007f]/.test(path), 'normalized absolute source root required');
  }
  assert.equal(basename(consumerRoot), 'agent-playground');
  assert.equal(basename(exampleSourceRoot), 'agentfootprint');
  assert.equal(dirname(consumerRoot), dirname(exampleSourceRoot), 'source helper must be the admitted sibling');
  return {
    dependencyNamespaces: [join(consumerRoot, 'node_modules'), join(exampleSourceRoot, 'node_modules')],
    sharedLink: { path: join(dirname(consumerRoot), 'node_modules'), target: join(consumerRoot, 'node_modules') },
  };
}

function declaringPackage(file, parse) {
  let root = dirname(file);
  for (;;) {
    const parent = dirname(root);
    if (basename(parent) === 'node_modules' || (basename(parent).startsWith('@') && basename(dirname(parent)) === 'node_modules')) {
      return { root, namespace: basename(parent) === 'node_modules' ? parent : dirname(parent),
        manifest: parse(regular(join(root, 'package.json'), 1024 * 1024)) };
    }
    assert.notEqual(root, parent, 'installed package owner missing'); root = parent;
  }
}

/** Observe EVERY independent namespace, including hidden aliases and nested locks. No package code runs. */
export function physicalCensus(consumerRoot, exampleSourceRoot, parse) {
  const plan = nativeDependencyLayout(consumerRoot, exampleSourceRoot);
  for (const root of [consumerRoot, exampleSourceRoot]) assert.equal(realpathSync(root), root, 'aliased source root');
  const packages = [], links = [], hiddenLocks = [], seen = new Set();
  let visits = 0;
  function walk(path, depth) {
    assert(depth <= 80, 'dependency depth bound');
    const canonical = realpathSync(path);
    assert.equal(canonical, resolve(path), 'aliased dependency directory');
    if (seen.has(canonical)) return;
    seen.add(canonical);
    for (const name of readdirSync(path).sort()) {
      assert(++visits <= 250000, 'dependency census bound');
      const file = join(path, name), stat = lstatSync(file);
      if (stat.isSymbolicLink()) {
        const target = realpathSync(file), targetStat = lstatSync(target);
        assert(targetStat.isFile() && basename(path) === '.bin' &&
          plan.dependencyNamespaces.some(root => inside(root, target)), 'unadmitted dependency link');
        const { root, namespace, manifest } = declaringPackage(target, parse);
        assert.equal(dirname(path), namespace, 'bin namespace differs from declaring package');
        const bins = typeof manifest.bin === 'string' ? { [manifest.name.split('/').at(-1)]: manifest.bin } : manifest.bin;
        assert(inside(root, target) && bins && Object.hasOwn(bins, name) && resolve(root, bins[name]) === target, 'undeclared bin link');
        links.push({ path: file, request: readlinkSync(file), target });
      } else if (stat.isDirectory()) walk(file, depth + 1);
      else if (name === '.package-lock.json') {
        assert.equal(basename(path), 'node_modules', 'unexpected hidden lock location');
        const raw = regular(file, 8 * 1024 * 1024), lock = parse(raw);
        assert(lock.packages && typeof lock.packages === 'object', 'hidden lock packages required');
        hiddenLocks.push({ path: file, base: dirname(path), sha256: hash(raw), packages: lock.packages });
      } else if (name === 'package.json') {
        const raw = regular(file, 1024 * 1024), manifest = parse(raw);
        if (family.has(manifest.name)) packages.push({ root: path, name: manifest.name,
          version: manifest.version, manifestSha256: hash(raw) });
      } else assert(stat.isFile(), 'nonregular dependency member');
    }
  }
  for (const path of plan.dependencyNamespaces) {
    let info;
    try { info = lstatSync(path); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    assert(info.isDirectory() && !info.isSymbolicLink(), 'linked dependency namespace');
    walk(path, 0);
  }
  const shared = lstatSync(plan.sharedLink.path);
  assert(shared.isSymbolicLink() && realpathSync(plan.sharedLink.path) === plan.sharedLink.target,
    'common parent must link only to the admitted app dependency tree');
  links.push({ path: plan.sharedLink.path, request: readlinkSync(plan.sharedLink.path), target: plan.sharedLink.target });
  return { packages, links, hiddenLocks, dependencyNamespaces: plan.dependencyNamespaces };
}

export function requireFamilyOwners(census, selected) {
  assert.deepEqual(Object.keys(selected).sort(), [...family].sort(), 'closed family owners required');
  const result = {};
  for (const [name, version] of Object.entries(selected)) {
    const owners = census.packages.filter(row => row.name === name);
    assert.equal(owners.length, 1, `one physical ${name} required`);
    assert.equal(owners[0].version, version, `wrong physical ${name} version`);
    result[name] = owners[0];
  }
  return result;
}
