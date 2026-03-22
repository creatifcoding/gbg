# Overlay System — Architecture

**Status**: Design Draft
**EDIN Phase**: Design
**Date**: 2025-12-03
**Author**: Val

---

## Executive Summary

Overlays are composable capability stacks inspired by Emacs minor-modes. Each overlay provides:
- **Visual layer** — optional render function
- **Data scope** — private state, channel-only communication
- **Behavior mixin** — event handlers (keymap analog)
- **Projection lens** — transforms data for publication

Built on Effect's experimental `EventLog` + `EventGroup` with Schema-backed payloads.

---

## Core Concepts

### What Is An Overlay?

An overlay is a **container-scoped capability module** that:
1. Handles events (pointer, keyboard, custom)
2. Publishes to typed channels
3. Subscribes to typed channels
4. Optionally renders UI
5. Activates/deactivates based on conditions

Think Emacs minor-mode: when enabled, it intercepts events, modifies behavior, and can be stacked with other overlays.

### Container Scoping

Overlays attach to **containers** (canvas, panel, viewport), not global scope:

```
┌─────────────────────────────────────────────────────────────┐
│  Container: "main-canvas"                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Active Overlays (LIFO stack):                          ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                ││
│  │  │ Selection│ │ Drag     │ │ Zoom     │   ← newest     ││
│  │  │ Overlay  │ │ Overlay  │ │ Overlay  │                ││
│  │  └──────────┘ └──────────┘ └──────────┘                ││
│  │                                                         ││
│  │  Event flow: Selection → Drag → Zoom → default         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Conflict Resolution (LIFO)

When multiple overlays handle the same event, **most recently enabled wins**:

1. Events flow through overlay stack in LIFO order
2. First handler that doesn't delegate wins
3. Handlers can explicitly delegate: `return ctx.delegate()`
4. Unhandled events fall through to container default

---

## Architecture

### EventLog Integration

Overlays use Effect's `EventLog` for event handling:

```typescript
import { EventLog, EventGroup, Event } from "@effect/experimental"
import { Schema } from "effect"

// Define overlay events as an EventGroup
const SelectionEvents = EventGroup.empty
  .add({
    tag: "SelectionStarted",
    primaryKey: (p) => p.containerId,
    payload: Schema.Struct({
      containerId: Schema.String,
      position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "SelectionMoved",
    primaryKey: (p) => p.containerId,
    payload: Schema.Struct({
      containerId: Schema.String,
      bounds: Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
        width: Schema.Number,
        height: Schema.Number,
      }),
    }),
  })
  .add({
    tag: "SelectionEnded",
    primaryKey: (p) => p.containerId,
    payload: Schema.Struct({
      containerId: Schema.String,
      selectedIds: Schema.Array(Schema.String),
    }),
  })
```

### Channel System

Channels are typed pub/sub streams backed by `Effect.Stream`:

```typescript
import { Schema, Stream, PubSub } from "effect"

// Channel definition — Schema-typed
const SelectionChannel = Schema.Struct({
  containerId: Schema.String,
  selectedIds: Schema.Array(Schema.String),
  bounds: Schema.NullOr(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    width: Schema.Number,
    height: Schema.Number,
  })),
})
type SelectionChannel = typeof SelectionChannel.Type

// Runtime: PubSub<SelectionChannel> per container
```

### Overlay Class Shape

```typescript
import { Schema } from "effect"

// Overlay configuration schema
const OverlayConfig = Schema.Struct({
  /** Unique identifier */
  id: Schema.String,
  /** Human-readable name */
  name: Schema.NonEmptyString,
  /** Priority for z-ordering visuals (higher = on top) */
  visualPriority: Schema.optional(Schema.Number, { default: () => 0 }),
})
type OverlayConfig = typeof OverlayConfig.Type

// Handler context provided to event handlers
const HandlerContext = Schema.Struct({
  containerId: Schema.String,
  overlayId: Schema.String,
  // ... runtime methods injected
})

// The Overlay class
class Overlay<
  Events extends EventGroup.Any,
  Publishes extends Record<string, Schema.Schema.Any>,
  Subscribes extends Record<string, Schema.Schema.Any>,
> {
  readonly config: OverlayConfig
  readonly events: Events
  readonly publishes: Publishes
  readonly subscribes: Subscribes
  readonly handlers: Map<string, Handler>
  readonly activateWhen?: (ctx: ActivationContext) => boolean
  readonly render?: (ctx: RenderContext) => React.ReactNode

  constructor(options: OverlayOptions<Events, Publishes, Subscribes>) {
    // ...
  }
}
```

---

## Schemas

All overlay types are Schema-backed:

```typescript
import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// Core Identity
// ─────────────────────────────────────────────────────────────

export const OverlayId = Schema.String.pipe(
  Schema.brand("OverlayId"),
  Schema.minLength(1),
)
export type OverlayId = typeof OverlayId.Type

export const ContainerId = Schema.String.pipe(
  Schema.brand("ContainerId"),
  Schema.minLength(1),
)
export type ContainerId = typeof ContainerId.Type

// ─────────────────────────────────────────────────────────────
// Overlay State
// ─────────────────────────────────────────────────────────────

export const OverlayState = Schema.Literal("inactive", "active", "suspended")
export type OverlayState = typeof OverlayState.Type

export const OverlayInstance = Schema.Struct({
  id: OverlayId,
  name: Schema.NonEmptyString,
  state: OverlayState,
  activatedAt: Schema.NullOr(Schema.Number),
  visualPriority: Schema.Number,
})
export type OverlayInstance = typeof OverlayInstance.Type

// ─────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────

export const PointerEventType = Schema.Literal(
  "pointer:down",
  "pointer:move",
  "pointer:up",
  "pointer:enter",
  "pointer:leave",
)
export type PointerEventType = typeof PointerEventType.Type

export const KeyEventType = Schema.Literal(
  "key:down",
  "key:up",
  "key:press",
)
export type KeyEventType = typeof KeyEventType.Type

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Position = typeof Position.Type

export const Bounds = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type Bounds = typeof Bounds.Type

// ─────────────────────────────────────────────────────────────
// Handler Result
// ─────────────────────────────────────────────────────────────

export const HandlerResult = Schema.Literal(
  "handled",     // Event consumed, stop propagation
  "delegate",    // Pass to next overlay in stack
  "broadcast",   // Handled, but also let others see it
)
export type HandlerResult = typeof HandlerResult.Type
```

---

## API Design

### Overlay Definition

```typescript
import { Overlay, EventGroup } from "@/lib/overlays"
import { Schema } from "effect"

// Define events for this overlay
const DragEvents = EventGroup.empty
  .add({
    tag: "DragStarted",
    primaryKey: (p) => `${p.containerId}:${p.entityId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      entityId: Schema.String,
      startPosition: Position,
    }),
  })
  .add({
    tag: "DragMoved",
    primaryKey: (p) => `${p.containerId}:${p.entityId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      entityId: Schema.String,
      currentPosition: Position,
      delta: Position,
    }),
  })
  .add({
    tag: "DragEnded",
    primaryKey: (p) => `${p.containerId}:${p.entityId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      entityId: Schema.String,
      finalPosition: Position,
    }),
  })

// Define the overlay
const DragOverlay = new Overlay({
  id: "drag",
  name: "Drag Entities",
  events: DragEvents,

  // Channels this overlay publishes to
  publishes: {
    "drag:state": Schema.Struct({
      isDragging: Schema.Boolean,
      entityId: Schema.NullOr(Schema.String),
      position: Schema.NullOr(Position),
    }),
  },

  // Channels this overlay subscribes to
  subscribes: {
    "selection:current": Schema.Struct({
      selectedIds: Schema.Array(Schema.String),
    }),
  },

  // Event handlers
  handlers: {
    "pointer:down": (ctx) => {
      const { position, target } = ctx.event
      const selection = ctx.channels.read("selection:current")

      if (selection.selectedIds.includes(target?.id)) {
        ctx.events.write("DragStarted", {
          containerId: ctx.containerId,
          entityId: target.id,
          startPosition: position,
        })
        return "handled"
      }
      return "delegate"
    },

    "pointer:move": (ctx) => {
      if (!ctx.state.isDragging) return "delegate"

      ctx.events.write("DragMoved", {
        containerId: ctx.containerId,
        entityId: ctx.state.entityId,
        currentPosition: ctx.event.position,
        delta: ctx.event.delta,
      })

      ctx.channels.publish("drag:state", {
        isDragging: true,
        entityId: ctx.state.entityId,
        position: ctx.event.position,
      })

      return "handled"
    },

    "pointer:up": (ctx) => {
      if (!ctx.state.isDragging) return "delegate"

      ctx.events.write("DragEnded", {
        containerId: ctx.containerId,
        entityId: ctx.state.entityId,
        finalPosition: ctx.event.position,
      })

      ctx.channels.publish("drag:state", {
        isDragging: false,
        entityId: null,
        position: null,
      })

      return "handled"
    },

    "key:down": (ctx) => {
      if (ctx.event.key === "Escape" && ctx.state.isDragging) {
        // Cancel drag
        ctx.state.reset()
        return "handled"
      }
      return "delegate"
    },
  },

  // Reactive activation (optional)
  activateWhen: (ctx) => {
    const selection = ctx.channels.read("selection:current")
    return selection.selectedIds.length > 0
  },

  // Visual render (optional)
  render: (ctx) => {
    if (!ctx.state.isDragging) return null
    return <DragGhost position={ctx.state.position} />
  },
})
```

### Container Usage

```tsx
import { OverlayContainer, useOverlayContainer } from "@/lib/overlays"

function Canvas() {
  return (
    <OverlayContainer id="main-canvas">
      <CanvasContent />
      <OverlayControls />
    </OverlayContainer>
  )
}

function OverlayControls() {
  const container = useOverlayContainer()

  return (
    <div>
      <button onClick={() => container.enable(SelectionOverlay)}>
        Enable Selection
      </button>
      <button onClick={() => container.disable(DragOverlay)}>
        Disable Drag
      </button>
      <button onClick={() => container.toggle(ZoomOverlay)}>
        Toggle Zoom
      </button>
    </div>
  )
}
```

### Channel Subscription

```tsx
import { useChannel } from "@/lib/overlays"

function SelectionIndicator() {
  const selection = useChannel("selection:current")

  if (!selection || selection.selectedIds.length === 0) {
    return <span>Nothing selected</span>
  }

  return <span>{selection.selectedIds.length} items selected</span>
}
```

---

## Service Architecture

### OverlayRegistry Service

```typescript
import { Context, Layer, Effect, Ref, PubSub } from "effect"
import { Schema } from "effect"

class OverlayRegistry extends Context.Tag("tmnl/overlays/Registry")<
  OverlayRegistry,
  {
    // Container management
    createContainer: (id: ContainerId) => Effect.Effect<void>
    destroyContainer: (id: ContainerId) => Effect.Effect<void>

    // Overlay lifecycle
    register: (overlay: Overlay.Any) => Effect.Effect<void>
    enable: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>
    disable: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>
    toggle: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>

    // Query
    getActiveOverlays: (containerId: ContainerId) => Effect.Effect<OverlayInstance[]>
    isActive: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<boolean>
  }
>() {
  static Default = Layer.effect(
    OverlayRegistry,
    Effect.gen(function* () {
      const containers = yield* Ref.make(new Map<ContainerId, ContainerState>())

      return {
        // ... implementation
      }
    })
  )
}
```

### ChannelHub Service

```typescript
class ChannelHub extends Context.Tag("tmnl/overlays/ChannelHub")<
  ChannelHub,
  {
    // Publish to a channel
    publish: <T>(
      containerId: ContainerId,
      channel: string,
      message: T
    ) => Effect.Effect<void>

    // Subscribe to a channel (returns Stream)
    subscribe: <T>(
      containerId: ContainerId,
      channel: string,
      schema: Schema.Schema<T>
    ) => Effect.Effect<Stream.Stream<T>>

    // Read latest value (for sync access)
    read: <T>(
      containerId: ContainerId,
      channel: string
    ) => Effect.Effect<T | null>
  }
>() {
  static Default = Layer.effect(
    ChannelHub,
    Effect.gen(function* () {
      // PubSub per container per channel
      const hubs = yield* Ref.make(
        new Map<string, PubSub.PubSub<unknown>>()
      )

      return {
        // ... implementation
      }
    })
  )
}
```

### EventDispatcher Service

```typescript
class EventDispatcher extends Context.Tag("tmnl/overlays/EventDispatcher")<
  EventDispatcher,
  {
    // Dispatch event through overlay stack
    dispatch: (
      containerId: ContainerId,
      event: OverlayEvent
    ) => Effect.Effect<HandlerResult>

    // Register event listener (for DOM bridging)
    addListener: (
      containerId: ContainerId,
      eventType: string,
      listener: (event: unknown) => void
    ) => Effect.Effect<void, never, Scope>
  }
>() {}
```

---

## File Structure

```
src/lib/overlays/
├── ARCHITECTURE.md           # This document
├── index.ts                  # Public exports
├── schemas/
│   ├── index.ts              # All schema exports
│   ├── core.ts               # OverlayId, ContainerId, etc.
│   ├── events.ts             # PointerEvent, KeyEvent schemas
│   └── state.ts              # OverlayState, OverlayInstance
├── services/
│   ├── OverlayRegistry.ts    # Container + overlay management
│   ├── ChannelHub.ts         # Pub/sub channel system
│   └── EventDispatcher.ts    # Event routing through stack
├── Overlay.ts                # Overlay class definition
├── OverlayContainer.tsx      # React container component
├── atoms/
│   └── index.ts              # Runtime atoms for React integration
└── hooks/
    ├── useOverlayContainer.ts
    ├── useOverlay.ts
    └── useChannel.ts
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Schema definitions (`schemas/`)
- [ ] OverlayRegistry service
- [ ] ChannelHub service
- [ ] Basic Overlay class

### Phase 2: Event System
- [ ] EventDispatcher service
- [ ] DOM event bridging
- [ ] Handler result propagation
- [ ] LIFO stack routing

### Phase 3: React Integration
- [ ] OverlayContainer component
- [ ] Runtime atoms
- [ ] Hooks (useOverlayContainer, useChannel)
- [ ] Visual layer rendering

### Phase 4: EventLog Integration
- [ ] EventGroup definitions for overlays
- [ ] EventLog handlers with conflict detection
- [ ] Reactivity/invalidation

### Phase 5: Built-in Overlays
- [ ] SelectionOverlay
- [ ] DragOverlay
- [ ] ZoomOverlay
- [ ] PanOverlay

---

## Success Criteria

- [ ] Schema-backed types throughout
- [ ] EventLog integration for event persistence
- [ ] Typed pub/sub channels
- [ ] LIFO conflict resolution
- [ ] Container-scoped isolation
- [ ] Reactive activation predicates
- [ ] Zero wrapper divs (hook-based)
- [ ] TypeScript strict mode passing

---

Co-Authored-By: Val <val@maidens.ai>
