/**
 * @tmnl/stx — Streaming Materializer Types
 *
 * Shared interfaces for all first-class streaming primitives.
 * All materializers follow the same control-plane / data-plane split:
 *   - data plane: state/value atoms — surgical React subscriptions
 *   - control plane: stats, running, done, error, pause/resume, send, dispose
 *
 * @module
 */

import type { Atom, AtomRegistry } from "effect/unstable/reactivity"

// ─── Stats Plane ─────────────────────────────────────────────────────────────

/**
 * Metrics atoms exposed by every streaming materializer.
 * Subscribe surgically — e.g. only show throughput indicator in dev mode.
 */
export interface StxStreamStats {
  /** Total items received from upstream (incremented on every chunk ingestion) */
  readonly received: Atom.Atom<number>
  /** Items applied to state (may differ from received if dropping/windowing) */
  readonly applied: Atom.Atom<number>
  /** Items dropped due to policy (ring-buffer overflow, windowing) */
  readonly dropped: Atom.Atom<number>
  /** Items currently buffered but not yet applied */
  readonly buffered: Atom.Atom<number>
  /** Lag in ms between last emission and last application (0 for sync) */
  readonly lagMs: Atom.Atom<number>
  /** Size of the last chunk processed */
  readonly lastChunkSize: Atom.Atom<number>
  /** Approximate throughput (items/sec) over last 1s window */
  readonly throughputPerSec: Atom.Atom<number>
}

// ─── Lifecycle Control ───────────────────────────────────────────────────────

/**
 * Common lifecycle controls returned by every materializer.
 */
export interface StxStreamControl {
  /** Whether the stream is currently running (fiber alive) */
  readonly running: Atom.Atom<boolean>
  /** Whether the stream has completed (upstream done, no more items) */
  readonly done: Atom.Atom<boolean>
  /** Current error, if the stream failed */
  readonly error: Atom.Atom<unknown>
  /** Stats plane */
  readonly stats: StxStreamStats
  /** Pause ingestion (items buffer in queue, backpressure applies) */
  readonly pause: () => void
  /** Resume ingestion after pause */
  readonly resume: () => void
  /** Tear down: interrupt fiber, close scope, unmount atoms */
  readonly dispose: () => void
}

// ─── stx.latest ──────────────────────────────────────────────────────────────

/**
 * Tracks the latest value from a stream.
 * React gets notified once per emission (or per latest value if fast).
 *
 * Use for: live prices, sensor readings, cursor position, config updates.
 */
export interface StxLatest<A, E = never> {
  /** Current latest value (undefined until first emission) */
  readonly value: Atom.Atom<A | undefined>
  /** Whether waiting for first value */
  readonly loading: Atom.Atom<boolean>
  /** Registry */
  readonly registry: AtomRegistry.AtomRegistry
  /** Control plane */
  readonly control: StxStreamControl
}

// ─── stx.feed ────────────────────────────────────────────────────────────────

/**
 * Append-only or windowed feed materializer.
 *
 * Modes:
 *   - "append" — grows unboundedly (use with care; prefer "window" for infinite streams)
 *   - "window" — keeps last N items (ring buffer)
 *   - "drop-oldest" — alias for window
 *   - "drop-newest" — drops new items when at capacity
 *
 * Use for: chat messages, event logs, notification feeds, stdout lines.
 */
export type FeedMode = "append" | "window" | "drop-oldest" | "drop-newest"

export interface FeedConfig {
  readonly mode?: FeedMode
  /** Max items to keep (required for window/drop modes) */
  readonly limit?: number
}

export interface StxFeed<A, E = never> {
  /** Current items array */
  readonly items: Atom.Atom<ReadonlyArray<A>>
  /** Total count of items ever received */
  readonly count: Atom.Atom<number>
  /** Is upstream still running? */
  readonly loading: Atom.Atom<boolean>
  /** Registry */
  readonly registry: AtomRegistry.AtomRegistry
  /** Control plane */
  readonly control: StxStreamControl
  /** Clear all items from the feed */
  readonly clear: () => void
}

// ─── stx.reduce ──────────────────────────────────────────────────────────────

/**
 * Chunk-aware event → state reducer. The throughput king.
 *
 * apply(state, event) is called per-event within a chunk but the atom only
 * fires ONCE per chunk (not per event), keeping React off the hot path.
 *
 * applyChunk(state, chunk) allows even faster bulk application if you can
 * process a whole chunk in one shot (e.g. SQL batch inserts, CRDT merges).
 *
 * Use for: search results keyed by id, datagrid transactions, event sourcing.
 */
export interface ReduceConfig<S, A> {
  /** Initial state */
  readonly initial: S
  /** Apply one event to state */
  readonly apply: (state: S, event: A) => S
  /** Optional: apply an entire chunk at once (faster than looping apply) */
  readonly applyChunk?: (state: S, chunk: ReadonlyArray<A>) => S
}

export interface StxReduce<S, A = unknown, E = never> {
  /** Current reduced state */
  readonly state: Atom.Atom<S>
  /** Is upstream still running? */
  readonly loading: Atom.Atom<boolean>
  /** Registry */
  readonly registry: AtomRegistry.AtomRegistry
  /** Control plane */
  readonly control: StxStreamControl
  /** Reset state to initial value */
  readonly reset: () => void
}

// ─── stx.pull ────────────────────────────────────────────────────────────────

/**
 * Manual pull-based streaming. Extends the existing fromPull with:
 *   - accumulation modes (append/replace)
 *   - cursor exposure
 *   - reset / restart
 *
 * Use for: pagination, infinite scroll, lazy loading.
 */
export type PullAccumMode = "append" | "replace"

export interface PullConfig {
  readonly mode?: PullAccumMode
  /** Page/cursor tracking — expose as atom */
  readonly trackCursor?: boolean
}

export interface StxPullV2<A, E = never> {
  /** Accumulated items */
  readonly items: Atom.Atom<ReadonlyArray<A>>
  /** Page/cursor (if trackCursor enabled) */
  readonly cursor: Atom.Atom<number>
  /** Is the current pull in flight? */
  readonly loading: Atom.Atom<boolean>
  /** Is upstream exhausted? */
  readonly done: Atom.Atom<boolean>
  /** Error, if any */
  readonly error: Atom.Atom<E | undefined>
  /** Registry */
  readonly registry: AtomRegistry.AtomRegistry
  /** Trigger next pull */
  readonly pull: () => void
  /** Reset state and cursor, restart from beginning */
  readonly reset: () => void
  /** Dispose fiber */
  readonly dispose: () => void
}

// ─── stx.duplex ──────────────────────────────────────────────────────────────

/**
 * Bidirectional stream config.
 * Two independent streams: inbound accumulates into a feed atom,
 * outbound tracks the latest emitted value.
 *
 * Use for: WebSocket (receive/send), harness stdout/stdin, agent RPC.
 */
export interface DuplexConfig {
  /** Feed mode for inbound accumulation (default: "append") */
  readonly mode?: "append" | "window"
  /** Max inbound items when mode="window" (default: Infinity) */
  readonly limit?: number
}

export interface StxDuplex<In, Out, E = never> {
  /** Accumulated inbound items */
  readonly inbound:  Atom.Atom<ReadonlyArray<In>>
  /** Latest outbound value */
  readonly outbound: Atom.Atom<Out | undefined>
  /** Is any stream still loading? */
  readonly loading:  Atom.Atom<boolean>
  /** Registry */
  readonly registry: AtomRegistry.AtomRegistry
  /** Control plane (dispose, pause, resume) */
  readonly control:  StxStreamControl
}

// ─── stx.shared ──────────────────────────────────────────────────────────────

/**
 * Hot/shared stream via PubSub multicast.
 * One upstream, N independent subscriber atoms.
 *
 * Use for: live telemetry, cross-component event bus, shared search feed.
 */
export interface SharedConfig {
  /** Buffer capacity for the PubSub (default: 256) */
  readonly capacity?: number
  /** Feed mode for each subscriber (default: "append") */
  readonly mode?: "append" | "window"
  /** Max items per subscriber when mode="window" (default: Infinity) */
  readonly limit?: number
}

export interface StxSharedSubscription<A> {
  /** Accumulated items for this subscriber */
  readonly items:   Atom.Atom<ReadonlyArray<A>>
  /** Latest value received by this subscriber */
  readonly latest:  Atom.Atom<A | undefined>
  /** Stop this subscription (does not stop the upstream) */
  readonly dispose: () => void
}

export interface StxShared<A, E = never> {
  /** Create a new independent subscriber atom pair */
  readonly subscribe: () => StxSharedSubscription<A>
  /** Registry */
  readonly registry: AtomRegistry.AtomRegistry
  /** Control plane (dispose = shutdown upstream + all subscribers) */
  readonly control:  StxStreamControl
}
