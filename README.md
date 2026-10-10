# AgentFootprint playground

Interactive examples with mock or explicitly selected real providers, live Lens
monitoring, and recorded trace replay. Node.js 22 or newer is required.

## Local workspace

The authored `file:` dependencies are intentional. Place this repository beside
built `agentfootprint`, `agentfootprint-lens`, `explainable-ui`, and `footPrint`
checkouts. Install/build those libraries using their own
instructions, then run `npm install`, `npm test`, and `npm run build` here.
`npm run dev` starts the playground. Mock is the default provider; no API key is
needed for tests or the default examples.

Examples come from `../agentfootprint/examples`. Their metadata is parsed as
literal data at build time; opening the catalogue does not run an example.
Examples without an exported browser `run()` entry remain available as source,
with an explicit CLI-only notice. A sample is identified by its folder/mode and
id, not by id alone.

## Package boundary and CI

The engine stays in `footprintjs`; record readers/writers/path helpers come from
the three public `foottrace`, `foottrace/write`, and `foottrace/paths` doors.
The agent sandbox retains its explicit approved-name list, supplied from each
name's official AgentFootprint export. It does not resolve arbitrary imports.
It is an in-page teaching executor, not an isolation boundary for hostile code.

CI checks the actual published packages, not hidden sibling build output. In its
disposable checkout, `scripts/prepare-ci-dependencies.mjs` validates and reports
each known local-link replacement with an exact reviewed release. Unexpected
file links fail closed; unrelated dependencies and peer declarations stay
unchanged. CI regenerates the existing lock without deleting it, runs `npm ci`,
then the tests and the complete TypeScript + Vite build. The authored links stay
unchanged in Git. Raw example sources are checked out at the matching release.

The E5 migration also repairs pre-existing removed root imports, the obsolete
`ExplainableShell.spec` prop, eager example execution during catalogue discovery,
and duplicate sample-id selection. The chart comes from the real runner, and
regression tests retain the ordinary run/replay and import-allowlist paths.
The obsolete `agent-samples` dependency is removed: commit `3c8c5ae` moved the
catalogue to `agentfootprint/examples`, but left that unused dependency edge.
