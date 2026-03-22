# Contract: `src/lib/primitives`

**Status:** Design with observed drift
**Owner:** Foundation (shared infrastructure)
**Layer Tier:** Primitive / low-level
**Date:** 2026-02-13

## Purpose

`primitives` provides reusable low-level building blocks without business-rule policy.
It is meant to be dependency-safe for consumers across `stx`, `hotkeys`, `overlays`, `maps`, and terminal widgets.

## Public Surface (from `src/lib/primitives/index.ts`)

- `TokenRegistry` module re-export + namespace factory (`TokenRegistry` object + `make`/`makeTag` etc.)
- `map` module re-export:
  - `BaseMap`
  - map registry atoms/helpers (`mapRegistry`, `createMapInstanceAtoms`, etc.)
  - map schemas (`PositionSchema`, `MapMarkerSchema`, `MapConfigSchema`, ...)

## Current Dependency Direction

**Observed outbound deps:**
- `overlays` (via map internals using `overlayRegistry` for shared state propagation)

**Observed inbound deps:**
- `hotkeys`
- `terminal`

## Expected Contract (target)

`primitives` should be a **pure dependency foundation**:
- No dependency on `overlays`, `terminal`, or interactive modules.
- Shared state integrations should go through adapter seams, not direct imports.
- Keep registration primitives lightweight and testable independently.

## Current Drift

`src/lib/primitives/map/registries.ts` uses `overlayRegistry` directly:
- This couples map primitives to visual overlay lifecycle.
- It blocks strict layering for interactive systems that expect primitives-first.

## Canonical Export Rules

- Export only minimal, type-safe constructors and schema utilities.
- Do not embed UI assumptions.
- Keep stateful effects outside pure primitives unless explicitly shared via adapter seam.

## Interaction Contract

### With `stx`
- Recommended: `stx` should consume map primitives (atoms/hooks), not vice-versa.

### With `hotkeys` / `commands`
- Only via schema contracts and registries; avoid deep import loops.

### With `overlays`
- **Do not import** `overlays` directly in default design.
- If unavoidable, route through dedicated adapter seam defined in `docs/adapters/cycle-seams.md`.

## Refactor Target for This Cycle

1. Extract a tiny primitives-to-visual adapter module (e.g., `src/lib/primitives/map/adapters/overlay.ts`) if shared state requires it.
2. Remove direct map import of `overlayRegistry` by inverting control.
3. Add explicit `registryBridge` param in map helpers where needed (consumer-provided callback for visibility updates).
4. Update contract docs and tests that assert dependency direction.

## Stability / Risk

- **Risk:** map registry consumers expect overlay side-effect synchronization.
- **Mitigation:** keep `BaseMap` behavior stable; only refactor wiring path.

## Acceptance Criteria

- Primitive exports remain backward-compatible.
- No new direct import from `primitives` to `overlays` in non-legacy adapter files.
- CI import-graph check has fewer `primitives -> overlays` edges.
- New adapter seam documented + owned in `docs/adapters/cycle-seams.md`.
