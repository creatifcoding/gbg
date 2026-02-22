# ADR-005: Atom-as-State Pattern — No Effect.Ref for React-Consumed State

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: AGENTS.md (project rules), DataManager EPOCH-0002 precedent

---

## Context

Effect.Service implementations need mutable state. The default Effect pattern is `Effect.Ref<T>` — a managed mutable reference within the Effect runtime. However, when React is the consumer, `Effect.Ref` requires a bridge: polling, SubscriptionRef, or streams-to-consume-streams.

The TMNL project established an alternative precedent in EPOCH-0002 (DataManager): **use `Atom.make()` as the primary state, not `Effect.Ref` inside services**.

## Decision

**All mutable state that React consumes is `Atom.make()` from effect-atom.** Service methods mutate Atoms directly via `Atom.set()`. React subscribes directly via `useAtomValue()`. No Ref→Atom bridge.

### Rules

1. **`Atom.make()` for React-visible state** — health, signal counts, pipeline status, lifecycle events
2. **`Atom.unsafeGet()` in service code** — synchronous read within Effect.gen
3. **`Atom.set()` for mutations** — direct set, no intermediate Ref
4. **`Effect.Ref` ONLY for internal-only state** — state that React never sees (e.g., HTTP adapter's ETag ref, RSS dedup HashSet)
5. **No `SubscriptionRef`** — no polling, no streams-to-consume-streams

### Example: AdapterManager

```typescript
// Atom-as-State: React subscribes directly
export const adapterRegistryAtom = Atom.make(new Map<string, RegisteredAdapter>())
export const adapterHealthAtom = Atom.make(new Map<string, AdapterHealth>())
export const totalSignalCountAtom = Atom.make(0)

// Service code reads/writes atoms
const register = (...) => Effect.gen(function* () {
  // ...
  const updated = new Map(Atom.unsafeGet(adapterRegistryAtom))
  updated.set(shape.adapterId, { shape, scope, registeredAt: new Date() })
  Atom.set(adapterRegistryAtom, updated)
})
```

### Example: OutputBridge

```typescript
// D2ts output → Queue → consumer fiber → Atom.set
const consumer = yield* Effect.fork(
  Effect.forever(
    Effect.gen(function* () {
      const first = yield* Queue.take(queue)
      const rest = yield* Queue.takeUpTo(queue, batchSize - 1)
      const batch = [first, ...Array.from(rest)]
      yield* Effect.sync(() => {
        const current = Atom.unsafeGet(activeSignalsAtom)
        const updated = [...current, ...batch]
        const capped = updated.length > maxAtomItems ? updated.slice(-maxAtomItems) : updated
        Atom.set(activeSignalsAtom, capped)
      })
    })
  )
)
```

## Consequences

### Positive
- Zero bridge overhead — no polling, no subscription management
- React re-renders immediately on `Atom.set()` — no tick delay
- Simpler code — fewer abstractions between service and view
- Consistent pattern across all services (AdapterManager, TsingouFlow, OutputBridge, SchemaRegistry)

### Negative
- `Atom.unsafeGet()` is technically "unsafe" — reads outside Effect's managed context
- Atom mutations not tracked by Effect's fiber scheduler — no automatic interruption on Atom set
- Testing requires `Atom.unsafeGet()` instead of yielding from Effect

### When Effect.Ref IS Acceptable
- **HTTP ETag tracking** — `Ref<string>` for conditional GET headers (internal-only)
- **RSS dedup HashSet** — `Ref<HashSet<string>>` for seen item IDs (internal-only)
- **Adaptive polling interval** — `Ref<Duration>` for dynamic schedule adjustment (internal-only)

## Atoms Inventory

| Atom | Service | Purpose |
|------|---------|---------|
| `adapterRegistryAtom` | AdapterManager | Live adapter registry |
| `adapterHealthAtom` | AdapterManager | Health snapshots |
| `totalSignalCountAtom` | AdapterManager | Global signal counter |
| `lifecycleEventsAtom` | AdapterManager | Lifecycle event log |
| `activeSignalsAtom` | OutputBridge | Latest signals for rendering |
| `derivedSignalCountAtom` | OutputBridge | Total derived signals |
| `pipelineLatencyAtom` | OutputBridge | Processing latency |
| `tickAtom` | TsingouFlow | Processing cycle counter |
| `pipelineStatusAtom` | TsingouFlow | Pipeline lifecycle state |
| `tickSignalCountAtom` | TsingouFlow | Signals per tick |
| `cycleDurationMsAtom` | TsingouFlow | Cycle processing time |
| `totalProcessedAtom` | TsingouFlow | Total signals processed |
| `throughputAtom` | TsingouFlow | Rolling throughput (signals/sec) |
| `runtimeSchemasAtom` | SchemaRegistry | Registered schemas |
| `schemaCountAtom` | SchemaRegistry | Schema count |
| `feedManagerStateAtom` | RssFeedManager | Feed health map |
| Per-adapter `healthAtom` | Each adapter | Individual adapter health |
| Per-adapter `signalCountAtom` | Each adapter | Individual signal count |
