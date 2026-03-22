# Implementation Plan: GEOINT Atom Family Refactoring (Phase 1)

Generated: 2026-01-20
Status: Ready for Implementation

---

## Goal

Refactor GEOINT atoms from global singletons to panel-scoped instances using `Atom.family` pattern, enabling multiple GeointDashboardPanel instances to maintain independent state while preserving backward compatibility during the transition period.

---

## Research Summary

### Atom.family Pattern (effect-atom)

From `/submodules/effect-atom/packages/atom/src/Atom.ts:1324-1359`:

```typescript
// Atom.family creates memoized atom instances per key
// Uses WeakRef + FinalizationRegistry for automatic cleanup
export const family = <Arg, T extends object>(
  f: (arg: Arg) => T
): (arg: Arg) => T => {
  const atoms = MutableHashMap.empty<Arg, WeakRef<T>>()
  const registry = new FinalizationRegistry<Arg>((arg) => {
    MutableHashMap.remove(atoms, arg)
  })
  return function(arg) {
    const atomEntry = MutableHashMap.get(atoms, arg).pipe(
      Option.flatMapNullable((ref) => ref.deref())
    )
    if (atomEntry._tag === "Some") return atomEntry.value
    const newAtom = f(arg)
    MutableHashMap.set(atoms, arg, new WeakRef(newAtom))
    registry.register(newAtom, arg)
    return newAtom
  }
}
```

**Key Insight**: `Atom.family` returns a function that, given a key, returns a memoized atom. Same key = same atom instance.

### Existing Patterns in Codebase

1. **InteractiveChartPanel** (`/src/lib/charts/interactive-panel/`):
   - Uses `getPanelAtoms(panelId)` factory pattern
   - Passes `panelId` via React Context
   - Disposes atoms on unmount via `disposePanelAtoms(panelId)`

2. **Fermion** (`/src/lib/fermion/`):
   - Schema-driven `Atom.family` with `Result<A, E>` wrapper
   - Lifecycle config: `keepAlive`, `ttl`
   - Builder pattern for fluent API

3. **GEOINT Layout Atoms** (`/src/lib/geoint/atoms/layoutAtoms.ts`):
   - Currently global singletons
   - Uses `geointRegistry.get()` / `geointRegistry.set()` for mutations
   - Actions defined as module-level functions

---

## Existing Codebase Analysis

### Current Atom Structure (`src/lib/geoint/atoms/index.ts`)

| Atom | Type | Scope | Migration Priority |
|------|------|-------|-------------------|
| `viewportAtom` | `Viewport` | Map state | High |
| `searchQueryAtom` | `string` | Search input | High |
| `searchResultsAtom` | `SearchResult[]` | Query results | High |
| `selectedEntitiesAtom` | `EntityId[]` | Selection | High |
| `visibleLayersAtom` | `LayerId[]` | Layer visibility | Medium |
| `mapStyleAtom` | `MapStyle` | Style selection | Medium |
| `searchPanelVisibleAtom` | `boolean` | UI state | Low |
| `layerPanelVisibleAtom` | `boolean` | UI state | Low |

### Entry Point: GeointDashboardPanel

The `GeointDashboardPanel` component is the natural boundary for panel scoping. Each instance needs:
1. A unique `panelId` prop
2. A React Context provider to pass `panelId` down the tree
3. Access to panel-scoped atoms via the context

### Consumer Components (partial list from grep)

- `GeointMap.tsx` - viewport, selected entities
- `SearchPanelCompound.tsx` - search query, results, panel visibility
- `EntityPanel.tsx` - selected entities
- `hooks/useViewportSearch.ts` - viewport, search

---

## Implementation Phases

### Phase 1.1: Create Atom Families Module

**Files to create:**
- `src/lib/geoint/atoms/families.ts` - Atom family definitions

**Pattern:**

```typescript
// src/lib/geoint/atoms/families.ts
import { Atom } from '@effect-atom/atom'
import { Schema } from 'effect'
import type { Viewport, SearchResult, MapStyle } from '../schemas'

// =============================================================================
// PANEL ID TYPE
// =============================================================================

export const PanelId = Schema.String.pipe(Schema.brand('GeointPanelId'))
export type PanelId = typeof PanelId.Type

export function asPanelId(value: string): PanelId {
  return value as PanelId
}

// =============================================================================
// ATOM FAMILIES
// =============================================================================

/**
 * Viewport state per panel.
 * Controls map center, zoom, bearing, pitch.
 */
export const viewportFamily = Atom.family((panelId: PanelId) =>
  Atom.make<Viewport>({
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
  })
)

/**
 * Search query string per panel.
 */
export const searchQueryFamily = Atom.family((panelId: PanelId) =>
  Atom.make<string>('')
)

/**
 * Search results per panel.
 */
export const searchResultsFamily = Atom.family((panelId: PanelId) =>
  Atom.make<SearchResult[]>([])
)

/**
 * Selected entity IDs per panel.
 */
export const selectedEntitiesFamily = Atom.family((panelId: PanelId) =>
  Atom.make<string[]>([])
)

/**
 * Visible layer IDs per panel.
 */
export const visibleLayersFamily = Atom.family((panelId: PanelId) =>
  Atom.make<string[]>(['base', 'entities'])
)

/**
 * Map style per panel.
 */
export const mapStyleFamily = Atom.family((panelId: PanelId) =>
  Atom.make<MapStyle>('dark')
)

/**
 * Search panel visibility per panel.
 */
export const searchPanelVisibleFamily = Atom.family((panelId: PanelId) =>
  Atom.make<boolean>(true)
)

/**
 * Layer panel visibility per panel.
 */
export const layerPanelVisibleFamily = Atom.family((panelId: PanelId) =>
  Atom.make<boolean>(false)
)

// =============================================================================
// AGGREGATE ACCESSOR
// =============================================================================

export interface GeointPanelAtoms {
  readonly viewportAtom: ReturnType<typeof viewportFamily>
  readonly searchQueryAtom: ReturnType<typeof searchQueryFamily>
  readonly searchResultsAtom: ReturnType<typeof searchResultsFamily>
  readonly selectedEntitiesAtom: ReturnType<typeof selectedEntitiesFamily>
  readonly visibleLayersAtom: ReturnType<typeof visibleLayersFamily>
  readonly mapStyleAtom: ReturnType<typeof mapStyleFamily>
  readonly searchPanelVisibleAtom: ReturnType<typeof searchPanelVisibleFamily>
  readonly layerPanelVisibleAtom: ReturnType<typeof layerPanelVisibleFamily>
}

/**
 * Get all panel atoms for a given panelId.
 * Returns memoized atoms - same panelId always returns same instances.
 */
export function getPanelAtoms(panelId: PanelId): GeointPanelAtoms {
  return {
    viewportAtom: viewportFamily(panelId),
    searchQueryAtom: searchQueryFamily(panelId),
    searchResultsAtom: searchResultsFamily(panelId),
    selectedEntitiesAtom: selectedEntitiesFamily(panelId),
    visibleLayersAtom: visibleLayersFamily(panelId),
    mapStyleAtom: mapStyleFamily(panelId),
    searchPanelVisibleAtom: searchPanelVisibleFamily(panelId),
    layerPanelVisibleAtom: layerPanelVisibleFamily(panelId),
  }
}
```

**Acceptance criteria:**
- [ ] All 8 atom families defined
- [ ] `getPanelAtoms(panelId)` returns aggregate object
- [ ] TypeScript compiles without errors
- [ ] Export from `atoms/index.ts`

---

### Phase 1.2: Create Panel Context Provider

**Files to create:**
- `src/lib/geoint/context/PanelContext.tsx` - React Context for panel scoping

**Pattern:**

```typescript
// src/lib/geoint/context/PanelContext.tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  type PanelId,
  type GeointPanelAtoms,
  asPanelId,
  getPanelAtoms,
} from '../atoms/families'

// =============================================================================
// CONTEXT TYPE
// =============================================================================

export interface GeointPanelContextValue {
  /** Panel identifier */
  readonly panelId: PanelId
  /** Panel-scoped atoms */
  readonly atoms: GeointPanelAtoms
}

// =============================================================================
// CONTEXT
// =============================================================================

const GeointPanelContext = createContext<GeointPanelContextValue | null>(null)

// =============================================================================
// PROVIDER
// =============================================================================

export interface GeointPanelProviderProps {
  /** Unique panel identifier */
  panelId: string
  /** Children components */
  children: ReactNode
}

/**
 * Provider for panel-scoped GEOINT atoms.
 *
 * Wrap each GeointDashboardPanel instance with this provider
 * to enable panel-isolated state.
 *
 * @example
 * ```tsx
 * <GeointPanelProvider panelId="panel-1">
 *   <GeointMap />
 *   <SearchPanel />
 * </GeointPanelProvider>
 * ```
 */
export function GeointPanelProvider({
  panelId: rawPanelId,
  children,
}: GeointPanelProviderProps) {
  const panelId = useMemo(() => asPanelId(rawPanelId), [rawPanelId])
  const atoms = useMemo(() => getPanelAtoms(panelId), [panelId])

  const value = useMemo<GeointPanelContextValue>(
    () => ({ panelId, atoms }),
    [panelId, atoms]
  )

  return (
    <GeointPanelContext.Provider value={value}>
      {children}
    </GeointPanelContext.Provider>
  )
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Access panel context. Throws if not within provider.
 */
export function useGeointPanel(): GeointPanelContextValue {
  const ctx = useContext(GeointPanelContext)
  if (!ctx) {
    throw new Error('useGeointPanel must be used within GeointPanelProvider')
  }
  return ctx
}

/**
 * Access panel context safely. Returns null if not within provider.
 */
export function useGeointPanelSafe(): GeointPanelContextValue | null {
  return useContext(GeointPanelContext)
}

/**
 * Get panel ID from context.
 */
export function usePanelId(): PanelId {
  return useGeointPanel().panelId
}

/**
 * Get panel atoms from context.
 */
export function usePanelAtoms(): GeointPanelAtoms {
  return useGeointPanel().atoms
}
```

**Acceptance criteria:**
- [ ] `GeointPanelProvider` accepts `panelId` prop
- [ ] `useGeointPanel()` hook returns context or throws
- [ ] `useGeointPanelSafe()` returns context or null
- [ ] Convenience hooks: `usePanelId()`, `usePanelAtoms()`

---

### Phase 1.3: Create Backward-Compatible Bridge

**Files to modify:**
- `src/lib/geoint/atoms/index.ts` - Add backward compatibility layer

**Strategy:** Keep global atoms as aliases to a "default" panel instance during migration.

```typescript
// src/lib/geoint/atoms/index.ts (additions)

import {
  type PanelId,
  asPanelId,
  viewportFamily,
  searchQueryFamily,
  // ... other families
} from './families'

// =============================================================================
// BACKWARD COMPATIBILITY LAYER
// =============================================================================

/**
 * Default panel ID for backward compatibility.
 * Used by legacy code that doesn't use panel context.
 */
export const DEFAULT_PANEL_ID: PanelId = asPanelId('__default__')

/**
 * @deprecated Use panel-scoped atoms via useGeointPanel() instead.
 * Global viewport atom - maps to default panel.
 */
export const viewportAtom = viewportFamily(DEFAULT_PANEL_ID)

/**
 * @deprecated Use panel-scoped atoms via useGeointPanel() instead.
 */
export const searchQueryAtom = searchQueryFamily(DEFAULT_PANEL_ID)

// ... repeat for all 8 atoms with @deprecated JSDoc

// Re-export families and context
export * from './families'
```

**Acceptance criteria:**
- [ ] All existing imports continue to work
- [ ] Global atoms are JSDoc-deprecated
- [ ] TypeScript shows deprecation warnings on hover
- [ ] No runtime behavior changes for existing code

---

### Phase 1.4: Integrate Provider into GeointDashboardPanel

**Files to modify:**
- `src/lib/geoint/components/GeointDashboardPanel.tsx`

**Pattern:**

```typescript
// GeointDashboardPanel.tsx
import { GeointPanelProvider } from '../context/PanelContext'

export interface GeointDashboardPanelProps {
  /** Unique panel identifier for multi-panel support */
  panelId?: string
  // ... existing props
}

export const GeointDashboardPanel: FC<GeointDashboardPanelProps> = ({
  panelId = 'default',
  children,
  ...props
}) => {
  return (
    <GeointPanelProvider panelId={panelId}>
      {/* existing content */}
    </GeointPanelProvider>
  )
}
```

**Acceptance criteria:**
- [ ] `panelId` prop added with default value
- [ ] Provider wraps panel content
- [ ] Existing usage without `panelId` continues to work

---

### Phase 1.5: Migrate Priority Components

**Files to modify (one at a time):**

1. `src/lib/geoint/components/GeointMap.tsx`
2. `src/lib/geoint/components/SearchPanelCompound.tsx`
3. `src/lib/geoint/hooks/useViewportSearch.ts`

**Migration Pattern:**

```typescript
// Before
import { viewportAtom, selectedEntitiesAtom } from '../atoms'
import { useAtomValue, useSetAtom } from '@effect-atom/react'

function GeointMap() {
  const viewport = useAtomValue(viewportAtom)
  const setViewport = useSetAtom(viewportAtom)
  // ...
}

// After
import { useGeointPanelSafe } from '../context/PanelContext'
import { viewportAtom as globalViewportAtom } from '../atoms' // fallback
import { useAtomValue, useSetAtom } from '@effect-atom/react'

function GeointMap() {
  // Panel-scoped with fallback to global
  const panelContext = useGeointPanelSafe()
  const viewport = useAtomValue(
    panelContext?.atoms.viewportAtom ?? globalViewportAtom
  )
  const setViewport = useSetAtom(
    panelContext?.atoms.viewportAtom ?? globalViewportAtom
  )
  // ...
}
```

**Acceptance criteria:**
- [ ] Components use panel-scoped atoms when available
- [ ] Fall back to global atoms when outside provider
- [ ] No visual/behavioral regressions
- [ ] Testbed shows isolated state per panel

---

### Phase 1.6: Create Test Harness

**Files to create:**
- `src/lib/geoint/__tests__/atom-families.test.ts`

**Test Cases:**

```typescript
import { describe, it, expect } from 'vitest'
import { Registry } from '@effect-atom/atom'
import {
  asPanelId,
  viewportFamily,
  searchQueryFamily,
  getPanelAtoms,
} from '../atoms/families'

describe('GEOINT Atom Families', () => {
  it('returns same atom instance for same panelId', () => {
    const panelA = asPanelId('panel-a')
    const atom1 = viewportFamily(panelA)
    const atom2 = viewportFamily(panelA)
    expect(atom1).toBe(atom2) // Same reference
  })

  it('returns different atom instances for different panelIds', () => {
    const panelA = asPanelId('panel-a')
    const panelB = asPanelId('panel-b')
    const atomA = viewportFamily(panelA)
    const atomB = viewportFamily(panelB)
    expect(atomA).not.toBe(atomB) // Different references
  })

  it('maintains isolated state between panels', () => {
    const registry = Registry.make()
    const panelA = asPanelId('panel-a')
    const panelB = asPanelId('panel-b')

    const atomA = searchQueryFamily(panelA)
    const atomB = searchQueryFamily(panelB)

    registry.set(atomA, 'search A')
    registry.set(atomB, 'search B')

    expect(registry.get(atomA)).toBe('search A')
    expect(registry.get(atomB)).toBe('search B')
  })

  it('getPanelAtoms returns consistent bundle', () => {
    const panelId = asPanelId('panel-x')
    const atoms1 = getPanelAtoms(panelId)
    const atoms2 = getPanelAtoms(panelId)

    expect(atoms1.viewportAtom).toBe(atoms2.viewportAtom)
    expect(atoms1.searchQueryAtom).toBe(atoms2.searchQueryAtom)
  })
})
```

**Acceptance criteria:**
- [ ] Tests pass in CI
- [ ] Coverage for memoization behavior
- [ ] Coverage for isolation between panels

---

## Testing Strategy

### Unit Tests

| Test | Location | Purpose |
|------|----------|---------|
| Atom family memoization | `atoms/families.test.ts` | Verify same key = same atom |
| State isolation | `atoms/families.test.ts` | Different keys = isolated state |
| Context hooks | `context/PanelContext.test.tsx` | Hook behavior inside/outside provider |

### Integration Tests

| Test | Location | Purpose |
|------|----------|---------|
| Multi-panel rendering | `components/GeointDashboardPanel.test.tsx` | Two panels with different state |
| Viewport sync | `hooks/useViewportSearch.test.ts` | Search respects panel viewport |

### Manual Testing (Testbed)

1. Mount two `GeointDashboardPanel` instances side by side
2. Search in Panel A, verify results don't appear in Panel B
3. Select entities in Panel B, verify selection not reflected in Panel A
4. Pan/zoom in Panel A, verify viewport independent of Panel B

---

## Migration Strategy

### Coexistence Period

```
Week 1-2: Phase 1.1-1.4
  - Atom families exist alongside global atoms
  - Global atoms point to DEFAULT_PANEL_ID
  - No changes to existing component behavior

Week 3-4: Phase 1.5
  - Migrate components one at a time
  - Each migration is a separate PR
  - Run full test suite after each migration

Week 5+: Cleanup
  - Remove @deprecated global atom exports
  - Remove fallback logic from components
  - Update documentation
```

### Rollback Strategy

If issues arise:
1. Revert component migrations (they're isolated PRs)
2. Global atoms continue to work via DEFAULT_PANEL_ID
3. No need to revert atom family infrastructure

---

## File Structure Summary

```
src/lib/geoint/
├── atoms/
│   ├── index.ts              # Re-exports + backward compat layer
│   ├── families.ts           # NEW: Atom family definitions
│   ├── layoutAtoms.ts        # Unchanged (global layout state)
│   └── __tests__/
│       └── families.test.ts  # NEW: Unit tests
├── context/
│   ├── index.ts              # NEW: Barrel export
│   └── PanelContext.tsx      # NEW: Provider + hooks
├── components/
│   ├── GeointDashboardPanel.tsx  # MODIFIED: Add provider wrapper
│   ├── GeointMap.tsx             # MODIFIED: Use panel atoms
│   └── SearchPanelCompound.tsx   # MODIFIED: Use panel atoms
└── hooks/
    └── useViewportSearch.ts      # MODIFIED: Use panel atoms
```

---

## Risks & Considerations

### Risk 1: WeakRef Garbage Collection

**Issue**: Atoms may be garbage collected if no strong references exist.

**Mitigation**:
- Use `Atom.keepAlive` for atoms that need persistence
- The family memoization uses WeakRef, but the atoms themselves are strongly referenced by React component subscriptions

### Risk 2: Context Provider Nesting

**Issue**: Nested providers could cause confusion about which panel context is active.

**Mitigation**:
- Document that `GeointPanelProvider` should only wrap top-level panel components
- Add runtime warning if nested providers detected (dev mode only)

### Risk 3: Performance with Many Panels

**Issue**: Many panel instances could create memory pressure.

**Mitigation**:
- Atom.family uses WeakRef for automatic cleanup
- Monitor memory in profiler during testbed multi-panel scenarios

---

## Estimated Complexity

| Phase | Effort | Risk |
|-------|--------|------|
| 1.1 Atom Families | Low | Low |
| 1.2 Context Provider | Low | Low |
| 1.3 Backward Compat | Low | Medium |
| 1.4 Panel Integration | Low | Low |
| 1.5 Component Migration | Medium | Medium |
| 1.6 Test Harness | Low | Low |

**Total Estimate**: 3-4 days for initial implementation, 1-2 weeks for full migration.

---

## Dependencies

- `@effect-atom/atom` - Atom.family, Registry
- `@effect-atom/react` - useAtomValue, useSetAtom
- `effect` - Schema (for PanelId branding)

---

## Next Steps After Phase 1

1. **Phase 2**: Implement panel-scoped operations (`searchOp`, `selectEntitiesOp`, etc.)
2. **Phase 3**: Add inter-panel communication via EventLog
3. **Phase 4**: Persistence layer for panel state

---

## References

| Resource | Path |
|----------|------|
| GEOINT Actions Spec | `src/lib/geoint/GEOINT_ACTIONS_SPEC.md` |
| Current Atoms | `src/lib/geoint/atoms/index.ts` |
| Fermion Pattern | `src/lib/fermion/` |
| Chart Panel Context | `src/lib/charts/interactive-panel/context/` |
| Effect-Atom Source | `submodules/effect-atom/packages/atom/src/Atom.ts` |
