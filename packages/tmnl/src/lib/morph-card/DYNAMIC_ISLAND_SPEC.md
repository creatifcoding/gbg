/**
 * MorphCard Dynamic Island Augmentation Spec
 *
 * Goal: Bring full Dynamic Island behavior parity into MorphCard.
 * Scope: State machine, reticles, complex transitions, drag/resize, persistence, tab-driven sizeKey.
 */

# MorphCard Dynamic Island Augmentation Spec

## Goals
- MorphCard gains Dynamic Island behavior parity (state machine, reticle, drag/resize, sizeKey).
- Transitions are dynamic and computed by an XState machine.
- Tab views can drive sizeKey and transition grammar (compound component pattern).
- Deprecate and remove legacy `initialMode` + `sizes` props in favor of state machine config.
- Reticles render inside the card and appear only for complex transitions.

## Non-Goals
- Avoid Cursor DynamicIsland UI replacement; we are extending MorphCard, not replacing Cursor.
- Do not introduce new "wrapper" component; extend MorphCard API directly.

## Glossary
- **sizeKey**: Named size slot (e.g., idle, minimal, compact, default, expanded, ultra).
- **Transition Grammar**: The "verb:modifier:direction" spec driving motion variants.
- **Complex Transition**: Transition requiring reticle + loading cadence (per machine).
- **Base Position**: Original position for a card used to revert after drag.
- **Relative Position**: Offset from base position from drag/resize.

## Architecture Overview

```
DynamicIslandMachine (XState)
  |
  |-- sizeKey
  |-- transition grammar
  |-- reticle variant + visibility
  |-- drag/resize state + constraints
  |
MorphCard (UI)
  |
  |-- Motion: position, size, blur, reticle overlay
  |-- TabBar + View mapping -> machine events
  |-- Persistence layer (per card)
```

## Reference Implementations (Current Code)
- Cursor DynamicIsland behavior: `src/lib/cursor/components/DynamicIsland.tsx`
- MorphCard base: `src/lib/morph-card/components/MorphCard.tsx`
- DynamicIslandCard tabs: `src/lib/morph-card/components/DynamicIslandCard.tsx`
- Tab atoms + persistence: `src/lib/morph-card/atoms/tab-atoms.ts`
- Effect services (server + streams): `src/lib/morph-card/hooks/useCardServer.ts`, `src/lib/morph-card/hooks/useDurableStreamPatches.ts`
- Legend-State renderer: `src/lib/json-render/react/legend-renderer.tsx`
- XState patterns: `src/lib/drag/machines/drag-machine.ts`, `src/lib/geoint/machines/*`

## State Machine (XState)

### Context (Effect Schema, not raw types)
- `cardId: CardId`
- `sizeKey: SizeKey`
- `previousSizeKey: SizeKey`
- `position: { x: number; y: number }` (relative)
- `basePosition: { x: number; y: number }` (static)
- `reticle: ReticleVariant`
- `reticleVisible: boolean`
- `activeTransition: TransitionGrammar`
- `isComplexTransition: boolean`
- `dragging: boolean`
- `resizing: boolean`
- `constraints?: { left?: number; right?: number; top?: number; bottom?: number }`

### States
- `idle`
- `reticleActive`
- `morphing`
- `dragging`
- `resizing`

### Events
- `TRANSITION { sizeKey, grammar?, reticle?, complexity? }`
- `SET_RETICLE { variant }`
- `SET_POSITION { x, y }`
- `SET_BASE_POSITION { x, y }`
- `RESET_POSITION`
- `DRAG_START`, `DRAG_END`
- `RESIZE_START`, `RESIZE_END`

### Behavioral Rules
- `TRANSITION`:
  - sets `previousSizeKey -> sizeKey`
  - computes `activeTransition` via dynamic generator
  - sets `isComplexTransition`
  - if complex: `reticleActive -> morphing -> idle` cadence
  - if simple: jump to `morphing` and reticle remains hidden
- `RESET_POSITION`: set `position` to `{0,0}` relative to base

### Complexity Heuristic (machine-driven)
- Default: complex if size delta exceeds threshold OR grammar verb in {glitch, teleport, cinematic}.
- Allow explicit override in event payload.

## Transition Grammar Generation
- Provide a machine hook:
  - `(context, event) => TransitionGrammar`
- Accept both string and object input but normalize into schema.
- Dynamic grammar is stored in context, not just computed at render time.

## Reticle Rendering
- Reticle is an overlay inside MorphCard.
- Visible only when `isComplexTransition` is true.
- Variant can be overridden per transition event or per tab.
- Reticle is timed by state machine (`reticleActive` duration).

## Drag/Resize Behavior
- Always enabled but **shift‑drag only**.
- Drag updates `position` (relative); base position remains stable.
- Resize changes size constraints and may adjust relative position.
- Support revert to base position via `RESET_POSITION`.
- Constraints applied via the same physics model as Cursor (elastic backpressure).

## Tab Integration (DynamicIslandCard.View)
- Each view can specify:
  - `sizeKey`
  - `transition` (grammar) **string or object**
  - `reticle`
  - `complexity` (bool)
- When a view becomes active, it dispatches `TRANSITION`.
- TabBar remains a UI wrapper; state machine controls size and transitions.

## State Storage (Effect Service + Atom Hierarchy + Optional AtomRpc)

- Use a **separate, nested atom.family hierarchy** for island state (not tab atoms).
- The XState machine must **read/write** this hierarchy via effect-atom registry.
- State is managed by an **Effect service** (first-class).
- **AtomRpc is optional**: only used when a sync boundary exists (agent/server).
- Proposed shape:
  - `islandCardStateFamily(cardId)`
    - `positionAtom`
    - `basePositionAtom`
    - `sizeKeyAtom`
    - `transitionAtom`
    - `reticleAtom`
    - `complexityAtom`
    - `dragStateAtom`
  - `tabStateFamily(cardId)` remains separate.

## API Changes (Breaking)
- Remove `initialMode` and `sizes` from MorphCard props.
- Replace with:
  - `initialSizeKey`
  - `stateMachineConfig` (size map, physics, reticle defaults)
  - `transitionStrategy` (dynamic grammar generator) **required**
    - returns `Effect` and can emit intermediate transitions (progressive grammar)

## Persistence
- Per card, persisted in localStorage:
  - active tab
  - sizeKey
  - basePosition
  - relative position
  - viewState map
- Persistence is **debounced** and flows through a card state cache used for undo/redo.

## Rendering Flow (Sequence)
1) Tab view becomes active -> `TRANSITION` event.
2) Machine computes grammar, decides complexity.
3) If complex:
   - reticleActive state sets overlay visible
   - morphing triggers size/blur transition
4) UI renders new size + motion and toggles overlay accordingly.

## Concrete Examples

### 1) Card with XState-driven transitions + tab overrides

```tsx
<DynamicIslandCard
  cardId="system-status"
  initialSizeKey="minimal"
  stateMachineConfig={{
    sizes: {
      minimal: { width: 120, height: 36 },
      compact: { width: 220, height: 56 },
      expanded: { width: 420, height: 220 },
    },
    reticle: "corners",
    reticleColor: "rgba(255,255,255,0.4)",
  }}
  transitionStrategy={(ctx, event) => {
    // Dynamic grammar based on event + size delta
    if (event.sizeKey === "expanded") return { verb: "cinematic", modifier: "smooth" }
    return { verb: "morph", modifier: "fast" }
  }}
>
  <DynamicIslandCard.View
    id="overview"
    label="Overview"
    sizeKey="compact"
    transition={{ verb: "morph", modifier: "smooth" }}
    reticle="corners"
  >
    <OverviewView />
  </DynamicIslandCard.View>
  <DynamicIslandCard.View
    id="detail"
    label="Detail"
    sizeKey="expanded"
    transition={{ verb: "cinematic", modifier: "slow" }}
    reticle="glitch"
    complex
  >
    <DetailView />
  </DynamicIslandCard.View>
</DynamicIslandCard>
```

### 2) Programmatic transition with revert

```ts
const { transition, resetPosition } = useMorphIsland(cardId)
transition("expanded", { verb: "teleport", modifier: "bounce" })
// later
resetPosition()
```

### 3) Reticle only for complex transitions

```ts
// Complexity heuristic
const isComplex = sizeDelta > 120 || ["glitch", "teleport", "cinematic"].includes(grammar.verb)
send({ type: "TRANSITION", sizeKey, grammar, complexity: isComplex })
```

### 4) Drag/Resize with Shift-only

```tsx
<MorphCard
  cardId="draggable"
  onPositionChange={(pos) => setDebug(pos)}
/>
```

### 5) Auto-measured bounds with optional override

```tsx
<MorphCard
  cardId="bounded"
/>
```

## Patch List (Implementation Targets)

### A) New Files

1) `src/lib/morph-card/card-state.ts`
- **Effect service** that owns island card state and undo/redo history.
- Provides `get`, `set`, `reset`, `undo`, `redo`, `subscribe`.
- Stores state in **nested atom.family hierarchy**:
  - `cardStateFamily(cardId)`
    - `sizeKeyAtom`
    - `basePositionAtom`
    - `positionAtom`
    - `reticleAtom`
    - `transitionAtom`
    - `complexityAtom`
    - `boundsAtom`
    - `dragStateAtom`
    - `historyAtom` (bounded ring buffer)
- **Debounced persistence** to localStorage, via service layer.
- Optional AtomRpc bridges for remote sync (no default coupling).

2) `src/lib/morph-card/machines/islandMachine.ts`
- XState v5 machine (behavior parity with Cursor DynamicIsland).
- Context includes: sizeKey, previousSizeKey, basePosition, position, reticle, transition, complexity, drag/resizing, bounds.
- Events: `TRANSITION`, `INTERMEDIATE_TRANSITION`, `DRAG_START`, `DRAG_END`, `RESIZE_START`, `RESIZE_END`, `SET_POSITION`, `SET_BASE_POSITION`, `RESET_POSITION`, `BOUNDS_UPDATE`, `SET_RETICLE`.
- Invokes **Effect‑based transitionStrategy** that can emit intermediate transitions (progressive grammar).

3) `src/lib/morph-card/components/ReticleOverlay.tsx`
- Visual overlay rendered **inside MorphCard**.
- Renders variants consistent with Cursor DynamicIsland (24 reticles).
- Visibility driven by `isComplexTransition` state.

### B) Modified Files

4) `src/lib/morph-card/components/MorphCard.tsx`
- Remove legacy `initialMode`/`sizes` props.
- Add:
  - `initialSizeKey`
  - `stateMachineConfig`
  - `transitionStrategy` (Effect, required)
- Initialize machine actor + CardStateService.
- Compute base position on mount via `getBoundingClientRect` (tree‑aware).
- Wire shift‑drag, resize, and reset‑to‑base.
- Render `ReticleOverlay` when complex transitions are active.

5) `src/lib/morph-card/components/DynamicIslandCard.tsx`
- Extend `View` props: `sizeKey`, `transition` (string/object), `reticle`, `complex`.
- On tab activation: dispatch machine `TRANSITION`.
- Ensure active tab syncs to card state cache.

6) `src/lib/morph-card/components/TabBar.tsx`
- Optionally surface current sizeKey or transition state.
- Keep backwards compatibility if no machine provided.

7) `src/lib/morph-card/atoms/tab-atoms.ts`
- Keep tab state **separate** from island state.
- Ensure no cross‑coupling to island card atoms.

8) `src/lib/morph-card/schemas/tab-schemas.ts`
- Add per‑view overrides:
  - `sizeKey`
  - `transition` (string | grammar object)
  - `reticle`
  - `complex`

9) `src/lib/morph-card/schemas/animation-config.ts`
- Ensure reticle + motion blur config is actually consumed by MorphCard UI.

10) `src/lib/morph-card/index.ts`
- Export new service, machine, overlay, and updated props.

### C) Optional / Later (Flesh‑Out Targets)

11) `src/lib/morph-card/hooks/useDynamicIslandCard.ts`
- Add machine‑driven helpers:
  - `transition(sizeKey, grammar?)`
  - `resetPosition()`
  - `setBounds(bounds)`
  - `setReticle(variant)`
- Provide selectors for `sizeKey`, `position`, `bounds`, `isComplex`.

12) `src/components/testbed/MorphCardTestbed.tsx`
- Update demos to new API.
- Add examples for complex transitions and intermediate grammar emissions.
- Validate shift‑drag + reset, bounds overrides, per‑tab sizeKey.

13) `src/lib/morph-card/catalog/index.tsx`
- Update schema for new props:
  - `initialSizeKey`
  - `stateMachineConfig`
  - `transitionStrategy` (callable via Effect in runtime)
- Remove `initialMode`/`sizes` from schema.

14) `src/lib/morph-card/services/CardServerService.ts`
- Optional: Add AtomRpc binding hooks when remote sync is enabled.

15) `src/lib/morph-card/context/index.ts`
- Extend context to expose machine events + state snapshots.

## Open Questions
- Base position is computed from layout on mount; must be aware of position in tree.
- Container bounds: auto-measured with programmatic override API.

## Research Notes (Local References)
- XState + Legend-State + effect-atom composition: `src/lib/stx/ARCHITECTURE.md`
- XState implementation patterns: `src/lib/drag/machines/drag-machine.ts`, `src/lib/geoint/machines/*`
- Cursor DynamicIsland behavior baseline: `src/lib/cursor/components/DynamicIsland.tsx`
- Legend-State renderer usage: `src/lib/json-render/react/legend-renderer.tsx`
- effect-atom patterns: `src/lib/json-render/react/atoms.ts`, `src/lib/cursor/atoms/index.tsx`
- AtomRpc usage patterns: `src/lib/geoint/clients/*.ts`, `src/lib/geoint/server/IngestionRpcServer.ts`
