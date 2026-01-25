/**
 * WindowManagerService - Effect Service for Tauri Multi-Window Management
 *
 * Provides an Effect-native API for creating, focusing, and managing
 * testbed windows in Tauri.
 *
 * @module lib/tauri-windows/manager/service
 */

import { Context, Data, Effect, Layer } from 'effect'
import type { TestbedWindowConfig } from './schemas'

// NOTE: @tauri-apps/api imports are done dynamically to avoid crashes in non-Tauri environments

// =============================================================================
// Plain Types (for Tauri IPC - no Effect Schema wrapping)
// =============================================================================

/**
 * Window info as returned from Tauri
 */
export interface WindowInfo {
  /** Unique window label (e.g., "testbed-fermion") */
  label: string
  /** Testbed ID if this is a testbed window */
  testbed_id: string | null
  /** Window title */
  title: string
  /** Whether this is the main window */
  is_main: boolean
  /** Whether this window is currently focused */
  is_focused: boolean
}

// =============================================================================
// Error Types
// =============================================================================

export class WindowError extends Data.TaggedError('WindowError')<{
  readonly code: string
  readonly message: string
}> {}

export class TauriNotAvailable extends Data.TaggedError('TauriNotAvailable')<{
  readonly message: string
}> {}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Pool status info
 */
export interface PoolStatus {
  available: number
  target_size: number
}

/**
 * Window state info
 */
export interface WindowState {
  is_minimized: boolean
  is_maximized: boolean
  is_fullscreen: boolean
  is_focused: boolean
}

export interface IWindowManagerService {
  /**
   * Create a new testbed window or focus existing one (singleton behavior)
   * NOTE: Use openTestbedWindowFast for sub-second opening
   */
  readonly createTestbedWindow: (
    testbedId: string,
    config?: TestbedWindowConfig
  ) => Effect.Effect<string, WindowError | TauriNotAvailable>

  /**
   * Focus an existing window by label
   */
  readonly focusWindow: (
    label: string
  ) => Effect.Effect<void, WindowError | TauriNotAvailable>

  /**
   * Close a window by label
   */
  readonly closeWindow: (
    label: string
  ) => Effect.Effect<void, WindowError | TauriNotAvailable>

  /**
   * List all open windows
   */
  readonly listWindows: () => Effect.Effect<
    readonly WindowInfo[],
    WindowError | TauriNotAvailable
  >

  /**
   * Get or focus a testbed window (convenience method)
   * Uses FAST PATH (window pooling) for sub-second opening
   */
  readonly getOrFocusTestbedWindow: (
    testbedId: string,
    config?: TestbedWindowConfig
  ) => Effect.Effect<string, WindowError | TauriNotAvailable>

  /**
   * Emit an event to all windows
   */
  readonly emitToAll: <T>(
    event: string,
    payload: T
  ) => Effect.Effect<void, WindowError | TauriNotAvailable>

  /**
   * Emit an event to a specific window
   */
  readonly emitToWindow: <T>(
    label: string,
    event: string,
    payload: T
  ) => Effect.Effect<void, WindowError | TauriNotAvailable>

  // ==========================================================================
  // Window Pool Commands (for sub-second window opening)
  // ==========================================================================

  /**
   * Initialize the window pool. Call at app startup.
   * Pre-creates hidden windows for instant showing later.
   * @returns Number of windows created
   */
  readonly initWindowPool: () => Effect.Effect<number, WindowError | TauriNotAvailable>

  /**
   * Get current pool status
   */
  readonly getPoolStatus: () => Effect.Effect<PoolStatus, WindowError | TauriNotAvailable>

  /**
   * Open a testbed window using the FAST PATH (pooled window).
   * ~50ms vs 200-400ms for regular window creation.
   * Falls back to slow path if pool is empty.
   */
  readonly openTestbedWindowFast: (
    testbedId: string,
    config?: TestbedWindowConfig
  ) => Effect.Effect<string, WindowError | TauriNotAvailable>

  // ==========================================================================
  // Window Control Commands
  // ==========================================================================

  /** Minimize a window */
  readonly minimizeWindow: (label: string) => Effect.Effect<void, WindowError | TauriNotAvailable>

  /** Unminimize (restore) a window */
  readonly unminimizeWindow: (label: string) => Effect.Effect<void, WindowError | TauriNotAvailable>

  /** Maximize a window */
  readonly maximizeWindow: (label: string) => Effect.Effect<void, WindowError | TauriNotAvailable>

  /** Unmaximize (restore) a window */
  readonly unmaximizeWindow: (label: string) => Effect.Effect<void, WindowError | TauriNotAvailable>

  /** Set fullscreen state */
  readonly setFullscreen: (label: string, fullscreen: boolean) => Effect.Effect<void, WindowError | TauriNotAvailable>

  /** Toggle fullscreen state, returns new state */
  readonly toggleFullscreen: (label: string) => Effect.Effect<boolean, WindowError | TauriNotAvailable>

  /** Get window state (minimized, maximized, fullscreen, focused) */
  readonly getWindowState: (label: string) => Effect.Effect<WindowState, WindowError | TauriNotAvailable>
}

// =============================================================================
// Service Tag
// =============================================================================

export class WindowManagerService extends Context.Tag('tmnl/tauri-windows/WindowManagerService')<
  WindowManagerService,
  IWindowManagerService
>() {}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if we're running in a Tauri environment.
 * Tauri 2.0 uses __TAURI_INTERNALS__ instead of __TAURI__
 */
function isTauriAvailable(): boolean {
  if (typeof window === 'undefined') return false

  // Tauri 2.0 uses __TAURI_INTERNALS__
  const hasTauri2 = '__TAURI_INTERNALS__' in window
  // Tauri 1.x used __TAURI__
  const hasTauri1 = '__TAURI__' in window

  console.log('[WindowManager] Tauri detection:', { hasTauri2, hasTauri1 })

  return hasTauri2 || hasTauri1
}

/**
 * Wrap a Tauri invoke call in an Effect
 */
function invokeEffect<T>(
  cmd: string,
  args?: Record<string, unknown>
): Effect.Effect<T, WindowError | TauriNotAvailable> {
  return Effect.gen(function* () {
    console.log(`[WindowManager] invokeEffect: ${cmd}`, args)

    if (!isTauriAvailable()) {
      console.warn('[WindowManager] Tauri not available!')
      return yield* Effect.fail(
        new TauriNotAvailable({ message: 'Tauri is not available in this environment' })
      )
    }

    console.log(`[WindowManager] Tauri available, invoking ${cmd}...`)

    try {
      const result = yield* Effect.promise(async () => {
        const { invoke } = await import('@tauri-apps/api/core')
        return invoke<T>(cmd, args)
      })
      console.log(`[WindowManager] ${cmd} success:`, result)
      return result
    } catch (error) {
      console.error(`[WindowManager] ${cmd} failed:`, error)
      // Tauri returns errors as objects with code and message
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error
      ) {
        return yield* Effect.fail(
          new WindowError({
            code: String((error as { code: unknown }).code),
            message: String((error as { message: unknown }).message),
          })
        )
      }
      // Unknown error
      return yield* Effect.fail(
        new WindowError({
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : String(error),
        })
      )
    }
  })
}

// =============================================================================
// Live Implementation
// =============================================================================

const liveImpl: IWindowManagerService = {
  createTestbedWindow: (testbedId, config) =>
    invokeEffect<string>('create_testbed_window', {
      testbedId, // Tauri 2.0 auto-converts Rust snake_case to JS camelCase
      config: config ?? null,
    }),

  focusWindow: (label) =>
    invokeEffect<void>('focus_window', { label }),

  closeWindow: (label) =>
    invokeEffect<void>('close_window', { label }),

  listWindows: () =>
    invokeEffect<WindowInfo[]>('list_windows'),

  // Use FAST PATH by default for sub-second window opening
  getOrFocusTestbedWindow: (testbedId, config) =>
    invokeEffect<string>('open_testbed_window_fast', {
      testbedId, // Tauri 2.0 auto-converts Rust snake_case to JS camelCase
      config: config ?? null,
    }),

  emitToAll: (event, payload) =>
    invokeEffect<void>('emit_to_all_windows', { event, payload }),

  emitToWindow: (label, event, payload) =>
    invokeEffect<void>('emit_to_window', { label, event, payload }),

  // Pool commands
  initWindowPool: () =>
    invokeEffect<number>('init_window_pool'),

  getPoolStatus: () =>
    invokeEffect<PoolStatus>('get_pool_status'),

  openTestbedWindowFast: (testbedId, config) =>
    invokeEffect<string>('open_testbed_window_fast', {
      testbedId,
      config: config ?? null,
    }),

  // Window control commands
  minimizeWindow: (label) =>
    invokeEffect<void>('minimize_window', { label }),

  unminimizeWindow: (label) =>
    invokeEffect<void>('unminimize_window', { label }),

  maximizeWindow: (label) =>
    invokeEffect<void>('maximize_window', { label }),

  unmaximizeWindow: (label) =>
    invokeEffect<void>('unmaximize_window', { label }),

  setFullscreen: (label, fullscreen) =>
    invokeEffect<void>('set_fullscreen', { label, fullscreen }),

  toggleFullscreen: (label) =>
    invokeEffect<boolean>('toggle_fullscreen', { label }),

  getWindowState: (label) =>
    invokeEffect<WindowState>('get_window_state', { label }),
}

export const WindowManagerServiceLive = Layer.succeed(
  WindowManagerService,
  liveImpl
)

// =============================================================================
// Mock Implementation (for development without Tauri)
// =============================================================================

const mockWindows = new Map<string, WindowInfo>()

// Initialize with main window
mockWindows.set('main', {
  label: 'main',
  testbed_id: null,
  title: 'TMNL',
  is_main: true,
  is_focused: true,
})

const mockImpl: IWindowManagerService = {
  createTestbedWindow: (testbedId, config) =>
    Effect.sync(() => {
      const label = `testbed-${testbedId}`
      if (!mockWindows.has(label)) {
        mockWindows.set(label, {
          label,
          testbed_id: testbedId,
          title: config?.title ?? `TMNL - ${testbedId}`,
          is_main: false,
          is_focused: true,
        })
        console.log(`[Mock] Created window: ${label}`)
      } else {
        console.log(`[Mock] Focused existing window: ${label}`)
      }
      return label
    }),

  focusWindow: (label) =>
    Effect.sync(() => {
      console.log(`[Mock] Focus window: ${label}`)
    }),

  closeWindow: (label) =>
    Effect.gen(function* () {
      if (label === 'main') {
        return yield* Effect.fail(
          new WindowError({
            code: 'CANNOT_CLOSE_MAIN',
            message: 'Cannot close the main window',
          })
        )
      }
      mockWindows.delete(label)
      console.log(`[Mock] Closed window: ${label}`)
    }),

  listWindows: () =>
    Effect.sync(() => Array.from(mockWindows.values())),

  getOrFocusTestbedWindow: (testbedId, config) =>
    Effect.sync(() => {
      const label = `testbed-${testbedId}`
      if (!mockWindows.has(label)) {
        mockWindows.set(label, {
          label,
          testbed_id: testbedId,
          title: config?.title ?? `TMNL - ${testbedId}`,
          is_main: false,
          is_focused: true,
        })
        console.log(`[Mock] Created window: ${label}`)
      } else {
        console.log(`[Mock] Focused existing window: ${label}`)
      }
      return label
    }),

  emitToAll: (event, payload) =>
    Effect.sync(() => {
      console.log(`[Mock] Emit to all: ${event}`, payload)
    }),

  emitToWindow: (label, event, payload) =>
    Effect.sync(() => {
      console.log(`[Mock] Emit to ${label}: ${event}`, payload)
    }),

  // Pool commands (mock - no actual pooling)
  initWindowPool: () =>
    Effect.sync(() => {
      console.log('[Mock] Window pool initialized (mock - no actual pooling)')
      return 3 // Pretend we created 3 windows
    }),

  getPoolStatus: () =>
    Effect.sync(() => {
      console.log('[Mock] Get pool status')
      return { available: 3, target_size: 3 }
    }),

  openTestbedWindowFast: (testbedId, config) =>
    Effect.sync(() => {
      const label = `testbed-${testbedId}`
      if (!mockWindows.has(label)) {
        mockWindows.set(label, {
          label,
          testbed_id: testbedId,
          title: config?.title ?? `TMNL - ${testbedId}`,
          is_main: false,
          is_focused: true,
        })
        console.log(`[Mock] Opened window (fast): ${label}`)
      } else {
        console.log(`[Mock] Focused existing window: ${label}`)
      }
      return label
    }),

  // Window control commands (mock)
  minimizeWindow: (label) =>
    Effect.sync(() => {
      console.log(`[Mock] Minimize window: ${label}`)
    }),

  unminimizeWindow: (label) =>
    Effect.sync(() => {
      console.log(`[Mock] Unminimize window: ${label}`)
    }),

  maximizeWindow: (label) =>
    Effect.sync(() => {
      console.log(`[Mock] Maximize window: ${label}`)
    }),

  unmaximizeWindow: (label) =>
    Effect.sync(() => {
      console.log(`[Mock] Unmaximize window: ${label}`)
    }),

  setFullscreen: (label, fullscreen) =>
    Effect.sync(() => {
      console.log(`[Mock] Set fullscreen=${fullscreen} for window: ${label}`)
    }),

  toggleFullscreen: (label) =>
    Effect.sync(() => {
      console.log(`[Mock] Toggle fullscreen for window: ${label}`)
      return false // Mock always returns false
    }),

  getWindowState: (label) =>
    Effect.sync(() => {
      console.log(`[Mock] Get window state: ${label}`)
      return {
        is_minimized: false,
        is_maximized: false,
        is_fullscreen: false,
        is_focused: true,
      }
    }),
}

export const WindowManagerServiceMock = Layer.succeed(
  WindowManagerService,
  mockImpl
)

// =============================================================================
// Default Layer (auto-selects based on environment)
// =============================================================================

/**
 * Lazy layer that checks Tauri availability at runtime, not module load time.
 * This is critical because __TAURI__ is injected asynchronously.
 */
export const WindowManagerServiceDefault = Layer.effect(
  WindowManagerService,
  Effect.sync(() => {
    const useLive = isTauriAvailable()
    console.log(`[WindowManager] Using ${useLive ? 'LIVE' : 'MOCK'} implementation`)
    return useLive ? liveImpl : mockImpl
  })
)
