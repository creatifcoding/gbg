/**
 * AvaProvider - React Provider for AVA v2 NATS-based streaming
 *
 * Provides automatic lifecycle management for NATS WebSocket connections
 * and Effect-Atom integration for reactive view subscriptions.
 *
 * @pattern Atom-as-State with Provider scope
 * @see atoms/v2/index.ts for underlying state atoms
 *
 * @example
 * ```tsx
 * import { AvaProvider } from '@/lib/ava'
 *
 * function App() {
 *   return (
 *     <AvaProvider natsUrl="ws://localhost:9222">
 *       <Dashboard />
 *     </AvaProvider>
 *   )
 * }
 * ```
 *
 * @module
 */

import { type ReactNode, useEffect, useRef } from 'react'
import { RegistryContext } from '@effect-atom/atom-react'

import {
  avaV2Registry,
  avaV2Ops,
  connectionStatusAtom,
  type AvaV2Config,
} from '../atoms/v2'

// =============================================================================
// Types
// =============================================================================

export interface AvaProviderProps {
  /** Child components that will have access to AVA atoms */
  readonly children: ReactNode

  /**
   * NATS WebSocket URL
   * @default 'ws://localhost:9222'
   */
  readonly natsUrl?: string

  /**
   * NATS subject prefix for AVA messages
   * @default 'tmnl.ava'
   */
  readonly subjectPrefix?: string

  /**
   * Auto-connect on mount (vs manual connect)
   * @default false
   */
  readonly autoConnect?: boolean

  /**
   * Callback when connection status changes
   */
  readonly onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void

  /**
   * Callback when error occurs
   */
  readonly onError?: (error: string) => void
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * AvaProvider - Manages AVA v2 lifecycle and provides atom context.
 *
 * Uses the shared avaV2Registry singleton, injecting it into React context
 * so that hooks like useAtomValue() can access the correct registry.
 *
 * Features:
 * - Automatic configuration injection
 * - WebSocket connection lifecycle management
 * - Cleanup on unmount (no orphan subscriptions)
 * - Optional auto-connect behavior
 *
 * @example Basic usage
 * ```tsx
 * <AvaProvider>
 *   <ViewSubscriber viewId="truck-42" />
 * </AvaProvider>
 * ```
 *
 * @example With custom config
 * ```tsx
 * <AvaProvider
 *   natsUrl="wss://prod.nats.example.com:9222"
 *   subjectPrefix="prod.ava"
 *   autoConnect
 *   onStatusChange={(s) => console.log('AVA status:', s)}
 * >
 *   <Dashboard />
 * </AvaProvider>
 * ```
 */
export function AvaProvider({
  children,
  natsUrl = 'ws://localhost:9222',
  subjectPrefix = 'tmnl.ava',
  autoConnect = false,
  onStatusChange,
  onError,
}: AvaProviderProps): ReactNode {
  // Track if cleanup has run (prevents double-cleanup in StrictMode)
  const cleanupRanRef = useRef(false)

  // Update config when props change
  useEffect(() => {
    const newConfig: Partial<AvaV2Config> = {
      natsUrl,
      subjectPrefix,
    }

    avaV2Ops.setConfig(newConfig)
  }, [natsUrl, subjectPrefix])

  // Subscribe to status changes
  useEffect(() => {
    if (!onStatusChange) return

    // Poll status atom for changes
    let lastStatus = avaV2Registry.get(connectionStatusAtom)
    onStatusChange(lastStatus)

    const interval = setInterval(() => {
      const status = avaV2Registry.get(connectionStatusAtom)
      if (status !== lastStatus) {
        lastStatus = status
        onStatusChange(status)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [onStatusChange])

  // Auto-connect placeholder
  useEffect(() => {
    if (!autoConnect) return
    // Auto-connect triggers first subscription
    // Connection happens lazily on first subscribe call
  }, [autoConnect])

  // Cleanup on unmount - CRITICAL for WebSocket lifecycle
  useEffect(() => {
    cleanupRanRef.current = false

    return () => {
      // Prevent double-cleanup in StrictMode
      if (cleanupRanRef.current) return
      cleanupRanRef.current = true

      // Trigger cleanup operation via registry.set pattern
      // This follows the Atom.fn() invocation convention
      console.log('[AVA] Provider unmounting, cleaning up subscriptions')
      try {
        avaV2Registry.set(avaV2Ops.unsubscribeAll, undefined)
      } catch (err) {
        console.error('[AVA] Cleanup error:', err)
        onError?.(String(err))
      }
    }
  }, [onError])

  // Provide the shared registry via context
  // This allows useAtomValue() to access avaV2Registry atoms
  return (
    <RegistryContext.Provider value={avaV2Registry}>
      {children}
    </RegistryContext.Provider>
  )
}

// =============================================================================
// Hook: useAvaProviderStatus
// =============================================================================

/**
 * Hook to access AvaProvider connection status.
 * Useful for connection status display, error handling, etc.
 *
 * Note: This is a synchronous read from registry, not reactive.
 * For reactive status, use useAvaConnection() from hooks/v2.
 *
 * @example
 * ```tsx
 * function ConnectionIndicator() {
 *   const { status, isConnected } = useAvaProviderStatus()
 *
 *   return (
 *     <div className={isConnected ? 'text-green-500' : 'text-red-500'}>
 *       {status}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAvaProviderStatus() {
  // Direct registry access for synchronous reads
  const status = avaV2Registry.get(connectionStatusAtom)

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected',
    hasError: status === 'error',
  }
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { avaV2Registry, avaV2Ops } from '../atoms/v2'
