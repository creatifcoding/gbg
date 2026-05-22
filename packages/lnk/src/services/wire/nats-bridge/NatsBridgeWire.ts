/**
 * NatsBridgeWire — exported skeleton for the future MSH-backed Wire adapter.
 *
 * The package boundary is now present, but the full JetStream/KV-backed Durable
 * Streams implementation is intentionally deferred. Selecting this layer today
 * produces a Wire whose methods fail with a clear `FetchError` instead of
 * silently pretending to be production-ready. Prime, no cardboard engines under
 * the bonnet.
 *
 * @module @tmnl/lnk/services/wire/nats-bridge/NatsBridgeWire
 */

import * as Duration from "effect-v4/Duration"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"

import { FetchError } from "../../../contracts/errors.js"
import { Wire, type WireShape } from "../Wire.js"
import { NatsBridgePort, type NatsBridgePortShape } from "./Port.js"

export interface NatsBridgeWireOptions {
  /** Internal subject root for future MSH JetStream messages. */
  readonly subjectRoot?: string | undefined
  /** Prefix for generated JetStream stream names. */
  readonly streamNamePrefix?: string | undefined
  /** KV bucket used for stream metadata and producer fencing state. */
  readonly metadataBucket?: string | undefined
  /** Prefix for generated durable consumer names. */
  readonly consumerNamePrefix?: string | undefined
}

export interface ResolvedNatsBridgeWireOptions {
  readonly subjectRoot: string
  readonly streamNamePrefix: string
  readonly metadataBucket: string
  readonly consumerNamePrefix: string
}

export const DEFAULT_NATS_BRIDGE_OPTIONS: ResolvedNatsBridgeWireOptions = {
  subjectRoot: "_tmnl.lnk.stream",
  streamNamePrefix: "TMNL_LNK",
  metadataBucket: "TMNL_LNK_META",
  consumerNamePrefix: "tmnl-lnk",
}

export const resolveNatsBridgeWireOptions = (
  options: NatsBridgeWireOptions = {},
): ResolvedNatsBridgeWireOptions => ({
  subjectRoot: options.subjectRoot ?? DEFAULT_NATS_BRIDGE_OPTIONS.subjectRoot,
  streamNamePrefix:
    options.streamNamePrefix ?? DEFAULT_NATS_BRIDGE_OPTIONS.streamNamePrefix,
  metadataBucket:
    options.metadataBucket ?? DEFAULT_NATS_BRIDGE_OPTIONS.metadataBucket,
  consumerNamePrefix:
    options.consumerNamePrefix ?? DEFAULT_NATS_BRIDGE_OPTIONS.consumerNamePrefix,
})

const notImplemented = (
  operation: keyof WireShape,
  options: ResolvedNatsBridgeWireOptions,
): FetchError =>
  new FetchError({
    status: 501,
    message:
      `NatsBridgeWire.${operation} is not implemented yet ` +
      `(subjectRoot=${options.subjectRoot}, metadataBucket=${options.metadataBucket}). ` +
      "Use InMemoryWire/HttpWire until the MSH JetStream adapter is completed.",
  })

const makeNotImplementedWire = (
  options: ResolvedNatsBridgeWireOptions,
): WireShape => ({
  put: () => Effect.fail(notImplemented("put", options)),
  post: () => Effect.fail(notImplemented("post", options)),
  get: () => Effect.fail(notImplemented("get", options)),
  head: () => Effect.fail(notImplemented("head", options)),
  delete: () => Effect.fail(notImplemented("delete", options)),
})

const hasRealOffset = (offset: unknown): boolean =>
  offset !== undefined && offset !== "-"

type WirePutInput = Parameters<WireShape["put"]>[0]
type WirePostInput = Parameters<WireShape["post"]>[0]
type WireGetInput = Parameters<WireShape["get"]>[0]
type PortCreateInput = Parameters<NatsBridgePortShape["create"]>[0]
type PortAppendInput = Parameters<NatsBridgePortShape["append"]>[0]
type PortReadInput = Parameters<NatsBridgePortShape["read"]>[0]
type Writable<T> = { -readonly [K in keyof T]: T[K] }

const toPortCreateInput = (input: WirePutInput): PortCreateInput => {
  const out: Writable<PortCreateInput> = {
    streamId: input.streamId,
    contentType: input.contentType,
  }
  if (input.body !== undefined) out.body = input.body
  if (input.streamClosed === true) out.streamClosed = true
  if (input.streamTtl !== undefined) out.ttl = input.streamTtl
  if (input.streamExpiresAt !== undefined) out.expiresAt = input.streamExpiresAt
  if (input.schemaId !== undefined) out.schemaId = input.schemaId
  return out
}

const toPortAppendInput = (input: WirePostInput): PortAppendInput => {
  const out: Writable<PortAppendInput> = {
    streamId: input.streamId,
    body: input.body,
  }
  if (input.contentType !== undefined) out.contentType = input.contentType
  if (input.producer !== undefined) out.producer = input.producer
  if (input.streamSeq !== undefined) out.streamSeq = input.streamSeq
  if (input.streamClosed === true) out.streamClosed = true
  return out
}

const toPortReadInput = (input: WireGetInput): PortReadInput => {
  const out: Writable<PortReadInput> = {
    streamId: input.streamId,
    position: input.position,
  }
  if (input.limit !== undefined) out.limit = input.limit
  if (input.live !== undefined) out.live = input.live
  if (input.timeout !== undefined) out.timeout = Duration.millis(input.timeout)
  if (input.cursor !== undefined) out.cursor = input.cursor
  return out
}

export class NatsBridgeWire {
  /**
   * Skeleton Layer. It provides the Wire tag with explicit 501-style failures.
   * Future work will replace this with `layerFromPort` backed by @tmnl/msh.
   */
  static readonly layer = (
    options: NatsBridgeWireOptions = {},
  ): Layer.Layer<Wire> => {
    const resolved = resolveNatsBridgeWireOptions(options)
    return Layer.succeed(Wire)(Wire.of(makeNotImplementedWire(resolved)))
  }

  /**
   * Wire adapter over a bridge port. The default `layer` stays guarded until a
   * concrete MSH-backed port is provided; this seam is real and testable now.
   */
  static readonly layerFromPort = (
    options: NatsBridgeWireOptions = {},
  ): Layer.Layer<Wire, never, NatsBridgePort> => {
    const resolved = resolveNatsBridgeWireOptions(options)
    void resolved
    return Layer.effect(
      Wire,
      Effect.gen(function* () {
        const port = yield* NatsBridgePort
        return Wire.of({
          put: (input) =>
            port.create(toPortCreateInput(input)).pipe(
              Effect.map((metadata) => ({
                streamId: metadata.streamId,
                contentType: metadata.contentType,
                created: metadata.created,
                closed: metadata.closed,
                ...(hasRealOffset(metadata.nextOffset) ? { nextOffset: metadata.nextOffset } : {}),
              })),
            ),
          post: (input) =>
            port.append(toPortAppendInput(input)),
          get: (input) =>
            port.read(toPortReadInput(input)).pipe(
              Effect.map((result) => ({
                body: result.body,
                upToDate: result.upToDate === true,
                closed: result.closed === true,
                ...(result.nextOffset !== undefined ? { nextOffset: result.nextOffset } : {}),
                ...(result.cursor !== undefined ? { cursor: result.cursor } : {}),
              })),
            ),
          head: (input) =>
            port.metadata(input.streamId).pipe(
              Effect.map((metadata) => ({
                contentType: metadata.contentType,
                closed: metadata.closed,
                ...(hasRealOffset(metadata.nextOffset) ? { nextOffset: metadata.nextOffset } : {}),
                ...(metadata.ttl !== undefined ? { ttl: metadata.ttl } : {}),
                ...(metadata.expiresAt !== undefined ? { expiresAt: metadata.expiresAt } : {}),
                ...(metadata.schemaId !== undefined ? { schemaId: metadata.schemaId } : {}),
              })),
            ),
          delete: (input) => port.delete(input.streamId),
        })
      }),
    )
  }
}
