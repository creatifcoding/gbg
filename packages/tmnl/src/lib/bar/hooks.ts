/**
 * TMNL Bar — React Hooks
 *
 * Thin hooks that wire atoms to React lifecycle.
 * Clock tick, niri event subscription, initial data fetch.
 */

import { useEffect } from 'react'
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import type { Atom } from '@effect-atom/atom-react'

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

  useEffect(() => {
    // Initial fetch
    setStatus('connecting')
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
              setWorkspaces(changed.workspaces)
            }
          }

          if ('WorkspaceActivated' in payload) {
            // Re-fetch full state on activation for consistency
            refreshWorkspaces(undefined)
          }

          if ('WindowOpenedOrChanged' in payload || 'WindowClosed' in payload) {
            refreshWindows(undefined)
          }
        })
        unlisten = fn
        setStatus('connected')
      } catch (e) {
        console.error('Niri event subscription failed:', e)
        setStatus('error')
      }
    }

    setup()
    return () => { unlisten?.() }
  }, [setWorkspaces, setWindows, setStatus, refreshWorkspaces, refreshWindows])
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
