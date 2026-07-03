I couldn’t write the file directly here (read-only), so here’s the report content for:

`/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/research/gbg-openprose-reactor-map.md`

# GBG OpenProse / Reactor map

## source inventory

- `.gitmodules` maps `submodules/openprose` to `https://github.com/openprose/prose`.
- OpenProse submodule:
  - `submodules/openprose/packages/reactor` — SDK/runtime source tree
  - `submodules/openprose/packages/reactor-cli` — CLI source tree
  - `submodules/openprose/skills/open-prose/**` — canonical semantics, examples, guidance
  - `submodules/openprose/spec/00-Tenets.md` … `04-Evals.md` — spec corpus for language/harness/pattern/evals
- LimitlessRP Reactor assets:
  - `packages/limitlessrp/reactor/reactor.yml`
  - `packages/limitlessrp/reactor/iridium-source-refresh.prose.md`
  - `packages/limitlessrp/reactor/iridium-research-cache.prose.md`
  - `packages/limitlessrp/reactor/iridium-due-diligence-memo.prose.md`
  - `packages/limitlessrp/docs/reactor/README.md`
  - `packages/limitlessrp/docs/live-research-runbook.md`
  - `packages/limitlessrp/docs/agent-dispatch.md`
  - `packages/limitlessrp/docs/research/README.md`
  - `packages/limitlessrp/workflows/iridium-commodity-trade-analysis.prose.md`
  - `packages/limitlessrp/workflows/iridium-research-scrape.prose.md`
  - `packages/limitlessrp/data/sources/iridium.sources.json`
  - `packages/limitlessrp/data/cache/iridium.initial-findings.json`
- Other local Reactor-labelled code (separate from OpenProse):
  - `packages/tmnl/scripts/reactor-topology-atlas.ts`
  - `packages/tmnl/scripts/reactor-v2-validation.sh`
  - `packages/tmnl/src/lib/iiot/services/reactor/**`

## version / commit evidence

| Item | Evidence |
|---|---|
| repo HEAD | `b6fc855c` |
| OpenProse submodule HEAD | `6b49de5221fe1b80516bf535282d411042c2ece6` |
| OpenProse tag | `reactor-v0.3.1-cli.0.2.2` |
| `@openprose/reactor` version | `0.3.1` (`submodules/openprose/packages/reactor/package.json`) |
| `@openprose/reactor-cli` version | `0.2.2` (`submodules/openprose/packages/reactor-cli/package.json`) |
| CLI binary | `reactor` ships from `@openprose/reactor-cli` (`bin: dist/cli.js`) |
| CLI version source | `cliVersion()` reads `package.json` at runtime (`packages/reactor-cli/src/meta.ts`) |

Note: `submodules/openprose/README.md` still says live npm versions `0.3.0` / `0.2.0`; that’s stale versus the manifests/tag above.

## Reactor concepts

- `kind: responsibility` = mounted node with `### Requires`, `### Maintains`, `### Continuity`.
- `kind: gateway` = external-driven responsibility.
- `kind: function` = stateless helper (`### Parameters` → `### Returns`).
- Forme compiles `Requires.<facet> ↔ Maintains.<facet>` into a topology world-model (`nodes`, `edges`, `entry_points`, `acyclic`).
- Run phase is deterministic: compare `(contract_fingerprint, input_fingerprints)`; unchanged => `skipped`, moved => `rendered`, failed => `failed`.
- Receipts are content-addressed and chain-verified; `observe()` rolls up cost by surprise and node.
- `reactor()` is the one-call facade from a contracts directory to a booted reactor handle.
- `reactor-cli` is the host/driver: `init`, `doctor`, `compile`, `run`, `serve`, `trigger`, plus keyless `status/topology/inspect/logs/trace/receipts`.

Key source files backing that:
- `submodules/openprose/skills/open-prose/concepts/reactor.md`
- `submodules/openprose/skills/open-prose/concepts/responsibility.md`
- `submodules/openprose/skills/open-prose/responsibility-runtime.md`
- `submodules/openprose/skills/open-prose/forme.md`
- `submodules/openprose/skills/open-prose/contract-markdown.md`
- `submodules/openprose/packages/reactor/src/index.ts`
- `submodules/openprose/packages/reactor/src/sdk/facade.ts`
- `submodules/openprose/packages/reactor/src/sdk/observe.ts`
- `submodules/openprose/packages/reactor/src/sdk/ingress.ts`
- `submodules/openprose/packages/reactor/src/receipt/index.ts`
- `submodules/openprose/packages/reactor-cli/src/cli.ts`
- `submodules/openprose/packages/reactor-cli/src/config.ts`

## local assets

### LimitlessRP Reactor
- `packages/limitlessrp/reactor/reactor.yml` uses:
  - `provider: openrouter`
  - `render_model: google/gemini-3.5-flash`
  - `compile_model: google/gemini-3.5-flash`
  - `telemetry.enabled: false`
- It seeds one static gateway:
  - node: `iridium_source_refresh`
  - `sourceRegistrySha: seed-registry-v0`
  - `requestedAt: 2026-06-03T00:00:00Z`
- `packages/limitlessrp/reactor/.reactor/` is absent.
- Missing generated artifacts:
  - `packages/limitlessrp/data/cache/iridium.research-cache.json`
  - `packages/limitlessrp/docs/research/iridium-refresh-report.md`
  - `packages/limitlessrp/docs/research/iridium-due-diligence-memo.md`
- `packages/limitlessrp/data/cache/iridium.initial-findings.json` is seed-only, not live market data.

### LimitlessRP workflow seam
- `packages/limitlessrp/workflows/iridium-research-scrape.prose.md` is the live scrape/audit routine.
- `packages/limitlessrp/workflows/iridium-commodity-trade-analysis.prose.md` is the intake/diligence memo routine.
- `packages/limitlessrp/docs/live-research-runbook.md` and `docs/agent-dispatch.md` define guardrails and agent roles.
- `packages/limitlessrp/docs/research/README.md` expects `iridium-refresh-report.md`.

### OpenProse source tree state
- `submodules/openprose/packages/reactor/dist` and `submodules/openprose/packages/reactor-cli/dist` are absent here, so this checkout is source-only for those packages.

## integration opportunities

- Replace the static `iridium_source_refresh` seed with a real file/http watcher or connector.
- Wire `iridium_research_cache` to regenerate only when `source_refreshes` moves; wire `iridium_due_diligence_memo` only when audited cache/intake moves.
- Add `reactor:doctor` and `reactor:compile:check` to CI/Nx workflows (targets exist; I found no workflow references in repo search).
- Use `reactor-devtools` replay as the audit trail for memo/cache changes and spend.
- Keep `packages/tmnl/**/reactor` separate from OpenProse Reactor; it’s a naming collision, not the same runtime.

## risks

- Doc drift: OpenProse README version note is stale (`0.3.0` / `0.2.0` vs actual `0.3.1` / `0.2.2`).
- No compiled reactor state exists here, so runtime behavior is not exercised in this checkout.
- Static seed gateway means no real event flow yet.
- The repo has two unrelated “Reactor” namespaces (OpenProse vs tmnl), which can confuse search/ownership.

## commands that are evidence-backed

### Keyless / CI-safe
```bash
cd packages/limitlessrp/reactor
bunx --package @openprose/reactor-cli reactor doctor
bunx --package @openprose/reactor-cli reactor compile --check
```

### Live (needs model key / peers)
```bash
cd packages/limitlessrp/reactor
bunx --package @openprose/reactor-cli reactor compile
bunx --package @openprose/reactor-cli reactor serve --http 8080
bunx --package @openprose/reactor-devtools reactor-devtools .reactor --describe
```

### LimitlessRP package checks
```bash
bunx nx run @gbg/limitlessrp:typecheck
bunx nx run @gbg/limitlessrp:python:smoke
bunx nx run @gbg/limitlessrp:rust:test
bunx nx run @gbg/limitlessrp:smoke
```

### Source-registry validation
```bash
bun -e 'JSON.parse(await Bun.file("packages/limitlessrp/data/sources/iridium.sources.json").text())'
```

### OpenProse example replay (from README)
```bash
npx -p @openprose/reactor-devtools reactor-devtools --example masked-relay --describe
```

