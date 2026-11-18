# AgentFootprint playground

Interactive examples with mock or explicitly selected real providers, live Lens
monitoring, and recorded trace replay. Node.js 22 or newer is required.

## Local workspace

The authored `file:` dependencies are intentional. Place this repository beside
built `agentfootprint`, `agentfootprint-lens`, `explainable-ui`, and `footPrint`
checkouts. Install/build those libraries using their own
instructions, then run `npm install`, `npm test`, `npm run lint`, and
`npm run test:types` followed by `npm run build` here.
`npm run dev` starts the playground. Mock is the default provider; no API key is
needed for tests or the default examples.

Examples come from `../agentfootprint/examples`. Their metadata is parsed as
literal data at build time; opening the catalogue does not run an example.
Examples without an exported browser `run()` entry remain available as source,
with an explicit CLI-only notice. A sample is identified by its folder/mode and
id, not by id alone.

## Migration: engine 14 release candidate and Foottrace 2.1

The native preparation targets the published `footprintjs@14.0.0-rc.0` and
`foottrace@2.1.0` together. The authored local engine, AgentFootprint, Lens and UI
links and historical Foottrace caret remain unchanged until the complete native
transaction is ready. Use the exact compatible candidate packages together;
an older engine or agent can otherwise install another Foottrace copy.

The committed lock and published-package CI setup still describe the previous
cohort. Paired installation, build and test validation remain pending; the
dependency declaration alone does not establish compatibility. App behavior,
record readers and saved traces are unchanged.

## Package boundary and CI

The engine stays in `footprintjs`; record readers/writers/path helpers come from
the three public `foottrace`, `foottrace/write`, and `foottrace/paths` doors.
The agent sandbox retains its explicit approved-name list, supplied from each
name's official AgentFootprint export. It does not resolve arbitrary imports.
It is an in-page teaching executor, not an isolation boundary for hostile code.

The guarded native CI route uses fixed original AF/Lens source artifacts plus the exact compatible
published renderer. It restores the authored manifest and historical lock before the original test,
capture-contract type check, lint and complete TypeScript + Vite build. Missing producer qualification
refuses before setup; the current local policy is still waiting for Lens and renderer facts. A dependency
or data observation is not consumer compatibility. Source-linked examples come from the exact admitted
AgentFootprint source, and use the same installed engine/reader/context graph as the app.

The E5 migration also repairs pre-existing removed root imports, the obsolete
`ExplainableShell.spec` prop, eager example execution during catalogue discovery,
and duplicate sample-id selection. The chart comes from the real runner, and
regression tests retain the ordinary run/replay and import-allowlist paths.
The obsolete `agent-samples` dependency is removed: commit `3c8c5ae` moved the
catalogue to `agentfootprint/examples`, but left that unused dependency edge.

## UI quality checks

The lint configuration shares the FootPrint playground's recommended TypeScript,
React Hooks, and React Refresh rules. Components and reusable helpers have
separate modules so Fast Refresh can retain component state safely. CI runs the
same `npm run lint` command as local development, with those recommended rules
enabled unchanged.

Offline mounted-page tests use jsdom to check sample navigation, late execution
results, provider-model request ownership, and trace metadata replacement. A
sample session owns its execution state; switching samples keeps the user's
question and display/provider preferences but cannot attach a previous sample's
late answer. Generated sandbox capture tests use real public snapshot/narrative
types and mock providers; they do not validate arbitrary evaluated code or turn
the teaching sandbox into a security boundary. Tests require no provider keys.
`npm run test:types` checks the capture test's public-type equalities with strict
TypeScript; the runtime test runner alone does not enforce those assertions.
Model-list normalization retains each provider's existing filtering/failure
behavior. One explicit correction keeps a malformed non-string Anthropic display
name out of React and sorting: the validated model ID becomes its label instead.
