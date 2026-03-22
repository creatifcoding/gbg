# 11 — Pi Error Handling Playbook (Strict Effect)

> Scope: `src/lib/pi-orchestrator/*`
> Goal: zero ad-hoc exception handling, fully typed failure channels.

## Decision Matrix

| Boundary | Pattern | Notes |
|---|---|---|
| Pure domain checks | `Effect.fail(new TaggedError(...))` | No thrown errors |
| Sync throw-prone code (`JSON.parse`) | `Effect.try({ try, catch })` | Map unknown to typed error |
| Callback/EventEmitter APIs | `Effect.async` / `Effect.asyncInterrupt` | Model cancellation + teardown |
| Promise APIs only | `Effect.tryPromise({ try, catch })` | Use only at true Promise boundary |
| Typed recovery | `Effect.catchTags` (preferred) + `Match.value` | Recover by `_tag` with explicit pattern branches |
| Unrecoverable invariant | `Effect.orDie` | Rare, explicit, documented |

## Canonical References

- Effect docs:
  - `Effect.try` (docId: 6313)
  - `Effect.tryPromise` (docId: 6045)
  - `Effect.fail` (docId: 6008)
  - `Effect.catchTag` (docId: 6032)
  - `Effect.orDie` (docId: 6217)
  - Yieldable errors (docId: 51)
- Submodule examples:
  - `submodules/effect/packages/effect/test/ScopedRef.test.ts`
  - `submodules/effect/packages/effect/test/FiberMap.test.ts`
  - `submodules/effect-atom/packages/atom/test/Atom.test.ts`

## Error Taxonomy Introduced

In `src/lib/pi-orchestrator/schemas/spawn.ts`:

- `SpawnError`
- `ProcessWriteError`
- `ProcessKillError`
- `ProcessExitError`
- `RpcDecodeError`
- `RpcRequestTimeoutError`
- `RpcCommandFailedError`

All are `Schema.TaggedError`, so all operational failures can be recovered with `catchTag`.

## Implementation Guardrails

1. Never use raw `try/catch` in orchestrator services.
2. Never use `tryPromise` for sync/callback code.
3. Every external failure source maps to a typed tagged error.
4. Prefer `Effect.catchTags({...})` over single-tag catch helpers for consistency.
5. Prefer `Match.value(...)` for branching in response/event/error decoding paths.
6. Atom cleanup paths use `Atom.batch` for consistency and render stability.
7. Compile gate required after each structural edit:

```bash
bunx tsc --noEmit
```
