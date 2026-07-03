/**
 * GetByShell — Public API
 *
 * Wayland layer-shell sidecar panel for TMNL.
 *
 * @example
 * ```tsx
 * import { useWorkspaces, useClock, useCompositorSync } from '@/lib/getbyshell'
 *
 * function ShellRoot() {
 *   useCompositorSync() // Subscribe to active compositor events (DriftWM or niri)
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
  compositorStatusAtom,
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
  logCompositorEventFn,
  logCompositorStatusFn,
  logBootPhaseFn,
  logErrorFn,
} from './atoms'

// Service
export { NiriService } from './niri'

// Hooks
export {
  useClockTick,
  useNiriSync,
  useCompositorSync,
  useWorkspaces,
  useFocusedWorkspace,
  useFocusedWindow,
  useClock,
  useSystemHealth,
  useFocusWorkspace,
  useActiveWorkspaceCount,
  usePaletteOpen,
  usePanelOpen,
} from './hooks'
