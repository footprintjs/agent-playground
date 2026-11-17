import assert from 'node:assert/strict';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

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
