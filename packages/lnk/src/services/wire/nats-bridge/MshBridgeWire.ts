/**
 * MshBridgeWire — concrete @tmnl/msh-backed Durable Streams Wire.
 *
 * LNK owns the Durable Streams semantics; MSH provides the NATS/JetStream/KV
 * substrate. `NatsBridgeWire` remains as the guarded compatibility skeleton,
 * while this public MSH-branded layer composes the real port/adapters.
 */

import * as Layer from "effect/Layer"
import {
  NatsConnectionService,
  NatsInnerService,
  NatsKVService,
  NatsStreamService,
} from "@tmnl/msh/nats"
import type { MshConfigInput } from "@tmnl/msh"

import { Wire } from "../Wire.js"
import {
  DEFAULT_NATS_BRIDGE_OPTIONS,
  NatsBridgeWire,
  resolveNatsBridgeWireOptions,
  type NatsBridgeWireOptions,
  type ResolvedNatsBridgeWireOptions,
} from "./NatsBridgeWire.js"
import { MshBatchPublisher } from "./MshBatchPublisher.js"
import { MshBridgePortLive } from "./MshBridgePortLive.js"
import { MshCasMetadataStore } from "./MshCasMetadataStore.js"
import { NatsBridgePort } from "./Port.js"
import { ShardGuard, type ShardGuardOptions } from "./ShardGuard.js"

export interface MshBridgeWireOptions extends NatsBridgeWireOptions {
  /** NATS/WebSocket server(s) for the MSH substrate connection. */
  readonly servers?: MshConfigInput["servers"] | undefined
  /** NATS connection name. */
  readonly name?: string | undefined
  readonly reconnect?: boolean | undefined
  readonly maxReconnectAttempts?: number | undefined
  readonly reconnectDelayMs?: number | undefined
  readonly debug?: boolean | undefined
  /** Local contention reduction before distributed KV/JetStream CAS. */
  readonly shardCount?: number | undefined
}

export interface ResolvedMshBridgeWireOptions extends ResolvedNatsBridgeWireOptions {
  readonly servers: MshConfigInput["servers"]
  readonly name: string
  readonly reconnect: boolean
  readonly maxReconnectAttempts: number
  readonly reconnectDelayMs: number
  readonly debug: boolean
  readonly shardCount?: number | undefined
}

export const DEFAULT_MSH_BRIDGE_OPTIONS: ResolvedMshBridgeWireOptions = {
  ...DEFAULT_NATS_BRIDGE_OPTIONS,
  servers: "ws://localhost:9222",
  name: "tmnl-lnk-msh-bridge",
  reconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelayMs: 2_000,
  debug: false,
}

export const resolveMshBridgeWireOptions = (
  options: MshBridgeWireOptions = {},
): ResolvedMshBridgeWireOptions => ({
  ...resolveNatsBridgeWireOptions(options),
  servers: options.servers ?? DEFAULT_MSH_BRIDGE_OPTIONS.servers,
  name: options.name ?? DEFAULT_MSH_BRIDGE_OPTIONS.name,
  reconnect: options.reconnect ?? DEFAULT_MSH_BRIDGE_OPTIONS.reconnect,
  maxReconnectAttempts:
    options.maxReconnectAttempts ?? DEFAULT_MSH_BRIDGE_OPTIONS.maxReconnectAttempts,
  reconnectDelayMs:
    options.reconnectDelayMs ?? DEFAULT_MSH_BRIDGE_OPTIONS.reconnectDelayMs,
  debug: options.debug ?? DEFAULT_MSH_BRIDGE_OPTIONS.debug,
  ...(options.shardCount !== undefined ? { shardCount: options.shardCount } : {}),
})

const shardOptions = (
  options: ResolvedMshBridgeWireOptions,
): ShardGuardOptions =>
  options.shardCount === undefined ? {} : { shardCount: options.shardCount }

const connectionConfig = (
  options: ResolvedMshBridgeWireOptions,
): MshConfigInput => ({
  servers: options.servers,
  name: options.name,
  reconnect: options.reconnect,
  maxReconnectAttempts: options.maxReconnectAttempts,
  reconnectDelayMs: options.reconnectDelayMs,
  debug: options.debug,
})

export class MshBridgeWire {
  /** Adapter seam for tests and custom bridge ports. */
  static readonly layerFromPort = NatsBridgeWire.layerFromPort

  /** Real Wire over already-provided MSH KV/JetStream services. */
  static readonly layerFromMshServices = (
    options: MshBridgeWireOptions = {},
  ): Layer.Layer<Wire, never, NatsKVService | NatsStreamService> => {
    const resolved = resolveMshBridgeWireOptions(options)
    const bridgeDeps = Layer.mergeAll(
      MshCasMetadataStore.layer(resolved),
      MshBatchPublisher.layer(resolved),
      ShardGuard.layer(shardOptions(resolved)),
    )
    const portLayer = MshBridgePortLive.layer(resolved).pipe(
      Layer.provide(bridgeDeps),
    )
    return NatsBridgeWire.layerFromPort(resolved).pipe(
      Layer.provide(portLayer),
    )
  }

  /** Fully-composed live layer: MSH connection + inner + KV + Stream + Wire. */
  static readonly layer = (
    options: MshBridgeWireOptions = {},
  ) => {
    const resolved = resolveMshBridgeWireOptions(options)
    const connection = NatsConnectionService.layerCustom(connectionConfig(resolved))
    const inner = NatsInnerService.layerFromConnection.pipe(
      Layer.provide(connection),
    )
    const mshServices = Layer.mergeAll(
      NatsKVService.layerFromInner,
      NatsStreamService.layerFromInner,
    ).pipe(Layer.provide(inner))

    return MshBridgeWire.layerFromMshServices(resolved).pipe(
      Layer.provide(mshServices),
    )
  }
}

export type { NatsBridgeWireOptions, ResolvedNatsBridgeWireOptions }
export { NatsBridgeWire }
