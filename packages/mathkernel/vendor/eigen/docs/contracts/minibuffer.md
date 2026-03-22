# Contract: `src/lib/minibuffer`

**Status:** Dual-stack migration (v1 + v2) in place
**Owner:** Interaction Platform
**Layer Tier:** Interaction service + UI shell
**Date:** 2026-02-13

## Purpose

`minibuffer` provides prompt/command entry, completion, and command-line style interactions (`M-x`, `y-or-n`, text read) for interactive flows.

## Public Surface (from `src/lib/minibuffer/index.ts` and versioned exports)

### v1 (`v1`)
- `MinibufferService`
- provider registry and built-in command provider
- `useMinibuffer()` hook + `MinibufferContent`

### v2 (`v2`)
- XState-backed machine (`minibufferMachine` + context/snapshot/actors)
- providers and completion runtime bridge
- bridge atoms (`snapshotAtom`, selector atoms, ops)
- React context + hooks (`useMinibuffer` API retained)

## Dependency Direction

**Observed outbound deps:**
- `commands`
- `hotkeys`
- `overlays`

**Observed inbound deps:**
- `commands`
- `editor`
- `hotkeys`
- `overlays`
- `terminal`

## Contract Points

- Minibuffer operations should be cancellation-safe.
- Prompt modes and selected completion must not be duplicated across v1/v2; v2 is the canonical event-driven path.
- Completion provider contract is externalized through provider registry.

## Current Drift / Debt

- `minibuffer` and `commands` have mutual cycle via command provider registration and `execute` integration.
- v1 and v2 coexist; some consumers still rely on legacy v1 semantics.

## Refactor Target (no UI churn)

1. Keep v1 APIs for compatibility; route new modules to v2 hooks/ops.
2. Consolidate provider registration semantics behind version-neutral adapter.
3. Reduce direct cross-imports to `commands`/`hotkeys` through command-adapter seam.

## Acceptance Criteria

- v1/v2 behavior parity for the tested user flows (prompt, command execute, message).
- Reduced direct bidirectional edges where practical; adapter seam documented.
- No visible UI changes during migration.
