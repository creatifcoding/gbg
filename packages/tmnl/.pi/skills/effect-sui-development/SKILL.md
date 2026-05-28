---
name: effect-sui-development
description: Meta-skill for @tmnl/effect-sui development: Effect v4/effect-smol patterns, Sui ontology, PTB/Flow/Query/package modules, localnet testing, Move publishing, diagnostics, and Nix mission-control tooling.
governed-by: metaskill
up: none
prereqs: effect-v4-schema, effect-v4-services, nx-workspace
provides: effect-sui-development, sui-sdk-wrapper, ptb-flow-query, localnet-gates, nix-sui-tooling
children: CHANGELOG.md, GRAPH.md, references/INDEX.md
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Effect-Sui Development

> up: none
> prereqs: effect-v4-schema, effect-v4-services, nx-workspace
> provides: effect-sui-development, sui-sdk-wrapper, ptb-flow-query, localnet-gates, nix-sui-tooling
> children: CHANGELOG.md, GRAPH.md, references/INDEX.md
> governed-by: metaskill

Prime, this is the seatbelt for `@tmnl/effect-sui`: where to look, what not to break, and which Sui/Effect/Nix rituals prevent beautiful architecture from becoming performance art.

## When to Load

- Editing anything under `packages/effect-sui/`.
- Designing or reviewing Sui object/PTB/transaction/package APIs.
- Touching `src/schema`, `src/ptb`, `src/query`, `src/flow`, `src/reservation`, `src/package`, `src/adapter`, or `src/diagnostics`.
- Changing Move fixtures, package publish helpers, `sui move` compilation, or `@mysten/codegen` integration.
- Updating `packages/effect-sui/nix/**`, mission-control commands, Sui localnet, Docker localnet, or shell ergonomics.
- Debugging localnet e2e, finality watchers, wallet callback auth, gas/payment planning, package registry, or STM reservations.
- Preparing release gates, docs, or commits for Effect-Sui.

## Non-Negotiables

- Use `effect-v4` alias / effect-smol-first patterns. Do not silently import legacy Effect APIs.
- Domain data/errors are Schema-backed. Raw interfaces are for third-party boundaries and narrow component props, not public Sui nouns.
- `ManagedRuntime` belongs at long-lived public/non-Effect edges. Creator owns `dispose()`.
- Diagnostics classify and annotate only; they must not alter execution semantics.
- Localnet is the confidence surface for chain semantics. Unit/fake/property tests are contract checks, not final proof.
- BCS belongs to Mysten SDK/codegen. Effect-Sui validates/transforms/classifies; it does not reinvent binary serialization.
- Stage explicit paths only. Never `git add -A`, never wildcard-stage, and always check `.git/index.lock`, cached diff, and scoped status first.

## Router

```text
What are you doing in Effect-Sui?
│
├─ Need the source-of-truth reading order / path anchors ─ references/grounding.md
├─ Need to know which package module owns a concern ───── references/package-map.md
├─ Designing public nouns / yield semantics / boundaries ─ references/ontology.md
├─ Working on PTB, Query, Flow, TxRunner, package publish ─ references/ptb-flow-query.md
├─ Working on Nix, localnet, Docker, Move commands ─────── references/nix-localnet-move.md
├─ Choosing validation gates or localnet modes ─────────── references/testing-release.md
├─ Researching Sui / Mysten SDK / Move primary sources ─── references/sui-research.md
├─ Need deeper Sui mechanics (objects/PTBs/gas/finality) ─ references/sui/INDEX.md
├─ Editing/committing safely in the dirty monorepo ─────── references/editing-protocol.md
└─ Need the topology of this skill ─────────────────────── GRAPH.md
```

## Fast Path

From `packages/tmnl`:

```bash
cd ../../packages/effect-sui
bun run quality
bun run quality:localnet
nix develop .#effect-sui --command effect-sui --help
nix develop .#effect-sui --command effect-sui sui-move bytecode counter >/tmp/counter-bytecode.json
```

From repo root:

```bash
cd packages/effect-sui
NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false bunx nx run @tmnl/effect-sui:quality:localnet
```

## First Response Protocol

1. Identify the concern: Schema, PTB, Query, Flow, Reservation, Package, Adapter, Diagnostics, Nix, Move, or Tests.
2. Read the matching reference doc in this skill.
3. Read the local package docs/source listed there before editing.
4. If Sui/Mysten behavior is uncertain, read local `../../submodules/sui` / `../../submodules/ts-sdks` primary sources before guessing.
5. Validate with the smallest relevant gate, then escalate to localnet if chain semantics changed.
