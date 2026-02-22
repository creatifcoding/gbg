# Interactive Surface System (`primitives` + `hotkeys` + `minibuffer` + `commands` + `overlays` + `terminal`)

**Status:** Design (rectification wave 1)
**Date:** 2026-02-13

## Why this matters

The interactive system is not a decorative add-on: it is a core control plane for navigation, editing, and AI workflows.
Current reality is functionally complete but cyclic:
- `commands` depends on `hotkeys`, `minibuffer`, `overlays`, `terminal` (and vice versa)
- `hotkeys` depends on `commands` and `minibuffer`
- `minibuffer` depends on both `hotkeys` and `commands`
- `terminal` depends on all of the above

That means ownership is ambiguous for event sources, and regressions are easy to hide.

---

## Canonical interactive flow (as implemented today)

```text
DOM keydown / UI event
  -> hotkeys parsing (`processKeyboardEvent`)
    -> scoped binding match
      -> command binding id
        -> CommandService.execute(commandId)
          -> command handler
            -> (optional) terminal operation
            -> (optional) overlay mutation
            -> (optional) minibuffer prompt
              -> completion provider callbacks
                -> CommandService / terminal side-effects
```

### Overlay-centric flow

```text
Pointer/gesture event
  -> overlay container dispatch
    -> overlay stack (LIFO)
      -> handler either handles / delegates / broadcasts
        -> channel/port publication
          -> terminal/sidebar/canvas observers
```

### Minibuffer flow

```text
executeCommand() or prompt()
  -> v2 machine / v1 Deferred pathway
    -> provider registry
      -> completion/filter
      -> execute callback
        -> (often) CommandService/Hotkeys interaction
```

---

## Current dependency surface (interactive cluster)

- `primitives -> overlays`
- `overlays -> hotkeys, minibuffer, terminal, screensaver, cursor, floating, sidebar`
- `hotkeys -> commands, minibuffer, primitives, tauri-windows`
- `minibuffer -> commands, hotkeys, overlays`
- `commands -> hotkeys, minibuffer, overlays, screensaver, terminal`
- `terminal -> commands, hotkeys, overlays, primitives`

This is a complete cycle cluster with secondary spill into `editor`, `genifer`, `dataplane`.

---

## Critical cycle paths (high severity)

1. `terminal -> commands -> hotkeys -> minibuffer -> overlays -> terminal`
2. `commands -> hotkeys -> minibuffer -> commands`
3. `hotkeys -> minibuffer -> hotkeys`
4. `overlays -> cursor -> charts -> dataplane -> editor -> ... -> overlays`

---

## Target architecture pattern (no user-facing churn)

### 1) Explicit interaction seams

Introduce adapter-style interfaces for cross-module actions:

- `ICommandBridge`:
  - register/list bindings
  - execute command by id
  - resolve command metadata

- `IMinibufferBridge`:
  - prompt/read/yorn APIs
  - provider registration contract

- `IOverlayEventBus`:
  - post/publish structured overlay events
  - create/destroy container
  - open/close overlay by id and container

- `IHotkeySurface`:
  - process key event
  - scope push/pop
  - which-key state

### 2) Directional ownership

- `hotkeys` owns parser + matching semantics.
- `commands` owns command catalog and execute pipeline.
- `minibuffer` owns prompt UX + completion modes.
- `overlays` owns overlay stack and container lifecycle.
- `terminal` consumes adapters, does not define canonical binding/prompt semantics.

### 3) Phase-locked migration order

- Pass A: document and codify contracts.
- Pass B: introduce adapter modules while preserving APIs.
- Pass C: replace direct imports in selected pathways.
- Pass D: optional cycle-breaking (if needed), keeping runtime-compatible fallbacks.

---

## Event contracts (must not change behavior)

### Hotkey event contract
- Input: normalized key string + timestamp + modifiers + event meta
- Output: handler result (`handled | delegate | broadcast`), command id or pass-through

### Command execution contract
- Input: command id + optional runtime context
- Output: effect result + domain errors

### Minibuffer contract
- Input: prompt spec / completion provider / expected result shape
- Output: completion list + final selection/response stream

### Overlay event contract
- Input: event payload + container/overlay context
- Output: dispatch result and optional downstream publications

---

## Acceptance criteria for the interactive pass

1. No visible UI behavior changes.
2. Existing tests for command palette / key chords / overlay toggles continue passing.
3. Cycle inventory remains documented and reduced where safe.
4. New adapter seams are used by all new modules.
5. New cycle introductions are disallowed unless explicitly logged in `docs/adapters/cycle-seams.md`.
