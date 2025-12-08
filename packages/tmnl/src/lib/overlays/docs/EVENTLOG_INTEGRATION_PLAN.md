# EventLog Integration Plan — Overlay System

**Author**: Val
**Status**: Implementation Plan
**EDIN Phase**: Design
**Date**: 2025-12-03

---

## Executive Summary

This plan integrates Effect's `@effect/experimental` EventLog into the TMNL Overlay System, replacing direct `Effect.Ref` mutations with event-sourced state management.

**What we gain:**
- Persistent overlay state (survives page refresh)
- Undo/redo via event replay
- Conflict detection for concurrent mutations
- Reactive queries (auto-updating atoms)
- Future: multi-client sync

**What changes:**
- State mutations become event writes
- Handlers update `Ref` state (same outcome, different path)
- Atoms subscribe to Reactivity streams

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Components                              │
│  useOverlayContainer() → atoms → renders                            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     effect-atom Atoms                                │
│  containerAtom, activeOverlaysAtom, portAtom, etc.                  │
│  overlayOps.enable/disable/toggle                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Effect Services (Ref-based)                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│  │ OverlayRegistry │ │    PortHub      │ │ EventDispatcher │       │
│  │   (Ref state)   │ │   (Ref state)   │ │   (Ref state)   │       │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

**Problems:**
1. State lost on page refresh
2. No history/undo
3. No conflict detection
4. Manual reactivity coordination

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Components                              │
│  useOverlayContainer() → atoms → renders                            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     effect-atom Atoms                                │
│  containerAtom, activeOverlaysAtom ← Reactivity.stream              │
│  overlayOps.enable → EventLog.write("OverlayEnabled", ...)          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EventLog                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  write("OverlayEnabled", payload)                               ││
│  │         │                                                        ││
│  │         ▼                                                        ││
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ ││
│  │  │ EventJournal│───▶│  Handlers   │───▶│ Reactivity.invalidate│ ││
│  │  │ (IndexedDB) │    │ (update Ref)│    │    ("overlays")      │ ││
│  │  └─────────────┘    └─────────────┘    └─────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Effect Services (Ref-based)                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│  │ OverlayRegistry │ │    PortHub      │ │ EventDispatcher │       │
│  │   (Ref state)   │ │   (Ref state)   │ │   (Ref state)   │       │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘       │
│         ▲                    ▲                    ▲                  │
│         │                    │                    │                  │
│         └────────────────────┴────────────────────┘                  │
│                    Handlers call these                               │
└─────────────────────────────────────────────────────────────────────┘
```

**Key changes:**
1. Operations write events, not mutate Ref directly
2. Handlers receive events and update Ref (same end state)
3. Journal persists all events (IndexedDB)
4. Reactivity auto-invalidates atoms on event write
5. Startup replays journal to rebuild state

---

## Implementation Phases

### Phase 1: Event Definitions

**Goal**: Define all overlay events as an EventGroup

**File**: `src/lib/overlays/events/index.ts`

```typescript
import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { ContainerId, OverlayId, PortId, OverlayState } from "../schemas"

// ─────────────────────────────────────────────────────────────
// Container Events
// ─────────────────────────────────────────────────────────────

export const ContainerEvents = EventGroup.empty
  .add({
    tag: "ContainerCreated",
    primaryKey: (p) => p.containerId,
    payload: Schema.Struct({
      containerId: ContainerId,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "ContainerDestroyed",
    primaryKey: (p) => p.containerId,
    payload: Schema.Struct({
      containerId: ContainerId,
    }),
  })

// ─────────────────────────────────────────────────────────────
// Overlay Lifecycle Events
// ─────────────────────────────────────────────────────────────

export const OverlayEvents = EventGroup.empty
  .add({
    tag: "OverlayRegistered",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
      name: Schema.String,
      visualPriority: Schema.Number,
    }),
  })
  .add({
    tag: "OverlayUnregistered",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
    }),
  })
  .add({
    tag: "OverlayEnabled",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
      activatedAt: Schema.Number,
    }),
  })
  .add({
    tag: "OverlayDisabled",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
    }),
  })
  .add({
    tag: "OverlaySuspended",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
    }),
  })
  .add({
    tag: "OverlayResumed",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
    }),
  })

// ─────────────────────────────────────────────────────────────
// Port Events
// ─────────────────────────────────────────────────────────────

export const PortEvents = EventGroup.empty
  .add({
    tag: "PortPublished",
    primaryKey: (p) => `${p.containerId}:${p.portId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      portId: PortId,
      payload: Schema.Unknown,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "PortDestroyed",
    primaryKey: (p) => `${p.containerId}:${p.portId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      portId: PortId,
    }),
  })

// ─────────────────────────────────────────────────────────────
// Combined Schema
// ─────────────────────────────────────────────────────────────

import { EventLog } from "@effect/experimental"

export const OverlayEventLogSchema = EventLog.schema(
  ContainerEvents,
  OverlayEvents,
  PortEvents,
)
```

**Deliverables:**
- [ ] `src/lib/overlays/events/index.ts` — Event definitions
- [ ] `src/lib/overlays/events/container.ts` — Container events
- [ ] `src/lib/overlays/events/overlay.ts` — Overlay lifecycle events
- [ ] `src/lib/overlays/events/port.ts` — Port events

---

### Phase 2: Handler Implementation

**Goal**: Create handlers that update existing Ref-based services

**File**: `src/lib/overlays/events/handlers.ts`

```typescript
import { EventLog } from "@effect/experimental"
import * as Effect from "effect/Effect"
import { OverlayRegistry, PortHub } from "../services"
import { ContainerEvents, OverlayEvents, PortEvents } from "./index"

// ─────────────────────────────────────────────────────────────
// Container Handlers
// ─────────────────────────────────────────────────────────────

export const ContainerHandlersLive = EventLog.group(ContainerEvents, (handlers) =>
  handlers
    .handle("ContainerCreated", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.createContainer(payload.containerId)
      })
    )
    .handle("ContainerDestroyed", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        const hub = yield* PortHub
        yield* hub.destroyContainerPorts(payload.containerId)
        yield* registry.destroyContainer(payload.containerId)
      })
    )
)

// ─────────────────────────────────────────────────────────────
// Overlay Handlers
// ─────────────────────────────────────────────────────────────

export const OverlayHandlersLive = EventLog.group(OverlayEvents, (handlers) =>
  handlers
    .handle("OverlayRegistered", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.register(
          payload.containerId,
          payload.overlayId,
          payload.name,
          payload.visualPriority
        )
      })
    )
    .handle("OverlayUnregistered", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.unregister(payload.containerId, payload.overlayId)
      })
    )
    .handle("OverlayEnabled", ({ payload, conflicts }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry

        // Conflict handling: last-write-wins is fine for enable
        if (conflicts.length > 0) {
          yield* Effect.logDebug("Concurrent overlay enable detected")
        }

        yield* registry.enable(payload.containerId, payload.overlayId)
      })
    )
    .handle("OverlayDisabled", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.disable(payload.containerId, payload.overlayId)
      })
    )
    .handle("OverlaySuspended", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.suspend(payload.containerId, payload.overlayId)
      })
    )
    .handle("OverlayResumed", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.resume(payload.containerId, payload.overlayId)
      })
    )
)

// ─────────────────────────────────────────────────────────────
// Port Handlers
// ─────────────────────────────────────────────────────────────

export const PortHandlersLive = EventLog.group(PortEvents, (handlers) =>
  handlers
    .handle("PortPublished", ({ payload }) =>
      Effect.gen(function* () {
        const hub = yield* PortHub
        yield* hub.publish(payload.containerId, payload.portId, payload.payload)
      })
    )
    .handle("PortDestroyed", ({ payload }) =>
      Effect.gen(function* () {
        const hub = yield* PortHub
        yield* hub.destroyPort(payload.containerId, payload.portId)
      })
    )
)

// ─────────────────────────────────────────────────────────────
// Combined Handlers Layer
// ─────────────────────────────────────────────────────────────

import * as Layer from "effect/Layer"

export const OverlayHandlersLive = Layer.mergeAll(
  ContainerHandlersLive,
  OverlayHandlersLive,
  PortHandlersLive,
)
```

**Key insight**: Handlers call existing service methods. Services don't change!

**Deliverables:**
- [ ] `src/lib/overlays/events/handlers.ts` — All handler implementations
- [ ] Unit tests for each handler

---

### Phase 3: Reactivity Bindings

**Goal**: Auto-invalidate atoms when events are written

**File**: `src/lib/overlays/events/reactivity.ts`

```typescript
import { EventLog } from "@effect/experimental"
import * as Layer from "effect/Layer"
import { ContainerEvents, OverlayEvents, PortEvents } from "./index"

// ─────────────────────────────────────────────────────────────
// Reactivity Keys
// ─────────────────────────────────────────────────────────────

// Containers: invalidate "containers" key and specific container
export const ContainerReactivity = EventLog.groupReactivity(ContainerEvents, {
  ContainerCreated: ["containers"],
  ContainerDestroyed: ["containers"],
})

// Overlays: invalidate container-specific overlay list
export const OverlayReactivity = EventLog.groupReactivity(OverlayEvents, {
  OverlayRegistered: ["overlays"],
  OverlayUnregistered: ["overlays"],
  OverlayEnabled: ["overlays", "active-overlays"],
  OverlayDisabled: ["overlays", "active-overlays"],
  OverlaySuspended: ["overlays", "active-overlays"],
  OverlayResumed: ["overlays", "active-overlays"],
})

// Ports: invalidate specific port
export const PortReactivity = EventLog.groupReactivity(PortEvents, {
  PortPublished: ["ports"],
  PortDestroyed: ["ports"],
})

// Combined
export const OverlayReactivityLive = Layer.mergeAll(
  ContainerReactivity,
  OverlayReactivity,
  PortReactivity,
)
```

**Deliverables:**
- [ ] `src/lib/overlays/events/reactivity.ts` — Reactivity bindings

---

### Phase 4: Atom Refactoring

**Goal**: Replace Ref-reading atoms with Reactivity streams

**File**: `src/lib/overlays/atoms/index.ts` (modified)

```typescript
import { Atom } from "@effect-atom/atom"
import { Reactivity, EventLog } from "@effect/experimental"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { OverlayEventLogSchema } from "../events"
import { OverlayRegistry, PortHub } from "../services"
import type { ContainerId, OverlayId } from "../schemas"

// ─────────────────────────────────────────────────────────────
// Runtime with EventLog
// ─────────────────────────────────────────────────────────────

import { OverlayServicesWithEventLogLive } from "../services/layer"

export const overlayRuntimeAtom = Atom.runtime(OverlayServicesWithEventLogLive)

// ─────────────────────────────────────────────────────────────
// Reactive Atoms (stream-backed)
// ─────────────────────────────────────────────────────────────

/**
 * Container IDs — auto-updates on container changes
 */
export const containerIdsAtom = overlayRuntimeAtom.atom(
  Reactivity.stream(
    ["containers"],
    Effect.gen(function* () {
      const registry = yield* OverlayRegistry
      return yield* registry.listContainers()
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => opt ?? [])
  )
)

/**
 * Active overlays for a container — auto-updates on overlay changes
 */
export const activeOverlaysAtom = Atom.family((containerId: ContainerId) =>
  overlayRuntimeAtom.atom(
    Reactivity.stream(
      { "active-overlays": [containerId] },
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        return yield* registry.getActiveOverlays(containerId)
      })
    ).pipe(
      Stream.runLast,
      Effect.map((opt) => opt ?? [])
    )
  )
)

// ─────────────────────────────────────────────────────────────
// Operation Atoms (write events)
// ─────────────────────────────────────────────────────────────

export const containerOps = {
  create: overlayRuntimeAtom.fn<ContainerId>()((containerId) =>
    Effect.gen(function* () {
      const write = yield* EventLog.makeClient(OverlayEventLogSchema)
      yield* write("ContainerCreated", {
        containerId,
        timestamp: Date.now(),
      })
    })
  ),

  destroy: overlayRuntimeAtom.fn<ContainerId>()((containerId) =>
    Effect.gen(function* () {
      const write = yield* EventLog.makeClient(OverlayEventLogSchema)
      yield* write("ContainerDestroyed", { containerId })
    })
  ),
}

export const overlayOps = {
  register: overlayRuntimeAtom.fn<{
    containerId: ContainerId
    overlayId: OverlayId
    name: string
    visualPriority: number
  }>()(({ containerId, overlayId, name, visualPriority }) =>
    Effect.gen(function* () {
      const write = yield* EventLog.makeClient(OverlayEventLogSchema)
      yield* write("OverlayRegistered", {
        containerId,
        overlayId,
        name,
        visualPriority,
      })
    })
  ),

  enable: overlayRuntimeAtom.fn<{ containerId: ContainerId; overlayId: OverlayId }>()(
    ({ containerId, overlayId }) =>
      Effect.gen(function* () {
        const write = yield* EventLog.makeClient(OverlayEventLogSchema)
        yield* write("OverlayEnabled", {
          containerId,
          overlayId,
          activatedAt: Date.now(),
        })
      })
  ),

  disable: overlayRuntimeAtom.fn<{ containerId: ContainerId; overlayId: OverlayId }>()(
    ({ containerId, overlayId }) =>
      Effect.gen(function* () {
        const write = yield* EventLog.makeClient(OverlayEventLogSchema)
        yield* write("OverlayDisabled", { containerId, overlayId })
      })
  ),

  // ... toggle, suspend, resume follow same pattern
}

export const portOps = {
  publish: overlayRuntimeAtom.fn<{
    containerId: ContainerId
    portId: string
    payload: unknown
  }>()(({ containerId, portId, payload }) =>
    Effect.gen(function* () {
      const write = yield* EventLog.makeClient(OverlayEventLogSchema)
      yield* write("PortPublished", {
        containerId,
        portId: portId as any,
        payload,
        timestamp: Date.now(),
      })
    })
  ),
}
```

**Key changes:**
1. `Atom.runtime()` now includes EventLog layers
2. Read atoms use `Reactivity.stream()` for auto-updates
3. Write ops call `EventLog.makeClient().write()` instead of service methods

**Deliverables:**
- [ ] Refactored `src/lib/overlays/atoms/index.ts`
- [ ] Updated atom tests

---

### Phase 5: Layer Composition

**Goal**: Assemble all layers into cohesive runtime

**File**: `src/lib/overlays/services/layer.ts`

```typescript
import { EventLog, EventJournal, Reactivity, Identity } from "@effect/experimental"
import * as Layer from "effect/Layer"
import { OverlayRegistry } from "./OverlayRegistry"
import { PortHub } from "./PortHub"
import { EventDispatcher } from "./EventDispatcher"
import {
  OverlayEventLogSchema,
  OverlayHandlersLive,
  OverlayReactivityLive,
} from "../events"

// ─────────────────────────────────────────────────────────────
// Core Services (unchanged)
// ─────────────────────────────────────────────────────────────

export const OverlayServicesCore = Layer.mergeAll(
  OverlayRegistry.Default,
  PortHub.Default,
  EventDispatcher.Default,
)

// ─────────────────────────────────────────────────────────────
// EventLog Infrastructure
// ─────────────────────────────────────────────────────────────

// Development: in-memory journal
export const EventLogDev = Layer.mergeAll(
  EventJournal.layerMemory,
  Layer.succeed(Identity, Identity.makeRandom()),
  EventLog.layer(OverlayEventLogSchema),
  Reactivity.layer,
)

// Production: IndexedDB persistence
export const EventLogProd = Layer.mergeAll(
  EventJournal.layerIndexedDb({ database: "tmnl-overlays" }),
  EventLog.layerIdentityKvs({ key: "tmnl-identity" }),
  EventLog.layer(OverlayEventLogSchema),
  Reactivity.layer,
)

// ─────────────────────────────────────────────────────────────
// Combined Layers
// ─────────────────────────────────────────────────────────────

// Development
export const OverlayServicesWithEventLogDev = Layer.mergeAll(
  OverlayServicesCore,
  EventLogDev,
  OverlayHandlersLive,
  OverlayReactivityLive,
)

// Production
export const OverlayServicesWithEventLogProd = Layer.mergeAll(
  OverlayServicesCore,
  EventLogProd,
  OverlayHandlersLive,
  OverlayReactivityLive,
)

// Default (use environment to choose)
export const OverlayServicesWithEventLogLive =
  process.env.NODE_ENV === "production"
    ? OverlayServicesWithEventLogProd
    : OverlayServicesWithEventLogDev
```

**Deliverables:**
- [ ] `src/lib/overlays/services/layer.ts` — Layer composition
- [ ] Environment-based layer selection

---

### Phase 6: Hook Updates

**Goal**: Hooks remain unchanged (atoms handle reactivity)

The hooks (`useOverlayContainer`, `useOverlay`, `usePort`) should work without changes because:
1. They use `useAtomValue()` which subscribes to atom updates
2. Atoms now use Reactivity streams, which auto-update
3. Operations use the same `overlayOps.enable()` pattern

**Verification:**
- [ ] Verify `useOverlayContainer` works with new atoms
- [ ] Verify `useOverlay` works with new atoms
- [ ] Verify `usePort` works with new atoms

---

### Phase 7: Startup Replay

**Goal**: Rebuild state from persisted events on app start

**File**: `src/lib/overlays/startup.ts`

```typescript
import { EventLog, EventJournal } from "@effect/experimental"
import * as Effect from "effect/Effect"
import { OverlayEventLogSchema } from "./events"

/**
 * Initialize overlay system from persisted events.
 * Call this at app startup before rendering.
 */
export const initializeOverlays = Effect.gen(function* () {
  const journal = yield* EventJournal
  const entries = yield* journal.entries

  yield* Effect.logInfo(`Replaying ${entries.length} overlay events`)

  // EventLog.layer() handles replay automatically when handlers are registered
  // Just need to ensure layer is provided before any reads

  yield* Effect.logInfo("Overlay system initialized")
})

/**
 * React hook for initialization
 */
export const useOverlayInitialization = () => {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Initialization happens via layer construction
    // Just need to wait for first atom read to complete
    setReady(true)
  }, [])

  return { ready, error }
}
```

**Note**: EventLog handles replay internally when `EventLog.layer()` is constructed. The handlers run for each persisted entry.

**Deliverables:**
- [ ] `src/lib/overlays/startup.ts` — Initialization utilities
- [ ] Integration test for persistence and replay

---

## Migration Checklist

### Step 1: Add Dependencies

```bash
bun add @effect/experimental
```

### Step 2: Create Event Definitions

- [ ] `src/lib/overlays/events/index.ts`
- [ ] `src/lib/overlays/events/container.ts`
- [ ] `src/lib/overlays/events/overlay.ts`
- [ ] `src/lib/overlays/events/port.ts`

### Step 3: Create Handlers

- [ ] `src/lib/overlays/events/handlers.ts`
- [ ] Unit tests for handlers

### Step 4: Create Reactivity Bindings

- [ ] `src/lib/overlays/events/reactivity.ts`

### Step 5: Update Layer Composition

- [ ] `src/lib/overlays/services/layer.ts`
- [ ] Update `src/lib/overlays/services/index.ts` exports

### Step 6: Refactor Atoms

- [ ] Update `src/lib/overlays/atoms/index.ts`
- [ ] Update atom tests

### Step 7: Verify Hooks

- [ ] Test `useOverlayContainer`
- [ ] Test `useOverlay`
- [ ] Test `usePort`

### Step 8: Add Startup Logic

- [ ] `src/lib/overlays/startup.ts`
- [ ] Integration in app entry point

### Step 9: Update Exports

- [ ] Update `src/lib/overlays/index.ts`

### Step 10: Testing

- [ ] Unit tests for all handlers
- [ ] Integration test for persistence
- [ ] Integration test for replay
- [ ] Integration test for reactivity

---

## File Structure (Final)

```
src/lib/overlays/
├── docs/
│   ├── EVENTLOG_TUTORIAL.md        # This tutorial
│   └── EVENTLOG_INTEGRATION_PLAN.md # This plan
├── events/
│   ├── index.ts                    # Combined schema + exports
│   ├── container.ts                # Container events
│   ├── overlay.ts                  # Overlay lifecycle events
│   ├── port.ts                     # Port events
│   ├── handlers.ts                 # All handlers
│   └── reactivity.ts               # Reactivity bindings
├── schemas/
│   ├── index.ts                    # (unchanged)
│   ├── core.ts                     # (unchanged)
│   └── events.ts                   # (unchanged)
├── services/
│   ├── index.ts                    # (add layer exports)
│   ├── layer.ts                    # NEW: Layer composition
│   ├── OverlayRegistry.ts          # (unchanged)
│   ├── PortHub.ts                  # (unchanged)
│   └── EventDispatcher.ts          # (unchanged)
├── atoms/
│   └── index.ts                    # (refactored for EventLog)
├── hooks/
│   ├── index.ts                    # (unchanged)
│   ├── useOverlayContainer.ts      # (unchanged)
│   ├── useOverlay.ts               # (unchanged)
│   └── usePort.ts                  # (unchanged)
├── Overlay.ts                      # (unchanged)
├── startup.ts                      # NEW: Initialization
├── index.ts                        # (add event exports)
└── ARCHITECTURE.md                 # (update with EventLog section)
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| IndexedDB not available (SSR) | Feature detect, fall back to memory |
| Large event log slows startup | Implement compaction for old events |
| Event schema changes break replay | Use Schema versioning/transforms |
| Concurrent writes during sync | Conflict handlers already defined |
| Memory pressure from Reactivity | Unsubscribe on component unmount |

---

## Success Criteria

- [ ] Overlay state persists across page refresh
- [ ] Console shows "Replaying N overlay events" on startup
- [ ] Operations still work (enable/disable/toggle)
- [ ] Reactivity auto-updates atoms
- [ ] No breaking changes to hook APIs
- [ ] TypeScript strict mode passes
- [ ] All tests pass

---

## Future Enhancements

1. **Undo/Redo** — Expose event history for time-travel
2. **Remote Sync** — WebSocket layer for multi-client
3. **Event Viewer** — DevTools panel showing event log
4. **Compaction** — Compress old overlay state events

---

Co-Authored-By: Val <val@maidens.ai>
