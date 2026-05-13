/**
 * TMNL Bar — Public API
 *
 * @example
 * ```tsx
 * import { useWorkspaces, useClock, useNiriSync } from '@/lib/bar'
 *
 * function BarRoot() {
 *   useNiriSync()   // Subscribe to niri events
 *   useClockTick()  // Start clock
 *   return <BarLayout>...</BarLayout>
 * }
 * ```
 */

// Types (Schema-backed)
export type { Workspace, NiriWindow, ConnectionStatus, NiriEvent } from './types'

// Atoms (state + derived + operations)
export {
  workspacesAtom,
  windowsAtom,
  niriStatusAtom,
  timeAtom,
  tmnlStatusAtom,
  sortedWorkspacesAtom,
  focusedWorkspaceAtom,
  activeWorkspaceCountAtom,
  focusedWindowAtom,
  clockAtom,
  systemHealthAtom,
  barRuntimeAtom,
  focusWorkspaceFn,
  refreshWorkspacesFn,
  refreshWindowsFn,
} from './atoms'

// Service
export { NiriService } from './niri'

// Hooks
export {
  useClockTick,
  useNiriSync,
  useWorkspaces,
  useFocusedWorkspace,
  useFocusedWindow,
  useClock,
  useSystemHealth,
  useFocusWorkspace,
  useActiveWorkspaceCount,
} from './hooks'
