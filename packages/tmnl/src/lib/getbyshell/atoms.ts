/**
 * TMNL Bar — Atom-as-State
 *
 * Atoms ARE the state. No Effect.Ref, no useState pollution.
 * Services mutate atoms directly via FnContext.set().
 * React subscribes via useAtomValue.
 *
 * Every operation is traced via Effect.log + Effect.withSpan.
 * ShellLoggerLive routes all logs → Tauri IPC → Rust → journald.
 *
 * Pattern precedent: src/lib/data-manager/v1/atoms/index.ts
 */

import { Atom } from '@effect-atom/atom-react'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import type { ConnectionStatus } from './types'
import { NiriService } from './niri'
import { ShellLoggerLive } from './logging'

// =============================================================================
// Writable State Atoms (Module-Level Singletons)
// =============================================================================

/** Raw workspace data from the active compositor (niri or DriftWM). */
export const workspacesAtom = Atom.make<readonly any[]>([])

/** Raw window data from the active compositor (niri or DriftWM). */
export const windowsAtom = Atom.make<readonly any[]>([])

/** Active compositor connection status. Kept as niriStatusAtom for API compatibility. */
export const niriStatusAtom = Atom.make<ConnectionStatus>('disconnected')

/** Compositor-neutral alias for new DriftWM/niri callers. */
export const compositorStatusAtom = niriStatusAtom

/** Current time — ticked every second */
export const timeAtom = Atom.make<Date>(new Date())

/** TMNL main app connection status */
export const tmnlStatusAtom = Atom.make<ConnectionStatus>('disconnected')

// =============================================================================
// Derived Atoms (Computed from writable atoms)
// =============================================================================

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
  // `niri` is retained for API compatibility; `compositor` is the neutral name.
  niri: get(niriStatusAtom),
  compositor: get(niriStatusAtom),
  tmnl: get(tmnlStatusAtom),
  healthy: get(niriStatusAtom) === 'connected',
}))

// =============================================================================
// Runtime Atom (Effect Services + Logger → React Bridge)
// =============================================================================

export const barRuntimeAtom = Atom.runtime(
  Layer.mergeAll(NiriService.Default, ShellLoggerLive),
)

// =============================================================================
// Compositor Operations — traced via Effect.withSpan
// =============================================================================

/** Focus a workspace by index */
export const focusWorkspaceFn = barRuntimeAtom.fn<number>()((idx, ctx) =>
  Effect.gen(function* () {
    yield* Effect.log(`Focusing workspace ${idx}`)
    const niri = yield* NiriService
    yield* niri.focusWorkspace(idx)
    ctx.set(workspacesAtom, (prev: readonly any[]) =>
      prev.map((ws: any) => ({
        ...ws,
        is_focused: ws.idx === idx,
        is_active: ws.idx === idx ? true : ws.is_active,
      }))
    )
    yield* Effect.log(`Workspace ${idx} focused (optimistic)`)
  }).pipe(Effect.withSpan('bar.focusWorkspace')),
)

/** Refresh workspaces from the active compositor. */
export const refreshWorkspacesFn = barRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    yield* Effect.logDebug('Refreshing workspaces from compositor')
    const niri = yield* NiriService
    const workspaces = yield* niri.getWorkspaces
    ctx.set(workspacesAtom, workspaces)
    ctx.set(niriStatusAtom, 'connected')
    yield* Effect.logDebug(`Refreshed: ${workspaces.length} workspaces`)
  }).pipe(Effect.withSpan('bar.refreshWorkspaces')),
)

/** Refresh windows from the active compositor. */
export const refreshWindowsFn = barRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    yield* Effect.logDebug('Refreshing windows from compositor')
    const niri = yield* NiriService
    const windows = yield* niri.getWindows
    ctx.set(windowsAtom, windows)
    yield* Effect.logDebug(`Refreshed: ${windows.length} windows`)
  }).pipe(Effect.withSpan('bar.refreshWindows')),
)

// =============================================================================
// Popover Logging Fns
// =============================================================================

/** Log popover open */
export const logPopoverOpenFn = barRuntimeAtom.fn<{
  id: string
  rect: { x: number; y: number; w: number; h: number }
}>()((params) =>
  Effect.gen(function* () {
    yield* Effect.log(
      `Popover opened: ${params.id} at (${params.rect.x},${params.rect.y}) ${params.rect.w}×${params.rect.h}`,
    )
  }).pipe(Effect.withSpan('bar.popover.open')),
)

/** Log popover close */
export const logPopoverCloseFn = barRuntimeAtom.fn<{ id: string }>()((params) =>
  Effect.gen(function* () {
    yield* Effect.log(`Popover closed: ${params.id}`)
  }).pipe(Effect.withSpan('bar.popover.close')),
)

// =============================================================================
// Modal Logging Fns
// =============================================================================

/** Log modal open */
export const logModalOpenFn = barRuntimeAtom.fn<{
  id: string
  entrance: string
  payload?: unknown
}>()((params) =>
  Effect.gen(function* () {
    yield* Effect.log(
      `Modal opened: ${params.id} entrance=${params.entrance}${params.payload ? ` payload=${JSON.stringify(params.payload)}` : ''}`,
    )
  }).pipe(Effect.withSpan('bar.modal.open')),
)

/** Log modal close */
export const logModalCloseFn = barRuntimeAtom.fn<{ id: string }>()((params) =>
  Effect.gen(function* () {
    yield* Effect.log(`Modal closed: ${params.id}`)
  }).pipe(Effect.withSpan('bar.modal.close')),
)

// =============================================================================
// Input Region Logging Fns
// =============================================================================

/** Log input region update */
export const logInputRegionFn = barRuntimeAtom.fn<{
  reason: string
  regionCount: number
  fullSurface: boolean
}>()((params) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(
      `Input region: ${params.reason} regions=${params.regionCount} fullSurface=${params.fullSurface}`,
    )
  }).pipe(Effect.withSpan('bar.inputRegion')),
)

// =============================================================================
// Compositor Event Logging Fns
// =============================================================================

/** Log active compositor event received. */
export const logNiriEventFn = barRuntimeAtom.fn<{
  type: string
  detail?: string
}>()((params) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Compositor event: ${params.type}${params.detail ? ` — ${params.detail}` : ''}`)
  }).pipe(Effect.withSpan('bar.compositor.event')),
)

/** Compositor-neutral alias for new DriftWM/niri callers. */
export const logCompositorEventFn = logNiriEventFn

/** Log active compositor connection status change. */
export const logNiriStatusFn = barRuntimeAtom.fn<{
  from: string
  to: string
}>()((params) =>
  Effect.gen(function* () {
    yield* Effect.log(`Compositor status: ${params.from} → ${params.to}`)
  }).pipe(Effect.withSpan('bar.compositor.status')),
)

/** Compositor-neutral alias for new DriftWM/niri callers. */
export const logCompositorStatusFn = logNiriStatusFn

// =============================================================================
// Lifecycle Logging Fns
// =============================================================================

/** Log bar boot phase */
export const logBootPhaseFn = barRuntimeAtom.fn<{
  phase: string
  detail?: string
}>()((params) =>
  Effect.gen(function* () {
    yield* Effect.log(`Boot: ${params.phase}${params.detail ? ` — ${params.detail}` : ''}`)
  }).pipe(Effect.withSpan('bar.boot')),
)

/** Log bar error */
export const logErrorFn = barRuntimeAtom.fn<{
  source: string
  error: string
}>()((params) =>
  Effect.gen(function* () {
    yield* Effect.logError(`Error in ${params.source}: ${params.error}`)
  }).pipe(
    Effect.withSpan('bar.error'),
    Effect.annotateLogs('source', params.source),
  ),
)
