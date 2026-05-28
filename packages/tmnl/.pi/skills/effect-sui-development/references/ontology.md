---
up: INDEX.md
prereqs: grounding.md, package-map.md
provides: sui-ontology, effectable-yield-semantics, bcs-boundary
children: none
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Ontology and Boundaries

> up: INDEX.md
> prereqs: grounding.md, package-map.md
> provides: sui-ontology, effectable-yield-semantics, bcs-boundary
> children: none

## Public Nouns

Effect-Sui centers Sui's native model, not raw SDK method names:

| Noun | Meaning | Default `yield*` intent |
|---|---|---|
| `SuiObject` | Active object capability: identity, current ref, owner, content, refresh/mutation affordances. | Refresh/read current snapshot. |
| `SuiPTB` | Programmable transaction block build program over inputs, commands, result references. | Analyze/build/compile; never execute. |
| `SuiTx` | Payable, authenticated executable lifecycle around a PTB. | Build → pay → auth → execute → wait → decode/reconcile. |
| `SuiPackage` / `SuiModule` | Immutable Move package/module factory surface. | Load descriptor/type registry/factory surface. |

`SuiQuery` and `SuiFlow` are supporting algebras: important, but not the public ontology nouns.

## Boundary Rules

- `SuiFlow` is orchestration machinery: query, reserve, build, simulate, sign, execute, wait, verify.
- `SuiQuery` is transport-safe read machinery: object lookup, decode, BCS bridge, GraphQL/gRPC/Core reads.
- `SuiPTB` must not submit to chain. Execution belongs to `SuiTx` / Flow runner.
- `SuiObjectRef` is authenticated inert data. `SuiObject` is the active capability.
- Package publish compiles Move externally or via CLI, but publishing goes through Effect-Sui Flow/TxRunner.

## BCS Boundary

Do not implement bespoke BCS. Use Mysten SDK/codegen:

```text
@mysten/bcs / @mysten/sui/bcs / generated bindings
  → Effect Schema validation/transforms
  → typed Effect errors and diagnostics
  → SuiObject / SuiPTB / SuiTx / SuiPackage capabilities
```

Effect-Sui owns classification, validation, policy, and effectful composition; Mysten owns wire serialization.

## Design Decision Anchors

Read these before changing the ontology:

- `packages/effect-sui/docs/ONTOLOGY.md`
- `packages/effect-sui/docs/DESIGN_DECISIONS.md`
- `packages/effect-sui/docs/SERVICE_ECOSYSTEM.md`
- `packages/effect-sui/docs/MANAGED_RUNTIME_STRATEGY.md`
