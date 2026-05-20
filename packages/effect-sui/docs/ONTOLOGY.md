# Effect-Sui Ontology

Effect-Sui is centered on Sui's native object/transaction/package model, not on transport methods or raw SDK helper names.

## Grounding

Sui's documentation frames the chain as an object/transaction DAG:

- Transactions consume object references and produce created, mutated, wrapped, deleted, or transferred object versions.
- Programmable transaction blocks (PTBs) are ordered command blocks over object inputs and pure BCS-byte inputs; their effects apply atomically at the end.
- Objects are the unit of storage, with ID, owner, version, digest metadata, and category-specific BCS contents.
- Move packages are immutable onchain package objects; modules define how typed Move objects are created and manipulated.

## Public Effectable grail

The user-facing model is the triumvirate:

### `SuiObject`

Onchain state plus object capability.

A `SuiObject` is not merely a `SuiObjectRef`. A ref is inert authenticated data. A snapshot is inert observed state. A `SuiObject` capability may be Effectable because it can refresh, reserve, transfer, or manufacture transactions against current chain state.

Typical responsibilities:

- stable object identity
- current authenticated ref
- ownership and access mode
- decoded BCS-backed content
- refresh / wait-for-version
- reserve for mutation
- transfer / delete / wrap affordances where allowed
- typed mutation builders supplied by packages/modules

### `SuiTx`

Transaction/state-transition capability.

A `SuiTx` is the public transaction abstraction. It may be backed by a PTB, but users should not have to think in compiler internals first.

Typical responsibilities:

- PTB command plan
- sender, gas, budget, price, expiration
- object and pure inputs
- dry-run / simulation
- signing and execution
- wait-for-transaction
- effects, events, balance changes, object changes, checkpoint visibility

### `SuiPackage` / `SuiModule`

Immutable code/type/factory surface.

A package is an onchain object containing Move bytecode modules. Modules define how typed objects are governed and manipulated. Effect-Sui should expose packages/modules as typed factories for objects and transactions.

Typical responsibilities:

- package ID and module names
- type registry / type tags
- generated Move call builders
- object factories for known types
- publish and upgrade helpers
- typed links to codegen parsers and BCS codecs

## Supporting internal algebras

These are still first-class Effect programs, but they are support machinery rather than the top-level ontology.

- `SuiPTB` — PTB construction/compilation over inputs and commands.
- `SuiQuery` — transport-safe reads, object lookup, GraphQL/gRPC/indexer reads, BCS decode.
- `SuiFlow` — orchestration: query → reserve → build → simulate → sign → execute → wait → verify.

`SuiFlow` is the conductor, not the third instrument.

## BCS boundary

Effect-Sui should not implement a bespoke BCS serializer.

BCS layout is owned by Mysten SDK/codegen:

- `@mysten/bcs`
- `@mysten/sui/bcs`
- generated Move bindings and parsers

Effect-Sui owns the bridge:

```text
Mysten BCS parser / serializer
  → Effect Schema validation and transformation
  → typed Effect errors
  → SuiObject / SuiTx / SuiPackage capabilities
```

This bridge is required because PTB pure inputs are bytes until used, object contents are BCS payloads, and generated package bindings parse/serialize Move structs. The package should wrap those codecs, classify failures, and expose typed domain values — not reimplement the binary format.
