# Contract: `src/lib/hotkeys`

**Status:** High-coupling hotspot
**Owner:** Interaction Platform
**Layer Tier:** Shared interaction protocol
**Date:** 2026-02-13

## Purpose

`hotkeys` manages keyboard binding definitions, parser behavior, and scope-based resolution.
It is the command dispatch layer that bridges input event streams to executable actions.

## Public Surface (from `src/lib/hotkeys/index.ts`)

- Types: key/chord/scope binding types
- Registries: `ScopeRegistry`, `BindingSourceRegistry`
- Services: `KeyParser`
- Atoms:
  - source atoms (`bindingsSourceAtom`, `scopeStackSourceAtom`, ...)
  - derived atoms (`scopedBindingsAtom`, `whichKeyEntriesAtom`, ...)
  - runtime ops (`hotkeyOps`, `hotkeyActions`, `processKeyboardEvent`)
- Hook: `useGlobalHotkeys`
- Component: `WhichKeyPopup`

## Dependency Direction

**Observed outbound deps:**
- `commands`
- `minibuffer`
- `primitives`
- `tauri-windows`

**Observed inbound deps:**
- `commands`
- `editor`
- `geoint`
- `overlays`
- `minibuffer`
- `terminal`
- `windows`

## Contract Guarantees

1. Do not hardwire terminal/editor lifecycles directly.
2. Keep parser and binding atoms deterministic and testable.
3. Event handlers should return stable handler results (handled/delegate/broadcast semantics defined in consumer contracts).
4. Command binding registration should be idempotent and reversible (supports hot reload/test isolation).

## Current Drift

- Bidirectional cycle with `commands` and `minibuffer` causes ownership conflict for command execution.
- `hotkeys` imports from `primitives` (necessary for tokenization registries) and `tauri-windows` (platform-specific handling), which should stay low-level and seam-limited.

## Target for Current Wave

- Keep API stable (no UI churn), but move command/minibuffer cross-calls behind adapter modules:
  - `CommandBindingAdapter`
  - `MinibufferPrefixAdapter`
- Ensure `hotkeys` owns raw key semantics; it should not own command completion UX.

## Acceptance Criteria

- No new `commands <-> hotkeys <-> minibuffer` cycle edges introduced.
- Command registration and scope resolution remain deterministic under repeated mounts/unmounts.
- Test coverage proves no functional regression for basic chords/sequences in command execution paths.
