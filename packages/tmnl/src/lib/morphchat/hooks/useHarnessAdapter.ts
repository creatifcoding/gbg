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

import { useEffect, useRef, useState } from 'react'
import { Effect } from 'effect'
import {
  HarnessRuntime,
  HarnessRuntimeBrowserWebSocketDefault,
} from '@/lib/harness'
import type { HarnessRuntimeShape } from '@/lib/harness/HarnessRuntime'
import type { HarnessRole } from '@/lib/harness/schemas'
import { createHarnessAdapter } from '../adapters/harness-adapter'
import type { MorphChatAdapter } from '../schemas/adapter-types'
import type { HarnessAdapterExtensions } from '../adapters/harness-adapter'

// =============================================================================
// Resolve HarnessRuntime shape from the Effect Layer
// =============================================================================

/**
 * Yields the HarnessRuntimeShape from the Layer.
 * Effect.provide closes over the WebSocket transport —
 * the returned shape's methods have zero remaining requirements.
 */
const resolveRuntime = Effect.gen(function* () {
  return (yield* HarnessRuntime) as HarnessRuntimeShape
}).pipe(Effect.provide(HarnessRuntimeBrowserWebSocketDefault))

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
        // Step 1: Resolve HarnessRuntimeShape from the Layer
        const runtimeShape = await Effect.runPromise(resolveRuntime)

        if (disposed) return

        // Step 2: Create the adapter with the resolved shape
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
              setStatus('ready')
              setError(`Connection failed: ${connectErr}`)
            }
          }
        }
      } catch (err) {
        if (!disposed) {
          console.error('[useHarnessAdapter] layer resolution failed:', err)
          setStatus('error')
          setError(String(err))
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
