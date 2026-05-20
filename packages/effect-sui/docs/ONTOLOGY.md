# Effect-Sui Ontology

Effect-Sui is centered on Sui's native object / programmable-transaction / package model, not on transport methods or raw SDK helper names.

## Grounding

Sui's documentation frames the chain as an object/transaction DAG:

- Transactions consume object references and produce created, mutated, wrapped, deleted, or transferred object versions.
- Programmable transaction blocks (PTBs) are ordered command blocks over object inputs and pure BCS-byte inputs; their effects apply atomically at the end.
- Objects are the unit of storage, with ID, owner, version, digest metadata, and category-specific BCS contents.
- Move packages are immutable onchain package objects; modules define how typed Move objects are created and manipulated.
- Payment, gas ownership, signing, sponsored transactions, and wallet serialization are not side quests. They are part of transaction correctness.

## Public Effectable lattice

The user-facing model is an ontology lattice, not one flat class hierarchy:

```text
SuiObject  — active object capability
SuiPTB     — full programmable transaction block build program
SuiTx      — payable/authenticated/executable transaction lifecycle
SuiPackage — immutable package/module factory surface
```

`SuiFlow` remains orchestration machinery. It can exist, but it is not the third/fourth noun of the ontology.

### `SuiObject`

Onchain state plus object capability.

A `SuiObject` is not merely a `SuiObjectRef`. A ref is inert authenticated data. A snapshot is inert observed state. A `SuiObject` capability may be Effectable because it can refresh, reserve, transfer, or manufacture transactions against current chain state.

Default yield semantics:

```ts
const snapshot = yield* object
// equivalent intent: yield* object.refresh()
```

Typical responsibilities:

- stable object identity
- current authenticated ref
- ownership and access mode
- decoded BCS-backed content
- refresh / wait-for-version
- reserve for mutation
- transfer / delete / wrap affordances where allowed
- typed mutation builders supplied by packages/modules

### `SuiPTB`

Full programmable transaction block as a build program.

A `SuiPTB` represents the PTB itself: inputs, commands, argument/result graph, and pre-execution validation. It is yieldable, but yielding a PTB should build/resolve/compile the transaction plan — not submit it to chain.

Default yield semantics:

```ts
const built = yield* ptb
// result shape: compiled Mysten Transaction plus resolved inputs, command graph, and gas/payment requirements
```

Typical responsibilities:

- object inputs: owned/immutable object refs, shared object refs, receiving refs
- pure inputs: typed values or raw BCS bytes
- command list: split, merge, transfer, moveCall, makeMoveVec, publish, upgrade
- result references: `Input`, `GasCoin`, `Result`, `NestedResult`
- static command checks where possible
- borrow/move/copy/gas-coin restrictions where statically representable
- compilation to Mysten `Transaction`
- transaction-kind serialization when wallet/sponsor flows need it

### `SuiTx`

Payable, authenticated, executable transaction lifecycle.

A `SuiTx` wraps a `SuiPTB` plus sender, payment, gas, auth, execution, waiting, and verification policy. It is the public transaction capability.

Default yield semantics:

```ts
const result = yield* tx
// equivalent intent: build → pay → auth → execute → wait → decode result
```

Typical responsibilities:

- PTB source
- sender / sponsor / gas owner
- gas price, budget, expiration
- gas payment selection or address-balance mode
- dry-run / simulation for budget estimation
- signing, wallet handoff, offline signing, multisig/sponsor signature collection
- execution and wait-for-transaction
- decoded effects, events, balance changes, object changes, checkpoint visibility
- reservation finalization / release

### `SuiPackage` / `SuiModule`

Immutable code/type/factory surface.

A package is an onchain object containing Move bytecode modules. Modules define how typed objects are governed and manipulated. Effect-Sui should expose packages/modules as typed factories for objects, PTBs, and transactions.

Default yield semantics:

```ts
const descriptor = yield* pkg
// equivalent intent: load package/module/type registry
```

Typical responsibilities:

- package ID and module names
- type registry / type tags
- generated Move call builders
- object factories for known types
- PTB factories for package commands
- publish and upgrade helpers
- typed links to codegen parsers and BCS codecs

## Supporting internal algebras

These are still first-class Effect programs, but they are support machinery rather than the top-level ontology.

- `SuiQuery` — transport-safe reads, object lookup, GraphQL/gRPC/indexer reads, BCS decode.
- `SuiFlow` — lifecycle orchestration: query → reserve → build → simulate → sign → execute → wait → verify.

`SuiFlow` is the conductor, not the instrument.

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
  → SuiObject / SuiPTB / SuiTx / SuiPackage capabilities
```

This bridge is required because PTB pure inputs are bytes until used, object contents are BCS payloads, generated package bindings parse/serialize Move structs, and offline signing serializes transaction data as BCS. The package should wrap those codecs, classify failures, and expose typed domain values — not reimplement the binary format.
