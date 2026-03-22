# Contract: `src/lib/floating`

**Status:** Stable utility, interface-heavy
**Owner:** Layout/Surface Runtime
**Layer Tier:** Shared UI substrate
**Date:** 2026-02-13

## Purpose

`floating` supplies docking/panel primitives and size/position orchestration.
It is a shared runtime surface used by overlays, terminal panels, file browser, and editor helpers.

## Public Surface (from `src/lib/floating/index.ts`)

- Components: floating panel provider/containers and drag overlays
- Hooks: dimension/position/measurement helpers
- Machines/Types: runtime state models for drag/resizing
- Utilities for panel registry and handle management

## Dependency Direction

**Observed outbound deps:**
- `capabilities`
- `drag`
- `drawer`
- `stx`

**Observed inbound deps:**
- `egui`
- `file-browser`
- `geoint`
- `overlays`
- `terminal`

## Contract Principles

1. Floating containers are pure layout infrastructure.
2. Interaction details (commands/hotkeys/terminal semantics) must be injected, not hardcoded.
3. All persisted state (positions/bounds/preferences) should remain in explicit atoms/services.

## Current Drift

- `overlays` and `terminal` integrate with floating internals indirectly through behavior surfaces.
- No cycles through floating itself, but it is a boundary-crossing dependency point for terminal and overlays.

## Refactor Target

- Keep floating API stable.
- Move any semantic coupling to adapter entry points in consumer modules.
- Keep state shape and hooks consistent while migrating to explicit adapters.

## Acceptance Criteria

- Floating behavior unchanged for existing panels.
- `floating` remains free of terminal/command-specific logic.
- Dependency edges to floating are declared and monitored in cycle-seam docs.
