# GEOINT Actions Specification

**Purpose**: Systematic implementation guide for all GEOINT keyboard command actions.

**Status**: 🔴 Not Started
**Last Updated**: 2026-01-20

---

## Overview

All actions listed in `GeointKeyboardActions` interface must be implemented with panel-scoped state using `Atom.family(panelId)` pattern.

### Architecture Patterns

1. **Panel Identity**: UUID (unique instance) + slug (human-readable)
   - Example: `{ uuid: "a1b2c3d4-...", slug: "geoint-main" }`
   - Full ID: `"geoint-main:a1b2c3d4"` used for scope registration

2. **Panel-Scoped State**: Each panel instance has isolated atoms via `Atom.family(panelId => Atom.make(...))`

3. **Operations Composition (Hydration)**:
   ```typescript
   // Create individual operation modules
   const mapOps = createMapOperations(panelId)
   const searchOps = createSearchOperations(panelId)
   const layerOps = createLayerOperations(panelId)
   const selectionOps = createSelectionOperations(panelId)
   const viewOps = createViewOperations(panelId)

   // Merge into unified operations object
   const ops = {
     ...mapOps,
     ...searchOps,
     ...layerOps,
     ...selectionOps,
     ...viewOps,
   }

   // Hydrate panel with operations
   const hydrated = hydratePanel(panelId, ops)
   ```

4. **Encapsulated Hotkey Management**: `useGeointPanelHotkeys(panelId, operations)`
   - Opaque wrapper handling scope registration, focus/blur, keybinding
   - Automatically registers unique scope per panel: `geoint:${panelId}`
   - Activates scope on focus, deactivates on blur
   - Returns ref to attach to container element

5. **Scope Hierarchy & Focus Management**:
   ```
   Global (priority: 0)
   ├─ Modal (priority: 20)
   ├─ Palette (priority: 30)
   └─ GEOINT (priority: 15)
      ├─ geoint:panel-1:uuid (active when focused)
      ├─ geoint:panel-2:uuid (inactive)
      └─ geoint:panel-3:uuid (inactive)
   ```
   - Only focused panel's scope is active
   - Modal/palette override all panel scopes
   - DOM focus/blur events control scope stack

---

## Core Implementation

### Panel Identity Structure

```typescript
// src/lib/geoint/atoms/families.ts

import { Schema } from 'effect'
import { v4 as uuid } from 'uuid'

export const PanelIdentity = Schema.Struct({
  uuid: Schema.UUID,
  slug: Schema.String,
})

export type PanelIdentity = Schema.Schema.Type<typeof PanelIdentity>

/**
 * Create a new panel identity.
 * @param slug Human-readable identifier (e.g., "geoint-main")
 */
export function createPanelIdentity(slug: string): PanelIdentity {
  return { uuid: uuid(), slug }
}

/**
 * Convert PanelIdentity to string for use as atom family key.
 * Format: "slug:uuid"
 */
export function panelIdentityToId(identity: PanelIdentity): PanelId {
  return asPanelId(`${identity.slug}:${identity.uuid}`)
}

/**
 * Convert PanelIdentity to scope ID for hotkey system.
 * Format: "geoint:slug:uuid"
 */
export function panelIdentityToScopeId(identity: PanelIdentity): string {
  return `geoint:${identity.slug}:${identity.uuid}`
}
```

### Unified Operations Factory

```typescript
// src/lib/geoint/atoms/operations.ts

import { createMapOperations } from './mapOperations'
import { createSearchOperations } from './searchOperations'
import { createLayerOperations } from './layerOperations'
import { createSelectionOperations } from './selectionOperations'
import { createViewOperations } from './viewOperations'
import type { PanelId } from './families'

/**
 * Unified GEOINT operations for a panel.
 * Merges all operation modules into a single object.
 */
export function createGeointOperations(panelId: PanelId) {
  // Create individual operation modules
  const mapOps = createMapOperations(panelId)
  const searchOps = createSearchOperations(panelId)
  const layerOps = createLayerOperations(panelId)
  const selectionOps = createSelectionOperations(panelId)
  const viewOps = createViewOperations(panelId)

  // Merge into unified object
  return {
    ...mapOps,
    ...searchOps,
    ...layerOps,
    ...selectionOps,
    ...viewOps,
  }
}

export type GeointOperations = ReturnType<typeof createGeointOperations>
```

### Encapsulated Hotkey Hook

```typescript
// src/lib/geoint/hooks/useGeointPanelHotkeys.ts

import { useEffect, useRef, useContext, useMemo } from 'react'
import { RegistryContext } from '@effect-atom/atom-react'
import { hotkeyActions, ScopeRegistry } from '@/lib/hotkeys'
import type { PanelIdentity } from '../atoms/families'
import type { GeointOperations } from '../atoms/operations'
import { panelIdentityToScopeId } from '../atoms/families'
import { GeointKeyboardProvider } from '../components/GeointKeyboardProvider'

/**
 * Encapsulated panel hotkey management.
 *
 * Handles:
 * - Unique scope registration per panel
 * - Focus/blur scope activation
 * - Keybinding registration
 * - Cleanup on unmount
 *
 * @param identity Panel identity (uuid + slug)
 * @param operations Unified operations object
 * @returns Ref to attach to focusable container
 *
 * @example
 * ```tsx
 * const identity = createPanelIdentity('geoint-main')
 * const ops = createGeointOperations(panelIdentityToId(identity))
 * const containerRef = useGeointPanelHotkeys(identity, ops)
 *
 * return <div ref={containerRef} tabIndex={-1}>...</div>
 * ```
 */
export function useGeointPanelHotkeys(
  identity: PanelIdentity,
  operations: GeointOperations
) {
  const registry = useContext(RegistryContext)
  const containerRef = useRef<HTMLDivElement>(null)

  const scopeId = useMemo(
    () => panelIdentityToScopeId(identity),
    [identity]
  )

  const scopeRegisteredRef = useRef(false)

  // Register unique scope for this panel
  useEffect(() => {
    if (!registry || scopeRegisteredRef.current) return

    // Register runtime scope (geoint:slug:uuid)
    const program = Effect.gen(function* () {
      const scopeRegistry = yield* ScopeRegistry.Tag
      yield* scopeRegistry.register({
        id: scopeId,
        name: `GEOINT Panel (${identity.slug})`,
        description: `Panel-scoped hotkeys for ${identity.slug}`,
        metadata: {
          parent: 'geoint',
          priority: 15,
        },
      })
    }).pipe(Effect.provide(ScopeRegistry.Live))

    Effect.runPromise(program).catch(console.warn)
    scopeRegisteredRef.current = true

    return () => {
      scopeRegisteredRef.current = false
    }
  }, [registry, scopeId, identity.slug])

  // Focus/blur management for scope activation
  useEffect(() => {
    const container = containerRef.current
    if (!container || !registry) return

    const handleFocus = (e: FocusEvent) => {
      // Only activate if focus entered from outside
      if (!container.contains(e.relatedTarget as Node)) {
        console.debug(`[Panel ${identity.slug}] Activating scope: ${scopeId}`)
        hotkeyActions.pushScope(registry, scopeId)
      }
    }

    const handleBlur = (e: FocusEvent) => {
      // Only deactivate if focus left to outside
      if (!container.contains(e.relatedTarget as Node)) {
        console.debug(`[Panel ${identity.slug}] Deactivating scope: ${scopeId}`)
        hotkeyActions.popScope(registry)
      }
    }

    container.addEventListener('focusin', handleFocus)
    container.addEventListener('focusout', handleBlur)

    return () => {
      container.removeEventListener('focusin', handleFocus)
      container.removeEventListener('focusout', handleBlur)

      // Ensure scope is popped on unmount
      const scopeStack = registry.get(scopeStackSourceAtom)
      if (scopeStack.includes(scopeId)) {
        hotkeyActions.popScope(registry)
      }
    }
  }, [registry, scopeId, identity.slug])

  return containerRef
}
```

### Usage in GeointDashboardPanel

```typescript
// src/lib/geoint/components/GeointDashboardPanel.tsx

const GeointDashboardPanelContent: FC<GeointDashboardPanelContentProps> = ({
  identity,
  label,
  onClose,
  initialLayout,
  className,
}) => {
  // Panel context
  const { panelId } = useGeointPanel()

  // Unified operations
  const ops = useMemo(
    () => createGeointOperations(panelId),
    [panelId]
  )

  // Encapsulated hotkey management (returns container ref)
  const containerRef = useGeointPanelHotkeys(identity, ops)

  return (
    <motion.div
      ref={containerRef}
      tabIndex={-1}  // Make focusable
      style={{ outline: 'none' }}  // Hide focus ring
      onClick={() => containerRef.current?.focus()}  // Auto-focus on click
    >
      <GeointKeyboardProvider
        scopeId={panelIdentityToScopeId(identity)}
        actions={ops}
        activateScope={false}  // Hook handles activation
      >
        {/* Panel content */}
      </GeointKeyboardProvider>
    </motion.div>
  )
}
```

---

## Action Categories

### 🗺️ Map Operations (4 actions)

| # | Action | Keys | Status | Implementation Notes |
|---|--------|------|--------|---------------------|
| 1 | `zoomIn` | `=` | ⬜ | Increment `viewportAtom` zoom by 1 |
| 2 | `zoomOut` | `-` | ⬜ | Decrement `viewportAtom` zoom by 1 |
| 3 | `resetView` | `0` | ⬜ | Set `viewportAtom` to `DEFAULT_VIEWPORT` |
| 4 | `toggleFullscreen` | `f` | ✅ Default | Browser API (already implemented in provider) |

#### Atoms Required
```typescript
// Panel-scoped viewport (already exists globally, needs family version)
const viewportFamily = Atom.family((panelId: string) =>
  Atom.make<ViewportState>(DEFAULT_VIEWPORT)
)
```

#### Implementation Pattern
```typescript
const zoomIn = () => {
  const current = registry.get(viewportFamily(panelId))
  registry.set(viewportFamily(panelId), {
    ...current,
    zoom: Math.min(current.zoom + 1, MAX_ZOOM)
  })
}
```

---

### 🔍 Search Operations (4 actions)

| # | Action | Keys | Status | Implementation Notes |
|---|--------|------|--------|---------------------|
| 5 | `focusSearch` | `/` | ✅ Default | `querySelector('[data-geoint-search-input]')?.focus()` |
| 6 | `clearSearch` | `escape` | ⬜ | Clear `searchQueryAtom`, reset `searchResultsAtom` |
| 7 | `executeSearch` | `enter` | ⬜ | Trigger search operation via `searchOps.execute()` |
| 8 | `toggleSearchPanel` | `ctrl+/` | ⬜ | Toggle `searchPanelVisibleAtom` boolean |

#### Atoms Required
```typescript
// Panel-scoped search state
const searchQueryFamily = Atom.family((panelId: string) =>
  Atom.make<string>('')
)

const searchPanelVisibleFamily = Atom.family((panelId: string) =>
  Atom.make<boolean>(true)
)
```

#### Integration Notes
- Search atoms likely exist in `src/lib/geoint/atoms/searchAtoms.ts`
- Need to refactor to use Atom.family pattern
- SearchProvider component already manages search state

---

### 🧭 Layer Operations (5 actions)

| # | Action | Keys | Status | Implementation Notes |
|---|--------|------|--------|---------------------|
| 9 | `toggleLayerPanel` | `g l` | ⬜ | Toggle `layerPanelVisibleAtom` boolean |
| 10 | `toggleLayer(layerId)` | `g 1`, `g 2`, `g 3` | ⬜ | Toggle layer in `visibleLayersAtom` Set |
| 11 | `showAllLayers` | `shift+s` | ⬜ | Set `visibleLayersAtom` to all layer IDs |
| 12 | `hideAllLayers` | `shift+h` | ⬜ | Clear `visibleLayersAtom` Set |
| 13 | `cycleMapStyle` | `g m` | ⬜ | Cycle `mapStyleAtom` through styles array |

#### Atoms Required
```typescript
// Panel-scoped layer state
const visibleLayersFamily = Atom.family((panelId: string) =>
  Atom.make<Set<string>>(new Set(['osm', 'tracks']))
)

const mapStyleFamily = Atom.family((panelId: string) =>
  Atom.make<MapStyle>('satellite')
)

const layerPanelVisibleFamily = Atom.family((panelId: string) =>
  Atom.make<boolean>(false)
)
```

#### Layer IDs
- `'osm'` - OpenStreetMap overlay
- `'satellite'` - Satellite imagery
- `'tracks'` - Entity tracks/trails
- `'weather'` - Weather overlays
- `'imagery'` - Planet/Sentinel imagery

---

### 🎯 Selection Operations (4 actions)

| # | Action | Keys | Status | Implementation Notes |
|---|--------|------|--------|---------------------|
| 14 | `selectAll` | `ctrl+a` | ⬜ | Set `selectedEntitiesAtom` to all visible entity IDs |
| 15 | `clearSelection` | `ctrl+shift+a` | ⬜ | Clear `selectedEntitiesAtom` Set |
| 16 | `invertSelection` | `ctrl+i` | ⬜ | XOR `selectedEntitiesAtom` with all visible IDs |
| 17 | `deleteSelected` | `delete` / `backspace` | ⬜ | Remove selected IDs from `entitiesAtom`, clear selection |

#### Atoms Required
```typescript
// Panel-scoped selection state
const selectedEntitiesFamily = Atom.family((panelId: string) =>
  Atom.make<Set<string>>(new Set())
)
```

#### Implementation Pattern
```typescript
const selectAll = () => {
  const results = registry.get(filteredResultsFamily(panelId))
  const allIds = new Set(results.map(r => r.id))
  registry.set(selectedEntitiesFamily(panelId), allIds)
}

const invertSelection = () => {
  const current = registry.get(selectedEntitiesFamily(panelId))
  const results = registry.get(filteredResultsFamily(panelId))
  const allIds = new Set(results.map(r => r.id))

  const inverted = new Set<string>()
  for (const id of allIds) {
    if (!current.has(id)) inverted.add(id)
  }

  registry.set(selectedEntitiesFamily(panelId), inverted)
}
```

---

### 👁️ View Operations (2 actions)

| # | Action | Keys | Status | Implementation Notes |
|---|--------|------|--------|---------------------|
| 18 | `fitToSelection` | `z f` | ⬜ | Calculate bounds of selected entities, set viewport |
| 19 | `fitToAll` | `z a` | ⬜ | Calculate bounds of all entities, set viewport |

#### Implementation Pattern
```typescript
const fitToSelection = () => {
  const selected = registry.get(selectedEntitiesFamily(panelId))
  const results = registry.get(filteredResultsFamily(panelId))

  const selectedResults = results.filter(r => selected.has(r.id))
  const bounds = calculateBounds(selectedResults.map(r => r.position))

  registry.set(viewportFamily(panelId), {
    ...viewport,
    ...boundsToViewport(bounds),
    transitionDuration: 300
  })
}
```

#### Utility Functions Needed
```typescript
function calculateBounds(positions: Position[]): Bounds {
  // Calculate min/max lon/lat from positions
}

function boundsToViewport(bounds: Bounds): Partial<ViewportState> {
  // Calculate zoom and center from bounds
}
```

---

## Implementation Phases

### Phase 1: Panel Identity & Core Infrastructure ✅
- [x] Create panel-scoped atom families (viewportAtom, resultsAtom, etc.)
- [x] Implement PanelId branded type
- [x] Create test harness for atom families (18 tests passing)
- [ ] Add PanelIdentity structure (UUID + slug)
- [ ] Add identity helper functions (createPanelIdentity, panelIdentityToId, panelIdentityToScopeId)

### Phase 2: Map Operations ✅
- [x] Create `createMapOperations(panelId)` factory
- [x] Implement zoomIn / zoomOut with MIN/MAX clamping
- [x] Implement resetView
- [x] Implement setViewport / getViewport helpers
- [x] Test with multiple panel instances (10 tests passing)

### Phase 3: Search Operations ⬜
- [ ] Create `createSearchOperations(panelId)` factory
- [ ] Implement clearSearch
- [ ] Implement executeSearch
- [ ] Implement toggleSearchPanel
- [ ] Test search operations isolation

### Phase 4: Layer Operations ⬜
- [ ] Create `createLayerOperations(panelId)` factory
- [ ] Implement toggleLayerPanel
- [ ] Implement toggleLayer(layerId)
- [ ] Implement showAllLayers / hideAllLayers
- [ ] Implement cycleMapStyle
- [ ] Test layer operations isolation

### Phase 5: Selection Operations ⬜
- [ ] Create `createSelectionOperations(panelId)` factory
- [ ] Implement selectAll / clearSelection
- [ ] Implement invertSelection
- [ ] Implement deleteSelected
- [ ] Test selection operations isolation

### Phase 6: View Operations ⬜
- [ ] Create `createViewOperations(panelId)` factory
- [ ] Implement calculateBounds utility
- [ ] Implement boundsToViewport utility
- [ ] Implement fitToSelection
- [ ] Implement fitToAll
- [ ] Test view operations isolation

### Phase 7: Unified Operations & Composition ⬜
- [ ] Create `createGeointOperations(panelId)` unified factory
- [ ] Merge all operation modules (map + search + layer + selection + view)
- [ ] Export `GeointOperations` type
- [ ] Test unified operations object

### Phase 8: Encapsulated Hotkey Hook ⬜
- [ ] Create `useGeointPanelHotkeys(identity, operations)` hook
- [ ] Implement runtime scope registration (ScopeRegistry.register)
- [ ] Implement focus/blur event handlers
- [ ] Implement scope stack management (push/pop)
- [ ] Return containerRef for element attachment
- [ ] Test focus isolation with multiple panels

### Phase 9: GeointKeyboardProvider Updates ⬜
- [ ] Add `scopeId` prop for per-panel scope
- [ ] Add `activateScope` prop (default: false)
- [ ] Update binding registration to use scopeId
- [ ] Test provider with custom scopeId

### Phase 10: Integration & Testing ⬜
- [ ] Update GeointDashboardPanel to use PanelIdentity
- [ ] Create identity in parent component
- [ ] Pass identity to GeointDashboardPanelContent
- [ ] Wire useGeointPanelHotkeys hook
- [ ] Attach containerRef to motion.div
- [ ] Test keybindings with focus changes
- [ ] Test multi-panel isolation
- [ ] Test modal/palette override
- [ ] Remove ad-hoc keyboard listener

---

## Files to Create/Modify

### New Files

#### 1. `src/lib/geoint/atoms/operations.ts` (NEW)
- Unified `createGeointOperations(panelId)` factory
- Merges all operation modules
- Export `GeointOperations` type

#### 2. `src/lib/geoint/atoms/searchOperations.ts` (NEW - Phase 3)
- `createSearchOperations(panelId)` factory
- clearSearch, executeSearch, toggleSearchPanel

#### 3. `src/lib/geoint/atoms/layerOperations.ts` (NEW - Phase 4)
- `createLayerOperations(panelId)` factory
- toggleLayer, showAllLayers, hideAllLayers, cycleMapStyle

#### 4. `src/lib/geoint/atoms/selectionOperations.ts` (NEW - Phase 5)
- `createSelectionOperations(panelId)` factory
- selectAll, clearSelection, invertSelection, deleteSelected

#### 5. `src/lib/geoint/atoms/viewOperations.ts` (NEW - Phase 6)
- `createViewOperations(panelId)` factory
- fitToSelection, fitToAll
- Utility functions: calculateBounds, boundsToViewport

#### 6. `src/lib/geoint/hooks/useGeointPanelHotkeys.ts` (NEW - Phase 8)
- Encapsulated hotkey hook
- Scope registration, focus/blur management
- Returns containerRef

### Modified Files

#### 1. `src/lib/geoint/atoms/families.ts` (Phase 1)
- Add `PanelIdentity` Schema
- Add `createPanelIdentity(slug)` function
- Add `panelIdentityToId(identity)` function
- Add `panelIdentityToScopeId(identity)` function

#### 2. `src/lib/geoint/atoms/mapOperations.ts` (EXISTS - Phase 2 ✅)
- Already created with zoomIn, zoomOut, resetView
- No changes needed

#### 3. `src/lib/geoint/atoms/index.ts` (Phases 1-7)
- Export all operation factories
- Export `GeointOperations` type
- Export PanelIdentity helpers

#### 4. `src/lib/geoint/components/GeointKeyboardProvider.tsx` (Phase 9)
- Add `scopeId?: string` prop
- Add `activateScope?: boolean` prop (default: false)
- Update binding registration to use custom scopeId

#### 5. `src/lib/geoint/components/GeointDashboardPanel.tsx` (Phase 10)
- Accept `identity: PanelIdentity` prop instead of `panelId: string`
- Create unified operations with `createGeointOperations()`
- Wire `useGeointPanelHotkeys()` hook
- Attach containerRef to motion.div with tabIndex={-1}
- Remove ad-hoc keyboard listener

#### 6. `src/lib/geoint/hooks/index.ts` (NEW or EXISTING)
- Export `useGeointPanelHotkeys`

---

## Testing Strategy

### Unit Tests
```typescript
describe('Panel-scoped actions', () => {
  it('zoomIn increments zoom for specific panel', () => {
    const registry = Registry.make()
    const panel1 = 'panel-1'
    const panel2 = 'panel-2'

    const actions1 = createGeointActions(panel1, registry)
    const actions2 = createGeointActions(panel2, registry)

    actions1.zoomIn()

    expect(registry.get(viewportFamily(panel1)).zoom).toBe(DEFAULT_ZOOM + 1)
    expect(registry.get(viewportFamily(panel2)).zoom).toBe(DEFAULT_ZOOM)
  })
})
```

### Integration Tests
- Verify keybindings trigger actions
- Verify multi-panel isolation
- Verify DeckGL reacts to viewport changes
- Verify search panel responds to toggle

---

## Success Criteria

- [ ] All 19 actions implemented
- [ ] All keybindings functional
- [ ] Multiple panel instances isolated
- [ ] No ad-hoc keyboard listeners
- [ ] KeyboardShortcutsOverlay integrated with hotkeys system
- [ ] All tests passing
