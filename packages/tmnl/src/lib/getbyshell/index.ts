/**
 * GetByShell — Public API
 *
 * Wayland layer-shell sidecar panel for TMNL.
 *
 * @example
 * ```tsx
 * import { useWorkspaces, useClock, useNiriSync } from '@/lib/getbyshell'
 *
 * function ShellRoot() {
 *   useNiriSync()   // Subscribe to niri events
 *   useClockTick()  // Start clock
 *   return <BarLayout>...</BarLayout>
 * }
 * ```
 */

// Types (Schema-backed)
export type { Workspace, NiriWindow, ConnectionStatus, NiriEvent } from './types'

// Atoms (state + derived + operations + logging fns)
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
  // Logging fns
  logPopoverOpenFn,
  logPopoverCloseFn,
  logModalOpenFn,
  logModalCloseFn,
  logInputRegionFn,
  logNiriEventFn,
  logNiriStatusFn,
  logBootPhaseFn,
  logErrorFn,
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
  usePaletteOpen,
} from './hooks'
