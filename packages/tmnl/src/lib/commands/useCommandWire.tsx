/**
 * TMNL Commands — React Hook for Command Wiring
 *
 * Wires all commands and keybindings to the hotkey system on mount.
 */

import { useContext, useEffect, useRef, useState } from 'react'
import { RegistryContext } from '@effect-atom/atom-react'
import { wireCommands, unwireCommands, type WireResult } from './wire'

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

    try {
      const wireResult = wireCommands(registry)
      setResult(wireResult)
      setIsWired(true)

      if (debug) {
        console.log('[useCommandWire] Wired commands:', {
          commands: wireResult.commandsRegistered,
          bindings: wireResult.bindingsRegistered,
          errors: wireResult.errors,
        })
      }

      onWired?.(wireResult)

      if (wireResult.errors.length > 0 && onError) {
        onError(wireResult.errors)
      }
    } catch (e) {
      console.error('[useCommandWire] Failed to wire commands:', e)
    }

    // No cleanup - commands stay registered for app lifetime
  }, [registry, debug, onWired, onError])

  const rewire = () => {
    unwireCommands(registry)
    const wireResult = wireCommands(registry)
    setResult(wireResult)

    if (debug) {
      console.log('[useCommandWire] Re-wired commands:', wireResult)
    }
  }

  const clear = () => {
    unwireCommands(registry)
    setIsWired(false)
    setResult(null)
    hasWired.current = false

    if (debug) {
      console.log('[useCommandWire] Cleared all commands')
    }
  }

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
