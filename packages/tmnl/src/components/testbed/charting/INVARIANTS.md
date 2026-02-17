# Stream + Lifecycle Invariants

## Lifecycle invariants
1. `create` must complete before `mount`.
2. `mount` only executes with non-null container.
3. unmount/dispose teardown must be idempotent.
4. dispose must be called on component teardown for auto-managed cards.

## Stream invariants
1. stream loop starts only when `state === READY` and `isStreaming === true`.
2. fiber must be interrupted on stop/unmount.
3. clear action must reset data and diagnostics for next run.
4. apply order: `appendBatchFast` -> `appendPointFast` -> `appendData` fallback.
5. bounded history is enforced by `pointCount` (`maxPoints` trim semantics).

## Error invariants
1. all chartOps calls route through `useExitRunner` and normalize failures to `ErrorPanel`.
2. stream failures surface via Effect cause logging and do not leave zombie fibers.
