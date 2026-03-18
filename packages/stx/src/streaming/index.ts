/**
 * @tmnl/stx — Streaming Module
 *
 * Effect v4 (effect-smol) streaming primitives backed by reactive atoms.
 * All materializers use AtomRegistry for React-friendly, surgical updates.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Primitive          │ Pattern               │ Use case               │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ stxReduce(stream)  │ fold events → state   │ search results, state  │
 * │ stxFeed(stream)    │ append/window/ring     │ logs, chat, tokens     │
 * │ stxLatest(stream)  │ keep newest value      │ prices, sensors, HMR   │
 * │ stxPull(stream)    │ manual pagination      │ infinite scroll        │
 * │ stxDuplex(streams) │ inbound + outbound     │ WebSocket, IPC, REPL   │
 * │ stxShared(stream)  │ PubSub multicast       │ event bus, telemetry   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Error propagation (all materializers):
 *   - Interrupt → silent (normal dispose)
 *   - Fail<E>   → error atom = typed E
 *   - Die       → error atom = StxDefect (wraps defect, full Cause)
 *   - Mixed     → StxDefect with .isMixed = true + .typedError
 *
 * @module
 */

export { stxReduce }  from "./reduce.js"
export { stxFeed }    from "./feed.js"
export { stxLatest }  from "./latest.js"
export { stxPull }    from "./pull.js"
export { stxDuplex }  from "./duplex.js"
export { stxShared }  from "./shared.js"
export { watchFiberExit, StxDefect } from "./fiber-exit.js"
export { makeStatsAtoms, makeControlAtoms } from "./stats.js"
export type {
  // Config
  ReduceConfig,
  FeedConfig,
  PullConfig,
  DuplexConfig,
  SharedConfig,
  // Return types
  StxReduce,
  StxFeed,
  StxLatest,
  StxPullV2,
  StxDuplex,
  StxShared,
  StxSharedSubscription,
  // Control
  StxStreamControl,
  StxStreamStats,
} from "./types.js"
export type { StxFiberAtoms } from "./fiber-exit.js"
