---
up: INDEX.md
prereqs: ../grounding.md, object-model.md, transaction-lifecycle.md
provides: ptb-semantics, ptb-commands, inputs-results, gas-coin-rules, publish-upgrade-rules
children: none
update-strategy: refresh when Sui PTB docs, Mysten Transaction builder, or Effect-Sui PTB compiler changes
update-status: current
---

# Programmable Transaction Blocks

> up: INDEX.md
> prereqs: ../grounding.md, object-model.md, transaction-lifecycle.md
> provides: ptb-semantics, ptb-commands, inputs-results, gas-coin-rules, publish-upgrade-rules
> children: none

Primary sources:

- `submodules/sui/docs/content/develop/transactions/ptbs/prog-txn-blocks.mdx`
- `submodules/sui/docs/content/develop/transactions/ptbs/inputs-and-results.mdx`
- `submodules/sui/docs/content/develop/transactions/ptbs/building-ptb.mdx`
- `submodules/sui/docs/content/references/ptb-commands.mdx`
- `submodules/ts-sdks/packages/sui/src/transactions/Transaction.ts`
- `submodules/ts-sdks/packages/sui/src/transactions/Commands.ts`

## What a PTB Is

A PTB is an ordered, atomic command block. All commands execute as a unit: if one fails, the transaction fails and effects follow Sui execution rules. PTBs can feed results from earlier commands into later commands, but they are not a general programming language: no loops, and command count is bounded by protocol limits.

Effect-Sui noun boundary:

```text
SuiPTB = build/analyze/compile
SuiTx  = pay/auth/execute/wait/reconcile
```

Do not let `SuiPTB` submit to chain. Execution belongs to Flow/TxRunner. Prime, this is the line between a scalpel and a wood chipper.

## Command Set

| Command | Inputs | Returns | Notes |
|---|---|---|---|
| `TransferObjects` | objects by value + address | `[]` | Only PTB command that may take `GasCoin` by value. |
| `SplitCoins` | coin by mutable ref + `u64` amounts | vector of coins | Useful to create payment coins from `tx.gas`. |
| `MergeCoins` | target coin by mutable ref + coins by value | `[]` | Merged coins are consumed. |
| `MakeMoveVec` | element type option + values | `vector<T>` | Required for empty/non-object vectors. |
| `MoveCall` | package/module/function/type args/runtime args | dynamic | Arity and result count depend on Move function signature. |
| `Publish` | module bytes + transitive dependency package IDs | `UpgradeCap` | Calls module `init` functions after staging package. |
| `Upgrade` | module bytes + deps + package + `UpgradeTicket` | `UpgradeReceipt` | No `init`; ticket/package/digest policy enforced. |

## Inputs

PTB inputs are either object arguments or pure BCS bytes.

| Input kind | Shape | Effect-Sui compiler implication |
|---|---|---|
| Owned/immutable object | `{ objectId, version, digest }` | Use authenticated `ObjectRef`; stale version must be surfaced. |
| Shared object | `{ objectId, initialSharedVersion, mutable }` | Resolve via owner/shared-ref query; mutability must match intended borrow. |
| Pure value | BCS bytes | Use Mysten BCS helpers/codegen; validate Schema at edges. |
| Gas coin | special PTB argument | Borrow by ref except `TransferObjects`. |

Pure values are type-checked lazily when first used at an expected type. The same raw bytes may be valid for multiple pure types, and each typed copy behaves independently. Effect-Sui diagnostics can annotate this, but compilation should still mirror SDK semantics.

## Results

Each command appends a result vector. Later commands reference:

- `Result(i)` for a single-result command or whole result reference;
- `NestedResult(i, j)` for result `j` from command `i`;
- `GasCoin` for the gas payment coin;
- `Input(i)` for original PTB inputs.

Multi-result Move calls should be handled like TS SDK destructuring:

```ts
const [nft1, nft2] = tx.moveCall({ target: '0x2::nft::mint_many' })
tx.transferObjects([nft1, nft2], tx.pure.address(address))
```

Effect-Sui map:

- `src/ptb/arguments.ts`: argument references.
- `src/ptb/analyzer-*`: arity/reference validation and diagnostics.
- `src/ptb/compiler-*`: apply arguments/results to Mysten `Transaction`.

## Gas Coin Rules

The gas coin can be used as an argument in PTBs, but with a restriction: it must be used by reference except in `TransferObjects`, where it may be moved by value. The SDK exposes this as `tx.gas`.

Implications:

- `SplitCoins(tx.gas, [...])` is the normal payment creation path.
- `MergeCoins(tx.gas, [...])` can consolidate into gas.
- Moving `tx.gas` except through `TransferObjects` should be rejected/diagnosed before runtime if the AST makes it visible.

## End-of-Execution Checks

Sui checks remaining values after command execution:

- mutable inputs return to original owners;
- immutable/read-only inputs are skipped;
- pure inputs drop;
- shared objects may only remain shared or be deleted/re-shared;
- remaining result values without `drop` must be moved by value;
- gas budget is deducted up front, unused gas returns at end.

Effect-Sui's analyzer should catch what it can statically, but Move ability and shared-object constraints may still surface from dry-run/execution.

## Publish and Upgrade

`Publish` embeds module bytes and transitive dependency IDs directly in the command structure, not as PTB `Argument`s. It returns one `UpgradeCap`; module `init` functions run after staging, in byte-vector order.

`Upgrade` takes exactly one PTB argument: an `UpgradeTicket` by value. It returns an `UpgradeReceipt`; no `init` functions run for upgrades.

Effect-Sui map:

- `src/package/publish.ts`: compiled package request → PTB publish command.
- `nix/modules/move.nix`: `effect-sui sui-move bytecode <fixture>` compiles modules/deps.
- `test/e2e/package-registry.localnet.test.ts`: chain proof.

## Offline Build

Mysten's builder can build offline only if all pure bytes, object refs, gas config, and shared refs are fully specified. Otherwise it needs a client/provider to resolve refs, gas price, budget, and coin selection.

This is why Query and Flow are separate: Query resolves facts; Flow decides payment/auth/execution; PTB compiler should not quietly perform network policy.
