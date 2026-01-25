/**
 * Tauri IPC Event Wrapper
 *
 * Effect-native wrapper around @tauri-apps/api/event for window events.
 * Uses Effect.log for structured logging (swappable via Logger.replace Layer).
 *
 * @module lib/tauri-windows/manager/ipc
 */

import { Data, Effect, Stream, pipe } from 'effect'
import type { WindowInfo } from './service'
import { updateWindowsList, removeWindow } from './atoms'

// NOTE: @tauri-apps/api imports are done dynamically to avoid crashes in non-Tauri environments
type UnlistenFn = () => void

// =============================================================================
// Error Types
// =============================================================================

/**
 * IPC operation error
 */
export class IPCError extends Data.TaggedError('IPCError')<{
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Tauri not available error
 */
export class TauriNotAvailableIPC extends Data.TaggedError('TauriNotAvailableIPC')<{
  readonly operation: string
}> {}

// =============================================================================
// Logging Helpers
// =============================================================================

const logIPC = (operation: string, message: string) =>
  Effect.logDebug(`[IPC:${operation}] ${message}`)

const logIPCError = (operation: string, message: string, cause?: unknown) =>
  Effect.logError(`[IPC:${operation}] ${message}`).pipe(
    Effect.annotateLogs({ operation, cause: cause ?? 'none' })
  )

const logIPCWarning = (operation: string, message: string) =>
  Effect.logWarning(`[IPC:${operation}] ${message}`).pipe(
    Effect.annotateLogs({ operation })
  )

/**
 * Fail with IPCError and log the error
 */
export const failIPCError = (operation: string, message: string, cause?: unknown) =>
  pipe(
    logIPCError(operation, message, cause),
    Effect.flatMap(() => Effect.fail(new IPCError({ operation, message, cause })))
  )

/**
 * Fail with TauriNotAvailableIPC and log warning
 */
export const failTauriNotAvailable = (operation: string) =>
  pipe(
    logIPCWarning(operation, 'Tauri not available'),
    Effect.flatMap(() => Effect.fail(new TauriNotAvailableIPC({ operation })))
  )

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event names used by the window manager
 */
export const WindowEvents = {
  CREATED: 'window:created',
  FOCUSED: 'window:focused',
  CLOSED: 'window:closed',
  LIST_CHANGED: 'window:list-changed',
  NAVIGATE: 'window:navigate', // For pooled window navigation
  // Cross-window sync events
  THEME_CHANGED: 'theme:changed',
  SESSION_CHANGED: 'session:changed',
} as const

export type WindowEventName = (typeof WindowEvents)[keyof typeof WindowEvents]

// =============================================================================
// Check Tauri Availability
// =============================================================================

/**
 * Check if we're running in a Tauri environment.
 * Tauri 2.0 uses __TAURI_INTERNALS__, Tauri 1.x used __TAURI__
 */
function isTauriAvailable(): boolean {
  if (typeof window === 'undefined') return false
  // Tauri 2.0 uses __TAURI_INTERNALS__
  const hasTauri2 = '__TAURI_INTERNALS__' in window
  // Tauri 1.x used __TAURI__
  const hasTauri1 = '__TAURI__' in window
  return hasTauri2 || hasTauri1
}

// =============================================================================
// Listen Functions
// =============================================================================

/**
 * Listen to a Tauri event and return an Effect that subscribes.
 * Returns an unsubscribe function.
 */
export function listenEffect<T>(
  event: string,
  callback: (payload: T) => void
): Effect.Effect<UnlistenFn, IPCError | TauriNotAvailableIPC> {
  return pipe(
    Effect.sync(() => isTauriAvailable()),
    Effect.flatMap((available) =>
      available
        ? pipe(
            logIPC('listen', `Subscribing to ${event}`),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: async () => {
                  const { listen } = await import('@tauri-apps/api/event')
                  return listen<T>(event, (e: { payload: T }) => callback(e.payload))
                },
                catch: (error) => new IPCError({
                  operation: 'listen',
                  message: `Failed to listen to ${event}`,
                  cause: error,
                }),
              })
            ),
            Effect.tap(() => logIPC('listen', `Subscribed to ${event}`))
          )
        : pipe(
            logIPC('listen', `Skipping ${event} (no Tauri)`),
            Effect.map(() => (() => {}) as UnlistenFn)
          )
    )
  )
}

/**
 * Create a Stream from a Tauri event
 */
export function eventStream<T>(event: string): Stream.Stream<T, IPCError> {
  return Stream.async<T, IPCError>((emitFn) => {
    if (!isTauriAvailable()) {
      return
    }

    let unlisten: UnlistenFn | undefined

    // Use dynamic import for Tauri API
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<T>(event, (e: { payload: T }) => {
          emitFn.single(e.payload)
        })
      )
      .then((fn: UnlistenFn) => {
        unlisten = fn
      })
      .catch((error: unknown) => {
        emitFn.fail(new IPCError({
          operation: 'eventStream',
          message: `Failed to create stream for ${event}`,
          cause: error,
        }))
      })

    // Cleanup on stream finalization
    return Effect.sync(() => {
      unlisten?.()
    })
  })
}

// =============================================================================
// Emit Functions
// =============================================================================

/**
 * Emit an event to all windows
 */
export function emitEffect<T>(event: string, payload: T): Effect.Effect<void, IPCError> {
  return pipe(
    Effect.sync(() => isTauriAvailable()),
    Effect.flatMap((available) =>
      available
        ? pipe(
            Effect.tryPromise({
              try: async () => {
                const { emit } = await import('@tauri-apps/api/event')
                await emit(event, payload)
              },
              catch: (error) => new IPCError({
                operation: 'emit',
                message: `Failed to emit ${event}`,
                cause: error,
              }),
            }),
            Effect.tap(() => logIPC('emit', `Emitted ${event}`))
          )
        : logIPC('emit', `[Mock] Would emit: ${event}`)
    )
  )
}

// =============================================================================
// Window Event Subscriptions
// =============================================================================

/** Error type for window event subscriptions */
export type IPCErrors = IPCError | TauriNotAvailableIPC

/**
 * Subscribe to all window manager events.
 * Updates the atom state automatically.
 *
 * @returns Effect that returns an unsubscribe function
 */
export function subscribeToWindowEvents(): Effect.Effect<() => void, IPCErrors> {
  return pipe(
    Effect.sync(() => isTauriAvailable()),
    Effect.flatMap((available) =>
      available
        ? Effect.gen(function* () {
            yield* logIPC('subscribeToWindowEvents', 'Setting up window event listeners')

            const unlisteners: UnlistenFn[] = []

            // Listen for window list changes
            const unlistenListChanged = yield* listenEffect<WindowInfo[]>(
              WindowEvents.LIST_CHANGED,
              (windows) => updateWindowsList(windows)
            )
            unlisteners.push(unlistenListChanged)

            // Listen for window created
            const unlistenCreated = yield* listenEffect<string>(
              WindowEvents.CREATED,
              () => {} // The list-changed event will update the full list
            )
            unlisteners.push(unlistenCreated)

            // Listen for window closed
            const unlistenClosed = yield* listenEffect<string>(
              WindowEvents.CLOSED,
              (label) => removeWindow(label)
            )
            unlisteners.push(unlistenClosed)

            // Listen for window focused
            const unlistenFocused = yield* listenEffect<string>(
              WindowEvents.FOCUSED,
              () => {} // Focused event logged by listenEffect
            )
            unlisteners.push(unlistenFocused)

            yield* logIPC('subscribeToWindowEvents', `Subscribed to ${unlisteners.length} events`)

            // Return combined unsubscribe function
            return () => {
              for (const unlisten of unlisteners) {
                unlisten()
              }
            }
          })
        : pipe(
            logIPC('subscribeToWindowEvents', 'Skipped (no Tauri)'),
            Effect.map(() => () => {})
          )
    )
  )
}

// =============================================================================
// Cross-Window Sync Events
// =============================================================================

/**
 * Emit a theme change event to all windows
 */
export function emitThemeChanged(theme: 'light' | 'dark'): Effect.Effect<void, IPCError> {
  return emitEffect(WindowEvents.THEME_CHANGED, { theme })
}

/**
 * Subscribe to theme changes from other windows
 */
export function subscribeToThemeChanges(
  callback: (theme: 'light' | 'dark') => void
): Effect.Effect<UnlistenFn, IPCErrors> {
  return listenEffect<{ theme: 'light' | 'dark' }>(
    WindowEvents.THEME_CHANGED,
    (payload) => callback(payload.theme)
  )
}

/**
 * Session info for cross-window sync
 */
export interface SessionInfo {
  id: string | null
  userId: string | null
}

/**
 * Emit a session change event to all windows
 */
export function emitSessionChanged(session: SessionInfo): Effect.Effect<void, IPCError> {
  return emitEffect(WindowEvents.SESSION_CHANGED, session)
}

/**
 * Subscribe to session changes from other windows
 */
export function subscribeToSessionChanges(
  callback: (session: SessionInfo) => void
): Effect.Effect<UnlistenFn, IPCErrors> {
  return listenEffect<SessionInfo>(WindowEvents.SESSION_CHANGED, callback)
}

// =============================================================================
// Module-level cache for Tauri webview API
// =============================================================================

/** Cached webview window getter (populated on first use) */
let cachedGetCurrentWebviewWindow: (() => { label: string }) | null = null

/**
 * Lazily load and cache the Tauri webview API
 */
const loadWebviewAPI = Effect.tryPromise({
  try: async () => {
    if (cachedGetCurrentWebviewWindow) return cachedGetCurrentWebviewWindow
    const mod = await import('@tauri-apps/api/webviewWindow')
    cachedGetCurrentWebviewWindow = mod.getCurrentWebviewWindow
    return cachedGetCurrentWebviewWindow
  },
  catch: (error) => new IPCError({
    operation: 'loadWebviewAPI',
    message: 'Failed to load Tauri webview API',
    cause: error,
  }),
})

/**
 * Get current window label
 * Returns null if not in Tauri environment or on failure
 */
export function getCurrentWindowLabel(): Effect.Effect<string | null> {
  return pipe(
    Effect.sync(() => isTauriAvailable()),
    Effect.flatMap((available) =>
      available
        ? pipe(
            loadWebviewAPI,
            Effect.map((getWindow) => getWindow().label),
            Effect.catchAll(() => Effect.succeed(null as string | null))
          )
        : Effect.succeed(null)
    )
  )
}

/**
 * Get current window label (alias for getCurrentWindowLabel)
 * @deprecated Use getCurrentWindowLabel instead - both are now async-safe
 */
export const getCurrentWindowLabelAsync = getCurrentWindowLabel
