/**
 * TMNL Streams Laboratory
 *
 * A reactive streaming library built on Effect, providing supervised,
 * interruptible stream sources with lifecycle management.
 *
 * Architecture:
 *   primitives/   — Stateless stream factories (ticker, pulse, etc.)
 *   constructs/   — Stateful lifecycle managers (Feed, FeedsManager, Channel)
 *   challenges/   — Educational experiments and demos
 *   docs/         — API reference, tutorials, patterns
 *
 * Run experiments: bun run src/lib/streams/challenges/playground.ts
 * Run tests: bun vitest run src/lib/streams/__tests__/
 */

// ============================================================================
// Primitives (stateless stream factories)
// ============================================================================

export {
  // Time primitives
  ticker,
  pulse,
  counter,
  heartbeat,
  metronome,
  delay,
  debounce,
  throttle,
  sample,
  buffer,
  timeout,
  elapsed,
  stopwatch,
  backoff,
} from "./primitives"
export type { TickerOptions, PulseOptions, StopwatchEvent } from "./primitives/time"

// Legacy re-export (deprecated, use primitives)
// NOTE: aliased to avoid duplicate named exports with primitives
export {
  ticker as legacyTicker,
  pulse as legacyPulse,
  counter as legacyCounter,
  heartbeat as legacyHeartbeat,
} from "./factories"
export type { TickerOptions as LegacyTickerOptions, PulseOptions as LegacyPulseOptions } from "./factories"

// ============================================================================
// Constructs (stateful lifecycle managers)
// ============================================================================

// Feed — Single stream source with lifecycle
export { Feed, makeFeed } from "./constructs/Feed"
export type { FeedConfig, FeedState } from "./constructs/Feed"
export { FeedStatus, FeedSignal } from "./constructs/Feed"

// FeedsManager — Orchestration kernel for multiple feeds
export {
  FeedsManager,
  FeedsManagerLive,
  FeedsManagerScoped,
  FeedId,
  FeedCommand,
  FeedManagerEvent,
  registerFeed,
  getFeed,
  sendCommand,
} from "./constructs/FeedsManager"
export type { FeedsManagerService, FeedEntry } from "./constructs/FeedsManager"

// Channel — Topological multiplexing protocol
export {
  // Identity
  ChannelId,
  InletId,
  OutletId,
  JunctionId,
  WireId,
  CorrelationId,

  // Status & Kinds
  ChannelStatus,
  JunctionKind,
  BackpressureStrategy,
  CircuitState,
  TimeoutBehavior,

  // Topology components
  Inlet,
  Outlet,
  Junction,
  Wire,

  // Protocol configuration
  BackpressureConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  RetryConfig,
  ChannelProtocol,

  // Commands
  ChannelCommand,
  OpenChannel,
  CloseChannel,
  ConnectInlet,
  DisconnectInlet,
  SubscribeOutlet,
  UnsubscribeOutlet,
  ResetCircuitBreaker,

  // Events
  ChannelEvent,
  ChannelOpened,
  ChannelClosed,
  ChannelFaulted,
  InletConnected,
  InletDisconnected,
  OutletSubscribed,
  OutletUnsubscribed,
  CircuitBreakerTripped,
  CircuitBreakerReset,
  TimeoutOccurred,
  BackpressureEngaged,

  // Bidirectional
  ChannelRequest,
  ChannelResponse,
  ChannelAck,
  ChannelNack,

  // State
  ChannelTopology,
  ChannelMetrics,
  ChannelState,
  ChannelConfig,
} from "./constructs/Channel"

// ChannelBuilder — Fluent API for constructing channels
export {
  ChannelBuilder,
  ChannelBuilderError,
} from "./constructs/ChannelBuilder"
export type {
  InletBuilderConfig,
  OutletBuilderConfig,
  JunctionBuilderConfig,
  WireEndpoint,
  BuilderInspection,
} from "./constructs/ChannelBuilder"

// ChannelService — Effect service for channel lifecycle
export {
  ChannelService,
  ChannelServiceLive,
  ChannelServiceScoped,
  ChannelServiceError,
  registerChannel,
  getChannel,
  openChannel,
  connectFeedToChannel,
} from "./constructs/ChannelService"
export type {
  ChannelInstance,
  ChannelServiceShape,
} from "./constructs/ChannelService"

// ============================================================================
// Challenge Artifacts (educational)
// ============================================================================

export * as Challenge01 from "./challenges/01-heartbeat"
export * as Challenge02 from "./challenges/02-cancellable-feed"
export * as Challenge03 from "./challenges/03-feed-demo"
export * as Challenge04 from "./challenges/04-manager-demo"
export * as Challenge05 from "./challenges/05-primitives-demo"
export * as Challenge06 from "./challenges/06-multi-source-merge"
export * as Challenge07 from "./challenges/07-channel-demo"
