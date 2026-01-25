# GEOINT XState-Atom Architecture (stx Pattern)

**Document Type**: Architecture Design
**Status**: Draft
**Beads**: tmnl-8w3ig, tmnl-v0m8w
**Date**: 2026-01-10

---

## Problem Statement

Current GEOINT architecture has **state fragmentation**:

1. **XState machines** (16) manage transitions but don't sync with atoms
2. **Atoms** (layoutAtoms.ts, index.ts) hold UI state independently
3. **useState** (66 calls) creates local state islands
4. **No bidirectional binding** between XState and atoms

Result: State can diverge, components subscribe to wrong source of truth.

---

## The stx Pattern

**stx** = **S**tate machine + a**T**oms + **X**State

### Core Principle

> **XState is the orchestrator. Atoms are the reactive surface. They must be synchronized.**

```
┌─────────────────────────────────────────────────────────────┐
│                      stx Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────┐         ┌──────────────┐                 │
│   │   XState     │ ──────► │    Atoms     │ ◄──── React     │
│   │   Machine    │         │  (reactive)  │       useAtom   │
│   └──────────────┘         └──────────────┘                 │
│         │                         │                          │
│         │  sync on               │  registry.set()          │
│         │  state change          │  triggers machine        │
│         ▼                        ▼                          │
│   ┌──────────────────────────────────────────┐              │
│   │         Bidirectional Sync Layer          │              │
│   │  - Machine actions update atoms           │              │
│   │  - Atom subscriptions send machine events │              │
│   └──────────────────────────────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Strategy

### 1. Machine-to-Atom Sync (Machine → Atoms)

XState actions update atoms when state changes:

```typescript
// In layoutMachine setup()
actions: {
  syncLayoutAtom: ({ context }) => {
    geointRegistry.set(layoutModeAtom, context.currentLayout)
    geointRegistry.set(animationStateAtom, {
      phase: context.animationPhase,
      isAnimating: context.isAnimating,
    })
  },

  syncPanelAtoms: ({ context }) => {
    geointRegistry.set(sidebarStateAtom, context.panels.sidebar)
    geointRegistry.set(intelPanelStateAtom, context.panels.intel)
    geointRegistry.set(timelinePanelStateAtom, context.panels.timeline)
  },

  syncFloatingPanels: ({ context }) => {
    // Update each floating panel atom
    Object.entries(context.floatingPanels).forEach(([id, config]) => {
      geointRegistry.set(floatingPanelFamily(id), config)
    })
  },
}
```

Add to state entry/exit:

```typescript
states: {
  command: {
    entry: ['persistCurrentLayout', 'syncLayoutAtom', 'syncPanelAtoms'],
    // ...
  },
}
```

### 2. Atom-to-Machine Sync (Atoms → Machine)

Subscribe to atoms and dispatch machine events:

```typescript
// In a useEffect or Effect service
function createAtomMachineSync(
  registry: Registry,
  actorRef: LayoutMachineRef
) {
  // Subscribe to layout atom changes from external sources
  return registry.subscribe(layoutModeAtom, (newLayout) => {
    const currentMachineLayout = actorRef.getSnapshot().context.currentLayout
    if (newLayout !== currentMachineLayout) {
      actorRef.send({ type: 'SET_LAYOUT', layout: newLayout })
    }
  })
}
```

### 3. Derived Atoms from Machine State

Create atoms that derive from machine snapshots:

```typescript
import { Atom } from '@effect-atom/atom'

// Machine snapshot atom (updated by subscription)
export const layoutMachineSnapshotAtom = Atom.make<LayoutMachineSnapshot | null>(null)

// Derived atoms
export const currentLayoutAtom = Atom.make(() =>
  layoutMachineSnapshotAtom.pipe(
    Atom.map(snapshot => snapshot?.context.currentLayout ?? 'command')
  )
)

export const isAnimatingAtom = Atom.make(() =>
  layoutMachineSnapshotAtom.pipe(
    Atom.map(snapshot => snapshot?.context.isAnimating ?? false)
  )
)
```

---

## Atom.family for Floating Panels

Replace static `Record<FloatingPanelId, config>` with Atom.family:

```typescript
import { Atom } from '@effect-atom/atom'

// Per-panel atom family
export const floatingPanelFamily = Atom.family<FloatingPanelId, FloatingPanelConfig>({
  default: (id) => ({
    id,
    visible: false,
    minimized: false,
    position: { x: 100, y: 100 },
    size: { width: 300, height: 200 },
    zIndex: 1,
  }),
})

// Usage in component
function FloatingPanel({ id }: { id: FloatingPanelId }) {
  const config = useAtomValue(floatingPanelFamily(id))

  const handleMove = (position: FloatingPanelPosition) => {
    geointRegistry.set(floatingPanelFamily(id), { ...config, position })
    // Or send to machine:
    // send({ type: 'MOVE_PANEL', id, position })
  }
}
```

---

## GEOINT-Specific Hooks

### useGeointLayout

```typescript
export function useGeointLayout() {
  const layout = useAtomValue(layoutModeAtom)
  const isAnimating = useAtomValue(isAnimatingAtom)
  const send = useLayoutMachineSend() // from provider

  return {
    layout,
    isAnimating,
    setLayout: (mode: LayoutMode) => send({ type: 'SET_LAYOUT', layout: mode }),
    cycleLayout: () => send({ type: 'TOGGLE_LAYOUT' }),
  }
}
```

### useGeointPanel

```typescript
export function useGeointPanel(panel: 'sidebar' | 'intel' | 'timeline') {
  const atomMap = {
    sidebar: sidebarStateAtom,
    intel: intelPanelStateAtom,
    timeline: timelinePanelStateAtom,
  }

  const state = useAtomValue(atomMap[panel])
  const send = useLayoutMachineSend()

  return {
    collapsed: state.collapsed,
    toggle: () => send({ type: `TOGGLE_${panel.toUpperCase()}` }),
    expand: () => send({ type: `EXPAND_${panel.toUpperCase()}` }),
    collapse: () => send({ type: `COLLAPSE_${panel.toUpperCase()}` }),
    // Panel-specific props
    ...(panel === 'sidebar' && { section: state.section }),
    ...(panel === 'intel' && { tab: state.tab }),
    ...(panel === 'timeline' && { range: state.range }),
  }
}
```

### useGeointFloatingPanel

```typescript
export function useGeointFloatingPanel(id: FloatingPanelId) {
  const config = useAtomValue(floatingPanelFamily(id))
  const send = useLayoutMachineSend()

  return {
    ...config,
    move: (position: FloatingPanelPosition) =>
      send({ type: 'MOVE_PANEL', id, position }),
    resize: (size: Partial<FloatingPanelSize>) =>
      send({ type: 'RESIZE_PANEL', id, size }),
    toggleVisibility: () =>
      send({ type: 'TOGGLE_PANEL_VISIBILITY', id }),
    toggleMinimize: () =>
      send({ type: 'TOGGLE_PANEL_MINIMIZE', id }),
    bringToFront: () =>
      send({ type: 'BRING_PANEL_TO_FRONT', id }),
  }
}
```

### useGeointSearch

```typescript
export function useGeointSearch() {
  const status = useAtomValue(searchStatusAtom)
  const results = useAtomValue(filteredResultsAtom)
  const filters = useAtomValue(activeFiltersAtom)
  const error = useAtomValue(searchErrorAtom)

  return {
    status,
    results,
    filters,
    error,
    isSearching: status === 'searching' || status === 'validating',
    updateFilters,  // from atoms/index.ts
    clearResults,   // from atoms/index.ts
    // Could also wire to searchMachine
  }
}
```

### useGeointEntity

```typescript
// Per-entity state with Atom.family
export const entityStateFamily = Atom.family<string, EntityUIState>({
  default: () => ({
    selected: false,
    hovered: false,
    expanded: false,
    highlighted: false,
  }),
})

export function useGeointEntity(entityId: string) {
  const state = useAtomValue(entityStateFamily(entityId))

  return {
    ...state,
    select: () => geointRegistry.set(entityStateFamily(entityId), { ...state, selected: true }),
    deselect: () => geointRegistry.set(entityStateFamily(entityId), { ...state, selected: false }),
    toggleExpanded: () => geointRegistry.set(entityStateFamily(entityId), { ...state, expanded: !state.expanded }),
    setHovered: (hovered: boolean) => geointRegistry.set(entityStateFamily(entityId), { ...state, hovered }),
  }
}
```

---

## Migration Path

### Phase 1: Create Sync Infrastructure
1. Add sync actions to layoutMachine
2. Create machine snapshot atom
3. Implement bidirectional subscription

### Phase 2: Implement Atom.family
1. floatingPanelFamily for floating panels
2. entityStateFamily for per-entity state
3. resultStateFamily for per-result UI state

### Phase 3: Create Hooks
1. useGeointLayout
2. useGeointPanel
3. useGeointFloatingPanel
4. useGeointSearch
5. useGeointEntity

### Phase 4: Migrate Components
1. Replace useState with hooks
2. Remove direct atom access where hooks exist
3. Ensure all state flows through stx pattern

---

## Testing Strategy

```typescript
import { it } from '@effect/vitest'
import { Registry } from '@effect-atom/atom'

describe('stx pattern', () => {
  it('machine state syncs to atoms', () => {
    const registry = Registry.make()
    const actor = createActor(layoutMachine)
    actor.start()

    actor.send({ type: 'SET_LAYOUT', layout: 'focus' })

    // Atom should reflect machine state
    expect(registry.get(layoutModeAtom)).toBe('focus')
  })

  it('atom changes trigger machine events', () => {
    const registry = Registry.make()
    const actor = createActor(layoutMachine)
    actor.start()

    // External atom update
    registry.set(layoutModeAtom, 'analytics')

    // Machine should transition
    expect(actor.getSnapshot().value).toBe('analytics')
  })
})
```

---

## References

- `/xstate-integration` skill
- `/effect-atom-integration` skill
- `src/lib/geoint/machines/layoutMachine.ts`
- `src/lib/geoint/atoms/layoutAtoms.ts`
