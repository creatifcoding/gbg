/**
 * StreamingMetricsProvider — Per-message-family React context.
 *
 * Wraps AssistantMessage so all child part renderers (text, thinking,
 * tool, code) can call `useStreamingMetrics()` to access tokens, rate,
 * elapsed, velocity — without prop drilling through every component.
 *
 * ARCHITECTURE:
 * - ThreadView resolves the harness instanceId from the adapter
 * - AssistantMessage reads `streamingMetrics$(instanceId)` via useAtomValue
 * - Children call `useStreamingMetrics()` — zero atom subscriptions, pure context
 *
 * NON-HARNESS ADAPTERS:
 * - When adapter is mock/conductor/replay, instanceId resolves to null
 * - Provider passes IDLE_METRICS — children see idle state, no errors
 *
 * @module morphchat/components/streaming-metrics-provider
 */

import { createContext, useContext } from 'react'
import type { StreamingMetrics } from '../atoms/streaming-metrics'
import { IDLE_METRICS } from '../atoms/streaming-metrics'

// =============================================================================
// Context
// =============================================================================

const StreamingMetricsCtx = createContext<StreamingMetrics>(IDLE_METRICS)

/**
 * Provider component — wrap each AssistantMessage's children.
 *
 * @example
 * ```tsx
 * <StreamingMetricsProvider value={metrics}>
 *   <PartRenderer ... />
 *   <PartRenderer ... />
 * </StreamingMetricsProvider>
 * ```
 */
export const StreamingMetricsProvider = StreamingMetricsCtx.Provider

/**
 * Access streaming metrics from any part renderer within an AssistantMessage.
 *
 * Returns `IDLE_METRICS` when:
 * - Not inside a provider (safe default)
 * - Adapter is non-harness (mock, conductor, replay)
 * - Message is not currently streaming
 *
 * @example
 * ```tsx
 * function MyCursor() {
 *   const { velocity, tokensPerSecond } = useStreamingMetrics()
 *   // velocity: 'fast' | 'normal' | 'slow'
 *   // tokensPerSecond: derived from streaming$ atom
 * }
 * ```
 */
export function useStreamingMetrics(): StreamingMetrics {
  return useContext(StreamingMetricsCtx)
}
