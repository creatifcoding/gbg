# Viewport Unification Plan

## Problem Statement

**Five** independent viewport state systems exist with minimal cross-talk:

| # | System | Atom | Registry | Where |
|---|---|---|---|---|
| **R1** | MapController / families | `viewportFamily(panelId)` | `geointRegistry` | `atoms/families.ts` — 15 writers, 8 readers |
| **R2** | GeointMap (component-local) | `viewStateFamily(instanceId)` | default `useAtom` | `components/GeointMap.tsx` — 3 writers, 1 reader |
| **R3** | Positioning system | `viewportAtom` (singleton) | `positioningRegistry` | `positioning/hooks.tsx` — 7 writers, 4 readers |
| **R4** | MapProjectionService | `Effect.Ref<ViewportState>` | Service-internal | `positioning/MapProjectionService.ts` |
| **R5** | Network graph machine | XState context | Machine store | `machines/networkGraphMachine.ts` |

**~38 consumer/producer call sites** across these 5 stores.

### Data Flow (broken)

```
MapController.zoomIn()
  → geointRegistry.set(viewportFamily(panelId))
  → ??? (nobody reads this on the rendering side)

User drags map in GeointMap
  → setViewState(viewStateFamily(instanceId))  [component-local]
  → syncViewport()  [→ positioningRegistry.viewportAtom]
  → ??? (MapController never reads this)

Minimap.onViewportChange()
  → mapController.setViewport()
  → geointRegistry.set(viewportFamily(panelId))
  → ??? (GeointMap doesn't see it)
```

### The flyTo Situation

| Stack | Animates? | Syncs Projections? | Used By |
|---|---|---|---|
| `GeointMap` `flyToTarget` prop → `FlyToInterpolator` | ✅ Yes (deck.gl) | Via `syncViewport` callback | Nothing (prop never passed) |
| `MapController.flyTo()` → atom snap | ❌ No | ❌ No | Hotkeys, harness tools |
| `positioningOps.flyTo()` → Effect service | ❌ No | ✅ Yes | Nothing currently |

## Solution: Single Source of Truth

### Design Decision

**geointRegistry + viewportFamily becomes THE source of truth.**

Rationale:
- It's already panel-scoped (the right granularity)
- MapController already writes to it
- geointRegistry is the established pattern for all geoint atoms
- GeointMap's component-local atoms are the aberration

### Phase 1: Wire GeointMap to Read Panel Viewport

**Goal**: GeointMap reads `viewportAtom` from `getPanelAtoms(panelId)` instead of its own `viewStateFamily`.

Changes:
1. **GeointMap** accepts a new `panelId` prop (or derives from context)
2. **GeointMap** uses `geointRegistry.get(atoms.viewportAtom)` as the controlled viewState
3. **GeointMap** `onViewStateChange` writes back to `geointRegistry.set(atoms.viewportAtom)`
4. **Delete** `viewStateFamily` from `GeointMap.tsx` (the component-local atoms)
5. **GeointDashboardPanel** passes `panelId` to `<GeointMap>`

After this: MapController.zoomIn() → atom → GeointMap re-renders → deck.gl updates. The loop closes.

### Phase 2: Wire flyTo Through Props

**Goal**: MapController.flyTo() triggers real deck.gl animation.

Options:
- **A) flyToTarget atom**: Add `flyToTargetFamily` to `families.ts`. MapController.flyTo() sets it. GeointMap reads it as a prop-equivalent, applies FlyToInterpolator. After animation completes, clear the atom.
- **B) Imperative ref**: GeointMap exposes a `mapRef` with `.flyTo(target)`. MapController calls it directly. Requires React ref forwarding.

**Recommended: Option A (atom-driven)**. It's consistent with the atom-as-state pattern and doesn't introduce imperative escape hatches.

### Phase 3: Collapse Positioning Viewport

**Goal**: `positioningRegistry.viewportAtom` reads from `geointRegistry.viewportFamily`.

Changes:
1. `useViewportSync` becomes unnecessary — positioning reads from the same source
2. `positioningOps.setViewport()` writes to geointRegistry instead of positioningRegistry
3. `positioningOps.flyTo()` uses the new `flyToTargetFamily` atom
4. Remove `positioningRegistry.viewportAtom` (or make it a derived atom that reads geointRegistry)

### Phase 4: Cleanup

1. Delete `viewStateFamily`, `tracksFamily`, etc. from GeointMap.tsx (component-local atoms)
2. Delete `createGeointInstanceAtoms()` / `disposeGeointInstanceAtoms()`
3. Remove the `(mc ?? ops)` fallback pattern from hotkeys — MapController only
4. Remove `createMapOperations`, `createViewOperations`, etc. (deprecated → deleted)
5. Consolidate `extractPosition()` utility (exists in 3 places)

## Atom Migration Map

| Current (delete) | Replacement (keep) |
|---|---|
| `GeointMap.viewStateFamily` | `families.viewportFamily` via geointRegistry |
| `GeointMap.visibilityFamily` | `families.layerVisibilityFamily` via geointRegistry |
| `GeointMap.selectedTrackFamily` | `families.selectedEntityFamily` via geointRegistry |
| `positioningRegistry.viewportAtom` | Derived from `families.viewportFamily` |
| (new) | `families.flyToTargetFamily` — triggers deck.gl animation |

## Risk Assessment

| Risk | Mitigation |
|---|---|
| GeointMap used standalone elsewhere (testbeds) | Keep `initialViewState` prop as seed, but atom is source of truth |
| Multiple GeointMap instances per panel | One atom per panel, all instances read same source |
| Positioning service needs width/height | Add width/height to viewportFamily schema or separate dimensionsFamily |
| deck.gl FlyToInterpolator mutates viewState during animation | Write-back from onViewStateChange handles intermediate frames |

## Test Strategy

1. MapController.zoomIn() → verify GeointMap viewState updates (integration)
2. User drag in GeointMap → verify MapController.getViewport() reflects change
3. MapController.flyTo() → verify deck.gl FlyToInterpolator fires
4. Minimap.onViewportChange → verify both MapController and GeointMap in sync
5. Existing 82 MapController/geodesic tests remain green (atom mock stays valid)
