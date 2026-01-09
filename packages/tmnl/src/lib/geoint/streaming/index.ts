/**
 * GEOINT Streaming Module
 *
 * Real-time data streaming integration for the GEOINT dashboard.
 *
 * @example
 * ```tsx
 * import {
 *   LiveDataProvider,
 *   LiveStatusIndicator,
 *   useLiveData,
 *   useIsStreaming
 * } from '@/lib/geoint/streaming'
 *
 * function GeointDashboard() {
 *   return (
 *     <LiveDataProvider autoConnect={true}>
 *       <LiveStatusIndicator />
 *       <MapView />
 *     </LiveDataProvider>
 *   )
 * }
 * ```
 *
 * @module geoint/streaming
 */

export {
  // Service
  LiveDataServiceTag,
  LiveDataServiceLive,
  type LiveDataService,

  // Error
  LiveDataError,

  // Types
  type ConnectionState,
  type LiveSubscriptionConfig,
  type LiveSubscription,
  type StreamEventHandlers,

  // Helpers
  viewportLiveConfig,
  defaultStreamHandlers,
} from './LiveDataService'

export {
  // Provider
  LiveDataProvider,
  type LiveDataProviderProps,

  // Hooks
  useLiveData,
  useIsStreaming,
  useLastUpdate,

  // Context type
  type LiveDataContextValue,

  // Components
  LiveStatusIndicator,
  type LiveStatusIndicatorProps,
} from './LiveDataProvider'
