# Bar Core — Widget Reference

> up: ../SKILL.md
> prereqs: none
> update-strategy: re-derive from src/lib/getbyshell/ + src-shell/
> update-trigger: bar widget API changes, new bar component added

## Overview

48px vertical layer-shell strip anchored to the left screen edge (`Layer::Top`). The primary navigation surface of GetByShell.

## Source Layout

| Location | Purpose |
|----------|---------|
| `src/lib/getbyshell/types.ts` | Schema-backed: Workspace, NiriWindow, ConnectionStatus, NiriEvent |
| `src/lib/getbyshell/atoms.ts` | Runtime atom + workspace/window/clock/health state + operation fns |
| `src/lib/getbyshell/hooks.ts` | React hooks: useClockTick, useNiriSync, useWorkspaces, etc. |
| `src/lib/getbyshell/niri.ts` | NiriService (Effect.Service → Tauri IPC) |
| `src/lib/getbyshell/index.ts` | Public API barrel |
| `src-shell/App.tsx` | Bar root component |
| `src-shell/components/BarLayout.tsx` | Vertical strip layout |
| `src-shell/components/Clock.tsx` | Clock display |
| `src-shell/components/TMNLStatus.tsx` | System status indicator |
| `src-shell/components/WorkspaceIndicators.tsx` | Niri workspace dots |
| `src-shell/components/CalendarPanel.tsx` | Calendar popover content |
| `src-shell/components/CommandPalette.tsx` | Palette trigger |
| `src-shell-tauri/` | Rust backend (layer-shell, input regions, surface width) |

## Key Patterns

### Runtime Atom (Effect → React Bridge)
```typescript
export const barRuntimeAtom = Atom.runtime(
  Layer.mergeAll(NiriService.Default, ShellLoggerLive),
)

export const focusWorkspaceFn = barRuntimeAtom.fn<number>()((idx, ctx) =>
  Effect.gen(function* () {
    const niri = yield* NiriService
    yield* niri.focusWorkspace(idx)
    ctx.set(workspacesAtom, (prev) => /* optimistic update */)
  }).pipe(Effect.withSpan('bar.focusWorkspace')),
)
```

### Input Region Sync
When a popover opens, the WebView surface expands and input regions are sent to Rust so the compositor delivers pointer events to the transparent backdrop (enabling click-outside-to-dismiss).

### Surface Width Expansion
Popovers expand the bar surface from 48px to ~400px. Modals expand to full monitor width. Version-counter guards prevent async race conditions between open/close surface syncs.

## Systemd

- `tmnl-bar-vite.service` — Vite on :1421 (`vite.config.shell.ts`)
- `tmnl-bar.service` — Tauri binary, Layer::Top, `src-shell-tauri/`
