/**
 * Wire — the public, transport-agnostic wire interface.
 *
 * `Wire` is a `Context.Service` whose shape is **hand-curated**
 * (deliberately not auto-derived from `RpcClient.From<typeof Protocol>`, which
 * leaks `AsQueue` / `Discard` generic flags that hand-rolled impls cannot
 * satisfy — see `spike/wire-shape.spike.ts`).
 *
 * Implementations:
 *   - `InMemoryWire` (Phase 1)   — in-process state store
 *   - `HttpWire`     (Phase 1.1) — real HTTP via `effect-v4/unstable/http/HttpClient`
 *   - `NatsBridgeWire` (Phase 5) — server-side adapter onto NATS JetStream
 *
 * Each implementation is a `Layer<Wire, ..., InternalService>`
 * that composes a per-impl internal Context.Service (`InMemoryInner`,
 * `HttpInner`, `NatsBridgeInner`).
 *
 * # Drift guard
 *
 * The `_DriftGuard` type below ensures `WireShape`'s method tags
 * remain a subset of the `Protocol` RpcGroup's Rpc tags. Adding a new Rpc to
 * `Wire` without adding a corresponding method here will fail to compile.
 *
 * @module @tmnl/lnk/services/wire/Wire
 */

import * as Context from "effect-v4/Context"
import type * as Effect from "effect-v4/Effect"
import type * as Scope from "effect-v4/Scope"
import type * as Stream from "effect-v4/Stream"
import type * as RpcGroup from "effect-v4/unstable/rpc/RpcGroup"

import {
  type Protocol,
  type PutInput,
  type PutResult,
  type PostInput,
  type PostResult,
  type GetInput,
  type GetHeaders,
  type HeadInput,
  type HeadResult,
  type DeleteInput,
  type DeleteResult,
} from "./Protocol.js"

import {
  type FetchError,
  type InvalidPayloadError,
  type StaleEpochError,
  type SequenceGapError,
  type StreamClosedError,
  type StreamNotFoundError,
  type StreamConfigMismatchError,
  type RetentionDroppedError,
  type InvalidOffsetError,
} from "../../contracts/errors.js"

// ─── Type extraction from the Protocol spec ─────────────────────────────────

/** Canonical `Schema.Type` extractor — works on any Wire op schema. */
type T<S> = S extends { Type: infer X } ? X : never

/** Inputs. */
export type PutInputT = T<typeof PutInput>
export type PostInputT = T<typeof PostInput>
export type GetInputT = T<typeof GetInput>
export type HeadInputT = T<typeof HeadInput>
export type DeleteInputT = T<typeof DeleteInput>

/** Schema'd outputs (the raw header/metadata parts). */
export type PutResultT = T<typeof PutResult>
export type PostResultT = T<typeof PostResult>
export type GetHeadersT = T<typeof GetHeaders>
export type HeadResultT = T<typeof HeadResult>
export type DeleteResultT = T<typeof DeleteResult>

// ─── GetResult — the only op result that extends its schema with a Stream ──

/**
 * Result of a `get` operation.
 *
 * Extends the schema-able `GetHeaders` with a non-schema-able `body` field
 * carrying the raw byte stream. Streams aren't representable in
 * `Schema.Schema`, so the body sits outside the Rpc spec by design — but
 * lives in the runtime service shape because byte transport is the whole
 * point of `get`.
 *
 * The body's `Stream` requires `Scope` to drive the underlying transport
 * (HTTP connection, in-memory iterator). The outer `get(input)` Effect is
 * therefore returned with `Scope` in its requirements.
 */
export interface GetResult extends GetHeadersT {
  readonly body: Stream.Stream<Uint8Array, FetchError, never>
}

// ─── Hand-curated service shape ─────────────────────────────────────────────

/**
 * The methods exposed by `Wire`.
 *
 * Each method's input/output/error types are extracted from the
 * corresponding `Rpc.make(...)` schemas in `Wire.ts`. This keeps a single
 * source of truth (the `Protocol` RpcGroup) while letting us hand-pick the
 * runtime shape (no `AsQueue` / `Discard` flags).
 */
export interface WireShape {
  /**
   * PUT /streams/:id — create a stream. Idempotent on matching config.
   *
   * Optionally appends an initial body atomically (per spec: PUT with body
   * = create-and-append in one round trip). When `body` is supplied, the
   * `nextOffset` field of the result reflects the offset of the last
   * appended message.
   */
  readonly put: (
    input: PutInput_PutBody,
  ) => Effect.Effect<PutResultT, FetchError | StreamConfigMismatchError>

  /** POST /streams/:id — append bytes. Producer headers optional. */
  readonly post: (
    input: PostInput_PostBody,
  ) => Effect.Effect<
    PostResultT,
    | FetchError
    | InvalidPayloadError
    | StaleEpochError
    | SequenceGapError
    | StreamClosedError
    | StreamNotFoundError
    | StreamConfigMismatchError
  >

  /**
   * GET /streams/:id?offset=… — read from a position.
   *
   * Returns `GetResult = GetHeaders + body Stream<Uint8Array>`. Caller is
   * responsible for `Effect.scoped(...)`-bounding the operation so the body
   * stream's transport closes.
   */
  readonly get: (
    input: GetInputT,
  ) => Effect.Effect<
    GetResult,
    | FetchError
    | StreamNotFoundError
    | RetentionDroppedError
    | InvalidOffsetError,
    Scope.Scope
  >

  /** HEAD /streams/:id — metadata-only query. */
  readonly head: (
    input: HeadInputT,
  ) => Effect.Effect<HeadResultT, FetchError | StreamNotFoundError>

  /** DELETE /streams/:id — remove stream. Returns `{ deleted: false }` if absent. */
  readonly delete: (
    input: DeleteInputT,
  ) => Effect.Effect<DeleteResultT, FetchError>
}

/**
 * `PutInput` augmented with a runtime-only `body` field.
 *
 * Per spec, PUT optionally accepts an initial body that is atomically
 * appended after stream creation. The body is `Schema`-orthogonal (raw bytes
 * are content-type-driven framing concerns, not part of the metadata schema).
 */
export interface PutInput_PutBody extends PutInputT {
  /** Optional initial body to append atomically with stream creation. */
  readonly body?: Uint8Array
}

/**
 * `PostInput` augmented with a runtime-only `body` field.
 *
 * `body` is a `Uint8Array` payload at the wire level. It's not schema'd into
 * `PostInput` because Schema doesn't model untyped bytes for the body — the
 * spec leaves the body as opaque bytes whose framing is governed by the
 * stream's `Content-Type`.
 *
 * Phase 1.1 will introduce a streaming-upload variant `postStream` accepting
 * a `Stream<Uint8Array>` for large bodies.
 */
export interface PostInput_PostBody extends PostInputT {
  readonly body: Uint8Array
}

// ─── Compile-time drift guard ───────────────────────────────────────────────
//
// The set of method tags in the curated shape MUST be a subset of the set of
// Rpc tags in the Wire group. Adding an Rpc to Wire without adding a method
// here triggers a compile error in implementations (which won't satisfy the
// updated shape). Removing an Rpc but keeping the method here triggers
// failure in this guard.

type _ProtocolTags = RpcGroup.Rpcs<typeof Protocol>["_tag"]
type _CuratedTags = keyof WireShape

type _DriftGuard = [_CuratedTags] extends [_ProtocolTags]
  ? [_ProtocolTags] extends [_CuratedTags]
    ? true
    : "FAIL: Protocol has Rpcs not present in WireShape"
  : "FAIL: WireShape has methods not present in Protocol"

const _driftGuard: _DriftGuard = true
void _driftGuard

// ─── Service tag ────────────────────────────────────────────────────────────

/**
 * The wire service. Use `yield* Wire` in `Effect.gen` to access
 * the methods, then provide a Layer (`InMemoryWire`, `HttpWire`, etc.) at
 * the runtime boundary.
 *
 * @example
 * ```ts
 * import { Effect, Layer } from "effect-v4"
 * import { Wire } from "@tmnl/lnk/services/wire"
 * import { InMemoryWire } from "@tmnl/lnk/services/wire/in-memory"
 *
 * const program = Effect.gen(function*() {
 *   const wire = yield* Wire
 *   yield* wire.put({ streamId: ..., contentType: ... })
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(InMemoryWire.layer)))
 * ```
 */
export class Wire extends Context.Service<
  Wire,
  WireShape
>()("@tmnl/lnk/services/wire/Wire") {}
