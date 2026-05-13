# Niri Service — Widget Reference

> up: ../SKILL.md
> prereqs: none
> update-strategy: re-derive from src/lib/getbyshell/niri.ts
> update-trigger: NiriService API changes, niri compositor version bumps

## Overview

Effect service bridging Tauri IPC to the niri Wayland compositor. Manages workspace switching, window tracking, and compositor event subscriptions.

## Source

`src/lib/getbyshell/niri.ts` — `NiriService` (Effect.Service → Tauri IPC)

## API

```typescript
export class NiriService extends Context.Tag('tmnl/NiriService')<
  NiriService,
  {
    readonly focusWorkspace: (idx: number) => Effect.Effect<void>
    readonly getWorkspaces: () => Effect.Effect<ReadonlyArray<Workspace>>
    readonly getWindows: () => Effect.Effect<ReadonlyArray<NiriWindow>>
    readonly subscribe: () => Effect.Effect<void>  // Start event subscription
  }
>() {}
```

## Event Flow

```
niri compositor
  → Tauri IPC events (workspace switch, window open/close/focus)
  → NiriService processes events
  → Atom.set() updates workspace/window atoms
  → React re-renders workspace indicators, window list
```

## Atoms Driven by Niri

- `workspacesAtom` — All workspace metadata
- `windowsAtom` — All open windows
- `sortedWorkspacesAtom` — Workspaces sorted by index
- `focusedWorkspaceAtom` — Currently active workspace
- `focusedWindowAtom` — Currently focused window
- `niriStatusAtom` — Connection status (connected/disconnected/error)
