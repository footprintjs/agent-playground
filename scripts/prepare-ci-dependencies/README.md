# Closed native dependency setup

`prepare-ci-dependencies.mjs` is the workflow-only facade for PREFLIGHT → FETCH → PREPARE → VERIFY.
The fixed input policy currently refuses: the independently qualified Lens image and its published-renderer
contract are not configured. This local source is not an activated or accepted runtime route.
PREFLIGHT is the first shell after checkout/Node setup, before even the global resolver install.
It cannot be skipped or ignored; each later stage still checks qualification independently.
The current four-body archive branch is AF-specific. The observed Lens nine-body compatibility
strategy still needs its own source/provider/member binding before any input policy is enabled.

The five temporary requests are exact published engine14.0.0-rc.0/Foottrace2.1.0, original accepted AF/Lens
archives, and one exact compatible published renderer. Unknown links/roles/workspaces refuse. The authored
source links, historical Foottrace caret, package version, public lock and all app behavior remain unchanged.
The historical lock is not a fabricated published AF15 lock. The native lock is genuinely regenerated from
that baseline for only these five requests, then strict npm ci runs the original lifecycle hooks.

```mermaid
flowchart LR
  fixed[Closed accepted source and registry facts] --> preflight[PREFLIGHT: metadata and immutable source]
  preflight --> fetch[FETCH: read-only token/API]
  fetch --> data[Original ZIP and provider receipts]
  data --> prepare[PREPARE: no token]
  prepare --> admit[Re-admit outer digest, source and original members]
  admit --> temporary[Five request projection and strict install]
  temporary --> restore[Restore original bytes and modes even on refusal]
  restore --> gates[Original test, strict types, lint and build]
  gates --> verify[VERIFY: prior-step digest and fresh re-admission]
```

## Ownership

- `projection.mjs`: pure five-request transformation, preserving unrelated fields and the original input.
- `admission.mjs`: fixed roles, exact provider attempt/source/tested parents/gate closure and original archive
  identity. Only the actual named AF docs failure can be excepted; Lens gates must succeed. Package contents
  are inspected through the existing pinned shared-ci DATA facade, never a second tar reader.
- `transport.mjs`: one-attempt workflow-token GETs, strict metadata joins and saved-original re-admission.
  A 403/404 is a failure with no credential fallback. Only FETCH has the standard workflow token.
- `filesystem.mjs`: bounded regular files, immutable Git sources, exact byte/mode restoration and minimal
  token-free npm environment with separate empty user/global configuration files.
- `namespaces.mjs`: actual App and source-helper namespaces, hidden/nested aliases and locks plus the one
  admitted common-parent dependency link. Directory links inside dependencies refuse; declared bin links
  are checked. This does not assume a root-only graph.
- `installed.mjs`: original AF/Lens members, one physical engine/reader/context owner, actual renderer SRI,
  resolution from every family/source owner, genuine normal/hidden locks and unchanged compiler image.
- `transaction.mjs`: fixed stage wiring, exclusive prepare attempt, strict lock/install and unconditional
  restoration. The original document bytes/modes are independently joined to immutable consumer Git HEAD.
  VERIFY checks an immutable prior-step checkpoint digest, re-admits original ZIP/TGZ/receipts against the
  fixed policy and observes all installed/source/compiler/lock images again.

The AF example checkout is the exact admitted source head. Its helper intentionally imports AF source;
it is not claimed to come from the packed archive. Its tracked source inventory, manifest/lock hashes,
HEAD/tree, absence of ignored injected files and shared dependency resolution are guarded. It receives
no separate dependency install or producer build.

`scripts/native_inputs.py` keeps its DATA_ONLY inspector. The public package facade additionally exposes
bounded `source_members` for exactly four named original ZIP bodies; `scripts/native_source_zip.py` stages
or checks those bytes as data only. Neither extracts a tar or imports package code. The old failed-producer
transport experiment and obsolete registry table are removed, with their historical proof kept outside
this source. The native workflow uploads only compact receipts, manifests, native lock and command logs;
no npm cache, dependency/build tree or duplicate producer archive is uploaded.

Cheap dependency-free controls:

```sh
node --test scripts/prepare-ci-dependencies/*.node-test.mjs
python3 -B -m unittest discover -s scripts/native_inputs -t scripts -p '*_test.py' -v
```

Fixtures contain inert executable-looking text but never load it. They check source/member/compiler/lock
changes, partial-failure restoration, staged-only changes, hidden obsolete readers in both namespaces,
dangling/foreign links, provider identity and pre-effect refusal. These are source controls, not a native
installation or whole consumer proof. Hosted tests, strict declarations, lint, build and exact-head review
remain required before acceptance. No publication or registry-AF claim is made.
