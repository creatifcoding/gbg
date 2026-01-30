/**
 * TMNL Commands — React Hook for Command Wiring
 *
 * Wires all commands and keybindings to the hotkey system on mount.
 * Uses Effect for error handling — no try/catch blocks.
 */

import { useContext, useEffect, useRef, useState, useCallback } from 'react'
import { Effect, Data } from 'effect'
import { RegistryContext } from '@effect-atom/atom-react'
import {
  wireCommandsEffect,
  unwireCommandsEffect,
  type WireResult,
  type RegistryLike,
} from './wire'
import { registerCommandProvider } from './CommandProvider'
import { registerTestbedWindowProvider, WindowManagerService, WindowManagerServiceDefault } from '@/lib/tauri-windows'

// ─────────────────────────────────────────────────────────────────────────────
// Error Types (Tagged for Effect.catchTag)
// ─────────────────────────────────────────────────────────────────────────────

/** Error during CommandProvider registration */
export class ProviderRegistrationError extends Data.TaggedError('ProviderRegistrationError')<{
  readonly cause: unknown
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Effect-Based Provider Registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register CommandProvider with minibuffer.
 * Wrapped in Effect.try for consistent error handling.
 */
const registerProviderEffect: Effect.Effect<void, ProviderRegistrationError> = Effect.try({
  try: () => registerCommandProvider(),
  catch: (cause) => new ProviderRegistrationError({ cause }),
})

/**
 * Register TestbedWindowProvider with minibuffer.
 * Enables Ctrl+Shift+N quick-switcher for testbed windows.
 */
const registerTestbedProviderEffect: Effect.Effect<void, ProviderRegistrationError> = Effect.try({
  try: () => registerTestbedWindowProvider(),
  catch: (cause) => new ProviderRegistrationError({ cause }),
})

export interface UseCommandWireOptions {
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean

  /**
   * Called when wiring is complete
   */
  onWired?: (result: WireResult) => void

  /**
   * Called on wiring errors
   */
  onError?: (errors: WireResult['errors']) => void
}

export interface UseCommandWireResult {
  /**
   * Whether commands have been wired
   */
  isWired: boolean

  /**
   * The wiring result (null until wired)
   */
  result: WireResult | null

  /**
   * Re-wire commands (useful after dynamic command registration)
   */
  rewire: () => void

  /**
   * Clear all wired commands
   */
  clear: () => void
}

/**
 * Hook that wires command system commands to the hotkey system.
 *
 * Call this once at the root of your app, after importing command definitions.
 *
 * @example
 * ```tsx
 * import '@/lib/commands' // Import to register commands
 *
 * function App() {
 *   const { isWired, result } = useCommandWire({
 *     debug: true,
 *     onWired: (r) => console.log(`Wired ${r.commandsRegistered} commands`),
 *   })
 *
 *   if (!isWired) return <div>Loading...</div>
 *
 *   return <YourApp />
 * }
 * ```
 */
export function useCommandWire(options: UseCommandWireOptions = {}): UseCommandWireResult {
  const { debug = false, onWired, onError } = options
  const registry = useContext(RegistryContext)
  const [isWired, setIsWired] = useState(false)
  const [result, setResult] = useState<WireResult | null>(null)
  const hasWired = useRef(false)

  useEffect(() => {
    // Only wire once
    if (hasWired.current) return
    hasWired.current = true

    // Effect-based wiring pipeline — no try/catch
    const wireEffect = Effect.gen(function* () {
      // Register CommandProvider with minibuffer FIRST
      // This ensures M-x completion works via CommandService.executeInteractive()
      yield* registerProviderEffect

      // Register TestbedWindowProvider for Ctrl+Shift+N quick-switcher
      yield* registerTestbedProviderEffect

      if (debug) {
        yield* Effect.log('[useCommandWire] Registered CommandProvider and TestbedWindowProvider with minibuffer')
      }

      // Check window pool health (diagnostic - runs after 1.5s to allow Rust pool init)
      setTimeout(() => {
        const checkPool = Effect.gen(function* () {
          const svc = yield* WindowManagerService
          const status = yield* svc.getPoolStatus()
          console.log(`[WindowPool] 🎱 Status: ${status.available}/${status.target_size} windows available`)
          if (status.available === 0) {
            console.error(`[WindowPool] ❌ Pool EMPTY - fast path will not work!`)
          } else if (status.available < status.target_size) {
            console.warn(`[WindowPool] ⚠️ Pool partially filled (${status.available}/${status.target_size})`)
          } else {
            console.log(`[WindowPool] ✅ Pool healthy - fast path ready`)
          }
        }).pipe(
          Effect.provide(WindowManagerServiceDefault),
          Effect.catchAll((e) => {
            console.warn('[WindowPool] Could not check pool status:', e)
            return Effect.void
          })
        )
        Effect.runPromise(checkPool)
      }, 1500)

      // Then wire commands to hotkey system
      const wireResult = yield* wireCommandsEffect(registry as RegistryLike)

      if (debug) {
        yield* Effect.log('[useCommandWire] Wired commands:', {
          commands: wireResult.commandsRegistered,
          bindings: wireResult.bindingsRegistered,
          errors: wireResult.errors,
        })
      }

      return wireResult
    }).pipe(
      // Handle provider registration errors
      Effect.catchTag('ProviderRegistrationError', (err) =>
        Effect.gen(function* () {
          yield* Effect.logError('[useCommandWire] Failed to register CommandProvider', err.cause)
          // Return empty result on provider failure
          return { commandsRegistered: 0, bindingsRegistered: 0, errors: [] } as WireResult
        })
      ),
      // Handle any unexpected errors
      Effect.catchAll((err) =>
        Effect.gen(function* () {
          yield* Effect.logError('[useCommandWire] Unexpected error during wiring', err)
          return { commandsRegistered: 0, bindingsRegistered: 0, errors: [] } as WireResult
        })
      )
    )

    // Run the Effect and handle the result
    Effect.runPromise(wireEffect).then((wireResult) => {
      setResult(wireResult)
      setIsWired(true)

      onWired?.(wireResult)

      if (wireResult.errors.length > 0 && onError) {
        onError(wireResult.errors)
      }
    })

    // No cleanup - commands stay registered for app lifetime
  }, [registry, debug, onWired, onError])

  const rewire = useCallback(() => {
    // Effect-based rewiring
    const rewireEffect = Effect.gen(function* () {
      yield* unwireCommandsEffect(registry as RegistryLike)
      const wireResult = yield* wireCommandsEffect(registry as RegistryLike)

      if (debug) {
        yield* Effect.log('[useCommandWire] Re-wired commands:', wireResult)
      }

      return wireResult
    })

    Effect.runPromise(rewireEffect).then((wireResult) => {
      setResult(wireResult)
    })
  }, [registry, debug])

  const clear = useCallback(() => {
    // Effect-based clearing
    Effect.runSync(unwireCommandsEffect(registry as RegistryLike))

    setIsWired(false)
    setResult(null)
    hasWired.current = false

    if (debug) {
      console.log('[useCommandWire] Cleared all commands')
    }
  }, [registry, debug])

  return { isWired, result, rewire, clear }
}

/**
 * HOC version for class components or non-hook contexts.
 */
export function withCommandWire<P extends object>(
  Component: React.ComponentType<P>,
  options?: UseCommandWireOptions
): React.FC<P> {
  return function WithCommandWire(props: P) {
    const { isWired } = useCommandWire(options)

    if (!isWired) {
      return null // Or a loading spinner
    }

    return <Component {...props} />
  }
}
