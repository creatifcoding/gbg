# Annotation Popover — XState v5 Evidence Pack

## Why this exists

This file captures the canonical XState v5 API guidance used to implement annotation popover lifecycle with a single machine authority (via stx), while preserving `popoverOps` as integration boundary.

---

## Local project constraints (verified)

- `xstate`: `^5.20.0`
- `@xstate/react`: `^4.1.3`

Source: `package.json`

> Note: code in this repo already uses v5 machine authoring patterns (`setup({...}).createMachine({...})`) in multiple modules.

---

## Canonical XState v5 API findings

### 1) Machine authoring

**Use:**

- `setup({ types, actions, guards, actors, delays }).createMachine({...})`
- `assign(...)` for context updates
- typed params objects for named actions (`{ type: 'actionName', params: (...) => (...) }`)

**Avoid:**

- v4-style schema/typegen patterns as primary source of truth
- untyped event payload access in actions/guards

References:

- DeepWiki: `/statelyai/xstate/6.1-type-system-and-setup()`
- Exa: Stately quick start + cheatsheet (`stately.ai/docs/quick-start`, `stately.ai/docs/cheatsheet`)

### 2) Actor lifecycle

**Use:**

- `createActor(machine)`
- `actor.start()` / `actor.stop()`
- `actor.getSnapshot()` for synchronous state reads
- snapshot subscription for orchestration side effects

References:

- DeepWiki: `/statelyai/xstate/2.7-actor-model-and-actor-logic-types`

### 3) Actions and side effects

**Use:**

- deterministic transition graph for lifecycle rules
- `assign` for context mutations
- side effects triggered at controlled boundaries, not from arbitrary component branches

References:

- DeepWiki: `/statelyai/xstate/2.5-actions`

### 4) React integration

**Use:**

- actor/snapshot subscriptions with stable selectors
- single orchestration boundary; avoid multi-writer React components mutating lifecycle state directly

References:

- DeepWiki: `/statelyai/xstate/3.1-react-integration`

---

## Popover-domain evidence (TipTap/ProseMirror/Floating UI)

### 1) TipTap bubble-menu internals

TipTap’s bubble menu plugin implements explicit lifecycle checks and update sequencing:

- update only when relevant selection/doc changes
- compute position from virtual element / selection rect
- hide on invalid conditions
- debounce update/resize handlers

Reference:

- `https://raw.githubusercontent.com/ueberdosis/tiptap/main/packages/extension-bubble-menu/src/bubble-menu-plugin.ts`

### 2) ProseMirror tooltip pattern

Popover/tooltip synchronization should hook into editor plugin/view update lifecycle and recompute position from editor coordinates.

Reference:

- `https://prosemirror.net/examples/tooltip/`

### 3) Hover traversal behavior

For trigger→floating traversal, safe polygon behavior is canonical (`useHover(..., { handleClose: safePolygon(...) })`) with documented caveats.

Reference:

- `https://floating-ui.com/docs/usehover`

---

## Implementation implications for this feature

1. Popover lifecycle is represented by a **single XState v5 machine**.
2. stx is the state boundary (machine + data), and React components are consumers.
3. `popoverOps` stays as integration boundary for existing annotation atom/service surfaces.
4. Multiple direct writers to `activePopoverAtom`/`popoverContentAtom` should be removed in favor of machine-dispatched intents.
5. Anchor updates follow editor lifecycle events (selection/transaction/scroll/resize), not static one-off DOM reads.

---

## Decision

Proceed with:

- `popoverMachine` (XState v5) as canonical lifecycle contract
- stx-backed controller boundary
- gradual rewiring of mark/popover hooks to machine intents
- retention of `popoverOps` as mutation bridge
