import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fixture } from './guard-fixtures.mjs';
import { physicalCensus } from './namespaces.mjs';

function cli(f, bin = 'dist/cli.js') {
  const pkg = join(f.root, 'node_modules/inert-cli');
  f.put(join(pkg, 'package.json'), JSON.stringify({ name: 'inert-cli', version: '1.0.0', bin: { 'inert-cli': bin } }));
  f.put(join(pkg, 'dist/cli.js'), 'throw new Error("bin must not execute");');
  mkdirSync(join(f.root, 'node_modules/.bin'));
  symlinkSync('../inert-cli/dist/cli.js', join(f.root, 'node_modules/.bin/inert-cli'));
  return pkg;
}

test('a nameless module-format scope does not replace the actual declaring package/bin owner', () => {
  const f = fixture();
  try {
    const pkg = cli(f); physicalCensus(f.root, f.helper, JSON.parse);
    f.put(join(pkg, 'dist/package.json'), '{"type":"commonjs"}');
    assert.equal(physicalCensus(f.root, f.helper, JSON.parse).links.length, 2);
  } finally { f.close(); }
});

test('module scopes cannot hide a declaration mismatch or make an escaping bin valid', () => {
  for (const bin of ['different.js', '../other/cli.js']) {
    const f = fixture();
    try {
      const pkg = cli(f, bin); f.put(join(pkg, 'dist/package.json'), '{"type":"commonjs"}');
      assert.throws(() => physicalCensus(f.root, f.helper, JSON.parse), /undeclared bin link/);
    } finally { f.close(); }
  }
});

test('a forged inner manifest cannot grant bin authority denied by the actual installed package', () => {
  const f = fixture();
  try {
    const pkg = cli(f, 'different.js');
    f.put(join(pkg, 'dist/package.json'), '{"name":"forged-inner","bin":{"inert-cli":"cli.js"}}');
    assert.throws(() => physicalCensus(f.root, f.helper, JSON.parse), /undeclared bin link/);
  } finally { f.close(); }
});

test('scoped and nested packages own their declared bin despite inner module-format scopes', () => {
  for (const path of ['@team/fixture-cli', 'outer/node_modules/fixture-cli', 'outer/node_modules/@team/fixture-cli']) {
    const f = fixture();
    try {
      const ns = path.startsWith('outer/') ? join(f.root, 'node_modules/outer/node_modules') : join(f.root, 'node_modules');
      const name = path.includes('@team/') ? '@team/fixture-cli' : 'fixture-cli', pkg = join(ns, name);
      if (path.startsWith('outer/')) f.put(join(f.root, 'node_modules/outer/package.json'), '{"name":"outer","version":"1.0.0"}');
      f.put(join(pkg, 'package.json'), JSON.stringify({ name, version: '1.0.0', bin: { probe: 'dist/main.js' } }));
      f.put(join(pkg, 'dist/main.js'), 'throw new Error("must not run");');
      f.put(join(pkg, 'dist/package.json'), '{"type":"commonjs"}');
      mkdirSync(join(ns, '.bin'), { recursive: true });
      symlinkSync(relative(join(ns, '.bin'), join(pkg, 'dist/main.js')), join(ns, '.bin/probe'));
      assert.equal(physicalCensus(f.root, f.helper, JSON.parse).links.length, 2);
    } finally { f.close(); }
  }
});

test('dangling and foreign bin links retain their refusal boundary', () => {
  for (const kind of ['dangling', 'foreign']) {
    const f = fixture();
    try {
      const bins = join(f.root, 'node_modules/.bin'); mkdirSync(bins);
      const target = join(f.out, 'outside.js');
      if (kind === 'foreign') f.put(target, 'throw new Error("foreign executable");');
      symlinkSync(target, join(bins, 'probe'));
      assert.throws(() => physicalCensus(f.root, f.helper, JSON.parse));
    } finally { f.close(); }
  }
});

test('a nested dependency bin cannot gain authority in the root dependency namespace', () => {
  const f = fixture();
  try {
    const ns = join(f.root, 'node_modules/outer/node_modules'), pkg = join(ns, 'inner'), target = join(pkg, 'dist/cli.js');
    f.put(join(f.root, 'node_modules/outer/package.json'), '{"name":"outer","version":"1.0.0"}');
    f.put(join(pkg, 'package.json'), '{"name":"inner","version":"1.0.0","bin":{"probe":"dist/cli.js"}}');
    f.put(target, 'throw new Error("must not execute");');
    mkdirSync(join(ns, '.bin'), { recursive: true });
    const original = join(ns, '.bin/probe'); symlinkSync(relative(join(ns, '.bin'), target), original);
    physicalCensus(f.root, f.helper, JSON.parse); // Legitimate nested owner/namespace.
    unlinkSync(original); mkdirSync(join(f.root, 'node_modules/.bin'));
    symlinkSync(relative(join(f.root, 'node_modules/.bin'), target), join(f.root, 'node_modules/.bin/probe'));
    assert.throws(() => physicalCensus(f.root, f.helper, JSON.parse), /bin namespace differs/);
  } finally { f.close(); }
});
