# Entity Lifecycle Event Observation — Architecture Options

> Research output: Machine.changes, RpcMiddleware.wrap, Manual Tap, Hybrid, and EventLog.changes approaches compared.
> Date: 2026-02-09
> Author: Val (research agent)

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture](#current-architecture)
3. [Option A: Machine.changes Stream](#option-a-machinechanges-stream)
4. [Option B: RpcMiddleware.wrap](#option-b-rpcmiddlewarewrap)
5. [Option C: Manual Effect.tap per Handler](#option-c-manual-effecttap-per-handler)
6. [Option D: Hybrid — Machine.changes + RpcMiddleware Enrichment](#option-d-hybrid--machinechanges--rpcmiddleware-enrichment)
7. [Option E: EventLog.changes Queue](#option-e-eventlogchanges-queue)
8. [Trade-off Matrix](#trade-off-matrix)
9. [Probability-Weighted Recommendation](#probability-weighted-recommendation)
10. [Implementation Effort](#implementation-effort)
11. [Risk Analysis](#risk-analysis)
12. [Appendix: Source Verification](#appendix-source-verification)

---

## Problem Statement

We need to observe entity state transitions across 14 entities (133 RPCs, 126 `actor.send()` calls) and publish them to the EventDistribution service for real-time subscribers via ChannelService broadcast outlets.

**Requirements:**
- Capture state transitions (before/after state) for all entity types
- Include action context (which RPC triggered the transition)
- Minimal modification to existing 14 entity handler files
- Zero risk of missed events (reliability)
- Performance: <1ms overhead per RPC call
- Works for both ES entities (Alarm, WorkOrder, EquipmentState) and asset entities (Site, Plant, Line, Area, etc.)

**Current state:**
- ReactivityBridge exists but is NOT wired into any entity handlers
- All 14 entities use `Entity.make()` + `Machine.boot()` pattern
- EventDistribution has 4 channels: readings, alarms, equipment, invalidations
- EventLog (SqlEventJournal) has a `changes` PubSub for ES entities

---

## Current Architecture

```
Entity Handler                    Machine
  |                                 |
  |-- actor.send(InternalXxx) ---->|-- Procedure.handler()
  |                                |-- publishState(newState) -> internal PubSub
  |<-- Effect<Result> -------------|
  |                                |
  |  (actor.changes available      |   Stream.concat(
  |   but NOT consumed anywhere)   |     Stream.sync(() => currentState),
  |                                |     Stream.fromPubSub(pubsub)
  |                                |   )
```

**Gap:** No bridge from entity state transitions to EventDistribution. The ReactivityBridge service exists but nothing calls it.

---

## Option A: Machine.changes Stream

### Mechanism

At `Machine.boot()` time in each entity handler, fork a fiber that subscribes to `actor.changes` and publishes each state transition to EventDistribution.

### Source Verification (VERIFIED)

From `@effect/experimental/Machine.ts:827-830`:
```typescript
changes: Stream.concat(
  Stream.sync(() => currentState),     // Emits initial state first
  Stream.fromPubSub(pubsub)            // Then all subsequent states
),
```

From `Machine.ts:594-600` (publishState):
```typescript
const publishState = (newState: Machine.State<M>) => {
  if (currentState !== newState) {      // Only publishes on ACTUAL change
    currentState = newState
    return PubSub.publish(pubsub, newState)
  }
  return Effect.void
}
```

From `Machine.ts:497-500` (PubSub lifecycle):
```typescript
const pubsub = yield* Effect.acquireRelease(
  PubSub.unbounded<Machine.State<M>>(),
  PubSub.shutdown                        // Shuts down when Machine scope closes
)
```

**Key facts:**
- Stream emits initial state, then every subsequent state
- Only fires when state actually changes (referential inequality check)
- PubSub is unbounded — no backpressure risk within Machine
- Stream completes when Machine scope closes (acquireRelease)

### Code Example

```typescript
// In each entity handler (e.g., SiteEntityHandlers):
const actor = yield* Machine.boot(siteMachine)
const eventDist = yield* EventDistribution

// Fork a fiber that observes all state transitions
yield* actor.changes.pipe(
  Stream.zipWithPrevious,                     // Stream<[Option<State>, State]>
  Stream.filter(([prev, _]) => Option.isSome(prev)), // Skip initial emit
  Stream.map(([prev, curr]) => ({
    entityType: 'Site',
    entityId: /* extract from state */,
    previousState: Option.getOrThrow(prev),
    newState: curr,
    timestamp: new Date().toISOString(),
  })),
  Stream.runForEach((change) =>
    eventDist.publishEquipmentStateChange(
      new EquipmentStateChange({
        equipmentId: change.entityId,
        previousState: JSON.stringify(change.previousState),
        newState: JSON.stringify(change.newState),
        timestamp: change.timestamp,
      })
    )
  ),
  Effect.fork,
)
```

### Analysis

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Handler modification | Minimal | Add ~15 lines per entity handler (fork after boot) |
| Completeness | HIGH | Captures ALL state transitions, including internal ones |
| Action context | NONE | Does NOT know which RPC triggered the transition |
| Previous state | YES | `Stream.zipWithPrevious` gives before/after |
| Reliability | HIGH | PubSub is unbounded, no messages lost |
| Performance | Negligible | Fiber consumes from existing PubSub — no new work in hot path |
| Entities affected | 12 files | All Machine-backed entities need the fork added |

### Pros
- Captures every state transition, even from private Machine procedures
- No modification to individual RPC handlers (126 actor.send calls untouched)
- Uses existing infrastructure (Machine already has PubSub)
- Previous state available via `Stream.zipWithPrevious`
- Stream lifecycle tied to Machine scope — automatic cleanup

### Cons
- **No action context** — knows state changed, but not which RPC caused it
- Requires modification to 12 entity handler files (add fork after Machine.boot)
- Type narrowing needed — Machine state is generic, must extract entity-specific fields
- Initial state emit must be filtered (or used for "entity appeared" event)

---

## Option B: RpcMiddleware.wrap

### Mechanism

Create a single `RpcMiddleware.Tag` with `wrap: true` that intercepts ALL entity RPC calls. After the handler succeeds, inspect the result and publish to EventDistribution.

### Source Verification (VERIFIED)

From `@effect/rpc/RpcMiddleware.ts:43-51`:
```typescript
export interface RpcMiddlewareWrap<Provides, E> {
  (options: {
    readonly clientId: number
    readonly rpc: Rpc.AnyWithProps       // Has _tag (RPC name)
    readonly payload: unknown
    readonly headers: Headers
    readonly next: Effect.Effect<SuccessValue, E, Provides>  // Handler result
  }): Effect.Effect<SuccessValue, E>
}
```

From `@effect/rpc/RpcServer.ts:442-445` (applyMiddleware):
```typescript
for (const tag of rpc.middlewares) {
  if (tag.wrap) {
    const middleware = Context.unsafeGet(context, tag)
    handler = middleware({ ...options, next: handler as any })  // Wraps handler
  }
```

From `@effect/rpc/RpcGroup.ts:249-258` (middleware method):
```typescript
middleware(this: RpcGroup<any>, middleware: RpcMiddleware.TagClassAny) {
  const requests = new Map<string, any>()
  for (const [tag, rpc] of this.requests) {
    requests.set(tag, rpc.middleware(middleware))   // Applied to ALL RPCs
  }
  return makeProto({ requests, annotations: this.annotations })
},
```

**Key facts:**
- `options.next` is the handler Effect — middleware wraps it
- `options.rpc._tag` gives the RPC name (e.g., "Site.Commission")
- `RpcGroup.middleware()` applies to ALL RPCs in the group
- Middleware sees the SuccessValue (opaque type) — can tap but not inspect directly
- Applied globally via Entity.make -> protocol -> group.middleware()

### Code Example

```typescript
// Define the middleware
class EntityEventMiddleware extends RpcMiddleware.Tag<EntityEventMiddleware>()(
  'EntityEventMiddleware',
  { wrap: true }
) {}

// Implementation
const EntityEventMiddlewareLive = Layer.effect(
  EntityEventMiddleware,
  Effect.gen(function* () {
    const eventDist = yield* EventDistribution
    return EntityEventMiddleware.of((options) =>
      options.next.pipe(
        Effect.tap((result) => {
          // result is SuccessValue (opaque) — cannot inspect type
          // options.rpc._tag gives us the RPC name
          const tag = options.rpc._tag  // e.g., "Site.Commission"

          return eventDist.publishInvalidation(
            new CacheInvalidation({
              cacheKey: `entity:${tag}`,
              reason: `RPC ${tag} completed`,
              timestamp: new Date().toISOString(),
            })
          )
        })
      )
    )
  })
)

// Apply to all entities — modify Entity.make to use fromRpcGroup with middleware:
const protocol = RpcGroup.make(
  CreateSiteRpc, GetSiteRpc, /* ... */
).middleware(EntityEventMiddleware)

export const SiteEntity = Entity.fromRpcGroup(SiteEntityType, protocol)
```

### The SuccessValue Problem

**CRITICAL ISSUE:** The `SuccessValue` type returned by `options.next` is an opaque branded type:

```typescript
export interface SuccessValue {
  readonly _: unique symbol   // Cannot be inspected at runtime
}
```

The middleware can `Effect.tap` the result but **cannot inspect what it is**. It doesn't know if the result is a `Site`, `Alarm`, or `WorkOrder`. It only knows:
- The RPC tag (`options.rpc._tag`)
- The payload (`options.payload`)
- That the handler succeeded

**This means:** The middleware cannot extract previous/new state from the result. It can only signal "RPC X succeeded with payload Y."

### Analysis

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Handler modification | ZERO | Middleware applied at Entity definition level |
| Completeness | MEDIUM | Only captures successful RPC completions, not internal transitions |
| Action context | YES | `options.rpc._tag` gives the exact RPC name |
| Previous state | NO | Not available — only sees the result |
| Reliability | HIGH | Same as handler reliability |
| Performance | ~0.1ms | One Effect.tap per RPC call |
| Entities affected | 14 files | Entity.make -> Entity.fromRpcGroup migration |

### Pros
- **Zero handler modification** — middleware is declarative
- Has full action context (RPC tag name, payload)
- Single middleware class applies to all entities via `group.middleware()`
- Cleanest separation of concerns

### Cons
- **Cannot inspect SuccessValue** — opaque type, no state extraction
- **No previous state** — middleware only sees the post-handler result
- Requires migrating 14 entities from `Entity.make()` to `Entity.fromRpcGroup()` (trivial but touches every file)
- Fires for read-only RPCs too (Get operations) — needs filtering
- Does not capture internal Machine transitions (only external RPC boundary)

---

## Option C: Manual Effect.tap per Handler

### Mechanism

Add `Effect.tap()` in each handler after `actor.send()` to publish the result to EventDistribution.

### Code Example

```typescript
// Before:
const handleCommission = (envelope: { payload: { siteId: SiteId } }) =>
  actor.send(new InternalCommission({ siteId: envelope.payload.siteId })).pipe(
    Effect.catchTags({ /* ... */ })
  )

// After:
const handleCommission = (envelope: { payload: { siteId: SiteId } }) =>
  actor.send(new InternalCommission({ siteId: envelope.payload.siteId })).pipe(
    Effect.tap((site) =>
      bridge.onEquipmentStateChange({
        equipmentId: site.id,
        previousState: 'unknown',  // Problem: don't know previous
        newState: site.status,
      })
    ),
    Effect.catchTags({ /* ... */ })
  )
```

### Analysis

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Handler modification | HEAVY | Every state-transitioning handler (103+) must be modified |
| Completeness | HIGH | Captures exactly what happens at RPC boundary |
| Action context | YES | Each tap is in the handler — knows the action |
| Previous state | PARTIAL | Must query before send, or get from Machine state |
| Reliability | HIGH | Effect.tap is robust |
| Performance | ~0.1ms | One tap per call |
| Entities affected | 12+ files, ~103 handlers | Every state-transitioning handler |

### Pros
- Full control over what gets published
- Knows exactly which action triggered the event
- Can include handler-specific metadata

### Cons
- **103+ handlers to modify** — massive surface area for human error
- Easy to forget a handler (no compile-time safety)
- Previous state requires extra query or state snapshot before send
- Verbose — same pattern repeated 103+ times
- Maintenance burden — every new handler must remember to add tap

---

## Option D: Hybrid — Machine.changes + RpcMiddleware Enrichment

### Mechanism

Combine Machine.changes (captures before/after state) with RpcMiddleware.wrap (captures action name). Two event streams merged for a complete picture.

### Architecture

```
                        Entity Handler
                            |
    RpcMiddleware.wrap  ----|---- Machine.changes
    (captures rpc._tag,     |    (captures prev/next state)
     emits ActionStarted)   |
                            |
                    ┌───────┴───────┐
                    │  Correlation  │
                    │   Service     │
                    └───────┬───────┘
                            |
                    EventDistribution
```

### Code Example

```typescript
// 1. Machine.changes fiber (in each entity handler)
yield* actor.changes.pipe(
  Stream.zipWithPrevious,
  Stream.filter(([prev, _]) => Option.isSome(prev)),
  Stream.map(([prev, curr]) => new EntityStateChanged({
    entityType: 'Site',
    entityId: extractId(curr),
    previousState: serializeState(Option.getOrThrow(prev)),
    newState: serializeState(curr),
    timestamp: new Date().toISOString(),
    action: 'unknown',  // Enriched later
  })),
  Stream.runForEach((event) =>
    correlator.publishStateChange(event)
  ),
  Effect.fork,
)

// 2. RpcMiddleware.wrap (global, applied once)
class EntityActionMiddleware extends RpcMiddleware.Tag<EntityActionMiddleware>()(
  'EntityActionMiddleware',
  { wrap: true }
) {}

const EntityActionMiddlewareLive = Layer.effect(
  EntityActionMiddleware,
  Effect.gen(function* () {
    const correlator = yield* CorrelationService
    return EntityActionMiddleware.of((options) => {
      const actionId = generateId()
      return Effect.gen(function* () {
        yield* correlator.recordAction(actionId, options.rpc._tag)
        const result = yield* options.next
        yield* correlator.completeAction(actionId)
        return result
      })
    })
  })
)

// 3. CorrelationService merges the two streams
// Uses temporal proximity to match action -> state change
```

### Analysis

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Handler modification | MODERATE | Fork in each handler + global middleware |
| Completeness | HIGHEST | Both state AND action captured |
| Action context | YES | From middleware |
| Previous state | YES | From Machine.changes |
| Reliability | MEDIUM | Correlation is inherently fuzzy |
| Performance | ~0.5ms | Two observers per RPC |
| Entities affected | 14 files + correlation service |

### Pros
- **Most complete data** — has both state transition AND action context
- Machine.changes captures ALL transitions (including internal)
- Middleware captures action name without handler modification

### Cons
- **Correlation complexity** — matching action to state change is non-trivial
- Race conditions: what if two RPCs fire simultaneously?
- Over-engineered for most use cases
- Two separate observer systems to maintain
- CorrelationService adds a new infrastructure component

---

## Option E: EventLog.changes Queue

### Mechanism

For ES entities (Alarm, WorkOrder, EquipmentState), the EventLog already has a `changes` PubSub that emits every written event. Subscribe to this queue and forward to EventDistribution.

For asset entities (Site, Plant, etc.) — fall back to Machine.changes or middleware.

### Source Verification (VERIFIED)

From `sql-event-journal.ts:404`:
```typescript
changes: PubSub.subscribe(pubsub) as Effect.Effect<
  Queue.Dequeue<EventJournal.Entry>,
  never,
  Scope.Scope
>,
```

### Code Example

```typescript
// For ES entities — observe EventLog changes
const makeESObserver = Effect.gen(function* () {
  const journal = yield* EventJournal
  const eventDist = yield* EventDistribution

  // Subscribe to all EventLog changes
  const queue = yield* journal.changes

  yield* Effect.forever(
    Effect.gen(function* () {
      const entry = yield* Queue.take(queue)

      // Route based on event type
      if (entry.streamId.startsWith('alarm:')) {
        yield* eventDist.publishAlarmEvent(
          mapToAlarmEvent(entry)
        )
      } else if (entry.streamId.startsWith('equipment:')) {
        yield* eventDist.publishEquipmentStateChange(
          mapToEquipmentChange(entry)
        )
      }
      // ... etc
    })
  ).pipe(Effect.fork)
})
```

### Analysis

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Handler modification | ZERO (for ES entities) | EventLog already emits changes |
| Completeness | HIGH (ES) / NONE (assets) | Only works for event-sourced entities |
| Action context | YES | EventLog entries include event type |
| Previous state | PARTIAL | Can reconstruct from event sequence |
| Reliability | HIGHEST | EventLog is the source of truth |
| Performance | Negligible | Already being written to EventLog |
| Entities affected | 3 ES + 11 asset entities need separate solution |

### Pros
- **Zero handler modification** for the 3 ES entities
- EventLog is the canonical source of truth — highest reliability
- Event entries include full action context (event type, payload)
- Already exists — just need to subscribe

### Cons
- **Only covers 3 of 14 entities** (Alarm, WorkOrder, EquipmentState)
- Asset entities (Site, Plant, Line, Area, etc.) don't use EventLog
- Need a completely separate mechanism for asset entities
- Dual-system complexity

---

## Trade-off Matrix

| Dimension | A: Machine.changes | B: RpcMiddleware | C: Manual Tap | D: Hybrid | E: EventLog |
|-----------|-------------------|-----------------|---------------|-----------|-------------|
| **Handler modification** | 12 files, ~15 lines each | 14 files (Entity.make migration) | 103+ handlers | 12 files + middleware | 0 files (ES) / fallback needed |
| **Completeness** | All state transitions | RPC boundary only | RPC boundary only | All transitions + action | ES events only |
| **Action context** | No | Yes (_tag) | Yes (in handler) | Yes (via correlation) | Yes (event type) |
| **Previous state** | Yes (zipWithPrevious) | No | Requires extra query | Yes | Partial (reconstruct) |
| **Reliability** | High | High | High (if no handler forgotten) | Medium (correlation risk) | Highest |
| **Performance overhead** | ~0ms (existing PubSub) | ~0.1ms (Effect.tap) | ~0.1ms (Effect.tap) | ~0.5ms (dual observer) | ~0ms (existing PubSub) |
| **New infrastructure** | None | None | None | CorrelationService | None |
| **Compile-time safety** | Moderate | High (middleware applied globally) | None | Moderate | N/A for assets |
| **Maintenance burden** | Low | Low | High | Medium | Low (ES) / High (assets) |
| **Entity coverage** | 12/14 (Machine-backed) | 14/14 (all) | 14/14 (all) | 14/14 (all) | 3/14 (ES only) |

---

## Probability-Weighted Recommendation

| Option | Probability | Rationale |
|--------|------------|-----------|
| **A: Machine.changes** | **40%** | Best balance of completeness (before/after state) with minimal modification. Missing action context is acceptable — the state transition itself tells you what happened. 12 files need ~15 lines each = 180 lines total. |
| **B: RpcMiddleware.wrap** | **25%** | Cleanest architecture (zero handler changes), but the opaque SuccessValue problem means you can't extract state from the result. Best for "action notification" use cases (cache invalidation, audit logging) where you just need to know "RPC X succeeded." |
| **D: Hybrid (A+B)** | **15%** | Theoretically the most complete, but the CorrelationService adds complexity that may not justify the benefit. The temporal correlation between middleware action and Machine state change is fragile under concurrent load. |
| **E: EventLog.changes** | **15%** | Ideal for the 3 ES entities — highest fidelity, zero modification. But requires a fallback for the other 11 entities, so it's really "E + (A or B)" which increases total complexity. |
| **C: Manual Effect.tap** | **5%** | Viable but the worst maintenance story. 103+ handlers to modify is an invitation for bugs. Only recommended if you need per-handler customization that no other approach can provide. |

### Recommended Path: **Option A (Machine.changes) + Option E (EventLog.changes) for ES entities**

**Combined approach:**
1. For 3 ES entities (Alarm, WorkOrder, EquipmentState): Subscribe to EventLog.changes — zero handler modification, highest fidelity
2. For 9 asset entities (Site, Plant, Area, Line, WorkCell, Machine, Device, Sensor, Enterprise): Fork Machine.changes observer — 9 files modified, ~15 lines each

**Why not middleware (B)?** The SuccessValue opacity is a deal-breaker for state extraction. If we only need "RPC succeeded" notifications (not state data), then B is superior. But the requirement is to capture state transitions, which B cannot provide.

**Why not hybrid (D)?** The correlation service adds infrastructure complexity for marginal benefit. The action context (which RPC triggered the change) can be inferred from the state transition shape in most cases.

---

## Implementation Effort

| Option | Files Changed | Lines Added | New Infrastructure | Estimated Effort |
|--------|--------------|-------------|-------------------|-----------------|
| **A: Machine.changes** | 12 | ~180 | 0 | ~2 hours |
| **B: RpcMiddleware.wrap** | 14 + 1 middleware | ~100 | 0 | ~1.5 hours |
| **C: Manual Effect.tap** | 12 | ~500+ | 0 | ~4 hours |
| **D: Hybrid** | 14 + 2 services | ~400 | CorrelationService | ~6 hours |
| **E: EventLog.changes** | 1 observer | ~60 | 0 | ~1 hour (ES only) |
| **A+E (recommended)** | 10 | ~240 | 0 | ~3 hours |

---

## Risk Analysis

### Option A: Machine.changes

| Risk | Severity | Mitigation |
|------|----------|------------|
| Initial state emit causes duplicate "created" event | Low | Filter with `Stream.zipWithPrevious` — skip when prev is None |
| Machine scope closes before observer processes all events | Low | PubSub is unbounded; observer fiber is scoped to same scope |
| Generic state type requires unsafe extraction | Medium | Create typed helper per entity type |
| Missing action context limits audit trail usefulness | Medium | State transition shape is usually sufficient to infer action |

### Option B: RpcMiddleware.wrap

| Risk | Severity | Mitigation |
|------|----------|------------|
| SuccessValue is opaque — cannot extract state | HIGH | Accept limitation; use for notifications only |
| Entity.make -> fromRpcGroup migration regression | Low | Mechanical change, well-tested |
| Fires for Get (read) RPCs too | Low | Filter on `rpc._tag` prefix |
| Middleware order matters if other middleware exists | Medium | Document ordering requirements |

### Option C: Manual Effect.tap

| Risk | Severity | Mitigation |
|------|----------|------------|
| Forgotten handler = missed events | HIGH | No compile-time enforcement |
| Previous state requires snapshot before send | Medium | Pre-query adds latency |
| Copy-paste errors across 103 handlers | HIGH | Code review discipline |

### Option D: Hybrid

| Risk | Severity | Mitigation |
|------|----------|------------|
| Temporal correlation mismatches | HIGH | Under concurrent load, wrong action may match wrong state change |
| Over-engineering for current needs | Medium | YAGNI principle violated |
| Two systems to debug when events are missing | Medium | Dual-observer increases debugging surface |

### Option E: EventLog.changes

| Risk | Severity | Mitigation |
|------|----------|------------|
| Only covers 3/14 entities | HIGH | Requires fallback (A or B) for assets |
| EventLog PubSub capacity under high write load | Low | Already tested in perf benchmarks |
| Event-to-EventDistribution mapping complexity | Low | Finite set of event types |

---

## Appendix: Source Verification

All claims in this document are verified against source code in the Effect submodule at:
- `../../submodules/effect/packages/experimental/src/Machine.ts` (Machine.changes, publishState, PubSub lifecycle)
- `../../submodules/effect/packages/rpc/src/RpcMiddleware.ts` (RpcMiddlewareWrap type, Tag constructor)
- `../../submodules/effect/packages/rpc/src/RpcGroup.ts` (middleware method, toLayer)
- `../../submodules/effect/packages/rpc/src/RpcServer.ts` (applyMiddleware, handler execution order)
- `../../submodules/effect/packages/cluster/src/Entity.ts` (Entity.make, toLayer, middleware requirements)

Project source verified at:
- `src/lib/iiot/entity/*.ts` (all 14 entity definitions, 133 RPCs, 126 actor.send calls)
- `src/lib/iiot/realtime/event-distribution.ts` (EventDistribution service, 4 channels)
- `src/lib/iiot/realtime/reactivity-bridge.ts` (ReactivityBridge service, currently unwired)
- `src/lib/iiot/infrastructure/sql-event-journal.ts` (EventLog.changes PubSub at line 404)

### DeepWiki Verification

Queries made to `@Effect-TS/effect` via DeepWiki:
1. **Machine.changes behavior** — CONFIRMED: Stream emits initial state + all subsequent transitions. PubSub shuts down on scope close.
2. **RpcMiddleware.wrap pattern** — CONFIRMED: `options.next` is handler Effect. Middleware wraps execution. Applied globally via `group.middleware()`.
3. **Entity middleware integration** — CONFIRMED: `Entity.toLayer` requires `Rpc.Middleware<Rpcs>` in context. RpcServer resolves middleware via standard `applyMiddleware` path.
4. **SuccessValue opacity** — CONFIRMED: Opaque branded type, cannot be inspected at runtime.
