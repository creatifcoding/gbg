# @gbg/limitlessrp

Limitless Research Protocol (LimitlessRP) is a GBG Domain Module / Capability Module package for source-grounded commodity intelligence workflows.

Current vertical slice: **iridium commodity detail acquisition and non-advisory analysis**.

## Surfaces

- **TypeScript**: shared schemas, intake helpers, red-flag generation, markdown memo rendering.
- **Python**: source-registry loading and validation utilities for scraper/analysis scripts.
- **Rust**: dependency-free mass/payable-metal normalization helpers.
- **Prose workflows**: `.prose.md` routines for intake analysis and agentic scraping.
- **Nix/direnv**: package-specific devshell via root flake output `.#limitlessrp`.

## Commands

From repo root:

```bash
bunx nx show project @gbg/limitlessrp
bunx nx run @gbg/limitlessrp:typecheck
bunx nx run @gbg/limitlessrp:python:smoke
bunx nx run @gbg/limitlessrp:rust:test
bunx nx run @gbg/limitlessrp:smoke
```

From this package:

```bash
bun run typecheck
bun run build
bun run python:smoke
bun run rust:test
bun run smoke
```

## Nix and direnv

Root `.envrc` uses the default flake devshell. This package also provides a package-local `.envrc`:

```bash
cd packages/limitlessrp
direnv allow
```

The package shell is bound to the root flake output:

```bash
nix develop ../..#limitlessrp
```

The package Nix modules live under `packages/limitlessrp/nix/` and are imported by the root `nix/default.nix` flake-parts module.

## Workflows

- `workflows/iridium-commodity-trade-analysis.prose.md` — intake, diligence, normalized economics, risk register, memo output.
- `workflows/iridium-research-scrape.prose.md` — source-grounded scraping routine with specialist Pi-agent dispatch roles.

## Research operations

- `docs/agent-dispatch.md` — Pi subagent role strategy and merge/audit rules.
- `docs/live-research-runbook.md` — live scraping guardrails, trust tiers, refresh cadence, and stop conditions.
- `docs/reactor/README.md` — OpenProse Reactor integration notes for standing research-state maintenance.

## Reactor standing-state harness

- `reactor/reactor.yml` — Reactor project config.
- `reactor/iridium-source-refresh.prose.md` — gateway for source-refresh arrivals.
- `reactor/iridium-research-cache.prose.md` — responsibility maintaining audited research cache.
- `reactor/iridium-due-diligence-memo.prose.md` — responsibility maintaining memo state.

Keyless local checks from `packages/limitlessrp/reactor`:

```bash
bunx --package @openprose/reactor-cli reactor doctor
bunx --package @openprose/reactor-cli reactor compile --check
```

## Data

- `data/sources/iridium.sources.json` — source registry with trust tiers, refresh cadence, expected fields, and extraction notes.
- `data/cache/iridium.initial-findings.json` — seed findings from initial search/fetch highlights. This is not live market data.

## Safety

LimitlessRP is a factual research and risk-analysis package. It does **not** recommend whether to buy, sell, hold, finance, hedge, or otherwise trade iridium or any commodity.
