/**
 * Lnk × @tmnl/stx integration — turn a `Lnk` into reactive atoms.
 *
 * # Why this layer
 *
 * `Lnk` is a yieldable handle for Effect-direct use (`yield* lnk` in
 * `Effect.gen`). For React / signal-based UIs, you want REACTIVE atoms
 * that re-render when messages arrive. `@tmnl/stx` provides materializers
 * (`stxLatest`, `stxFeed`, etc.) that bridge Effect Streams to Atom-based
 * reactive state.
 *
 * This module is the thin connector: take a `Lnk`, return atoms.
 *
 * # Materializers
 *
 *   - `lnkLatest(lnk, registry)` — latest message only (overwrite).
 *     Use for: live values, last-seen status, single-snapshot readouts.
 *   - `lnkFeed(lnk, registry, opts)` — append/window/ring buffer.
 *     Use for: chat logs, event timelines, append-only feeds.
 *
 * # Lifecycle
 *
 * The materializers internally use `Stream.fromPubSub(lnk._pubsub)`, which
 * is `Stream<Message, never, never>` — no Scope dependency leaks. The
 * underlying subscription's lifetime is bound to the materializer's fiber,
 * which `@tmnl/stx` runs via `Effect.runFork` and ties to its own atom
 * lifecycle. When the registry tears down (e.g. component unmount), the
 * fiber is interrupted and the subscription closes.
 *
 * @module @tmnl/lnk/services/lnks/Stx
 */

import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as Stream from "effect/Stream"
import {
  stxFeed,
  stxLatest,
  type FeedConfig,
  type StxFeed,
  type StxLatest,
} from "@tmnl/stx"

import type { Lnk } from "./Lnk.js"
import type { Message } from "./Message.js"

// ─── Latest ─────────────────────────────────────────────────────────────────

/**
 * Track the latest message received by a `Lnk` as reactive atoms.
 *
 * Returns `StxLatest<Message, never>` with atoms for:
 *   - `value`   — `Option<Message>` (None until first message arrives)
 *   - `loading` — true until first message; false after
 *   - `done`    — true after the stream finishes (e.g. Stream-Closed)
 *   - `error`   — never set (the wrapped stream is `never`-typed)
 *
 * The subscription is alive for the duration of the materializer's
 * internal fiber (interrupted on registry teardown).
 *
 * @example
 * ```tsx
 * import { useStxLatest } from "@tmnl/stx"
 * import { lnkLatest } from "@tmnl/lnk/services"
 *
 * function LiveValue({ lnk, registry }) {
 *   const instance = React.useMemo(
 *     () => lnkLatest(lnk, registry),
 *     [lnk, registry],
 *   )
 *   const { value } = useStxLatest(instance)
 *   return <div>{value?.payload ? new TextDecoder().decode(value.payload) : "—"}</div>
 * }
 * ```
 */
export const lnkLatest = (
  lnk: Lnk,
  registry: AtomRegistry.AtomRegistry,
): StxLatest<Message, never> =>
  stxLatest(
    Stream.fromPubSub(lnk._pubsub),
    registry,
  )

// ─── Feed ───────────────────────────────────────────────────────────────────

/**
 * Track an append-only feed of messages received by a `Lnk` as reactive
 * atoms. Supports windowed (drop-old-when-full) buffering for log-shaped
 * UIs.
 *
 * Returns `StxFeed<Message>` with atoms for:
 *   - `items` — `ReadonlyArray<Message>` (chronologically ordered)
 *   - `loading`, `done`, `error` (same semantics as `lnkLatest`)
 *
 * @example
 * ```tsx
 * import { useStxFeed } from "@tmnl/stx"
 * import { lnkFeed } from "@tmnl/lnk/services"
 *
 * function MessageLog({ lnk, registry }) {
 *   const instance = React.useMemo(
 *     () => lnkFeed(lnk, registry, { maxItems: 100 }),
 *     [lnk, registry],
 *   )
 *   const { items } = useStxFeed(instance)
 *   return (
 *     <ul>
 *       {items.map((m, i) => (
 *         <li key={i}>{new TextDecoder().decode(m.payload)}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export const lnkFeed = (
  lnk: Lnk,
  registry: AtomRegistry.AtomRegistry,
  options?: FeedConfig,
): StxFeed<Message> =>
  stxFeed(
    Stream.fromPubSub(lnk._pubsub),
    options ?? {},
    registry,
  )
