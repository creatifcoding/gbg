---
up: INDEX.md
prereqs: ../grounding.md, object-model.md, programmable-transaction-blocks.md
provides: mysten-core-api-map, transaction-builder-map, bcs-codegen-boundary, wallet-serialization-rule
children: none
update-strategy: refresh when Mysten TypeScript SDK docs/source or Effect-Sui adapter/query/PTB integration changes
update-status: current
---

# Mysten TypeScript SDK Map

> up: INDEX.md
> prereqs: ../grounding.md, object-model.md, programmable-transaction-blocks.md
> provides: mysten-core-api-map, transaction-builder-map, bcs-codegen-boundary, wallet-serialization-rule
> children: none

Primary sources:

- `submodules/ts-sdks/packages/docs/content/sui/clients/core.mdx`
- `submodules/ts-sdks/packages/docs/content/sui/transaction-building/gas.mdx`
- `submodules/ts-sdks/packages/docs/content/sui/sdk-building.mdx`
- `submodules/ts-sdks/packages/sui/src/client/core.ts`
- `submodules/ts-sdks/packages/sui/src/client/client.ts`
- `submodules/ts-sdks/packages/sui/src/transactions/Transaction.ts`
- `submodules/ts-sdks/packages/sui/src/transactions/Inputs.ts`
- `submodules/ts-sdks/packages/sui/src/transactions/Commands.ts`
- `submodules/ts-sdks/packages/codegen/src/generate-utils.ts`

## Core API Philosophy

`ClientWithCoreApi` is transport-agnostic. gRPC, GraphQL, and JSON-RPC clients should share `client.core` methods.

Effect-Sui should depend on the narrowest client shape it needs:

```text
read/query concerns       → ClientWithCoreApi object/coin/transaction methods
execute/finality concerns → executeTransaction, waitForTransaction, getTransaction
PTB build concerns        → Transaction builder + Inputs helpers
```

## Object Reads

Core object methods return default metadata (`objectId`, `version`, `digest`, `owner`, `type`) and optional includes.

| Include | Use | Warning |
|---|---|---|
| `content` | BCS-encoded Move struct content. | Preferred for generated parsers/codegen. |
| `json` | JSON representation. | Shape can vary by transport; avoid for canonical decoding. |
| `objectBcs` | Full object envelope. | Do not feed to Move struct parser. |
| `display` | Sui Display metadata. | Presentation only. |

Effect-Sui map:

- `src/query/resolver-core.ts`: get object(s), normalize refs/owners.
- `src/query/bcs-codec.ts`: wrap parser failures.
- `src/schema/objects.ts`: public object/ref schemas.

## Transactions

Core transaction methods:

| Method | Use |
|---|---|
| `executeTransaction` | Submit signed transaction bytes + signatures. |
| `simulateTransaction` | Dry-run/preflight; can include command results. |
| `signAndExecuteTransaction` | SDK convenience with signer. Useful reference; Flow often separates signing/execution. |
| `getTransaction` | Fetch finalized/indexed transaction by digest. |
| `waitForTransaction` | Wait until transaction is available; prevents immediate-query races. |
| `getReferenceGasPrice` | Gas price policy input. |

Always inspect success/failure shape. The Core API may return `Transaction` or `FailedTransaction`, not merely throw.

Effect-Sui map:

- `src/flow/rpc-preflight.ts`: simulate.
- `src/flow/rpc-execution.ts`: execute.
- `src/flow/rpc-finality.ts`: wait/get transaction.
- `src/diagnostics/classify.ts`: normalize thrown and returned failures.

## Transaction Builder

The builder provides:

- `new Transaction()`;
- `tx.pure.*` helpers for BCS pure values;
- `tx.object(objectId)` and `Inputs.ObjectRef` / `Inputs.SharedObjectRef` for explicit refs;
- `tx.splitCoins`, `tx.transferObjects`, `tx.moveCall`, `tx.publish`, etc.;
- `tx.gas` special gas argument;
- `tx.build({ client })` for bytes;
- `Transaction.from(bytes)` and `Transaction.fromKind(kindBytes)`;
- `tx.serialize()` for wallet/app transfer of a builder instance.

## Build vs Serialize

Mysten docs recommend wallet apps pass a `Transaction` object and use `tx.serialize()` when sending a PTB from app context to wallet context. Do not build bytes in app code just to hand them to a wallet; serialization lets the wallet apply gas logic and coin selection.

Effect-Sui adapter rule:

```text
wallet boundary → Transaction / serialize / Transaction.from
execution boundary → built bytes + signatures
```

## Offline Build

Offline build requires fully specified:

- pure bytes;
- owned/immutable object refs;
- shared object refs with initial shared version and mutability;
- gas owner/payment/price/budget.

If any are missing, use a client to resolve them. Do not bury network resolution inside pure PTB constructors.

## BCS and Codegen Boundary

Mysten owns BCS and generated Move bindings:

- `@mysten/bcs` and `@mysten/sui/bcs` for serializers/parsers;
- `@mysten/codegen` for package/module bindings;
- generated struct parsers for `content` bytes.

Effect-Sui owns:

- Schema validation at public boundaries;
- typed Effect errors;
- diagnostics and retry hints;
- Flow orchestration;
- typed facades (`SuiObject`, `SuiPTB`, `SuiTx`, `SuiPackage`).

## Error Handling Rule

Methods fetching multiple objects can return per-item `Error` values. Transaction execution can return a failed transaction result. Treat both as typed data to classify, not as impossible states.
