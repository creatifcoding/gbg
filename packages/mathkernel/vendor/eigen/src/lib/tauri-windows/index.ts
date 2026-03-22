/**
 * Tauri Multi-Window System
 *
 * Multi-window support for TMNL using Tauri's webview windows.
 *
 * @module lib/tauri-windows
 */

export * from './manager'

// Provider
export {
  TESTBED_WINDOW_PROVIDER_ID,
  TestbedWindowProvider,
  registerTestbedWindowProvider,
} from './TestbedWindowProvider'

// Cross-window sync
export {
  SYNC_EVENTS,
  broadcastScaleChange,
  broadcastStateChange,
  subscribeToScaleChanges,
  subscribeToStateChanges,
  useCrossWindowSync,
  ScaleSyncBridge,
  type ScaleSyncPayload,
  type StateSyncPayload,
  type ScaleChangeHandler,
  type StateChangeHandler,
} from './sync'

export { useScaleSync, useWindowLabel } from './sync/hooks'
