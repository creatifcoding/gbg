/**
 * NATS bridge wire skeleton.
 *
 * Exposes the port contract and guarded Wire layer for the future
 * @tmnl/msh-backed durable stream adapter.
 *
 * @module @tmnl/lnk/services/wire/nats-bridge
 */

export {
  NatsBridgeWire,
  DEFAULT_NATS_BRIDGE_OPTIONS,
  resolveNatsBridgeWireOptions,
  type NatsBridgeWireOptions,
  type ResolvedNatsBridgeWireOptions,
} from "./NatsBridgeWire.js"

export {
  NatsBridgePort,
  type NatsBridgePortShape,
  type NatsBridgeStreamMetadata,
  type NatsBridgeAppendInput,
  type NatsBridgeAppendResult,
  type NatsBridgeReadInput,
  type NatsBridgeReadResult,
} from "./Port.js"
