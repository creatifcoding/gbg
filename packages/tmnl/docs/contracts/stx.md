# Contract: `src/lib/stx`

**Status:** Stable
**Owner:** Platform Runtime
**Layer Tier:** Primitive / state foundation
**Date:** 2026-02-13

## Purpose

`stx` provides unified composition primitives for app state:
- XState integration
- Legend-state helpers
- effect-atom access and hooks
- typed bridges between machine state and reactive UI

It is expected to be one of the lowest reliable layers for interactive subsystems.

## Public Surface (from `src/lib/stx/index.ts`)

- `stx` factory and typed configs
- React hooks: `useStxValue`, `useStxData`, `useStxSend`, etc.
- Binding helpers: `fromEffect`, `fromLegendState`, `fromEffectCallback`, ...
- Re-exports for core primitives (XState/LegendState/effect-atom) in one place.

## Dependency Direction

**Observed outbound deps:**
- none (primitive tier)

**Observed inbound deps:**
- `drag`
- `transfer`
- `floating`
- `ava`

## Contract Guarantees

1. No mandatory dependency on UI or terminal modules.
2. Compositional APIs should remain generic over React/DOM context.
3. Hooks must be stable and avoid hidden global mutation.
4. Effects and machine bridges must remain deterministic and typed.

## Invariant Checklist

- `stx` types should remain schema-first where domain payloads are exposed.
- No hard dependency on `overlays`, `terminal`, `commands`, or `hotkeys`.
- No cross-module singleton coupling except explicit `Context.Tag`/effect-atom patterns.

## Refactor Targets for Current Phase

- Treat as base dependency for interaction modules.
- When editing consumers, avoid creating new imports from `stx` to any interactive surface.
- Keep `stx` untouched during cycle remediation unless API changes needed (rare).

## Acceptance Criteria

- Baseline import scan must keep `stx` at zero outbound local dependencies.
- New interactive modules must consume `stx` via stable hooks/types only.
- `stx` can be upgraded without touching `commands/hotkeys/minibuffer/overlays` internals.
