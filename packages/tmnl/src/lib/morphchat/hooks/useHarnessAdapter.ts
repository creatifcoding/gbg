/**
 * useHarnessAdapter — Creates a live MorphChat adapter backed by HarnessRuntime.
 *
 * Resolves the HarnessRuntime service from the Effect Layer (WebSocket transport),
 * creates a harness adapter, and manages its lifecycle (connect on mount,
 * dispose on unmount).
 *
 * Usage:
 * ```tsx
 * const { adapter, status, error } = useHarnessAdapter({
 *   nodeId: 'cop-assistant',
 *   role: 'operator',
 * })
 *
 * if (!adapter) return <Connecting... />
 * return <MorphChat.Surface spec={preset} adapter={adapter} />
 * ```
 *
 * @module morphchat/hooks/useHarnessAdapter
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { Atom } from '@effect-atom/atom'
import { Effect } from 'effect'
import {
  HarnessRuntime,
  HarnessRuntimeBrowserWebSocketDefault,
} from '@/lib/harness'
import type { HarnessRuntimeShape } from '@/lib/harness/HarnessRuntime'
import type { HarnessRole } from '@/lib/harness/schemas'
import {
  createHarnessAdapter,
} from '../adapters/harness-adapter'
import type { MorphChatAdapter } from '../schemas/adapter-types'
import type { HarnessAdapterExtensions } from '../adapters/harness-adapter'

// =============================================================================
// Shared Layer Runtime — resolves HarnessRuntime once, reused across hooks
// =============================================================================

const harnessRuntimeAtom = Atom.runtime(HarnessRuntimeBrowserWebSocketDefault)

/**
 * Resolve the HarnessRuntime shape from the Effect Layer.
 * This is an atom-fn — call it and Effect.runPromise the result.
 */
const resolveHarnessRuntime = harnessRuntimeAtom.fn(
  Effect.gen(function* () {
    return (yield* HarnessRuntime) as HarnessRuntimeShape
  }),
)

// =============================================================================
// Hook Config
// =============================================================================

export interface UseHarnessAdapterConfig {
  /** Node ID for session targeting */
  readonly nodeId: string
  /** Harness role */
  readonly role: HarnessRole
  /** Agent display name */
  readonly agentName?: string
  /** Auto-connect on mount */
  readonly autoConnect?: boolean
  /** Adapter ID override */
  readonly adapterId?: string
  /** Human label */
  readonly label?: string
}

// =============================================================================
// Hook Result
// =============================================================================

export type HarnessAdapterStatus = 'resolving' | 'ready' | 'connecting' | 'connected' | 'error'

export interface UseHarnessAdapterResult {
  /** The adapter — null while the Effect layer is resolving */
  readonly adapter: (MorphChatAdapter & HarnessAdapterExtensions) | null
  /** Current resolution status */
  readonly status: HarnessAdapterStatus
  /** Error message if resolution/connection failed */
  readonly error: string | null
}

// =============================================================================
// Hook
// =============================================================================

export function useHarnessAdapter(config: UseHarnessAdapterConfig): UseHarnessAdapterResult {
  const {
    nodeId,
    role,
    agentName = 'Agent',
    autoConnect = true,
    adapterId,
    label,
  } = config

  const [status, setStatus] = useState<HarnessAdapterStatus>('resolving')
  const [error, setError] = useState<string | null>(null)
  const adapterRef = useRef<(MorphChatAdapter & HarnessAdapterExtensions) | null>(null)
  const [adapterReady, setAdapterReady] = useState(false)

  useEffect(() => {
    let disposed = false

    async function init() {
      try {
        // Step 1: Resolve the HarnessRuntime shape from the Effect Layer
        const runtimeShape = await Effect.runPromise(resolveHarnessRuntime())

        if (disposed) return

        // Step 2: Create the harness adapter with the resolved shape
        const adapter = createHarnessAdapter({
          runtime: runtimeShape,
          nodeId,
          role,
          agentName,
          adapterId,
          label,
          autoReconnect: true,
          maxReconnectAttempts: 5,
        })

        adapterRef.current = adapter
        setStatus('ready')
        setAdapterReady(true)

        // Step 3: Auto-connect if configured
        if (autoConnect) {
          setStatus('connecting')
          try {
            await Effect.runPromise(adapter.connect())
            if (!disposed) setStatus('connected')
          } catch (connectErr) {
            if (!disposed) {
              console.error('[useHarnessAdapter] connect failed:', connectErr)
              // Adapter is still usable — consumer can retry via adapter.reconnect()
              setStatus('ready')
              setError(`Connection failed: ${connectErr}`)
            }
          }
        }
      } catch (err) {
        if (!disposed) {
          console.error('[useHarnessAdapter] layer resolution failed:', err)
          setStatus('error')
          setError(`Failed to resolve HarnessRuntime: ${err}`)
        }
      }
    }

    init()

    return () => {
      disposed = true
      if (adapterRef.current) {
        Effect.runPromise(adapterRef.current.dispose()).catch(() => {})
        adapterRef.current = null
      }
    }
  }, [nodeId, role, agentName, autoConnect, adapterId, label])

  return {
    adapter: adapterReady ? adapterRef.current : null,
    status,
    error,
  }
}
