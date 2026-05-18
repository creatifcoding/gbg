/**
 * NatsBridgePort — internal port contract for the future MSH-backed Wire.
 *
 * This file records the boundary discovered from the legacy Holonet NATS bridge:
 * the LNK adapter owns Durable Streams semantics, while MSH owns only substrate
 * operations (JetStream/KV/subjects/auth). The port deliberately speaks in LNK
 * concepts so the adapter can be tested without leaking NATS details upward.
 *
 * Legacy inventory:
 *   - StreamBridgeService: create/append/read/metadata/delete over NATS.
 *   - ConsumerStateService: durable consumer naming and offset tracking.
 *   - LiveStreamService: long-poll/SSE behavior built above bridge reads.
 *   - nats-stream-bridge spike: JsMsg → Effect.Stream decoding pattern.
 *
 * MSH-backed implementation notes for the next phase:
 *   - Metadata should live in KV: content-type, schema-id, closed flag,
 *     producer fencing state, and tail offset/sequence.
 *   - Messages should live in JetStream subjects selected by stream id.
 *   - JetStream sequence values must be translated to LNK opaque offsets inside
 *     this package; callers must never parse those offsets.
 *   - Producer idempotency should use JetStream msgID when possible and KV for
 *     fencing state that JetStream does not model directly.
 *
 * @module @tmnl/lnk/services/wire/nats-bridge/Port
 */

import * as Context from "effect-v4/Context"
import type * as Effect from "effect-v4/Effect"
import type * as Stream from "effect-v4/Stream"

import type { ContentType } from "../../../contracts/ContentType.js"
import type { Offset, ReadPosition } from "../../../contracts/Offset.js"
import type { Epoch, ProducerId, Seq } from "../../../contracts/Producer.js"
import type { StreamId } from "../../../contracts/StreamId.js"
import type {
  FetchError,
  InvalidPayloadError,
  RetentionDroppedError,
  SequenceGapError,
  StaleEpochError,
  StreamClosedError,
  StreamConfigMismatchError,
  StreamNotFoundError,
} from "../../../contracts/errors.js"

export interface NatsBridgeStreamMetadata {
  readonly streamId: StreamId
  readonly contentType: ContentType
  readonly schemaId?: string
  readonly closed: boolean
  readonly nextOffset?: Offset
}

export interface NatsBridgeAppendInput {
  readonly streamId: StreamId
  readonly contentType?: ContentType
  readonly body: Uint8Array
  readonly producer?: {
    readonly producerId: ProducerId
    readonly epoch: Epoch
    readonly seq: Seq
  }
  readonly streamSeq?: string
  readonly streamClosed?: true
}

export interface NatsBridgeAppendResult {
  readonly nextOffset: Offset
  readonly duplicate: boolean
  readonly closed: boolean
  readonly producerEpoch?: Epoch
  readonly producerSeq?: Seq
}

export interface NatsBridgeReadInput {
  readonly streamId: StreamId
  readonly position: ReadPosition
  readonly limit?: number
  readonly live?: "poll" | "sse"
  readonly timeout?: number
  readonly cursor?: string
}

export interface NatsBridgeReadResult {
  readonly body: Stream.Stream<Uint8Array, FetchError, never>
  readonly nextOffset?: Offset
  readonly upToDate?: true
  readonly closed?: true
  readonly cursor?: string
}

export interface NatsBridgePortShape {
  readonly create: (input: {
    readonly streamId: StreamId
    readonly contentType: ContentType
    readonly body?: Uint8Array
    readonly streamClosed?: true
    readonly ttl?: number
    readonly expiresAt?: string
    readonly schemaId?: string
  }) => Effect.Effect<
    NatsBridgeStreamMetadata & { readonly created: boolean },
    FetchError | StreamConfigMismatchError
  >

  readonly append: (
    input: NatsBridgeAppendInput,
  ) => Effect.Effect<
    NatsBridgeAppendResult,
    | FetchError
    | InvalidPayloadError
    | StaleEpochError
    | SequenceGapError
    | StreamClosedError
    | StreamNotFoundError
    | StreamConfigMismatchError
  >

  readonly read: (
    input: NatsBridgeReadInput,
  ) => Effect.Effect<
    NatsBridgeReadResult,
    | FetchError
    | StreamNotFoundError
    | RetentionDroppedError
  >

  readonly metadata: (
    streamId: StreamId,
  ) => Effect.Effect<NatsBridgeStreamMetadata, FetchError | StreamNotFoundError>

  readonly delete: (
    streamId: StreamId,
  ) => Effect.Effect<{ readonly deleted: boolean }, FetchError>
}

export class NatsBridgePort extends Context.Service<
  NatsBridgePort,
  NatsBridgePortShape
>()("@tmnl/lnk/services/wire/nats-bridge/Port") {}
