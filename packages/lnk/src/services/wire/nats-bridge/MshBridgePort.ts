/**
 * Public MSH-branded port aliases.
 *
 * The bridge consumes MSH substrate services, but owns Durable Streams domain
 * semantics in LNK. These aliases make that intent explicit while preserving
 * the existing `nats-bridge` compatibility surface.
 */

export {
  NatsBridgePort as MshBridgePort,
  type NatsBridgePortShape as MshBridgePortShape,
  type NatsBridgeStreamMetadata as MshBridgeStreamMetadata,
  type NatsBridgeAppendInput as MshBridgeAppendInput,
  type NatsBridgeAppendResult as MshBridgeAppendResult,
  type NatsBridgeReadInput as MshBridgeReadInput,
  type NatsBridgeReadResult as MshBridgeReadResult,
} from "./Port.js"
