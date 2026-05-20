# Effect-Sui Design Decisions

This ledger records architectural decisions that should survive context clears and implementation churn.

## DD-0001 — User-facing ontology is object / PTB / transaction / package

**Decision.** Effect-Sui's public Effectable surface is:

- `SuiObject` — active object capability.
- `SuiPTB` — full programmable transaction block as an Effectable build program.
- `SuiTx` — payable/authenticated/executable transaction lifecycle.
- `SuiPackage` / `SuiModule` — immutable package/module factory surface.

**Rationale.** Sui itself is object-centric. Transactions consume object refs and create/mutate/delete/transfer object versions. PTBs are the user transaction body: ordered commands over object and pure inputs. Packages/modules govern object types and provide the Move functions that transactions call.

**Consequence.** `SuiPTB`, `SuiTx`, and `SuiObject` are not aliases. They have separate yield semantics:

- `yield* object` refreshes/loads object state.
- `yield* ptb` resolves/builds/compiles a PTB.
- `yield* tx` executes the transaction lifecycle declared by that `SuiTx`.
- `yield* pkg` loads package/module/type metadata.

## DD-0002 — `SuiFlow` is orchestration, not the ontology grail

**Decision.** Keep `SuiFlow` as lifecycle orchestration machinery, but do not present it as the third/fourth public noun.

**Rationale.** `SuiFlow` is a process: query → reserve → build → simulate → sign → execute → wait → verify. It coordinates the nouns; it is not a Sui DAG node or package/object capability.

**Consequence.** Public examples should start from `SuiObject`, `SuiPTB`, `SuiTx`, and `SuiPackage` / `SuiModule`. `SuiFlow` can appear as an advanced runner or as service-internal implementation.

## DD-0003 — PTB construction and execution require a service ecosystem

**Decision.** `SuiPTB` and `SuiTx` are Effectable facades. The serious work belongs to services.

**Rationale.** PTB correctness spans object resolution, BCS pure values, argument/result tracking, gas, payment, auth, execution, waiting, and STM reservation. Putting all of that into one class would be a Rube Goldberg machine with a nice hat.

**Consequence.** Each service gets a normalized contract: responsibility, inputs, outputs, dependencies, invariants, failure tags, STM/concurrency policy, observability, and tests. See `SERVICE_ECOSYSTEM.md`.

## DD-0004 — Payment/gas is first-class, not an options footnote

**Decision.** Payment is modeled by dedicated `SuiGasPlanner` and `SuiPaymentService` capabilities.

**Rationale.** Sui gas has non-trivial behavior: reference gas price, budget bounds, dry-run budget estimation, gas coin overlap restrictions, automatic gas coin selection, gas smashing, address-balance gas, sponsored transactions, and concurrent gas object conflicts.

**Consequence.** `SuiTx` should accept a payment policy rather than a loose bag of optional gas fields. Payment policy interpretation belongs to services so wallet, sponsor, and offline modes can share a normalized process.

## DD-0005 — BCS is a bridge, not a replacement target

**Decision.** Do not implement a bespoke BCS serializer.

**Rationale.** Mysten owns binary layout through `@mysten/bcs`, `@mysten/sui/bcs`, and generated Move bindings. Reimplementing that makes Effect-Sui version-fragile.

**Consequence.** Effect-Sui wraps BCS parsers/serializers with Schema validation and typed Effect failures. BCS is used by object decode, pure input encode, generated package bindings, transaction bytes, and offline/wallet handoff.

## DD-0006 — STM protects owned object/gas reuse

**Decision.** Object refs, gas coins, payment objects, and execution queues are coordinated through STM-backed state.

**Rationale.** Sui rejects stale object versions and concurrent reuse. Sponsored transactions also require sponsor gas objects not to be reused in concurrent inflight transactions.

**Consequence.** Reservation happens before build/execute and is released or reconciled after success/failure. No RPC/signing should happen inside the STM transaction; STM only reserves and records local intent.

## DD-0007 — Wallet/sponsor/offline flows change the build boundary

**Decision.** `SuiTx` supports multiple auth/build modes rather than assuming immediate `signAndExecuteTransaction`.

**Rationale.** Wallet Standard prefers passing a `Transaction` class / serialized transaction, not prebuilt bytes, so the wallet can perform gas logic. Sponsored and offline signing require transaction bytes/signatures to cross process boundaries.

**Consequence.** `SuiTx` must be able to produce transaction kind bytes, unsigned transaction bytes, serialized transaction strings, signed payloads, or executed results depending on lifecycle policy.
