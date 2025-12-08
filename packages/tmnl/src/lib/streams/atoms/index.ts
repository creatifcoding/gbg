/**
 * Stream-Atom Primitives
 *
 * Bridges Effect Streams, Feeds, and Channels with effect-atom for
 * progressive, reactive UI updates.
 *
 * ## The Gap These Fill
 *
 * | Pattern | Limitation |
 * |---------|------------|
 * | `Reactivity.stream()` | Single value per invalidation |
 * | `Atom.make(stream)` | Last value only, no accumulation |
 * | Manual `ctx.set()` | Imperative boilerplate |
 * | Feed/Channel | No atom bridge |
 *
 * ## Primitives
 *
 * - **streamToAtom** — Stream → Atom with accumulation + batching
 * - **feedToAtom** — Feed → Atom with lifecycle (start/stop)
 * - **channelOutletAtom** — Channel outlet → Atom via ChannelService
 * - **withEventLog** — Pipeline observability operator
 *
 * @example Basic stream subscription
 * ```typescript
 * import { streamToAtom } from "@/lib/streams/atoms"
 *
 * const handle = streamToAtom(myStream, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next],
 *   batchEvery: 50,
 *   maxItems: 1000,
 * })
 *
 * handle.start()
 * // In React: useAtomValue(handle.atom)
 * ```
 *
 * @example Feed with lifecycle
 * ```typescript
 * import { feedToAtom } from "@/lib/streams/atoms"
 * import { Feed } from "@/lib/streams/constructs"
 *
 * const feed = Feed.make({
 *   id: "sensor",
 *   producer: readSensor,
 *   interval: 100,
 * })
 *
 * const handle = feedToAtom(feed, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next].slice(-100),
 * })
 *
 * handle.start() // Feed starts
 * handle.stop()  // Feed stops
 * ```
 *
 * @example Channel outlet subscription
 * ```typescript
 * import { channelOutletAtom } from "@/lib/streams/atoms"
 *
 * const handle = yield* channelOutletAtom(channelId, outletId, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next],
 * })
 *
 * handle.start()
 * ```
 *
 * @example Observable pipeline
 * ```typescript
 * import { withEventLog } from "@/lib/streams/atoms"
 *
 * const observed = myStream.pipe(
 *   withEventLog({
 *     sourceId: "my-feed",
 *     channelId: "my-channel",
 *     onEvent: (e) => metricsCollector.track(e),
 *   })
 * )
 * ```
 *
 * @module
 */

// ============================================================================
// STREAM TO ATOM
// ============================================================================

export {
  streamToAtom,
  streamToAtomArray,
  streamToAtomLatest,
  type StreamToAtomOptions,
  type StreamAtomStatus,
  type StreamToAtomHandle,
} from "./streamToAtom"

// ============================================================================
// FEED TO ATOM
// ============================================================================

export {
  feedToAtom,
  feedToAtomArray,
  feedToAtomLatest,
  type FeedToAtomOptions,
  type FeedAtomStatus,
  type FeedToAtomHandle,
} from "./feedToAtom"

// ============================================================================
// CHANNEL OUTLET ATOM
// ============================================================================

export {
  // Core
  outletToAtom,
  channelOutletAtom,
  // Convenience factories
  channelOutletAtomArray,
  channelOutletAtomLatest,
  // Types
  type ChannelOutletAtomOptions,
  type OutletAtomStatus,
  type ChannelOutletAtomHandle,
} from "./channelOutletAtom"

// ============================================================================
// PIPELINE OBSERVABILITY
// ============================================================================

export {
  // Core operator
  withEventLog,
  // Convenience factories
  withEventLogConsole,
  withEventLogCollector,
  // Event schemas
  StreamDataEmitted,
  StreamCompleted,
  StreamErrored,
  StreamObservabilityEvent,
  // Types
  type WithEventLogOptions,
} from "./withEventLog"
