# AVA v2 TypeScript Completion Strategy

> **Status**: Strategic Analysis & Tactical Roadmap
> **Date**: 2026-01-08
> **Author**: Val (Prime's Architectural Conscience)
> **Session**: Ralph Loop - Research & Integration

## Executive Summary

The AVA v2 TypeScript implementation is **substantially complete**. The core architecture (schemas, services, atoms, hooks, provider) is functional with comprehensive test coverage. However, several opportunities exist to deepen Effect integration and complete component-level adoption.

## Current Implementation Status

### Completed Components (✅)

| Component | Location | Coverage | Notes |
|-----------|----------|----------|-------|
| **Effect Schemas (v2)** | `schemas/v2/` | 100% | All domain types, branded identifiers |
| **NatsClient Service** | `services/NatsClient.ts` | 100% | WebSocket transport, JSON subscriptions |
| **AvaClientV2 Service** | `services/AvaClientV2.ts` | 100% | FiberMap integrated, scoped lifecycle |
| **Atoms (v2)** | `atoms/v2/index.ts` | 100% | Operations, state atoms, derived atoms |
| **Hooks (v2)** | `hooks/v2/index.ts` | 100% | 8 hooks covering all use cases |
| **AvaProvider** | `components/AvaProvider.tsx` | 100% | Registry injection, lifecycle cleanup |
| **Delta Matching** | `utils/delta-matching.ts` | 100% | Effect.Match for ViewDeltaPayload |
| **Traced Utilities** | `utils/traced.ts` | 100% | Tracing infrastructure |
| **Test Coverage** | `__tests__/` | 120/121 | 1 pre-existing mock timeout |

### Partially Integrated (⚠️)

| Component | Issue | Impact |
|-----------|-------|--------|
| **FiberMap in Atoms** | Atoms create fresh layers per operation | FiberMap benefits not realized |
| **Delta Reducer** | `applyDeltaReducer` exists but not wired | Deltas not applied to artifacts |
| **Traced Operations** | Tracing utils exist but not used in atoms | No observability in subscriptions |

### Not Yet Implemented (❌)

| Component | Priority | Dependencies |
|-----------|----------|--------------|
| **MapBlock AVA Integration** | P2 | Hooks working |
| **AG-Grid AVA Integration** | P2 | Hooks working |
| **Scene3DBlock AVA Integration** | P3 | Hooks working |
| **Live NATS Integration Tests** | P1 | Docker NATS running |

## Architectural Analysis

### Current Atom Pattern (Fresh Layer Per Operation)

```typescript
// Current: Each operation creates new layer
subscribe: Atom.fn<ViewId>()(
  (viewId, ctx) =>
    Effect.gen(function* () {
      const config = ctx(avaV2ConfigAtom)
      const layer = createAvaV2Layer(config) // ← Fresh layer each time
      // ...
    })
)
```

**Implications:**
1. FiberMap in AvaClientV2 is a new instance each operation
2. No persistent fiber tracking across operations
3. Manual HashMap in atoms for fiber management
4. Each subscribe gets its own service lifecycle

### Recommended: Shared Runtime Pattern

```typescript
// Recommended: Single persistent runtime
export const avaV2RuntimeAtom = Atom.make((get) => {
  const config = get(avaV2ConfigAtom)
  return Atom.runtime(createAvaV2Layer(config))
})

// Operations use runtime, not create layers
subscribe: avaV2RuntimeAtom.fn<ViewId>()(
  (viewId, ctx) =>
    Effect.gen(function* () {
      const client = yield* AvaClientV2
      // FiberMap persists across operations!
      yield* FiberMap.run(client.subscriptionFibers, viewId, streamProgram)
    })
)
```

**Benefits:**
1. FiberMap persists across operations
2. Automatic fiber cleanup on runtime disposal
3. Simpler atom code (no manual fiber HashMap)
4. True subscription lifecycle management

## Strategic Priorities

### P0: Immediate Tactical Wins (This Session)

These can be done without architectural changes:

1. **Wire Delta Reducer to Subscriptions**
   - Use `applyDeltaReducer` in `subscribeDelta` stream handler
   - Updates artifacts incrementally instead of full replacement

2. **Add Traced Operations to Atoms**
   - Wrap key operations with `withAvaSpan`
   - Add logging via `logAvaEvent`

3. **Integration Test Setup**
   - Verify Docker NATS is accessible
   - Create test that connects to real NATS

### P1: Short-term Architecture (Next Session)

1. **Shared Runtime Migration**
   - Refactor atoms to use `avaV2RuntimeAtom.fn()` pattern
   - Remove manual `subscriptionFibersAtom`
   - Leverage FiberMap for automatic cleanup

2. **Enhanced Error Handling**
   - Use Effect.Match for error categorization
   - Add retry schedules for transient failures

### P2: Component Integration (Follow-on)

1. **MapBlock Integration**
   - Create `useAvaMapData` hook
   - Handle GeoJSON channel type

2. **AG-Grid Integration**
   - Create `useAvaGridData` hook
   - Handle row data channel type

## Effect Patterns to Apply

### From Research

| Pattern | Location | Application |
|---------|----------|-------------|
| **FiberMap.run** | Service lifecycle | Replace manual fiber tracking |
| **Stream.fromPubSub** | NATS subscriptions | Could simplify stream creation |
| **Effect.Match** | Error handling | Categorize and handle errors |
| **Schedule.exponential** | Reconnection | Already in NatsClient |
| **Layer.scoped** | Service creation | Already implemented |

### From effect-atom Submodule

```typescript
// Registry-based testing (canonical pattern)
const r = Registry.make()
expect(r.get(myAtom)).toBe(initialValue)
r.set(myAtom, newValue)
expect(r.get(myAtom)).toBe(newValue)

// Stream atoms with mount/unmount
const unmount = r.mount(streamAtom)
await vitest.advanceTimersByTimeAsync(50)
let result = r.get(streamAtom)
assert(Result.isSuccess(result))
unmount()

// Scoped atoms with finalizers
const atom = Atom.fn((n) =>
  Effect.succeed(n).pipe(
    Effect.zipLeft(Effect.addFinalizer(() => Effect.sync(() => cleanup())))
  )
).pipe(Atom.keepAlive)
```

## Implementation Checklist

### This Session
- [x] Research FiberMap patterns via deepwiki
- [x] Research Stream.fromPubSub patterns
- [x] Review effect-atom test patterns
- [x] Analyze current implementation gaps
- [x] Document completion strategy (this file)
- [x] Wire applyDeltaReducer to subscriptions
- [x] Add traced operations to atom operations

### Next Session
- [ ] Refactor to shared runtime pattern
- [ ] Update atoms to use FiberMap from service
- [ ] Remove subscriptionFibersAtom
- [ ] Add integration tests with live NATS
- [ ] Verify end-to-end artifact streaming

### Future Sessions
- [ ] MapBlock AVA integration
- [ ] AG-Grid AVA integration
- [ ] Performance benchmarks
- [ ] Production deployment guide

## Files Modified This Session

1. **`services/AvaClientV2.ts`** - Added FiberMap, Layer.scoped
2. **`atoms/v2/index.ts`** - Delta reducer integration, traced operations, dual stream subscription
3. **`utils/delta-matching.ts`** - Effect.Match patterns for deltas
4. **`utils/index.ts`** - Exports for delta-matching
5. **`.edin/FIBERMAP_IMPROVEMENT.md`** - FiberMap documentation
6. **`.edin/EFFECT_MATCH_PATTERN.md`** - Effect.Match documentation
7. **`.edin/AVA_V2_COMPLETION_STRATEGY.md`** - This strategy document

## Key Insights from Research

### FiberMap Best Practices (from deepwiki)

1. **Always create in Scope** - `FiberMap.make()` acquires scope finalizer
2. **Use onlyIfMissing** - Prevents duplicate fibers for same key
3. **Automatic cleanup** - Fibers interrupted when scope closes
4. **FiberMap.run vs fork** - Use FiberMap.run for managed collections

### Stream Patterns (from effect-docs)

1. **Stream.async** - Callback-based stream creation
2. **Stream.fromPubSub** - PubSub to Stream conversion
3. **Stream.tap** - Side effects without transforming
4. **Stream.ensuring** - Cleanup when stream ends

### effect-atom Patterns (from submodule)

1. **Registry.make()** - Create test registries
2. **Atom.keepAlive** - Prevent GC of atom state
3. **Result.isSuccess()** - Check effect atom results
4. **r.mount(streamAtom)** - Start stream subscription

## Beads Tracking

### Ready Issues (P1)
- `tmnl-kr176` - Refactor atoms to shared runtime pattern with FiberMap
- `tmnl-jtf8p` - Create AVA v2 integration test with live NATS
- `tmnl-zjyrg` - Implement AvaProvider with Atom.runtime pattern

### Closed This Session
- `tmnl-xmyd2` - Wire traced operations into AvaClientV2 ✅

### Blocking Chain
- `tmnl-ocd3t` (Docker NATS config) → `tmnl-jtf8p` (Integration tests)
- `tmnl-kr176` (Shared runtime) → Component integration

## FiberMap Best Practices (Updated from deepwiki)

```typescript
// 1. FiberMap.run for managed collections - auto-removes on completion
yield* FiberMap.run(fiberMap, viewId, streamProgram)

// 2. FiberMap.remove for explicit cleanup
yield* FiberMap.remove(fiberMap, viewId)

// 3. onlyIfMissing prevents duplicate fibers
yield* FiberMap.run(fiberMap, viewId, program, { onlyIfMissing: true })

// 4. Auto-interrupt on Layer scope close - no manual cleanup needed
const SubscriptionManagerLive = Layer.scoped(SubscriptionManager, Effect.gen(function* () {
  const fiberMap = yield* FiberMap.make<string>()
  // ... when Layer closes, all fibers interrupted
}))
```

## effect-atom Runtime Pattern (From Submodule)

```typescript
// Create runtime from layer
const counterRuntime = Atom.runtime(CounterLive)

// Create atoms from runtime
const count = counterRuntime.atom(Effect.flatMap(Counter, (_) => _.get))

// Create function atoms from runtime
const increment = counterRuntime.fn<void>()((_) =>
  Effect.flatMap(Counter, (_) => _.inc)
)

// Replace layer in tests
const r = Registry.make({
  initialValues: [Atom.initialValue(counterRuntime.layer, CounterTest)]
})
```

## References

- [AVA_V2_IMPLEMENTATION_STRATEGY.md](../src-ava/docs/AVA_V2_IMPLEMENTATION_STRATEGY.md)
- [FIBERMAP_IMPROVEMENT.md](./FIBERMAP_IMPROVEMENT.md)
- [EFFECT_MATCH_PATTERN.md](./EFFECT_MATCH_PATTERN.md)
- [effect-atom tests](../../submodules/effect-atom/packages/atom/test/Atom.test.ts)
- [Effect FiberMap docs](https://effect.website/docs/reference/effect/FiberMap/)
- [DeepWiki FiberMap Research](https://deepwiki.com/search/how-do-i-use-fibermaprun-vs-ef_df9c75c5)
