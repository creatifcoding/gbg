# Contract: `src/lib/commands`

**Status:** Foundation stable, wiring-heavy
**Owner:** Interaction Platform
**Layer Tier:** Interaction protocol + execution layer
**Date:** 2026-02-13

## Purpose

`commands` defines typed command schemas, registration, execution service, and persistence for keybinding overrides.
It provides the abstraction used by command palette and key-driven command execution.

## Public Surface (from `src/lib/commands/index.ts`)

- Types: command metadata, binding types, execution context
- DSL: `command`, `entityCommand`, `defineCommand`, `defineEntityCommand`
- `CommandService` for execute/get/list/override flows
- Atoms: `commandsAtom`, `bindingOverridesAtom`, `effectiveBindingsAtom`
- Defaults: built-in commands + `allCommands`
- Wiring: `wireCommands`, `wireCommandsEffect`, `unwire*`, error types
- React: `useCommandWire`, `withCommandWire`
- Persistence: `load/save` overrides hooks
- Command provider: `CommandProvider` for minibuffer completion

## Dependency Direction

**Observed outbound deps:**
- `hotkeys`
- `minibuffer`
- `overlays`
- `screensaver`
- `search`
- `tauri-windows`
- `terminal`

**Observed inbound deps:**
- `hotkeys`
- `minibuffer`
- `terminal`

## Contract Principles

1. Command definition should be pure and side-effect-light.
2. Runtime execution belongs to `CommandService` and is effect-typed.
3. Keybinding source-of-truth flows through atoms with persistence adapter.
4. `CommandProvider` must stay generic to avoid hardcoding command panel implementation.

## Current Drift

- Cycle with `hotkeys` and `minibuffer` causes command ownership ambiguity.
- Direct dependency on `overlays` via defaults/wiring glue indicates shared ownership boundary crossing.

## Refactor Target

- Preserve existing command API (backward-compatible).
- Introduce adapter seam around UI integration:
  - `CommandExecutionAdapter` (exposes execute + status only)
  - `CommandBindingAdapter` (abstract from hotkeys registry internals)
- Keep persistence/local override behavior isolated.

## Acceptance Criteria

- Command execution semantics remain unchanged.
- Interactive surfaces consume commands through documented seams.
- Additional cycles are only via explicit seams where impossible to break.
