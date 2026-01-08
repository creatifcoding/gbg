# FiberMap Improvement Recommendation for AVA v2

> **Status**: Improvement Recommendation
> **Date**: 2026-01-08
> **Author**: Val (Prime's Architectural Conscience)
> **Priority**: P2 (Performance/Reliability Improvement)

## Executive Summary

The current AVA v2 atoms implementation uses `HashMap.HashMap<ViewId, Fiber.RuntimeFiber>` for tracking subscription fibers. This pattern requires manual cleanup and doesn't integrate with Effect's Scope system. **Effect provides `FiberMap`** - a purpose-built data structure that automatically removes fibers when they complete and supports scoped cleanup.

## Current Implementation

```typescript
// atoms/v2/index.ts - Current approach

/** Active subscription fibers for cleanup */
const subscriptionFibersAtom = Atom.make<HashMap.HashMap<ViewId, Fiber.RuntimeFiber<void, unknown>>>(
  HashMap.empty()
)

// In avaV2Ops.subscribe:
const fiber = yield* Effect.fork(streamProgram)
ctx.set(subscriptionFibersAtom, HashMap.set(ctx(subscriptionFibersAtom), viewId, fiber))

// In avaV2Ops.unsubscribe:
const fiberOpt = HashMap.get(fibers, viewId)
if (Option.isSome(fiberOpt)) {
  yield* Fiber.interrupt(fiberOpt.value)
}
ctx.set(subscriptionFibersAtom, HashMap.remove(fibers, viewId))
```

### Problems with Current Approach

1. **Manual cleanup required** - Fibers must be explicitly removed on completion/error
2. **Race conditions** - Fiber might complete between get and remove
3. **No Scope integration** - No automatic cleanup when provider unmounts
4. **Memory leaks possible** - If unsubscribe fails, fiber reference persists
5. **Duplicate subscription checks** - Must manually check if fiber exists

## Recommended: Effect FiberMap

```typescript
import { Effect, FiberMap, Scope } from "effect"

// FiberMap automatically:
// - Removes fibers when they complete (success, failure, or interruption)
// - Replaces existing fiber when same key is used (interrupts previous)
// - Interrupts all fibers when Scope closes
// - Thread-safe operations

const subscriptionFiberMap = yield* FiberMap.make<ViewId>()

// Run effect and track fiber by key - auto-removes on completion
yield* FiberMap.run(subscriptionFiberMap, viewId, streamProgram)

// To replace existing subscription (interrupts previous automatically):
yield* FiberMap.run(subscriptionFiberMap, viewId, newStreamProgram)

// Check if subscription exists:
const hasSubscription = yield* FiberMap.has(subscriptionFiberMap, viewId)

// Manual removal (rarely needed - fibers auto-remove):
yield* FiberMap.remove(subscriptionFiberMap, viewId)

// Get fiber (returns Option):
const fiber = yield* FiberMap.get(subscriptionFiberMap, viewId)

// Clear all (interrupts all fibers):
yield* FiberMap.clear(subscriptionFiberMap)

// Wait for all to complete:
yield* FiberMap.join(subscriptionFiberMap)
```

## Migration Strategy

### Step 1: Create FiberMap in Service Layer

```typescript
// services/AvaClientV2.ts - Add FiberMap to service

export class AvaClientV2 extends Context.Tag("AvaClientV2")<
  AvaClientV2,
  {
    // ... existing methods
    readonly subscriptionFibers: FiberMap.FiberMap<ViewId, void, AvaSubscriptionError>
  }
>() {}

export const AvaClientV2Live = Layer.scoped(
  AvaClientV2,
  Effect.gen(function* () {
    const nats = yield* NatsClient
    const config = yield* AvaClientV2ConfigTag

    // Create scoped FiberMap - all fibers interrupted when layer closes
    const subscriptionFibers = yield* FiberMap.make<ViewId>()

    return {
      // ... other methods
      subscriptionFibers,
    }
  })
)
```

### Step 2: Use FiberMap in Operations

```typescript
// atoms/v2/index.ts - Updated operations

export const avaV2Ops = {
  subscribe: Atom.fn<ViewId>()(
    (viewId, ctx) =>
      Effect.gen(function* () {
        const client = yield* AvaClientV2

        // FiberMap.run replaces any existing subscription automatically
        // Previous fiber is interrupted, new one tracked
        yield* FiberMap.run(
          client.subscriptionFibers,
          viewId,
          streamProgram,
          { onlyIfMissing: false } // Replace existing (default)
        )

        // Or use onlyIfMissing: true to skip if already subscribed
        yield* FiberMap.run(
          client.subscriptionFibers,
          viewId,
          streamProgram,
          { onlyIfMissing: true }
        )
      }).pipe(Effect.provide(avaV2Layer))
  ),

  unsubscribe: Atom.fn<ViewId>()(
    (viewId, ctx) =>
      Effect.gen(function* () {
        const client = yield* AvaClientV2

        // Remove fiber (interrupts it)
        yield* FiberMap.remove(client.subscriptionFibers, viewId)

        // Cleanup state atoms
        ctx.set(subscriptionsAtom, HashMap.remove(ctx(subscriptionsAtom), viewId))
        ctx.set(artifactsAtom, HashMap.remove(ctx(artifactsAtom), viewId))

        // Request backend unsubscribe
        yield* client.requestUnsubscribe(viewId)
      }).pipe(Effect.provide(avaV2Layer))
  ),

  unsubscribeAll: Atom.fn()(
    (_, ctx) =>
      Effect.gen(function* () {
        const client = yield* AvaClientV2

        // Clear all fibers (interrupts all)
        yield* FiberMap.clear(client.subscriptionFibers)

        // Clear state atoms
        ctx.set(subscriptionsAtom, HashMap.empty())
        ctx.set(artifactsAtom, HashMap.empty())
        ctx.set(deltasAtom, [])
        ctx.set(connectionStatusAtom, 'disconnected')
      }).pipe(Effect.provide(avaV2Layer))
  ),
}
```

### Step 3: Remove subscriptionFibersAtom

```typescript
// Delete this atom - FiberMap handles fiber lifecycle
// const subscriptionFibersAtom = Atom.make<HashMap.HashMap<ViewId, Fiber>>(HashMap.empty())
```

## FiberMap Key Features

| Feature | Current (HashMap) | FiberMap |
|---------|-------------------|----------|
| Auto-remove on completion | ❌ Manual | ✅ Automatic |
| Scope integration | ❌ None | ✅ Full |
| Replace existing | ❌ Manual check | ✅ Built-in option |
| Thread-safe | ⚠️ Needs care | ✅ Effect-native |
| Memory leaks | ⚠️ Possible | ✅ Prevented |

## Testing Considerations

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Effect, FiberMap, Fiber, TestClock } from "effect"

describe("FiberMap subscription management", () => {
  it.effect("auto-removes fiber on completion", () =>
    Effect.gen(function* () {
      const map = yield* FiberMap.make<string>()

      // Run a quick effect
      yield* FiberMap.run(map, "test", Effect.succeed("done"))

      // Fiber auto-removed after completion
      yield* Effect.yieldNow()
      const size = yield* FiberMap.size(map)
      expect(size).toBe(0)
    }).pipe(Effect.scoped)
  )

  it.effect("replaces existing subscription", () =>
    Effect.gen(function* () {
      const map = yield* FiberMap.make<string>()
      const calls: string[] = []

      // First subscription
      yield* FiberMap.run(map, "view-1",
        Effect.gen(function* () {
          yield* Effect.sleep("1 hour")
          calls.push("first")
        })
      )

      // Replace with second subscription (interrupts first)
      yield* FiberMap.run(map, "view-1",
        Effect.gen(function* () {
          calls.push("second")
        })
      )

      yield* Effect.yieldNow()
      expect(calls).toEqual(["second"]) // First was interrupted
    }).pipe(Effect.scoped)
  )

  it.effect("clears all on scope close", () =>
    Effect.gen(function* () {
      const interrupted: string[] = []

      yield* Effect.scoped(
        Effect.gen(function* () {
          const map = yield* FiberMap.make<string>()

          yield* FiberMap.run(map, "a",
            Effect.never.pipe(
              Effect.onInterrupt(() => Effect.sync(() => interrupted.push("a")))
            )
          )
          yield* FiberMap.run(map, "b",
            Effect.never.pipe(
              Effect.onInterrupt(() => Effect.sync(() => interrupted.push("b")))
            )
          )

          // Scope closes here - both fibers interrupted
        })
      )

      expect(interrupted).toContain("a")
      expect(interrupted).toContain("b")
    })
  )
})
```

## Atom Integration Pattern

Since FiberMap requires Scope, and atoms are long-lived, the FiberMap should live in the service layer (which has a Layer-scoped lifecycle):

```typescript
// Pattern: FiberMap in Service, Atom tracks metadata only

// Service owns the FiberMap
const AvaClientV2Live = Layer.scoped(AvaClientV2, Effect.gen(function* () {
  const fiberMap = yield* FiberMap.make<ViewId>()
  // ...
}))

// Atom tracks subscription metadata (viewId, timestamps, etc.)
// Not the fibers themselves
export const subscriptionsAtom = Atom.make<HashMap.HashMap<ViewId, ViewSubscription>>(
  HashMap.empty()
)

// Operations update both FiberMap (lifecycle) and Atom (state)
```

## Implementation Checklist

- [ ] Add `FiberMap` to `AvaClientV2` service interface
- [ ] Create scoped FiberMap in `AvaClientV2Live`
- [ ] Update `avaV2Ops.subscribe` to use `FiberMap.run`
- [ ] Update `avaV2Ops.unsubscribe` to use `FiberMap.remove`
- [ ] Update `avaV2Ops.unsubscribeAll` to use `FiberMap.clear`
- [ ] Remove `subscriptionFibersAtom` (no longer needed)
- [ ] Add FiberMap tests to `ava-v2-services.test.ts`
- [ ] Verify cleanup on provider unmount

## References

- [FiberMap.make Documentation](https://effect.website/docs/data-types/fibermap/)
- [Effect Scope Documentation](https://effect.website/docs/resource-management/scope/)
- [Current atoms/v2/index.ts](../src/lib/ava/atoms/v2/index.ts)
- [AVA v2 Implementation Strategy](../src-ava/docs/AVA_V2_IMPLEMENTATION_STRATEGY.md)
