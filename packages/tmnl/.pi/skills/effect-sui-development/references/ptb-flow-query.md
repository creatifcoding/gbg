---
up: INDEX.md
prereqs: grounding.md, package-map.md, ontology.md
provides: ptb-runtime, transaction-flow, query-runtime, package-publish, diagnostics-policy
children: none
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# PTB, Query, Flow, Package, and Diagnostics

> up: INDEX.md
> prereqs: grounding.md, package-map.md, ontology.md
> provides: ptb-runtime, transaction-flow, query-runtime, package-publish, diagnostics-policy
> children: none

## PTB Layer

`src/ptb` owns the static transaction model:

- `arguments.ts`, `inputs.ts`, `commands.ts`, `ast.ts` define Schema-backed PTB AST.
- `constructors.ts` and `make.ts` provide ergonomic creation.
- `analyzer-*` validates command arity/arguments and collects object inputs/diagnostics.
- `compiler-*` applies AST to Mysten `Transaction` and resolves `Input`, `GasCoin`, `Result`, `NestedResult`.
- `runtime.ts` is the ManagedRuntime-backed public builder edge.

Ground upstream with `ts-sdks/packages/sui/src/transactions/Transaction.ts` and `Commands.ts`. For digested Sui PTB mechanics, read `sui/programmable-transaction-blocks.md`.

## Query Layer

`src/query` owns reads and decoding:

- `resolver-core.ts` reads object data and normalizes refs/owners/content.
- `resolver-shared-ref.ts` turns shared owners into `SharedObjectRef`.
- `bcs-codec.ts` wraps Mysten parsers/serializers with typed failures.
- `runtime-client.ts` is the edge-owned Query facade; dispose it when you create it.

## Flow Layer

`src/flow` owns transaction lifecycle:

```text
PTB requirements → reservation request → gas/payment plan → auth/signing
→ dry-run/preflight → execute → wait finality → reconcile/release
```

Key files:

- `runner-lifecycle.ts`: lifecycle state machine.
- `runner-completion.ts`: PTB requirement and preflight invariants.
- `runner-reconcile.ts`: finalizer/release reconciliation.
- `gas*.ts`, `payment*.ts`, `auth*.ts`: policy and signing machinery.
- `rpc-*.ts`: dry-run, execute, finality wait/watch.
- `runtime-client.ts`: Flow client and watcher edge.

## Package Publish

`src/package/publish.ts` owns compiled Move publish requests and PTB construction. It expects compiled modules/dependencies from `sui move build --dump-bytecode-as-base64`, then publishes through Flow/TxRunner and extracts `PackageWrite` / `UpgradeCap` evidence. Read `sui/move-packages.md` before changing this boundary.

## Diagnostics

Diagnostics classify `unknown`, typed errors, `Cause`, and `Exit`. They may attach severity, category, phase, retry hint, and event metadata. They must never change retry/execution policy by themselves. Execution semantics live in Flow policies, not diagnostics.

## Deep Sui Cross-Refs

- `sui/object-model.md`: object refs, shared refs, owner normalization.
- `sui/transaction-lifecycle.md`: finality watchers, certified effects, idempotent resubmit.
- `sui/programmable-transaction-blocks.md`: PTB commands, argument/result semantics, gas coin rules.
- `sui/gas-auth.md`: gas/payment/auth, sponsorship, concurrency hazards.
- `sui/mysten-ts-sdk.md`: Core API and Transaction builder behavior.
