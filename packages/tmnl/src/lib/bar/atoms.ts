/**
 * TMNL Bar — Atom-as-State
 *
 * Atoms ARE the state. No Effect.Ref, no useState pollution.
 * Services mutate atoms directly via FnContext.set().
 * React subscribes via useAtomValue.
 *
 * Pattern precedent: src/lib/data-manager/v1/atoms/index.ts
 */

import { Atom } from '@effect-atom/atom-react'
import * as Effect from 'effect/Effect'

import type { ConnectionStatus } from './types'
import { NiriService } from './niri'

// ─────────────────────────────────────────────────────────────────────────────
// Writable State Atoms (Module-Level Singletons)
// ─────────────────────────────────────────────────────────────────────────────

/** Raw workspace data from niri */
export const workspacesAtom = Atom.make<readonly any[]>([])

/** Raw window data from niri */
export const windowsAtom = Atom.make<readonly any[]>([])

/** Niri connection status */
export const niriStatusAtom = Atom.make<ConnectionStatus>('disconnected')

/** Current time — ticked every second */
export const timeAtom = Atom.make<Date>(new Date())

/** TMNL main app connection status */
export const tmnlStatusAtom = Atom.make<ConnectionStatus>('disconnected')

// ─────────────────────────────────────────────────────────────────────────────
// Derived Atoms (Computed from writable atoms)
// ─────────────────────────────────────────────────────────────────────────────

/** Workspaces sorted by index — always consistent ordering */
export const sortedWorkspacesAtom = Atom.make((get) =>
  [...get(workspacesAtom)].sort((a: any, b: any) => a.idx - b.idx)
)

/** The currently focused workspace */
export const focusedWorkspaceAtom = Atom.make((get) =>
  get(workspacesAtom).find((ws: any) => ws.is_focused) ?? null
)

/** Count of workspaces with windows */
export const activeWorkspaceCountAtom = Atom.make((get) =>
  get(workspacesAtom).filter((ws: any) => ws.active_window_id !== null).length
)

/** The currently focused window */
export const focusedWindowAtom = Atom.make((get) =>
  get(windowsAtom).find((w: any) => w.is_focused) ?? null
)

/** Formatted clock components */
export const clockAtom = Atom.make((get) => {
  const t = get(timeAtom)
  return {
    hours: t.getHours().toString().padStart(2, '0'),
    minutes: t.getMinutes().toString().padStart(2, '0'),
    seconds: t.getSeconds(),
    day: t.toLocaleDateString('en', { weekday: 'short' }).toUpperCase(),
    pulseSeparator: t.getSeconds() % 2 === 0,
  }
})

/** System health derived from connection statuses */
export const systemHealthAtom = Atom.make((get) => ({
  niri: get(niriStatusAtom),
  tmnl: get(tmnlStatusAtom),
  healthy: get(niriStatusAtom) === 'connected',
}))

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Atom (Effect Services → React Bridge)
// ─────────────────────────────────────────────────────────────────────────────

export const barRuntimeAtom = Atom.runtime(NiriService.Default)

// ─────────────────────────────────────────────────────────────────────────────
// Operation Atoms — canonical pattern: runtimeAtom.fn<Arg>()(callback)
// ─────────────────────────────────────────────────────────────────────────────

/** Focus a workspace by index */
export const focusWorkspaceFn = barRuntimeAtom.fn<number>()((idx, ctx) =>
  Effect.gen(function* () {
    const niri = yield* NiriService
    yield* niri.focusWorkspace(idx)
    // Optimistic update: mark target as focused
    ctx.set(workspacesAtom, (prev: readonly any[]) =>
      prev.map((ws: any) => ({
        ...ws,
        is_focused: ws.idx === idx,
        is_active: ws.idx === idx ? true : ws.is_active,
      }))
    )
  })
)

/** Refresh workspaces from niri */
export const refreshWorkspacesFn = barRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    const niri = yield* NiriService
    const workspaces = yield* niri.getWorkspaces
    ctx.set(workspacesAtom, workspaces)
    ctx.set(niriStatusAtom, 'connected')
  })
)

/** Refresh windows from niri */
export const refreshWindowsFn = barRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    const niri = yield* NiriService
    const windows = yield* niri.getWindows
    ctx.set(windowsAtom, windows)
  })
)
