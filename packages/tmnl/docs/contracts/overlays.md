# Contract: `src/lib/overlays`

**Status:** Active development + legacy cycle drag
**Owner:** Interaction Platform
**Layer Tier:** Shared interactive substrate
**Date:** 2026-02-13

## Purpose

`overlays` is the runtime container for capability layers on UI surfaces.
It owns container-scoped overlay registration, dispatch, ports/channels, and visual overlay state.

## Public Surface (from `src/lib/overlays/index.ts`)

- **Schemas:** event/tag schemas, state schemas, core IDs.
- **Services:**
  - `OverlayRegistry`
  - `PortHub`
  - `EventDispatcher`
- **Core composition:** `Overlay`, `createOverlay`, `composeOverlays`
- **Atoms:** container/overlay/port runtime atoms + ops
- **Hooks:** `useOverlay*`, `useEventDispatch`, `useEventStream`
- **Visual registry:** `openOverlay`, `closeOverlay`, z-order, suppressions.

## Dependency Direction

**Observed outbound deps:**
- `cursor`
- `floating`
- `hotkeys`
- `minibuffer`
- `screensaver`
- `sidebar`
- `terminal`

**Observed inbound deps:**
- `ava`, `buffer`, `commands`, `dataplane`, `drawer`, `geoint`, `minibuffer`, `morph-card`, `primitives` (via map), `screensaver`, `sidebar`, `terminal`, `windows`

## Current State (Cycle-Heavy)

`overlays` is strongly coupled to: `hotkeys`, `minibuffer`, `commands`, `terminal`, and data/visual chains (`cursor`, `charts`, `dataplane`, `editor`, `floating`).

### Representative cycles
- `overlays -> ... -> editor -> ... -> overlays`
- `overlays -> cursor -> charts -> ... -> overlays`
- `terminal -> commands -> hotkeys -> minibuffer -> overlays -> terminal`

## Contract Principles

1. **Container first:** overlays are scoped to container ids, never global ad hoc behavior.
2. **Event-only contracts:** cross-overlay interaction should favor port/event channels over direct calls.
3. **No command/business logic in services:** `overlays` should not own editor-level semantics.
4. **Effect-first runtime:** state mutations should flow through atoms/services.

## Refactor Target for this phase

### Near-term (no UI churn)
- Keep existing service APIs and hooks stable.
- Introduce explicit seams to avoid importing `overlayRegistry` directly from primitives and interactive modules.
- Route visual + command concerns through typed interfaces.

### Structural seam candidates
- `OverlayEventsBus` interface (publish/subscribe abstraction)
- `OverlayActivationPolicy` adapter for command/minibuffer integrations
- `OverlayHostRuntime` injection point for external containers

## Acceptance Criteria

- Existing overlay behavior unchanged for users.
- New cycle seams documented and enforced.
- No additional inbound dependency growth from primitives/elements into interactive peers.
- Adapter seam ownership visible in `docs/adapters/cycle-seams.md`.
