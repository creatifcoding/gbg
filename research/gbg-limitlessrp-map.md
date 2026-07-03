> Read-only scout: I couldn’t write the file, so here’s the ready-to-save markdown content for `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/research/gbg-limitlessrp-map.md`.

# gbg-limitlessrp-map

## Observed package map

- **31 files total**; package is small but polyglot.
- **Publish surface** (`package.json.files`): `dist`, `README.md`, `workflows`, `data`, `python`, `rust`
  - **Repo-only**: `docs`, `reactor`, `scripts`, `nix`
- **TS front door**
  - `src/index.ts`: `EvidenceKind`, `RiskSeverity`, `ProvenanceRef`, `EvidenceValue`, `Iridium*` intake types, `SourceRegistryEntry`, `RedFlag`, `AnalysisMemo`, `NON_ADVISORY_NOTICE`, and helpers:
    - `unknownValue`, `providedValue`, `observedValue`
    - `createEmptyIridiumIntake`
    - `collectUnknownPaths`
    - `buildRedFlags`
    - `buildAnalysisMemo`
    - `renderMarkdownMemo`
  - `src/smoke.ts`: registry + memo smoke check
- **Python**
  - `python/limitlessrp/registry.py`: `load_source_registry`, `validate_source_registry`
  - `python/limitlessrp/smoke.py`: registry-count smoke
  - `pyproject.toml`: hatchling wheel for `python/limitlessrp`
- **Rust**
  - `rust/limitlessrp-core/src/lib.rs`: `GRAMS_PER_TROY_OUNCE`, `MassUnit`, `to_troy_ounces`, `payable_troy_ounces`, unit tests
- **Data**
  - `data/sources/iridium.sources.json`
  - `data/cache/iridium.initial-findings.json`
- **Workflows**
  - `workflows/iridium-commodity-trade-analysis.prose.md`
  - `workflows/iridium-research-scrape.prose.md`
- **Reactor**
  - `reactor/reactor.yml`
  - `reactor/iridium-source-refresh.prose.md`
  - `reactor/iridium-research-cache.prose.md`
  - `reactor/iridium-due-diligence-memo.prose.md`
- **Nix/direnv**
  - `.envrc`
  - `nix/default.nix`
  - `nix/devshell.nix`
- **Docs**
  - `docs/agent-dispatch.md`
  - `docs/live-research-runbook.md`
  - `docs/reactor/README.md`
  - `docs/research/README.md`

## Nix/direnv

- Root flake imports `./nix`; package Nix module is imported from `../packages/limitlessrp/nix`.
- Package `.envrc`:
  - `use flake ../..#limitlessrp`
  - exports `LIMITLESSRP_ROOT="$PWD"`
  - exports `PYTHONPATH="$PWD/python…"`
- Devshell packages: `bun`, `nodejs_24`, `typescript`, `python312`, `uv`, `rustc`, `cargo`, `rustfmt`, `clippy`, `pkg-config`, `jq`

## Validation commands

**Package scripts**
- `bun run build`
- `bun run typecheck`
- `bun run smoke`
- `bun run python:smoke`
- `bun run rust:check`
- `bun run rust:test`
- `bun run reactor:doctor`
- `bun run reactor:compile:check`
- `bun run clean`

**Nx targets**
- `build`, `typecheck`, `python:smoke`, `rust:check`, `rust:test` are cacheable
- `smoke`, `reactor:doctor`, `reactor:compile:check` are uncached
- `build` outputs `dist`
- `nx-release-publish` package root: `dist/{projectRoot}`

**Smoke chain**
- `typecheck -> build -> python smoke -> cargo test -> JSON parse registry -> workflow file presence -> node dist/smoke.js`

## Workflow contracts

### `iridium-commodity-trade-analysis`
- Intake memo contract; required sections:
  - Executive Summary
  - Collected Facts
  - Missing Details
  - Normalized Economics
  - Market Context
  - Operational and Custody Risk
  - Counterparty and Compliance Risk
  - Red Flag Register
  - Next Due-Diligence Actions
  - Non-Advisory Notice
- Guardrails: no buy/sell/hold/finance/hedge advice; preserve unknowns

### `iridium-research-scrape`
- Five specialist roles:
  - `market-data-researcher`
  - `supply-demand-researcher`
  - `compliance-provenance-researcher`
  - `logistics-custody-researcher`
  - `source-quality-auditor`
- Fact JSON contract:
  - `sourceId`, `kind`, `claim`, `field`, `citation.url`, `asOf|unknown`, `limitations`, `confidence`
- Write targets:
  - `packages/limitlessrp/data/cache/iridium.research-cache.json`
  - `packages/limitlessrp/docs/research/iridium-refresh-report.md`

### `docs/agent-dispatch.md` / `docs/live-research-runbook.md`
- Merge/audit rules: preserve source IDs, reject uncited/ambiguous/stale claims
- Trust tiers: primary / industry / secondary / unknown
- Stop conditions: missing unit/date/currency/form, licensed-access limits, regulated-advice boundary

### Reactor contracts
- `iridium_source_refresh` gateway
- `iridium_research_cache` responsibility
- `iridium_due_diligence_memo` responsibility
- Material facets:
  - source refresh set
  - pricing_context
  - supply_demand_context
  - custody_compliance_context
  - rejected_claims
  - missing_details
  - red_flag_register
  - memo_markdown

## Data/source grounding

- Source registry: **9 entries**
  - `price-benchmark`: 3
  - `market-context`: 1
  - `market-report`: 2
  - `statistical-agency`: 1
  - `responsible-sourcing`: 1
  - `chain-of-custody`: 1
- Trust tiers:
  - primary: 3
  - industry: 5
  - secondary: 1
- Refresh cadence:
  - daily: 3
  - quarterly: 1
  - annual: 5

**Registry entries**
- `johnson-matthey-pgm-management`
- `johnson-matthey-trading`
- `umicore-iridium-price`
- `argus-iridium-rotterdam-jm`
- `johnson-matthey-pgm-report-2026`
- `johnson-matthey-pgm-report-2026-pdf`
- `usgs-mcs-2026-pgm`
- `lppm-responsible-sourcing-guidance`
- `rjc-2024-chain-of-custody`

**Seed cache**
- `data/cache/iridium.initial-findings.json`
- generated: `2026-06-03T02:45:00Z`
- status: `seed-from-search-and-fetch-highlights`
- 6 findings; explicitly **not live market data**

## Harness fit

- This is a **contract-first polyglot domain module**:
  - TS = memo/intake rendering
  - Python = registry validation/loading
  - Rust = payable-metal normalization
  - prose workflows = orchestration contracts
  - Reactor = standing-state maintenance
- Good fit for owned agent SDK/harness ambitions because the truth surfaces are explicit and deterministic.
- Current limitation: the package has **design-time contracts**, but very little executable agent runtime glue.

## Gaps

- No `data/cache/iridium.research-cache.json` yet
- No `docs/research/iridium-refresh-report.md` yet
- No `docs/research/iridium-due-diligence-memo.md` yet
- No package-specific GitHub Actions workflow
- No executable source-scrape / agent-dispatch runtime in-package; `subagent` examples are prose-only
- `docs/research/README.md` only documents the refresh report, not the due-diligence memo artifact
- Python has `pytest` in dev deps, but no test files
- Rust crate is internal only (`publish = false`)
- Reactor seed uses placeholder `seed-registry-v0` fingerprint

## Visual-explainer lanes

1. **Surface map** — TS / Python / Rust / data / workflows / Reactor / docs / Nix
2. **Grounding lane** — source registry → seed findings → refresh cache → due-diligence memo
3. **Dispatch lane** — source classes → specialist roles → merge/audit → artifacts
4. **Reactor lane** — gateway → responsibility → downstream responsibility
5. **Validation lane** — smoke/typecheck/python/rust/reactor checks
6. **Polyglot lane** — TS memo helpers ↔ Python registry validation ↔ Rust normalization