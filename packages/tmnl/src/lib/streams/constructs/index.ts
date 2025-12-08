/**
 * Stream Constructs — Stateful lifecycle managers
 *
 * | Construct     | Role                              | BFO Type |
 * |---------------|-----------------------------------|----------|
 * | Feed          | Single source with lifecycle      | Process  |
 * | FeedsManager  | Orchestration kernel              | Service  |
 * | Channel       | Topological multiplexing protocol | GDC      |
 */

// Feed — Single stream source with lifecycle
export { Feed, makeFeed } from "./Feed"
export type { FeedConfig, FeedState } from "./Feed"
export { FeedStatus, FeedSignal } from "./Feed"

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
} from "./FeedsManager"
export type { FeedsManagerService, FeedEntry } from "./FeedsManager"

// Channel — Topological multiplexing protocol
export {
  // Identity
  ChannelId,
  InletId,
  OutletId,
  JunctionId,
  WireId,
  CorrelationId,

  // Status
  ChannelStatus,

  // Topology components
  Inlet,
  Outlet,
  Junction,
  JunctionKind,
  Wire,

  // Protocol configuration
  BackpressureStrategy,
  BackpressureConfig,
  CircuitState,
  CircuitBreakerConfig,
  TimeoutBehavior,
  TimeoutConfig,
  RetryConfig,
  ChannelProtocol,

  // Commands
  OpenChannel,
  CloseChannel,
  ConnectInlet,
  DisconnectInlet,
  SubscribeOutlet,
  UnsubscribeOutlet,
  ResetCircuitBreaker,
  ChannelCommand,

  // Events
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
  ChannelEvent,

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
} from "./Channel"

// ChannelBuilder — Fluent API for constructing channels
export {
  ChannelBuilder,
  ChannelBuilderError,
} from "./ChannelBuilder"
export type {
  InletBuilderConfig,
  OutletBuilderConfig,
  JunctionBuilderConfig,
  WireEndpoint,
  BuilderInspection,
} from "./ChannelBuilder"

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
} from "./ChannelService"
export type {
  ChannelInstance,
  ChannelServiceShape,
} from "./ChannelService"
