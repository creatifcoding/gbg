/**
 * LiveDataProvider — React integration for GEOINT real-time data
 *
 * Provides React context for managing live data subscriptions.
 * Automatically cleans up subscriptions on unmount.
 *
 * Usage:
 * ```tsx
 * <LiveDataProvider
 *   autoConnect={true}
 *   onConnectionChange={(state) => console.log('State:', state)}
 * >
 *   <GeointDashboard />
 * </LiveDataProvider>
 * ```
 *
 * @module geoint/streaming/LiveDataProvider
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type FC,
} from 'react'
import { Effect } from 'effect'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import {
  LiveDataServiceTag,
  LiveDataServiceLive,
  type ConnectionState,
  type LiveSubscriptionConfig,
  type LiveSubscription,
  type StreamEventHandlers,
  viewportLiveConfig,
  defaultStreamHandlers,
} from './LiveDataService'
import {
  geointRegistry,
  streamingStateAtom,
  viewportBoundsAtom,
  type StreamingState,
} from '../atoms'
import type { IntelSource } from '../schemas'

// =============================================================================
// REGISTRY PROVIDER
// =============================================================================

/**
 * Internal provider that supplies geointRegistry to useAtomValue hooks.
 */
const GeointRegistryProvider: FC<{ children: ReactNode }> = ({ children }) => (
  <RegistryContext.Provider value={geointRegistry}>
    {children}
  </RegistryContext.Provider>
)

// =============================================================================
// CONTEXT
// =============================================================================

export interface LiveDataContextValue {
  /** Current connection state */
  readonly connectionState: ConnectionState
  /** Active subscriptions */
  readonly subscriptions: readonly LiveSubscription[]
  /** Subscribe to live data */
  readonly subscribe: (
    config: LiveSubscriptionConfig,
    handlers?: StreamEventHandlers
  ) => Promise<LiveSubscription | null>
  /** Unsubscribe from a stream */
  readonly unsubscribe: (subscriptionId: string) => Promise<void>
  /** Unsubscribe from all streams */
  readonly unsubscribeAll: () => Promise<void>
  /** Manually reconnect */
  readonly reconnect: () => Promise<void>
  /** Whether auto-connect is enabled */
  readonly autoConnect: boolean
  /**
   * Get current streaming state (sync).
   * For reactive streaming state, use useIsStreaming() or useLastUpdate() hooks.
   */
  readonly getStreamingState: () => StreamingState
}

const LiveDataContext = createContext<LiveDataContextValue | null>(null)

/**
 * Hook to access live data context.
 */
export function useLiveData(): LiveDataContextValue {
  const ctx = useContext(LiveDataContext)
  if (!ctx) {
    throw new Error('useLiveData must be used within LiveDataProvider')
  }
  return ctx
}

/**
 * Hook to check if streaming is active.
 * Must be used within LiveDataProvider.
 */
export function useIsStreaming(): boolean {
  const streamingState = useAtomValue(streamingStateAtom)
  return streamingState.isStreaming
}

/**
 * Hook to get last update timestamp.
 * Must be used within LiveDataProvider.
 */
export function useLastUpdate(): number | null {
  const streamingState = useAtomValue(streamingStateAtom)
  return streamingState.lastUpdate
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

export interface LiveDataProviderProps {
  readonly children: ReactNode
  /** Auto-connect to live stream on mount */
  readonly autoConnect?: boolean
  /** Sources to subscribe to (empty = all) */
  readonly sources?: IntelSource[]
  /** Custom event handlers */
  readonly handlers?: StreamEventHandlers
  /** Callback when connection state changes */
  readonly onConnectionChange?: (state: ConnectionState) => void
  /** Callback when data is received */
  readonly onData?: (count: number) => void
}

/**
 * LiveDataProvider — Manages real-time data subscriptions for GEOINT.
 */
export const LiveDataProvider: FC<LiveDataProviderProps> = ({
  children,
  autoConnect = false,
  sources = [],
  handlers,
  onConnectionChange,
  onData,
}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [subscriptions, setSubscriptions] = useState<LiveSubscription[]>([])
  const activeSubscriptionRef = useRef<string | null>(null)
  // Use sync registry access - not hook-based for internal state
  const getStreamingState = useCallback((): StreamingState => {
    return geointRegistry.get(streamingStateAtom)
  }, [])

  // Merge handlers
  const mergedHandlers: StreamEventHandlers = {
    ...defaultStreamHandlers,
    ...handlers,
    onConnect: () => {
      setConnectionState('connected')
      onConnectionChange?.('connected')
      handlers?.onConnect?.()
      defaultStreamHandlers.onConnect?.()
    },
    onDisconnect: () => {
      setConnectionState('disconnected')
      onConnectionChange?.('disconnected')
      handlers?.onDisconnect?.()
      defaultStreamHandlers.onDisconnect?.()
    },
    onError: (error) => {
      setConnectionState('error')
      onConnectionChange?.('error')
      handlers?.onError?.(error)
      defaultStreamHandlers.onError?.(error)
    },
    onReconnect: (attempt) => {
      setConnectionState('reconnecting')
      onConnectionChange?.('reconnecting')
      handlers?.onReconnect?.(attempt)
      defaultStreamHandlers.onReconnect?.(attempt)
    },
    onData: (event) => {
      handlers?.onData?.(event)
      defaultStreamHandlers.onData?.(event)
      onData?.(1)
    },
  }

  // Subscribe function
  const subscribe = useCallback(
    async (
      config: LiveSubscriptionConfig,
      customHandlers?: StreamEventHandlers
    ): Promise<LiveSubscription | null> => {
      try {
        setConnectionState('connecting')

        const program = Effect.gen(function* () {
          const service = yield* LiveDataServiceTag
          return yield* service.subscribe(
            config,
            customHandlers ?? mergedHandlers
          )
        }).pipe(Effect.provide(LiveDataServiceLive))

        const subscription = await Effect.runPromise(program)

        setSubscriptions((prev) => [...prev, subscription])
        activeSubscriptionRef.current = subscription.id

        return subscription
      } catch (error) {
        console.error('[LiveDataProvider] Subscribe failed:', error)
        setConnectionState('error')
        return null
      }
    },
    [mergedHandlers]
  )

  // Unsubscribe function
  const unsubscribe = useCallback(async (subscriptionId: string): Promise<void> => {
    try {
      const program = Effect.gen(function* () {
        const service = yield* LiveDataServiceTag
        yield* service.unsubscribe(subscriptionId)
      }).pipe(Effect.provide(LiveDataServiceLive))

      await Effect.runPromise(program)

      setSubscriptions((prev) => prev.filter((s) => s.id !== subscriptionId))
      if (activeSubscriptionRef.current === subscriptionId) {
        activeSubscriptionRef.current = null
        setConnectionState('disconnected')
      }
    } catch (error) {
      console.error('[LiveDataProvider] Unsubscribe failed:', error)
    }
  }, [])

  // Unsubscribe all function
  const unsubscribeAll = useCallback(async (): Promise<void> => {
    try {
      const program = Effect.gen(function* () {
        const service = yield* LiveDataServiceTag
        yield* service.unsubscribeAll()
      }).pipe(Effect.provide(LiveDataServiceLive))

      await Effect.runPromise(program)

      setSubscriptions([])
      activeSubscriptionRef.current = null
      setConnectionState('disconnected')
    } catch (error) {
      console.error('[LiveDataProvider] Unsubscribe all failed:', error)
    }
  }, [])

  // Reconnect function
  const reconnect = useCallback(async (): Promise<void> => {
    // Get current viewport bounds
    const bounds = geointRegistry.get(viewportBoundsAtom)
    const config = viewportLiveConfig(bounds as [number, number, number, number], sources)

    // Unsubscribe existing and resubscribe
    await unsubscribeAll()
    await subscribe(config)
  }, [sources, subscribe, unsubscribeAll])

  // Auto-connect on mount
  useEffect(() => {
    if (!autoConnect) return

    const bounds = geointRegistry.get(viewportBoundsAtom)
    const config = viewportLiveConfig(bounds as [number, number, number, number], sources)

    subscribe(config)

    return () => {
      // Cleanup on unmount
      if (activeSubscriptionRef.current) {
        unsubscribe(activeSubscriptionRef.current)
      }
    }
  }, [autoConnect, sources, subscribe, unsubscribe])

  // Context value
  const contextValue: LiveDataContextValue = {
    connectionState,
    subscriptions,
    subscribe,
    unsubscribe,
    unsubscribeAll,
    reconnect,
    autoConnect,
    getStreamingState,
  }

  return (
    <GeointRegistryProvider>
      <LiveDataContext.Provider value={contextValue}>
        {children}
      </LiveDataContext.Provider>
    </GeointRegistryProvider>
  )
}

// =============================================================================
// STATUS INDICATOR COMPONENT
// =============================================================================

export interface LiveStatusIndicatorProps {
  /** Show detailed status text */
  readonly showLabel?: boolean
  /** Custom class name */
  readonly className?: string
}

/**
 * LiveStatusIndicator — Visual indicator for live data connection status.
 * Uses reactive hooks for streaming state (inside GeointRegistryProvider).
 */
export const LiveStatusIndicator: FC<LiveStatusIndicatorProps> = ({
  showLabel = true,
  className = '',
}) => {
  const { connectionState } = useLiveData()
  const lastUpdate = useLastUpdate()

  const statusConfig = {
    disconnected: {
      color: 'bg-gray-500',
      label: 'Offline',
      pulse: false,
    },
    connecting: {
      color: 'bg-yellow-500',
      label: 'Connecting...',
      pulse: true,
    },
    connected: {
      color: 'bg-green-500',
      label: 'Live',
      pulse: true,
    },
    reconnecting: {
      color: 'bg-orange-500',
      label: 'Reconnecting...',
      pulse: true,
    },
    error: {
      color: 'bg-red-500',
      label: 'Error',
      pulse: false,
    },
  }

  const config = statusConfig[connectionState]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.pulse && (
          <div
            className={`absolute inset-0 w-2 h-2 rounded-full ${config.color} animate-ping opacity-75`}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-text-secondary">
          {config.label}
          {lastUpdate && connectionState === 'connected' && (
            <span className="text-text-quaternary ml-1">
              ({Math.round((Date.now() - lastUpdate) / 1000)}s ago)
            </span>
          )}
        </span>
      )}
    </div>
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export { type LiveSubscriptionConfig, type StreamEventHandlers } from './LiveDataService'
