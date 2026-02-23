/**
 * TMNL Bar — React Hooks
 *
 * Thin hooks that wire atoms to React lifecycle.
 * Clock tick, niri event subscription, initial data fetch.
 */

import { useEffect, useState } from 'react'
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import type { Atom } from '@effect-atom/atom-react'
import { listen } from '@tauri-apps/api/event'

import {
  timeAtom,
  workspacesAtom,
  windowsAtom,
  niriStatusAtom,
  refreshWorkspacesFn,
  refreshWindowsFn,
  sortedWorkspacesAtom,
  focusedWorkspaceAtom,
  clockAtom,
  systemHealthAtom,
  focusWorkspaceFn,
  focusedWindowAtom,
  activeWorkspaceCountAtom,
  logNiriEventFn,
  logNiriStatusFn,
  logBootPhaseFn,
  logErrorFn,
} from './atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Clock Tick — updates timeAtom every second
// ─────────────────────────────────────────────────────────────────────────────

export function useClockTick() {
  const setTime = useAtomSet(timeAtom)

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [setTime])
}

// ─────────────────────────────────────────────────────────────────────────────
// Niri Sync — fetches initial state + subscribes to events
// ─────────────────────────────────────────────────────────────────────────────

export function useNiriSync() {
  const setWorkspaces = useAtomSet(workspacesAtom)
  const setWindows = useAtomSet(windowsAtom)
  const setStatus = useAtomSet(niriStatusAtom)
  const refreshWorkspaces = useAtomSet(refreshWorkspacesFn)
  const refreshWindows = useAtomSet(refreshWindowsFn)
  const logNiriEvent = useAtomSet(logNiriEventFn)
  const logNiriStatus = useAtomSet(logNiriStatusFn)
  const logBoot = useAtomSet(logBootPhaseFn)
  const logError = useAtomSet(logErrorFn)

  useEffect(() => {
    // Initial fetch
    logBoot({ phase: 'niri.connect', detail: 'Starting niri sync' })
    setStatus('connecting')
    logNiriStatus({ from: 'disconnected', to: 'connecting' })
    refreshWorkspaces(undefined)
    refreshWindows(undefined)

    // Subscribe to niri events from Tauri backend
    let unlisten: (() => void) | null = null

    const setup = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const fn = await listen<Record<string, unknown>>('niri-event', (event) => {
          const payload = event.payload
          if (!payload) return

          if ('WorkspacesChanged' in payload) {
            const changed = payload['WorkspacesChanged'] as { workspaces: any[] }
            if (changed?.workspaces) {
              logNiriEvent({ type: 'WorkspacesChanged', detail: `${changed.workspaces.length} workspaces` })
              setWorkspaces(changed.workspaces)
            }
          }

          if ('WorkspaceActivated' in payload) {
            const activated = payload['WorkspaceActivated'] as { id?: number; focused?: boolean }
            logNiriEvent({ type: 'WorkspaceActivated', detail: `id=${activated?.id}` })
            refreshWorkspaces(undefined)
          }

          if ('WindowOpenedOrChanged' in payload) {
            const win = payload['WindowOpenedOrChanged'] as { window?: { title?: string; app_id?: string } }
            logNiriEvent({ type: 'WindowOpenedOrChanged', detail: `${win?.window?.app_id ?? '?'}` })
            refreshWindows(undefined)
          }

          if ('WindowClosed' in payload) {
            logNiriEvent({ type: 'WindowClosed' })
            refreshWindows(undefined)
          }
        })
        unlisten = fn
        setStatus('connected')
        logNiriStatus({ from: 'connecting', to: 'connected' })
        logBoot({ phase: 'niri.ready', detail: 'Event subscription active' })
      } catch (e) {
        console.error('Niri event subscription failed:', e)
        setStatus('error')
        logNiriStatus({ from: 'connecting', to: 'error' })
        logError({ source: 'niri.sync', error: String(e) })
      }
    }

    setup()
    return () => { unlisten?.() }
  }, [setWorkspaces, setWindows, setStatus, refreshWorkspaces, refreshWindows, logNiriEvent, logNiriStatus, logBoot, logError])
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Hooks — subscribe to derived atoms
// ─────────────────────────────────────────────────────────────────────────────

/** Sorted workspaces, always in index order */
export function useWorkspaces() {
  return useAtomValue(sortedWorkspacesAtom)
}

/** The focused workspace */
export function useFocusedWorkspace() {
  return useAtomValue(focusedWorkspaceAtom)
}

/** The focused window */
export function useFocusedWindow() {
  return useAtomValue(focusedWindowAtom)
}

/** Clock components (hours, minutes, day, pulseSeparator) */
export function useClock() {
  return useAtomValue(clockAtom)
}

/** System health status */
export function useSystemHealth() {
  return useAtomValue(systemHealthAtom)
}

/** Focus workspace action */
export function useFocusWorkspace() {
  return useAtomSet(focusWorkspaceFn)
}

/** Active workspace count */
export function useActiveWorkspaceCount() {
  return useAtomValue(activeWorkspaceCountAtom)
}

/** Command palette open state — listens to Rust `tmnl:palette-state` event */
export function usePaletteOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let unlisten: (() => void) | null = null

    listen<boolean>('tmnl:palette-state', (ev) => {
      setOpen(ev.payload)
    }).then((fn) => { unlisten = fn })

    return () => { unlisten?.() }
  }, [])

  return open
}

/** Panel workspace open state — listens to Rust `tmnl:panel-state` event (cross-process) */
export function usePanelOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let unlisten: (() => void) | null = null

    listen<boolean>('tmnl:panel-state', (ev) => {
      setOpen(ev.payload)
    }).then((fn) => { unlisten = fn })

    return () => { unlisten?.() }
  }, [])

  return open
}
