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

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"

import { FetchError } from "../../../contracts/errors.js"
import { Wire, type WireShape } from "../Wire.js"
import { NatsBridgePort } from "./Port.js"

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
   * Contract-preserving seam for the future live implementation. Currently the
   * port is required only to prove composition shape; operations remain guarded.
   */
  static readonly layerFromPort = (
    options: NatsBridgeWireOptions = {},
  ): Layer.Layer<Wire, never, NatsBridgePort> => {
    const resolved = resolveNatsBridgeWireOptions(options)
    return Layer.effect(
      Wire,
      Effect.gen(function* () {
        yield* NatsBridgePort
        return Wire.of(makeNotImplementedWire(resolved))
      }),
    )
  }
}
