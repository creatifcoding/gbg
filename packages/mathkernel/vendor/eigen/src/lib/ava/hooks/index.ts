/**
 * AVA Hooks Module
 *
 * React hooks for consuming AVA atoms.
 *
 * @module
 */

// v2 hooks (NATS-based)
export {
  // Connection
  useAvaConnection,
  // View subscription
  useViewSubscription,
  // Channel data
  useChannelData,
  useChannels,
  // Monitoring
  useAvaMonitor,
  // Collections
  useAllArtifacts,
  useSubscriptions,
  // Cleanup
  useAvaCleanup,
  // Types
  type UseAvaConnectionResult,
  type UseViewSubscriptionResult,
  type UseChannelDataResult,
  type UseAvaMonitorResult,
} from './v2'
