/**
 * Tauri Multi-Window Manager
 *
 * Provides Effect-native APIs for managing multiple Tauri windows.
 *
 * ## Features
 *
 * - Create testbed windows with singleton behavior
 * - Cross-window event emission
 * - Reactive state via Effect-Atom
 * - IPC event subscriptions
 *
 * @module lib/tauri-windows/manager
 */

// Service
export {
  WindowManagerService,
  WindowManagerServiceLive,
  WindowManagerServiceMock,
  WindowManagerServiceDefault,
  WindowError,
  TauriNotAvailable,
  type IWindowManagerService,
  type WindowInfo,
  type PoolStatus,
  type WindowState,
} from './service'

// Schemas
export {
  type TestbedWindowConfig,
  getWindowLabel,
  getTestbedIdFromLabel,
} from './schemas'

// Atoms
export {
  windowManagerRegistry,
  openWindowsAtom,
  currentWindowLabelAtom,
  isMainWindowAtom,
  navigatedTestbedAtom,
  windowListAtom,
  windowCountAtom,
  testbedWindowsAtom,
  getWindowInfoAtom,
  isTestbedOpenAtom,
  updateWindowsList,
  addWindow,
  removeWindow,
  setCurrentWindowLabel,
  setNavigatedTestbed,
} from './atoms'

// IPC
export {
  // Error types
  IPCError,
  TauriNotAvailableIPC,
  type IPCErrors,
  // Error helpers
  failIPCError,
  failTauriNotAvailable,
  // Event constants
  WindowEvents,
  type WindowEventName,
  // Core functions
  listenEffect,
  eventStream,
  emitEffect,
  subscribeToWindowEvents,
  // Theme sync
  emitThemeChanged,
  subscribeToThemeChanges,
  // Session sync
  emitSessionChanged,
  subscribeToSessionChanges,
  type SessionInfo,
  // Window label utilities
  getCurrentWindowLabel,
  getCurrentWindowLabelAsync,
} from './ipc'
