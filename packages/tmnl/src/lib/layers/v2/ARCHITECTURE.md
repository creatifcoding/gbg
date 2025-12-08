# Layer System v2 — Architecture Proposal

**Status**: Draft
**EDIN Phase**: Design
**Date**: 2025-12-03
**Author**: Val

---

## Executive Summary

v2 eliminates the HOC wrapper pattern, removes XState overhead, and centralizes the Effect runtime at the provider level. The result: zero wrapper divs, explicit registration, and cleaner React integration.

---

## Core Principles

1. **No Wrapper Divs** — Components apply layer styles directly via hook
2. **Single Runtime** — Provider owns Effect runtime, components subscribe
3. **Explicit Registration** — No side-effect magic, predictable lifecycle
4. **Atoms as Truth** — effect-atom IS the state, no dual sync

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    <LayerProvider>                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Effect Runtime (single)                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │   │
│  │  │ IdGenerator│  │LayerRegistry│ │ LayerOperations│  │   │
│  │  └────────────┘  └────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                             │                                │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              effect-atom (Single Source)              │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐ │   │
│  │  │layersAtom │  │ sortedAtom│  │ layerFamilyAtom   │ │   │
│  │  │ (Map)     │  │ (derived) │  │ (by id)           │ │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      React Components                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │useLayerStyle │  │useLayerOps  │  │useRegisterLayer  │  │
│  │ (style obj)  │  │ (operations)│  │ (lifecycle)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## API Design

### 1. LayerProvider

```tsx
import { LayerProvider } from '@/lib/layers/v2'

function App() {
  return (
    <LayerProvider>
      <Background />
      <Content />
      <Overlay />
    </LayerProvider>
  )
}
```

**Responsibilities**:
- Creates and owns the Effect runtime
- Provides context for layer hooks
- Handles cleanup on unmount

### 2. useRegisterLayer (Lifecycle Hook)

```tsx
import { useRegisterLayer } from '@/lib/layers/v2'

function Background() {
  const layerId = useRegisterLayer({
    name: 'background',
    initialZIndex: -10,
    pointerEvents: 'auto',
  })

  // layerId is stable string, null until registered

  return <div id={layerId}>...</div>
}
```

**Returns**: `string | null` — Layer ID after registration, null during SSR/hydration

**Lifecycle**:
1. Mount → `register(config)` → returns ID
2. Unmount → `unregister(id)` → cleanup

### 3. useLayerStyle (Style Hook)

```tsx
import { useLayerStyle } from '@/lib/layers/v2'

function Content({ children }) {
  const layerId = useRegisterLayer({ name: 'content', initialZIndex: 10 })
  const style = useLayerStyle(layerId)

  return (
    <div style={style}>
      {children}
    </div>
  )
}
```

**Returns**: `CSSProperties` object with:
- `position`
- `zIndex`
- `pointerEvents`
- `inset` (for absolute/fixed)

**No wrapper div** — Component applies styles directly to its root element.

### 4. useLayerOps (Operations Hook)

```tsx
import { useLayerOps } from '@/lib/layers/v2'

function LayerControls({ layerId }) {
  const ops = useLayerOps(layerId)

  return (
    <>
      <button onClick={ops.bringToFront}>↑ Front</button>
      <button onClick={ops.sendToBack}>↓ Back</button>
      <button onClick={() => ops.setVisible(false)}>Hide</button>
    </>
  )
}
```

**Operations**:
- `bringToFront()` → Move to highest z-index + gap
- `sendToBack()` → Move to lowest z-index - gap
- `setVisible(boolean)` → Toggle visibility
- `setPointerEvents('auto' | 'none' | 'pass-through')`
- `setZIndex(number)` → Direct z-index assignment

### 5. Convenience: useLayer (Combined Hook)

```tsx
import { useLayer } from '@/lib/layers/v2'

function ManagedLayer({ children }) {
  const { id, style, ops, layer } = useLayer({
    name: 'managed',
    initialZIndex: 50,
    positionMode: 'absolute',
  })

  return (
    <div style={style} data-layer-id={id}>
      {children}
      {layer?.visible && <span>Visible</span>}
    </div>
  )
}
```

**Returns**:
- `id: string | null`
- `style: CSSProperties`
- `ops: LayerOps`
- `layer: LayerInstance | null`

---

## Service Architecture

### LayerRegistry Service

Replaces LayerManager. Simpler, no XState.

```typescript
class LayerRegistry extends Context.Tag('tmnl/layers/v2/LayerRegistry')<
  LayerRegistry,
  LayerRegistryOps
>() {
  static Default = Layer.effect(
    LayerRegistry,
    Effect.gen(function* () {
      const layers = yield* Ref.make<Map<string, LayerInstance>>(new Map())

      return {
        register: (config: LayerConfig) => Effect.gen(function* () {
          const id = yield* IdGenerator.pipe(Effect.flatMap(g => g.generate()))
          const instance: LayerInstance = {
            id,
            name: config.name,
            zIndex: config.initialZIndex ?? 0,
            visible: config.visible ?? true,
            positionMode: config.positionMode ?? 'relative',
            pointerEvents: config.pointerEvents ?? 'auto',
          }
          yield* Ref.update(layers, map => new Map(map).set(id, instance))
          return id
        }),

        unregister: (id: string) => Ref.update(layers, map => {
          const next = new Map(map)
          next.delete(id)
          return next
        }),

        getLayer: (id: string) => Ref.get(layers).pipe(
          Effect.map(map => map.get(id) ?? null)
        ),

        getAllLayers: () => Ref.get(layers).pipe(
          Effect.map(map => Array.from(map.values()))
        ),

        getSorted: () => Ref.get(layers).pipe(
          Effect.map(map =>
            Array.from(map.values()).sort((a, b) => a.zIndex - b.zIndex)
          )
        ),

        updateLayer: (id: string, update: Partial<LayerInstance>) =>
          Ref.update(layers, map => {
            const existing = map.get(id)
            if (!existing) return map
            return new Map(map).set(id, { ...existing, ...update })
          }),
      }
    })
  )
}
```

### LayerOperations Service

Z-index algorithms, separated from storage.

```typescript
class LayerOperations extends Context.Tag('tmnl/layers/v2/LayerOperations')<
  LayerOperations,
  LayerOperationsOps
>() {
  static Default = Layer.effect(
    LayerOperations,
    Effect.gen(function* () {
      const registry = yield* LayerRegistry

      return {
        bringToFront: (id: string) => Effect.gen(function* () {
          const sorted = yield* registry.getSorted()
          const maxZ = sorted[sorted.length - 1]?.zIndex ?? 0
          yield* registry.updateLayer(id, { zIndex: maxZ + 10 })
        }),

        sendToBack: (id: string) => Effect.gen(function* () {
          const sorted = yield* registry.getSorted()
          const minZ = sorted[0]?.zIndex ?? 0
          yield* registry.updateLayer(id, { zIndex: minZ - 10 })
        }),

        setVisible: (id: string, visible: boolean) =>
          registry.updateLayer(id, { visible }),

        setPointerEvents: (id: string, pe: PointerEventsBehavior) =>
          registry.updateLayer(id, { pointerEvents: pe }),

        setZIndex: (id: string, zIndex: number) =>
          registry.updateLayer(id, { zIndex }),
      }
    })
  )
}
```

---

## Atom Architecture

### Runtime Atom (Single)

```typescript
export const layerRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    IdGenerator.Default,
    LayerRegistry.Default,
    LayerOperations.Default
  )
)
```

### State Atoms

```typescript
// All layers as Map (raw)
export const layersMapAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const registry = yield* LayerRegistry
    return yield* registry.getAllLayers()
  })
)

// Sorted by z-index (derived)
export const sortedLayersAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const registry = yield* LayerRegistry
    return yield* registry.getSorted()
  })
)

// Individual layer (family)
export const layerAtom = Atom.family((id: string) =>
  layerRuntimeAtom.atom(
    Effect.gen(function* () {
      const registry = yield* LayerRegistry
      return yield* registry.getLayer(id)
    })
  )
)
```

### Operation Atoms

```typescript
export const layerOpsAtom = {
  register: layerRuntimeAtom.fn((config: LayerConfig) =>
    Effect.gen(function* () {
      const registry = yield* LayerRegistry
      return yield* registry.register(config)
    })
  ),

  unregister: layerRuntimeAtom.fn((id: string) =>
    Effect.gen(function* () {
      const registry = yield* LayerRegistry
      yield* registry.unregister(id)
    })
  ),

  bringToFront: layerRuntimeAtom.fn((id: string) =>
    Effect.gen(function* () {
      const ops = yield* LayerOperations
      yield* ops.bringToFront(id)
    })
  ),

  // ... other operations
}
```

---

## Types

```typescript
// Core layer instance
interface LayerInstance {
  readonly id: string
  readonly name: string
  zIndex: number
  visible: boolean
  positionMode: PositionMode
  pointerEvents: PointerEventsBehavior
}

// Registration config
interface LayerConfig {
  name: string
  initialZIndex?: number
  visible?: boolean
  positionMode?: PositionMode
  pointerEvents?: PointerEventsBehavior
}

// Position modes
type PositionMode = 'relative' | 'absolute' | 'fixed' | 'sticky'

// Pointer event behaviors
type PointerEventsBehavior = 'auto' | 'none' | 'pass-through'

// Hook returns
interface UseLayerReturn {
  id: string | null
  style: CSSProperties
  ops: LayerOps
  layer: LayerInstance | null
}

interface LayerOps {
  bringToFront: () => void
  sendToBack: () => void
  setVisible: (visible: boolean) => void
  setPointerEvents: (pe: PointerEventsBehavior) => void
  setZIndex: (z: number) => void
}
```

---

## File Structure

```
src/lib/layers/v2/
├── ARCHITECTURE.md          # This document
├── index.ts                 # Public exports
├── types.ts                 # TypeScript types
├── LayerProvider.tsx        # React context + runtime
├── services/
│   ├── IdGenerator.ts       # (reuse from v1)
│   ├── LayerRegistry.ts     # Layer storage
│   └── LayerOperations.ts   # Z-index algorithms
├── atoms/
│   └── index.ts             # Runtime + state + operation atoms
└── hooks/
    ├── useRegisterLayer.ts  # Registration lifecycle
    ├── useLayerStyle.ts     # Style computation
    ├── useLayerOps.ts       # Operation bindings
    └── useLayer.ts          # Combined convenience hook
```

---

## Migration Path

### Phase 1: Parallel Implementation
- Build v2 alongside v1
- v1 exports remain stable
- New components can opt-in to v2

### Phase 2: Testbed Migration
- Migrate testbed components to v2
- Validate no regressions
- Document any edge cases

### Phase 3: Production Migration
- Update production components
- Deprecate v1 exports
- Update CLAUDE.md documentation

### Phase 4: Cleanup
- Remove v1 code
- Flatten v2 to root

---

## Comparison: v1 vs v2

| Aspect | v1 | v2 |
|--------|----|----|
| Wrapper div | Yes (HOC) | No (style injection) |
| XState | Yes (underutilized) | No |
| Runtime location | Per-HOC mount | Provider level |
| Registration | Side-effect in useEffect | Explicit hook call |
| State sync | Dual (Ref + Atom) | Single (Atom) |
| Position defaults | Fixed (missing inset) | Explicit contracts |

---

## Open Questions

1. **SSR Hydration**: How to handle layer registration during hydration?
   - Proposal: Return `null` ID until client-side, use `useId()` for stable keys

2. **Persistence**: Should v2 support optional layer persistence?
   - Proposal: Defer to v2.1, keep v2.0 ephemeral

3. **DevTools**: Should v2 include a debug inspector?
   - Proposal: Defer to v2.1, can add overlay panel similar to slider debug

4. **Animation Integration**: Should z-index changes be animatable?
   - Proposal: Use existing `animatable()` system, z-index as number animatable

---

## Success Criteria

- [ ] No wrapper divs in DOM
- [ ] Single Effect runtime per provider
- [ ] Type-safe hook API
- [ ] Backwards-compatible migration path
- [ ] All v1 testbed components working with v2
- [ ] TypeScript strict mode passing

---

Co-Authored-By: Val <val@maidens.ai>
