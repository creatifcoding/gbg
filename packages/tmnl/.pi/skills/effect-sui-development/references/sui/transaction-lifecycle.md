---
up: INDEX.md
prereqs: ../grounding.md, object-model.md
provides: transaction-lifecycle, finality-semantics, checkpoint-verification, idempotent-resubmit
children: none
update-strategy: refresh when Sui transaction lifecycle docs or Effect-Sui finality runners change
update-status: current
---

# Transaction Lifecycle and Finality

> up: INDEX.md
> prereqs: ../grounding.md, object-model.md
> provides: transaction-lifecycle, finality-semantics, checkpoint-verification, idempotent-resubmit
> children: none

Primary source: `submodules/sui/docs/content/develop/transactions/transaction-lifecycle.mdx`.

## Lifecycle

```text
construct transaction
→ sign intent
→ submit to full node
→ full-node Transaction Driver forwards to validator
→ validators run validity/safety checks
→ Mysticeti consensus sequences accepted transaction
→ validators execute deterministically
→ effects are certified by quorum or checkpoint
→ full node returns final effects
→ checkpoint stream makes it permanent/indexable
```

## Validity Checks That Matter to Effect-Sui

Validators reject invalid or unsafe input before execution. Important checks include:

- user signature is valid;
- input objects exist;
- signer has required read/write access;
- gas budget and payment are sufficient;
- owned object versions are not already consumed by another accepted transaction.

Effect-Sui must therefore treat preflight as evidence, not as a guarantee. A valid dry-run can still lose a race on an owned object or gas coin before submission.

## Effects Are the Execution Artifact

Execution produces transaction effects:

- created, mutated, wrapped, unwrapped, deleted objects;
- gas spent and rebates;
- success/failure status;
- events and balance changes when requested by the client.

Effect-Sui map:

- `src/flow/rpc-execution.ts`: submit/execute boundary.
- `src/flow/rpc-finality.ts`: finality wait/watch.
- `src/flow/runner-reconcile.ts`: release reservations and reconcile final object refs from effects.
- `src/diagnostics/*`: classify failures without changing execution policy.

## Certified Effects and Checkpoints

The full node obtains finality when it has certified effects: either quorum acknowledgments of the same effects digest, or inclusion in a certified checkpoint. The Sui docs state that after certified effects, the transaction is irreversible and will not be reverted.

Operational consequences:

- `waitForDigest`/finality watcher should wait for a transaction result/effects surface, not merely "submitted".
- Querying immediately after execute can race the indexer/API. Use `waitForTransaction`-style confirmation before dependent reads.
- Checkpoint inclusion is also indexer input; query systems may lag execution finality.

## Idempotence

Sui transactions are idempotent: a given signed transaction executes at most once. Resubmitting an already executed transaction returns original effects or indicates it is invalid.

Effect-Sui consequence:

- Persist pending signed/executable requests at application edges if the caller needs crash recovery.
- Retrying the same signed transaction can be safe; rebuilding and re-signing with the same owned object refs is not automatically safe.
- Reservation release must be tied to finality/invalidity evidence, not hope. Hope is not a concurrency primitive, Prime.

## Finality Timing

The docs describe typical end-to-end finality around hundreds of milliseconds, while checkpoint/indexer visibility can take longer. Test gates should allow seconds, not single-frame UI optimism.

## Watcher Rules

Finality watchers should expose:

- `fiber`: caller can observe/interrogate the watcher;
- `join`: await final result;
- `exit`: preserve typed failure/success;
- `interrupt`/`dispose`: caller-owned cleanup.

That matches Effect-Sui's runtime strategy: the creator of a long-lived runtime/fiber owns disposal.
