import { describe, expect, it } from 'vitest';
import * as foottrace from 'foottrace';
import * as write from 'foottrace/write';
import * as paths from 'foottrace/paths';
import { MockProvider } from 'agentfootprint/providers';
import { executeCode } from '../src/runner/executeCode';

describe('public record and agent bindings', () => {
  it.each([
    ['foottrace', foottrace], ['foottrace/write', write], ['foottrace/paths', paths],
  ])('injects the real identities from %s', async (door, namespace) => {
    const names = Object.keys(namespace);
    const result = await executeCode(`import { ${names.join(', ')} } from '${door}'; return { ${names.join(', ')} };`, '');
    expect(result.error).toBeUndefined();
    expect(result.output).toEqual({ ...namespace });
  });

  it('records a real mock-only run, its graph and snapshot for replay', async () => {
    const result = await executeCode(`
      import { LLMCall } from 'agentfootprint';
      import { MockProvider } from 'agentfootprint/providers';
      const runner = LLMCall.create({ provider: new MockProvider({ reply: 'Recorded answer' }), model: 'mock' }).build();
      return await runner.run({ message: input });
    `, 'Test');
    expect(result.error).toBeUndefined();
    expect(result.output).toBe('Recorded answer');
    expect(result.execution?.snapshot).toBeDefined();
    expect(result.execution?.traceGraph?.nodes.length).toBeGreaterThan(0);
  });

  it('uses the canonical provider identity while keeping unapproved bindings unavailable', async () => {
    const provider = await executeCode(`import { MockProvider } from 'agentfootprint/providers'; return MockProvider;`, '');
    expect(provider.output).toBe(MockProvider);
    const unsupported = await executeCode(`import { readFile } from 'node:fs'; return readFile('not-available');`, '');
    expect(unsupported.error).toContain('readFile is not defined');
    // A public backend not on the existing sample allowlist must not leak in.
    const backend = await executeCode(`return localCodeRunner;`, '');
    expect(backend.error).toContain('localCodeRunner is not defined');
  });
});
