# Contract: `src/lib/terminal`

**Status:** Active integration surface
**Owner:** Surface Layer
**Layer Tier:** Stateful application surface + backend bridge
**Date:** 2026-02-13

## Purpose

`terminal` provides terminal UI and command I/O integration.
It currently bridges AI/core streams, overlays, hotkeys, and overlays-driven interactions.

## Public Surface (from `src/lib/terminal/index.ts` + `v2`/`v3`)

- Public terminal shell components (`Terminal`, `GhosttyTerminal`, `TerminalPanel`)
- Terminal shell hooks and PTY bridge helpers
- Multiple implementation versions (`v2`, `v3`) with shared command/overlay integration points

## Dependency Direction

**Observed outbound deps:**
- `ai-core`
- `commands`
- `editor`
- `floating`
- `hotkeys`
- `genifer`
- `mcp`
- `overlays`
- `primitives`
- `tmnl-ui`

**Observed inbound deps:**
- `commands`
- `conductor`
- `overlays`
- `testbed`

## Contract Principles

1. Terminal lifecycle should remain deterministic under repeated mount/unmount.
2. Keep external integrations (commands/hotkeys/overlays) behind adapters where feasible.
3. Preserve compatibility across `v2` and `v3` public API.
4. Command execution and rendering should not be coupled to a single overlay implementation.

## Current Drift

- Terminal sits in the interactive cycle:
  `terminal -> commands -> hotkeys -> minibuffer -> overlays -> terminal`
- Also participates in `ai-core` and `testbed` bidirectional paths.

## Refactor Target

### No UI churn policy
- Keep terminal components stable.
- Introduce an interaction facade (`terminalInteractionAdapter`) between terminal core and command/hotkey/minibuffer modules.
- Document explicit event contract for terminal-commands dispatching and overlay open/close triggers.

## Acceptance Criteria

- Terminal functional parity for existing command palette and key actions.
- At least one cycle seam documented and enforced for each high-risk edge.
- No user-visible behavior change from current baseline.
