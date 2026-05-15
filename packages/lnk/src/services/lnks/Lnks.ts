/**
 * Lnks — ref-counted multi-stream client.
 *
 * # Why this layer
 *
 * `Lnk` is a single-stream handle. In real apps you have many streams,
 * often with multiple consumers each. Spinning up a fresh `Lnk` (driver
 * fiber + PubSub) per consumer wastes:
 *   - One driver fiber per stream is enough — multiple subscribers share it.
 *   - Closing the last consumer should stop the driver fiber.
 *   - Re-opening a stream that was just closed should reuse a still-alive handle.
 *
 * `Lnks` solves this with `RcMap<StreamId, Lnk>`:
 *   - First `connect(streamId)` acquires the handle; subsequent calls reuse it.
 *   - When the LAST referencer closes its scope, the handle is released
 *     (driver fiber interrupted, PubSub shut down).
 *   - Resources are bounded by an optional capacity + idle TTL.
 *
 * # Example
 *
 * ```ts
 * import { Effect } from "effect-v4"
 * import { Lnks } from "@tmnl/lnk/services"
 * import { InMemoryWire } from "@tmnl/lnk/services/wire/in-memory"
 *
 * const program = Effect.gen(function*() {
 *   const lnks = yield* Lnks.Lnks
 *   const lnk1 = yield* lnks.connect(streamId, contentType)
 *   const lnk2 = yield* lnks.connect(streamId, contentType)
 *   // lnk1 === lnk2 (same underlying handle)
 *   yield* lnk2.append(payload)
 * })
 *
 * Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(Lnks.layer()),
 *     Effect.provide(InMemoryWire.layer),
 *   ),
 * )
 * ```
 *
 * @module @tmnl/lnk/services/lnks/Lnks
 */

import type * as Cause from "effect-v4/Cause"
import * as Context from "effect-v4/Context"
import * as Duration from "effect-v4/Duration"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as RcMap from "effect-v4/RcMap"
import type * as Schema from "effect-v4/Schema"
import type * as Scope from "effect-v4/Scope"

import type { ContentType } from "../../contracts/ContentType.js"
import type { FetchError } from "../../contracts/errors.js"
import type { StreamId } from "../../contracts/StreamId.js"
import { JSON_CONTENT_TYPE, TypedLnk, withSchema } from "./TypedLnk.js"
import { Wire } from "../wire/Wire.js"
import { Lnk, type LnkMakeOptions } from "./Lnk.js"

// ─── Config ─────────────────────────────────────────────────────────────────

export interface LnksConfig {
  /**
   * Maximum number of cached handles. Excess connect attempts fail with
   * `ExceededCapacityError`. Default: unlimited.
   */
  readonly capacity?: number
  /**
   * After the last reference releases, wait this duration before evicting.
   * Useful when callers reconnect rapidly. Default: 0 (immediate eviction).
   */
  readonly idleTimeToLive?: Duration.Input
  /** Default options applied to every `Lnk.make` call. */
  readonly defaultLnkOptions?: LnkMakeOptions
}

// ─── Lookup-key composite ───────────────────────────────────────────────────

/**
 * Composite cache key: a stream might be opened with different start
 * offsets in the same session. We dedupe by `streamId` only — concurrent
 * opens with different `fromOffset` values share the FIRST opener's choice.
 *
 * For "different cursor" use cases, callers should use a one-shot
 * `Lnk#read({fromOffset})` instead of opening a separate handle.
 */
type LnkCacheKey = string

const cacheKey = (streamId: StreamId): LnkCacheKey => streamId as string

// ─── Lnks shape ─────────────────────────────────────────────────────────────

export interface LnksShape {
  /**
   * Connect to a stream by ID. Reuses an existing handle if one is live;
   * otherwise constructs a new `Lnk` with the supplied content-type and
   * options.
   *
   * Returns a `Lnk` scoped to the caller's `Scope`. When the LAST scope
   * referencing a given streamId closes, the underlying handle is evicted
   * (driver fiber interrupted, PubSub shut down).
   *
   * Note on content-type: if a handle for this streamId is already live,
   * the supplied `contentType` is IGNORED (the existing handle's CT is
   * authoritative). For first-opener semantics, ensure the stream was
   * created with the desired CT via `Wire.put` before calling `connect`.
   */
  readonly connect: (
    streamId: StreamId,
    contentType: ContentType,
    options?: LnkMakeOptions,
  ) => Effect.Effect<Lnk, FetchError | Cause.ExceededCapacityError, Scope.Scope>

  /**
   * Schema-aware connect. Returns a typed handle that validates and
   * encodes outgoing values, and decodes incoming bytes via the supplied
   * schema. Default content-type is `application/json`.
   *
   * Lifecycle is identical to `connect`: the underlying raw `Lnk` is
   * ref-counted in the factory's `RcMap`, so multiple `connectTyped`
   * calls for the same streamId (with possibly different schemas)
   * share the same wire connection. Each call returns a distinct
   * lightweight `TypedLnk<A>` view.
   *
   * Phase 2.5. Underlying framing is JSON; binary framings come later.
   */
  readonly connectTyped: <A>(
    streamId: StreamId,
    schema: Schema.Schema<A>,
    options?: LnkMakeOptions,
  ) => Effect.Effect<
    TypedLnk<A>,
    FetchError | Cause.ExceededCapacityError,
    Scope.Scope
  >
}

// ─── Service tag + Layer ────────────────────────────────────────────────────

export class Lnks extends Context.Service<Lnks, LnksShape>()(
  "@tmnl/lnk/services/lnks/Lnks",
) {
  /**
   * Build a `Lnks` Layer with the given config (defaults: unlimited
   * capacity, immediate eviction). Requires `Wire` in the runtime context.
   */
  static readonly layer = (
    config: LnksConfig = {},
  ): Layer.Layer<Lnks, never, Wire> =>
    Layer.effect(
      Lnks,
      Effect.gen(function* () {
        const wire = yield* Wire

        // Side-channel for lookup args. RcMap.lookup only receives the key;
        // we stash full args here before each `RcMap.get` call so the
        // lookup function can read them. Concurrent `connect()` for the
        // same key is safe: only the FIRST call's args are used (subsequent
        // reads find the entry in the cache and skip lookup entirely).
        const pendingRequests = new Map<
          LnkCacheKey,
          {
            streamId: StreamId
            contentType: ContentType
            options?: LnkMakeOptions
          }
        >()

        const lookup = (key: LnkCacheKey) =>
          Effect.gen(function* () {
            const req = pendingRequests.get(key)
            if (req === undefined) {
              return yield* Effect.die(
                new Error(
                  `Lnks: no pending request for ${key} (internal invariant violated)`,
                ),
              )
            }
            return yield* Lnk.make(req.streamId, req.contentType, {
              ...config.defaultLnkOptions,
              ...req.options,
            }).pipe(Effect.provideService(Wire, wire))
          })
        const idleTimeToLive =
          config.idleTimeToLive !== undefined
            ? Duration.fromInputUnsafe(config.idleTimeToLive)
            : undefined
        // RcMap.make has two overloads: one requires `capacity`, one
        // forbids it. Split the call to satisfy strict optional types.
        // The two RcMap.make overloads return different error types
        // (`ExceededCapacityError` only when capacity is specified). We
        // unify them under the broader "may exceed capacity" type — even
        // for the unlimited variant the cast is sound because the broader
        // type is a strict superset.
        type RcMapWithCapacity = RcMap.RcMap<
          LnkCacheKey,
          Lnk,
          FetchError | Cause.ExceededCapacityError
        >
        const map: RcMapWithCapacity =
          config.capacity !== undefined
            ? yield* RcMap.make({
                lookup,
                capacity: config.capacity,
                ...(idleTimeToLive !== undefined ? { idleTimeToLive } : {}),
              })
            : ((yield* RcMap.make({
                lookup,
                ...(idleTimeToLive !== undefined ? { idleTimeToLive } : {}),
              })) as unknown as RcMapWithCapacity)

        const connect: LnksShape["connect"] = (
          streamId,
          contentType,
          options,
        ) => {
          const key = cacheKey(streamId)
          // Stash args BEFORE RcMap.get so the lookup callback can read
          // them. If the key is already cached, lookup isn't called and
          // the stash is unused (cleaned up on next put with same key).
          pendingRequests.set(key, {
            streamId,
            contentType,
            ...(options !== undefined ? { options } : {}),
          })
          return RcMap.get(map, key) as Effect.Effect<
            Lnk,
            FetchError | Cause.ExceededCapacityError,
            Scope.Scope
          >
        }

        const connectTyped: LnksShape["connectTyped"] = (
          streamId,
          schema,
          options,
        ) =>
          // Reuse `connect` (ref-counted, JSON content-type) and wrap with
          // the supplied schema. The returned `TypedLnk` is a lightweight
          // schema-bound view; the wire connection is owned by the underlying
          // ref-counted raw `Lnk`.
          Effect.map(connect(streamId, JSON_CONTENT_TYPE, options), (raw) =>
            withSchema(raw, schema),
          )

        return { connect, connectTyped }
      }),
    )

  /** Convenience: a default `Lnks` Layer with no config overrides. */
  static readonly Default: Layer.Layer<Lnks, never, Wire> = Lnks.layer()
}
