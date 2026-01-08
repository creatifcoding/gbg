/**
 * AVA v2 React Hooks
 *
 * React hooks for consuming AVA v2 atoms.
 * Provides convenient access to view subscriptions, artifacts, and channels.
 *
 * Follows Atom-as-State doctrine:
 * - Atoms ARE the primary state
 * - Hooks subscribe via useAtomValue()
 * - Operations dispatch to avaV2Ops
 *
 * @pattern React hooks with effect-atom
 * @see AVA_REACTIVE_BINDING_API.md
 * @module
 */

import { useCallback, useEffect, useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { HashMap } from 'effect'

import {
  // State atoms
  connectionStatusAtom,
  errorAtom,
  subscriptionsAtom,
  artifactsAtom,
  deltasAtom,
  eventsAtom,
  // Derived atoms
  subscribedViewIdsAtom,
  subscriptionCountAtom,
  subscriptionAtom,
  artifactAtom,
  isConnectedAtom,
  // Operations
  avaV2Ops,
  avaV2Streams,
  // Registry
  avaV2Registry,
  // Config
  avaV2ConfigAtom,
  // Types
  type ConnectionStatus,
  type ViewSubscription,
  type AvaV2Config,
} from '../../atoms/v2'

import type {
  ViewId,
  ViewArtifact,
  ViewDelta,
  ReconcilerEvent,
  ChannelBinding,
  ChannelData,
} from '../../schemas/v2'

import { isError, isPending } from '../../schemas/v2'

// =============================================================================
// Types
// =============================================================================

export interface UseAvaConnectionResult {
  /** Current connection status */
  readonly status: ConnectionStatus
  /** Whether connected to NATS */
  readonly isConnected: boolean
  /** Error message if any */
  readonly error: string | null
  /** Current configuration */
  readonly config: AvaV2Config
  /** Update configuration */
  readonly setConfig: (config: Partial<AvaV2Config>) => void
}

export interface UseViewSubscriptionResult {
  /** Subscription metadata */
  readonly subscription: ViewSubscription | null
  /** Latest artifact */
  readonly artifact: ViewArtifact | null
  /** Whether subscription is active */
  readonly isSubscribed: boolean
  /** Subscribe to the view */
  readonly subscribe: () => void
  /** Unsubscribe from the view */
  readonly unsubscribe: () => void
  /** Invalidate the view (trigger refresh) */
  readonly invalidate: (reason?: string) => void
}

export interface UseChannelDataResult<T = unknown> {
  /** Channel data (typed) */
  readonly data: T | null
  /** Raw channel binding */
  readonly binding: ChannelBinding | null
  /** Whether channel is hydrated with data */
  readonly isHydrated: boolean
  /** Whether channel is in error state */
  readonly isError: boolean
  /** Whether channel hydration is pending */
  readonly isPending: boolean
  /** Whether channel is loading (pending or not yet hydrated) */
  readonly isLoading: boolean
  /** Error message if in error state */
  readonly error: string | null
}

export interface UseAvaMonitorResult {
  /** Recent deltas */
  readonly deltas: readonly ViewDelta[]
  /** Recent reconciler events */
  readonly events: readonly ReconcilerEvent[]
  /** Count of active subscriptions */
  readonly subscriptionCount: number
  /** List of subscribed view IDs */
  readonly subscribedViewIds: readonly ViewId[]
  /** Start monitoring all artifacts */
  readonly startMonitoringArtifacts: () => void
  /** Start monitoring all deltas */
  readonly startMonitoringDeltas: () => void
  /** Start monitoring reconciler events */
  readonly startMonitoringEvents: () => void
}

// =============================================================================
// Connection Hook
// =============================================================================

/**
 * Hook for AVA v2 connection status and configuration.
 *
 * @example
 * ```tsx
 * function ConnectionStatus() {
 *   const { status, isConnected, error, setConfig } = useAvaConnection()
 *
 *   if (!isConnected) return <div>Disconnected: {error}</div>
 *   return <div>Connected via {status}</div>
 * }
 * ```
 */
export function useAvaConnection(): UseAvaConnectionResult {
  const status = useAtomValue(connectionStatusAtom)
  const isConnected = useAtomValue(isConnectedAtom)
  const error = useAtomValue(errorAtom)
  const config = useAtomValue(avaV2ConfigAtom)

  const setConfig = useCallback((partial: Partial<AvaV2Config>) => {
    avaV2Ops.setConfig(partial)
  }, [])

  return useMemo(
    () => ({
      status,
      isConnected,
      error,
      config,
      setConfig,
    }),
    [status, isConnected, error, config, setConfig]
  )
}

// =============================================================================
// View Subscription Hook
// =============================================================================

/**
 * Hook for subscribing to a specific view.
 *
 * @param viewId - The view to subscribe to
 * @param autoSubscribe - Whether to auto-subscribe on mount (default: false)
 *
 * @example
 * ```tsx
 * function TruckView({ truckId }: { truckId: ViewId }) {
 *   const { artifact, subscribe, unsubscribe, isSubscribed } =
 *     useViewSubscription(truckId, true)
 *
 *   if (!isSubscribed) return <button onClick={subscribe}>Subscribe</button>
 *
 *   return (
 *     <div>
 *       <h2>{artifact?.spec.name}</h2>
 *       <button onClick={() => unsubscribe()}>Unsubscribe</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useViewSubscription(
  viewId: ViewId,
  autoSubscribe = false
): UseViewSubscriptionResult {
  // Get subscription and artifact atoms for this viewId
  const subscriptionAtomForView = useMemo(() => subscriptionAtom(viewId), [viewId])
  const artifactAtomForView = useMemo(() => artifactAtom(viewId), [viewId])

  const subscription = useAtomValue(subscriptionAtomForView)
  const artifact = useAtomValue(artifactAtomForView)

  const isSubscribed = subscription !== null

  const subscribe = useCallback(() => {
    // Trigger the subscribe operation by setting the operation atom
    avaV2Registry.set(avaV2Ops.subscribe, viewId)
  }, [viewId])

  const unsubscribe = useCallback(() => {
    // Trigger the unsubscribe operation by setting the operation atom
    avaV2Registry.set(avaV2Ops.unsubscribe, viewId)
  }, [viewId])

  const invalidate = useCallback(
    (reason?: string) => {
      // Trigger the invalidate operation by setting the operation atom
      avaV2Registry.set(avaV2Ops.invalidate, { viewId, reason })
    },
    [viewId]
  )

  // Auto-subscribe on mount if requested
  useEffect(() => {
    if (autoSubscribe && !isSubscribed) {
      subscribe()
    }

    // Cleanup on unmount
    return () => {
      if (autoSubscribe && isSubscribed) {
        unsubscribe()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubscribe, viewId])

  return useMemo(
    () => ({
      subscription,
      artifact,
      isSubscribed,
      subscribe,
      unsubscribe,
      invalidate,
    }),
    [subscription, artifact, isSubscribed, subscribe, unsubscribe, invalidate]
  )
}

// =============================================================================
// Channel Data Hook
// =============================================================================

/**
 * Hook for accessing channel data from a subscribed view.
 *
 * @param viewId - The view ID
 * @param channelId - The channel ID within the view
 *
 * @example
 * ```tsx
 * function PositionChannel({ viewId }: { viewId: ViewId }) {
 *   const { data, isLoading, isError, error } =
 *     useChannelData<{ lat: number; lng: number }>(viewId, 'position')
 *
 *   if (isLoading) return <Spinner />
 *   if (isError) return <Error message={error} />
 *
 *   return <Map position={data} />
 * }
 * ```
 */
export function useChannelData<T = unknown>(
  viewId: ViewId,
  channelId: string
): UseChannelDataResult<T> {
  const artifactAtomForView = useMemo(() => artifactAtom(viewId), [viewId])
  const artifact = useAtomValue(artifactAtomForView)

  // Find the channel binding
  const binding = useMemo(() => {
    if (!artifact) return null
    return artifact.channelBindings.find((b) => b.channelId === channelId) ?? null
  }, [artifact, channelId])

  // Extract channel data and status
  const result = useMemo((): UseChannelDataResult<T> => {
    if (!binding) {
      return {
        data: null,
        binding: null,
        isHydrated: false,
        isError: false,
        isPending: false,
        isLoading: true,
        error: null,
      }
    }

    const channelData = binding.data

    // Not yet hydrated
    if (!channelData) {
      return {
        data: null,
        binding,
        isHydrated: false,
        isError: false,
        isPending: false,
        isLoading: true,
        error: null,
      }
    }

    // Pending
    if (isPending(channelData)) {
      return {
        data: null,
        binding,
        isHydrated: false,
        isError: false,
        isPending: true,
        isLoading: true,
        error: null,
      }
    }

    // Error
    if (isError(channelData)) {
      return {
        data: null,
        binding,
        isHydrated: false,
        isError: true,
        isPending: false,
        isLoading: false,
        error: channelData.value.message,
      }
    }

    // Hydrated with data
    const data = extractChannelValue<T>(channelData)
    return {
      data,
      binding,
      isHydrated: true,
      isError: false,
      isPending: false,
      isLoading: false,
      error: null,
    }
  }, [binding])

  return result
}

/**
 * Extract typed value from ChannelData
 */
function extractChannelValue<T>(data: ChannelData): T | null {
  switch (data.type) {
    case 'inline':
      return data.value as T
    case 'rows':
      return data.value as T
    case 'assetRef':
      return data.value as T
    case 'streamHandle':
      return data.value as T
    case 'error':
    case 'pending':
      return null
    default:
      return null
  }
}

// =============================================================================
// Multiple Channels Hook
// =============================================================================

/**
 * Hook for accessing multiple channels from a view.
 *
 * @param viewId - The view ID
 * @param channelIds - Array of channel IDs to access
 *
 * @example
 * ```tsx
 * function TruckDashboard({ viewId }: { viewId: ViewId }) {
 *   const channels = useChannels(viewId, ['position', 'telemetry', 'alerts'])
 *
 *   return (
 *     <div>
 *       <Map position={channels.position.data} />
 *       <Telemetry data={channels.telemetry.data} />
 *       <Alerts alerts={channels.alerts.data} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useChannels<T extends Record<string, unknown>>(
  viewId: ViewId,
  channelIds: readonly (keyof T)[]
): Record<keyof T, UseChannelDataResult<T[keyof T]>> {
  const artifactAtomForView = useMemo(() => artifactAtom(viewId), [viewId])
  const artifact = useAtomValue(artifactAtomForView)

  return useMemo(() => {
    const result = {} as Record<keyof T, UseChannelDataResult<T[keyof T]>>

    for (const channelId of channelIds) {
      const binding = artifact?.channelBindings.find(
        (b) => b.channelId === String(channelId)
      ) ?? null

      if (!binding || !binding.data) {
        result[channelId] = {
          data: null,
          binding,
          isHydrated: false,
          isError: false,
          isPending: false,
          isLoading: true,
          error: null,
        }
        continue
      }

      const channelData = binding.data

      if (isPending(channelData)) {
        result[channelId] = {
          data: null,
          binding,
          isHydrated: false,
          isError: false,
          isPending: true,
          isLoading: true,
          error: null,
        }
      } else if (isError(channelData)) {
        result[channelId] = {
          data: null,
          binding,
          isHydrated: false,
          isError: true,
          isPending: false,
          isLoading: false,
          error: channelData.value.message,
        }
      } else {
        result[channelId] = {
          data: extractChannelValue<T[keyof T]>(channelData),
          binding,
          isHydrated: true,
          isError: false,
          isPending: false,
          isLoading: false,
          error: null,
        }
      }
    }

    return result
  }, [artifact, channelIds])
}

// =============================================================================
// Monitor Hook
// =============================================================================

/**
 * Hook for monitoring AVA v2 system activity.
 * Useful for debugging and admin dashboards.
 *
 * @example
 * ```tsx
 * function AvaMonitor() {
 *   const {
 *     deltas,
 *     events,
 *     subscriptionCount,
 *     startMonitoringDeltas,
 *   } = useAvaMonitor()
 *
 *   useEffect(() => {
 *     startMonitoringDeltas()
 *   }, [])
 *
 *   return (
 *     <div>
 *       <p>Subscriptions: {subscriptionCount}</p>
 *       <DeltaList deltas={deltas} />
 *       <EventLog events={events} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useAvaMonitor(): UseAvaMonitorResult {
  const deltas = useAtomValue(deltasAtom)
  const events = useAtomValue(eventsAtom)
  const subscriptionCount = useAtomValue(subscriptionCountAtom)
  const subscribedViewIds = useAtomValue(subscribedViewIdsAtom)

  const startMonitoringArtifacts = useCallback(() => {
    // Trigger the subscribeAllArtifacts stream operation
    avaV2Registry.set(avaV2Streams.subscribeAllArtifacts, undefined)
  }, [])

  const startMonitoringDeltas = useCallback(() => {
    // Trigger the subscribeAllDeltas stream operation
    avaV2Registry.set(avaV2Streams.subscribeAllDeltas, undefined)
  }, [])

  const startMonitoringEvents = useCallback(() => {
    // Trigger the subscribeEvents stream operation
    avaV2Registry.set(avaV2Streams.subscribeEvents, undefined)
  }, [])

  return useMemo(
    () => ({
      deltas,
      events,
      subscriptionCount,
      subscribedViewIds,
      startMonitoringArtifacts,
      startMonitoringDeltas,
      startMonitoringEvents,
    }),
    [
      deltas,
      events,
      subscriptionCount,
      subscribedViewIds,
      startMonitoringArtifacts,
      startMonitoringDeltas,
      startMonitoringEvents,
    ]
  )
}

// =============================================================================
// All Artifacts Hook
// =============================================================================

/**
 * Hook for accessing all artifacts across all subscriptions.
 * Useful for admin views showing all active views.
 *
 * @example
 * ```tsx
 * function AllViews() {
 *   const artifacts = useAllArtifacts()
 *
 *   return (
 *     <ul>
 *       {artifacts.map(([viewId, artifact]) => (
 *         <li key={viewId}>{artifact.spec.name}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useAllArtifacts(): readonly [ViewId, ViewArtifact][] {
  const artifacts = useAtomValue(artifactsAtom)

  return useMemo(() => {
    return Array.from(HashMap.entries(artifacts))
  }, [artifacts])
}

// =============================================================================
// Subscription List Hook
// =============================================================================

/**
 * Hook for accessing all active subscriptions.
 *
 * @example
 * ```tsx
 * function SubscriptionManager() {
 *   const subscriptions = useSubscriptions()
 *
 *   return (
 *     <ul>
 *       {subscriptions.map(([viewId, sub]) => (
 *         <li key={viewId}>
 *           {viewId} - Last update: {sub.lastUpdate}
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useSubscriptions(): readonly [ViewId, ViewSubscription][] {
  const subscriptions = useAtomValue(subscriptionsAtom)

  return useMemo(() => {
    return Array.from(HashMap.entries(subscriptions))
  }, [subscriptions])
}

// =============================================================================
// Cleanup Hook
// =============================================================================

/**
 * Hook that cleans up all AVA v2 subscriptions on unmount.
 * Use at the top level of your app to ensure cleanup.
 *
 * @example
 * ```tsx
 * function App() {
 *   useAvaCleanup()
 *
 *   return <AppContent />
 * }
 * ```
 */
export function useAvaCleanup(): void {
  useEffect(() => {
    return () => {
      // Trigger the unsubscribeAll operation on cleanup
      avaV2Registry.set(avaV2Ops.unsubscribeAll, undefined)
    }
  }, [])
}
