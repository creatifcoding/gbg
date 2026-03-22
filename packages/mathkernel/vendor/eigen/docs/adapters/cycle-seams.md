# Cycle Seam Registry

**Status:** Design + Migration Guide
**Date:** 2026-02-13

This registry defines **explicit adapter seams** for the 29 discovered cycles.
We do **not** flatten all cycles at once; we document and quarantine them while moving new work to seam-based integration.

> Policy: new functionality must not add dependencies not represented in this registry.

## 1) `commands <-> hotkeys <-> minibuffer`

**Observed edge set:**
- `commands -> hotkeys`
- `hotkeys -> commands`
- `commands -> minibuffer`
- `minibuffer -> commands`
- `hotkeys -> minibuffer`
- `minibuffer -> hotkeys`

**Problem:** command registration, execution, and prompt UX share ownership.

**Seam:**
- `ICommandExecutionBridge` (commands-first interface)
- `ICompletionPromptBridge` (minibuffer-first interface)

**Interim rule:** keep one-way imports by introducing bridges in modules that must call the other side; avoid importing full implementation modules.

**Owner:** commands-hotkeys-mini squad

---

## 2) `terminal -> commands -> hotkeys -> overlays -> terminal`

**Observed path:**
- `terminal -> commands`
- `commands -> hotkeys`
- `hotkeys -> minibuffer / overlays`
- `minibuffer -> overlays`
- `overlays -> terminal`

**Problem:** terminal currently participates in command dispatch and overlay orchestration while also exposing command entry points.

**Seam:**
- `ITerminalInteractionAdapter` (read-only event methods)
- `ICommandWireAdapter` (only execute + binding status)
- `IOverlayHostAdapter` (open/close + container metadata)

**Interim rule:** terminal should depend only on **interfaces** for command hotkey dispatch and overlay control, not on specific modules.

**Owner:** terminal interaction squad

---

## 3) `overlays -> cursor -> charts -> dataplane -> editor -> overlays`

**Observed:** overlays indirectly depends back through visual/data layout stack.

**Problem:** canvas/visual registry ownership leaks through data rendering layers.

**Seam:**
- `IVisualSurfaceAdapter` for overlay-triggered UI hints.
- `IDataPlaneViewportAdapter` for editor/dataplane publish signals.

**Interim rule:** overlay-driven hooks should depend on typed channel payloads only.

**Owner:** UI/visual runtime squad

---

## 4) `overlays -> screensaver -> overlays`

**Observed:** recursive direct dependency from screen saver behavior.

**Problem:** screensaver control currently requires overlay runtime imports.

**Seam:**
- `IScreenSaverControl` abstraction in shared contracts layer.

**Interim rule:** screensaver should request overlay actions through adapter interface and not import full overlay stack.

**Owner:** UI effects squad

---

## 5) `data-grid -> table-service -> data-grid`

**Observed:** direct reciprocal registration dependency.

**Problem:** table service metadata and grid lifecycle are mutually coupled.

**Seam:**
- `ITableServiceGateway` interface for grid metadata providers.

**Interim rule:** `table-service` should expose adapter-free API layer; data-grid should call only gateway functions.

**Owner:** data-grid subsystem owner

---

## 6) `primitives -> overlays`

**Observed edge:** `primitives` imports from `overlays` through map registry internals.

**Problem:** violates intended layer direction (`primitives` should be lower layer).

**Seam:**
- `IMapOverlayBridge` in `primitives/map` to invert control.

**Interim rule:** map code should accept an optional bridge and default to no-op when absent.

**Owner:** primitives + overlays owners

---

## Execution Rules for New Work

- Use these seams when touching cycle edges.
- If a new import edge appears, it must map to a documented seam.
- Remove cycle edges only when a direct adapter replacement exists.
- Do **not** modify public behavior while introducing seams.

## Current Status by Cycle

- `commands/hotkeys/minibuffer`: **Contract drafted, implementation pending**
- `terminal <-> interactive cluster`: **Contract drafted, implementation pending**
- `overlays <-> visual/data chain`: **Contract drafted, requires staged migration**
- `primitives -> overlays`: **Immediate cleanup candidate once seam exists**

## Rollback Strategy

If a seam migration regresses:
1. revert adapter-internal call path only,
2. keep public API untouched,
3. preserve legacy direct behavior behind feature flags,
4. run interaction regression checklist before merge.
