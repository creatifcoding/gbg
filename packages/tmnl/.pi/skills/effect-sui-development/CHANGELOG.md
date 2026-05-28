---
up: SKILL.md
prereqs: none
provides: effect-sui-development-changelog
children: none
meta: true
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Effect-Sui Development — Changelog

> up: SKILL.md
> prereqs: none
> provides: effect-sui-development-changelog
> children: none
> meta: true

## [0.2.0] — 2026-05-27

Expanded the Sui references into a nested deep dossier grounded in local Sui/Mysten sources.

| Action | File | What changed |
|---|---|---|
| `+` | `references/sui/INDEX.md` | Added second-level Sui dossier router. |
| `+` | `references/sui/object-model.md` | Added object identity, refs, versions, ownership, Query implications. |
| `+` | `references/sui/transaction-lifecycle.md` | Added submission, consensus, certified effects, checkpoints, idempotent resubmit, watcher rules. |
| `+` | `references/sui/programmable-transaction-blocks.md` | Added PTB command/input/result, gas coin, publish/upgrade, offline build rules. |
| `+` | `references/sui/gas-auth.md` | Added gas accounting, gas smashing, sponsored transaction, signature, and concurrency guidance. |
| `+` | `references/sui/move-packages.md` | Added Move package model, UpgradeCap semantics, bytecode/publish boundary. |
| `+` | `references/sui/mysten-ts-sdk.md` | Added Mysten Core API, object include, transaction builder, BCS/codegen boundary. |
| `+` | `references/sui/localnet-cli.md` | Added localnet CLI flags, config isolation, Docker fallback, wrapper validation. |
| `~` | `references/sui-research.md` | Converted flat source map into router for nested Sui dossier plus expanded primary-source map. |
| `~` | `GRAPH.md`, `references/INDEX.md`, `SKILL.md` | Updated traversal and router entries for nested Sui references. |
| `~` | `references/ptb-flow-query.md`, `references/nix-localnet-move.md`, `references/testing-release.md` | Added deep Sui cross-references. |

## [0.1.0] — 2026-05-27

Initial governed meta-skill for `@tmnl/effect-sui` development.

| Action | File | What changed |
|---|---|---|
| `+` | `SKILL.md` | Created root router, load triggers, non-negotiables, source-first protocol, and fast path commands. |
| `+` | `GRAPH.md` | Created traversal graph across root docs and references. |
| `+` | `references/INDEX.md` | Created reference router for Effect-Sui topics. |
| `+` | `references/grounding.md` | Added path anchors, source precedence, mandatory local primary sources, and research gate. |
| `+` | `references/package-map.md` | Added module ownership map for schema/effectable/PTB/query/flow/reservation/package/adapter/diagnostics/testing. |
| `+` | `references/ontology.md` | Added public noun lattice, yield semantics, BCS boundary, and design decision anchors. |
| `+` | `references/ptb-flow-query.md` | Added transaction subsystem map for PTB, Query, Flow, package publish, and diagnostics. |
| `+` | `references/nix-localnet-move.md` | Added package shell, curated mission-control, localnet toolbox, Move toolbox, Docker fallback, and Nix module map. |
| `+` | `references/testing-release.md` | Added quality/localnet gates, E2E modes, change-type validation matrix, and artifact hygiene. |
| `+` | `references/sui-research.md` | Added Sui/Mysten SDK primary-source map, grep commands, and CLI help checks. |
| `+` | `references/editing-protocol.md` | Added dirty-root protection, index lock handling, explicit staging, and commit readiness checklist. |
