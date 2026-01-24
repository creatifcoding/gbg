/**
 * NEX Module - NATS Execution Engine Integration
 *
 * Effect-native services for NEX workload management:
 * - NexClientService: Auction, deploy, list, stop workloads
 * - RpcService: Request-reply patterns with schema validation
 * - NexEventWatcher: Lifecycle events and log streaming
 *
 * Architecture:
 * ```
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    NEX Effect Service Layer                          │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                      │
 * │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
 * │  │  NexClientSvc   │    │    RpcService   │    │  EventWatcher   │  │
 * │  │  (auction/dep)  │    │  (RPC handlers) │    │  (lifecycle)    │  │
 * │  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │
 * │           │                      │                      │            │
 * │           └──────────────────────┼──────────────────────┘            │
 * │                                  │                                   │
 * │                    ┌─────────────┴─────────────┐                     │
 * │                    │    MessageDecoder         │                     │
 * │                    │  (Schema.parseJson based) │                     │
 * │                    └─────────────┬─────────────┘                     │
 * │                                  │                                   │
 * │                    ┌─────────────┴─────────────┐                     │
 * │                    │    NatsInnerService       │                     │
 * │                    │  (holonet/nats/inner)     │                     │
 * │                    └───────────────────────────┘                     │
 * └─────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * NATS Subject Patterns:
 * - `$NEX.SVC.<ns>.control.AUCTION` - Workload placement auction
 * - `$NEX.SVC.<ns>.control.AUCTIONDEPLOY.<bid>` - Deploy to bidder
 * - `$NEX.SVC.<ns>.workloads.LIST` - List workloads
 * - `$NEX.SVC.<ns>.workloads.STOP` - Stop workload
 * - `$NEX.FEED.<ns>.event.*` - Lifecycle events
 * - `$NEX.FEED.<ns>.logs.<wid>.out` - Workload stdout
 * - `$NEX.FEED.<ns>.logs.<wid>.err` - Workload stderr
 *
 * @module nex
 */

// Schemas
export * from './schemas'

// Errors
export * from './errors'

// MessageDecoder
export { MessageDecoder, MessageDecoderLive } from './decoder'

// Services
export {
  NexClientService,
  NexClientServiceLive,
} from './services/client'

export {
  RpcService,
  RpcServiceLive,
  type RpcHandler,
} from './services/rpc'

export {
  NexEventWatcher,
  NexEventWatcherLive,
} from './services/events'
