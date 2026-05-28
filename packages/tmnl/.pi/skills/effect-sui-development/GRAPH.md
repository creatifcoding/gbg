---
up: SKILL.md
prereqs: none
provides: skill-topology, traversal-map
children: none
meta: true
update-strategy: refresh whenever effect-sui-development adds, removes, or renames docs
update-status: current
---

# Effect-Sui Development — Graph

> up: SKILL.md
> prereqs: none
> provides: skill-topology, traversal-map
> children: none
> meta: true
> update-strategy: refresh whenever effect-sui-development adds, removes, or renames docs
> update-status: current

## Topology

```text
SKILL.md                                      # Router + load triggers + first response protocol
├──[routes]─→ GRAPH.md                        # This file
├──[routes]─→ CHANGELOG.md                    # Version history
│
└──[routes]─→ references/INDEX.md             # Reference router
    ├──[contains]─→ grounding.md              # Source precedence, path anchors, research gate
    ├──[contains]─→ package-map.md            # Module ownership and placement rules
    ├──[contains]─→ ontology.md               # Public nouns, yield semantics, BCS boundary
    ├──[contains]─→ ptb-flow-query.md         # PTB, Query, Flow, Package, diagnostics map
    ├──[contains]─→ nix-localnet-move.md      # Nix shell, localnet, Move toolbox
    ├──[contains]─→ testing-release.md        # Gates, e2e modes, validation matrix
    ├──[contains]─→ sui-research.md           # Sui/Mysten primary source map + deep dossier router
    │   └──[contains]─→ sui/INDEX.md          # Nested Sui dossier router
    │       ├──[contains]─→ object-model.md   # Object IDs, refs, versions, ownership
    │       ├──[contains]─→ transaction-lifecycle.md # consensus, effects, checkpoints, idempotence
    │       ├──[contains]─→ programmable-transaction-blocks.md # commands, inputs/results, publish
    │       ├──[contains]─→ gas-auth.md       # gas, sponsorship, signatures, concurrency
    │       ├──[contains]─→ move-packages.md  # Move package model + publish boundary
    │       ├──[contains]─→ mysten-ts-sdk.md  # Core API, builder, BCS/codegen
    │       └──[contains]─→ localnet-cli.md   # localnet CLI, faucet, GraphQL, wrappers
    └──[contains]─→ editing-protocol.md       # Dirty-root, staging, validation discipline
```

## Parseable Entries

- [references/INDEX.md] Reference router.
- [references/grounding.md] Source precedence, path anchors, research gate.
- [references/package-map.md] Module ownership and placement rules.
- [references/ontology.md] Public nouns, yield semantics, BCS boundary.
- [references/ptb-flow-query.md] PTB, Query, Flow, Package, diagnostics map.
- [references/nix-localnet-move.md] Nix shell, localnet, Move toolbox.
- [references/testing-release.md] Gates, e2e modes, validation matrix.
- [references/sui-research.md] Sui/Mysten primary source map and nested dossier router.
- [references/sui/INDEX.md] Nested Sui dossier router.
- [references/sui/object-model.md] Object IDs, refs, versions, ownership semantics.
- [references/sui/transaction-lifecycle.md] Transaction submission, consensus, effects, checkpoints, idempotence.
- [references/sui/programmable-transaction-blocks.md] PTB commands, inputs/results, gas coin, publish/upgrade.
- [references/sui/gas-auth.md] Gas model, smashing, sponsorship, signatures, executor concurrency.
- [references/sui/move-packages.md] Move package model, UpgradeCap, bytecode publish boundary.
- [references/sui/mysten-ts-sdk.md] Mysten Core API, Transaction builder, BCS/codegen boundary.
- [references/sui/localnet-cli.md] Localnet CLI, faucet/indexer/GraphQL, wrapper validation.
- [references/editing-protocol.md] Dirty-root, staging, validation discipline.

## Traversal Hints

- Start with `grounding.md` for any non-trivial implementation.
- Read `ontology.md` before changing public nouns or yield semantics.
- Read `ptb-flow-query.md` before touching transaction lifecycle.
- Read `references/sui/programmable-transaction-blocks.md` when a PTB compiler/analyzer question depends on Sui semantics.
- Read `references/sui/gas-auth.md` before changing payment, sponsorship, wallet auth, or reservations.
- Read `nix-localnet-move.md` and `references/sui/localnet-cli.md` before changing mission-control or Sui CLI wrappers.
- Read `editing-protocol.md` before staging or committing.
