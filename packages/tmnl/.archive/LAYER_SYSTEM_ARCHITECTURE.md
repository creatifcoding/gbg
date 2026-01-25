# Layer System Architecture (ARCHIVED)

> **Status**: ARCHIVED on 2025-12-31
> **Reason**: This architecture was superseded by `src/lib/overlays/` and `src/lib/floating/`
> **Successor Systems**:
> - `src/lib/overlays/` — Event-driven overlay system with Schema-backed events
> - `src/lib/floating/` — Panel management, drag, resize, persistence

---

## Overview

TMNL implements a sophisticated layer management system inspired by Adobe's layer paradigm, adapted for web applications. The system uses **Effect** for dependency injection, **effect-atom** for reactive state management, and **XState** for lifecycle state machines.

## Core Philosophy

The layer system treats UI components as composable layers with explicit z-index ordering, pointer-event behavior, and lifecycle management. This enables:

1. **Declarative layering** - Components declare their layer properties via HOC
2. **Centralized state** - Single source of truth for all layer metadata
3. **Smart z-index management** - Algorithms that minimize re-renders and reassignments
4. **Proper event bubbling** - Fine-grained pointer-events control (auto, none, pass-through)
5. **Effect-based DI** - Services use Effect.Service pattern for testability and composition

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React Components                        │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ withLayering HOC │◄────────┤   useLayer Hook  │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   effect-atom (Reactive)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  layersAtom  │  │ layerIndex   │  │ layerSorted  │      │
│  │  (all layers)│  │ (z-ordered)  │  │ (optimized)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              layerRuntimeAtom (Effect Runtime)               │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Effect Services (DI Layer)                │  │
│  │                                                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │ IdGenerator│  │LayerFactory│  │ LayerManager   │  │  │
│  │  │  Service   │  │  Service   │  │   Service      │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └────────┬───────┘  │  │
│  │        │                │                  │           │  │
│  │        │                │         ┌────────▼────────┐ │  │
│  │        │                │         │  Effect.Ref     │ │  │
│  │        └────────────────┴────────►│  <LayerState>   │ │  │
│  │                                   └─────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ XState Machine  │
                  │ (Lifecycle)     │
                  └─────────────────┘
```

## Key Design Decisions

### 1. Z-Index Storage Model

**Decision**: Layers store their own z-index property; LayerIndex is a derived, sorted view.

**Rationale**:

- Allows layers to carry their z-index with them
- LayerIndex provides ordered visualization without being the source of truth
- Enables onResort closures to access new z-index value

**Implementation**:

```typescript
interface LayerInstance {
  readonly id: string;
  readonly zIndex: number; // ← Stored on layer
  // ... other properties
}

// Derived sorted view
const layerIndexAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const manager = yield* LayerManager;
    return yield* manager.getLayerIndex(); // Returns layers sorted by zIndex
  })
);
```

### 2. Smart Z-Index Algorithm

**Decision**: Create gaps (±10) when bringing layers to front/back to minimize future reassignments.

**Rationale**:

- Avoids cascading updates when z-index changes
- Allows future insertions without recalculating all layers
- Triggers onResort closure only for the moved layer, not all layers

**Implementation** (`LayerManager.ts:calculateNewZIndex`):

```typescript
const calculateNewZIndex = (
  layers: ReadonlyArray<LayerInstance>,
  targetId: string,
  direction: 'front' | 'back'
): number => {
  const sorted = Array.sort(layers, (a, b) => a.zIndex - b.zIndex);

  if (direction === 'front') {
    const maxZ = sorted[sorted.length - 1]?.zIndex ?? 0;
    return maxZ + 10; // ← Gap for future insertions
  } else {
    const minZ = sorted[0]?.zIndex ?? 0;
    return minZ - 10;
  }
};
```

### 3. Dual State: Effect.Ref + Atom Sync

**Decision**: LayerManager maintains canonical state in `Effect.Ref<Array<LayerInstance>>`, synced with atoms for React.

**Rationale**:

- Effect.Ref provides mutable state within Effect runtime
- Atoms expose this state reactively to React components
- Separation of concerns: service layer (Effect) vs view layer (React)
- Enables testing services without React

### 4. XState Hybrid Integration

**Decision**: XState machine validates transitions; LayerManager executes z-index changes.

**Rationale**:

- XState handles visibility/lock state (hidden, visible, locked)
- Z-index is orthogonal to lifecycle state
- Machine sends events to LayerManager for z-index operations
- Separation allows independent testing of state machine logic

### 5. onResort Closures

**Decision**: Layers can define closures that execute after z-index changes.

**Rationale**:

- Allows custom behavior when layer order changes (e.g., update analytics, trigger animations)
- Closure receives updated layer instance with new z-index
- Stored in layer metadata for flexibility

### 6. Render Optimization via layerSorted Atom

**Decision**: `layerSorted` atom tracks visual hash to prevent unnecessary re-renders when z-index changes don't affect visual output.

### 7. Pointer Events Strategy

**Decision**: Three-tier pointer-events model: `auto`, `none`, `pass-through`.

**Rationale**:

- **auto**: Layer captures all clicks (e.g., background)
- **none**: Layer ignores all clicks (transparent overlay)
- **pass-through**: Container is `none`, children are `auto` (smart bubbling)

## Service Architecture

### IdGenerator Service

**Purpose**: Configurable ID generation with multiple strategies.

**Strategies**:

- `nanoid`: Fast, URL-safe (default)
- `uuid`: Standard UUID v4
- `custom`: User-provided generator function

### LayerFactory Service

**Purpose**: Creates compliant layer instances with validation.

**Dependencies**: `IdGenerator`

**Responsibilities**:

- Generate unique IDs via IdGenerator
- Create XState machine actor for lifecycle
- Validate configuration (z-index range, opacity range, name)
- Attach onResort closures to metadata

### LayerManager Service

**Purpose**: Centralized layer state management and z-index operations.

**Operations**:

- `getAllLayers()` - Returns all layers (unsorted)
- `getLayerIndex()` - Returns layers sorted by z-index
- `addLayer(layer)` - Register new layer
- `removeLayer(id)` - Unregister layer
- `bringToFront(id)` - Move layer to top (smart algorithm)
- `sendToBack(id)` - Move layer to bottom
- `setVisible(id, visible)` - Toggle visibility (+ XState event)
- `setOpacity(id, opacity)` - Adjust transparency
- `setLocked(id, locked)` - Lock interactions (+ XState event)
- `setPointerEvents(id, behavior)` - Change click behavior

## File Structure (PLANNED, NEVER IMPLEMENTED)

```
src/lib/layers/
├── types.ts                    # TypeScript types
├── services/
│   ├── IdGenerator.ts          # ID generation service
│   ├── LayerFactory.ts         # Layer factory service
│   └── LayerManager.ts         # Layer manager service
├── machines/
│   └── layerMachine.ts         # XState lifecycle machine
├── atoms/
│   └── index.ts                # effect-atom definitions
├── withLayering.tsx            # HOC for layer wrapping
├── useLayer.ts                 # React hook
└── index.ts                    # Public exports
```

## Known Limitations & Future Work

1. **Effect.runPromise in withLayering**: Currently uses simplified Effect execution.
2. **No Layer Persistence**: Layers are ephemeral.
3. **No Layer Groups**: Cannot group layers into folders/collections.
4. **Fixed Z-Index Gaps**: Gap size (±10) is hardcoded.
5. **Limited XState Integration**: Machine doesn't trigger callbacks on state transitions.
6. **No Undo/Redo**: Layer operations are not tracked for undo.

## References

- [Effect Documentation](https://effect.website)
- [effect-atom Documentation](https://github.com/tim-smart/effect-atom)
- [XState Documentation](https://xstate.js.org)
- [Adobe Layers Paradigm](https://helpx.adobe.com/photoshop/using/layer-basics.html)
