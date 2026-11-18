import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const scripts = new URL('../', import.meta.url), facade = new URL('../prepare-ci-dependencies.mjs', import.meta.url);
const workflow = new URL('../.github/workflows/checks.yml', scripts);

function requireFirstPreflight(text) {
  const steps = text.split(/^      - /m).slice(1);
  const shell = steps.find(step => /^(?:        )?run:/m.test(step));
  assert(shell, 'workflow shell missing');
  assert.match(shell, /^(?:        )?run: node scripts\/prepare-ci-dependencies\.mjs preflight$/m,
    'qualification preflight must be the first shell, before package effects');
  assert(!/^(?:        )?(if|continue-on-error):/m.test(shell), 'qualification preflight must not be skipped or ignored');
  assert.equal((text.match(/prepare-ci-dependencies\.mjs preflight/g) ?? []).length, 1);
}

test('actual workflow qualifies fixed metadata/source before any package or provider command, unconditionally', () => {
  requireFirstPreflight(readFileSync(workflow, 'utf8'));
});

test('moving package effects earlier, skipping preflight or ignoring its failure refuses', () => {
  const good = 'steps:\n      - name: Qualify\n        run: node scripts/prepare-ci-dependencies.mjs preflight\n      - run: npm ci\n';
  requireFirstPreflight(good);
  for (const bad of [good.replace('      - name: Qualify', '      - name: Earlier\n        run: npm ci\n      - name: Qualify'),
    good.replace('        run:', '        if: false\n        run:'),
    good.replace('        run:', '        continue-on-error: true\n        run:')]) assert.throws(() => requireFirstPreflight(bad));
});

test('pending input policy refuses CLI preflight and all stages before API/package/output effects', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'app-preflight-cli-')));
  try {
    const copy = join(root, 'agent-playground/scripts'); mkdirSync(copy, { recursive: true });
    cpSync(facade, join(copy, 'prepare-ci-dependencies.mjs'));
    cpSync(new URL('./', import.meta.url), join(copy, 'prepare-ci-dependencies'), { recursive: true });
    writeFileSync(join(copy, 'prepare-ci-dependencies/inputs.json'), '{"status":"PENDING_QUALIFIED_LENS_AND_RENDERER"}');
    const effects = join(root, 'effects'); mkdirSync(effects);
    const env = { PATH: process.env.PATH, GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'footprintjs/agent-playground',
      GITHUB_WORKSPACE: root, RUNNER_TEMP: effects, GITHUB_OUTPUT: join(effects, 'not-created') };
    for (const command of ['preflight', 'fetch', 'prepare', 'verify']) {
      const result = spawnSync(process.execPath, [join(copy, 'prepare-ci-dependencies.mjs'), command],
        { env: command === 'fetch' ? { ...env, GH_TOKEN: 'inert-not-a-credential' } : env,
          cwd: root, encoding: 'utf8', timeout: 5000 });
      assert.equal(result.status, 2); assert.equal(JSON.parse(result.stderr).status, 'REFUSED');
      assert.equal(result.stdout, ''); assert.deepEqual(readdirSync(effects), []);
    }
  } finally { rmSync(root, { recursive: true }); }
});
