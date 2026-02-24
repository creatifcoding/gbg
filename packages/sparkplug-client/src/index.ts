/**
 * @selfcharters/sparkplug-client
 *
 * Configurable, spec-compliant, Effect-native Sparkplug B client.
 *
 * Fork lineage: Eclipse Tahu → Nortech (mqtt v5) → @selfcharters (unlock, fix Will QoS, add Effect)
 *
 * @module @selfcharters/sparkplug-client
 */

// Config
export {
  SparkplugConfig,
  MqttSessionConfig,
  WillConfig,
  PublishConfig,
  StateConfig,
} from './config'

// Errors
export { SparkplugError, SparkplugErrorCode } from './errors'

// Protocol
export {
  buildTopic,
  parseTopic,
  makeSeqCounter,
  makeBdSeqCounter,
  makeDeathPayload,
  makeWillMessage,
  type SparkplugMessageType,
  type SparkplugTopic,
  type WillMessage,
  type DeathPayload,
} from './SparkplugProtocol'

// Codec
export {
  encodePayload,
  decodePayload,
  decodeMetricValue,
  extractQuality,
  type UPayload,
  type UMetric,
  type UPropertyValue,
} from './SparkplugCodec'

// Transport
export {
  MqttTransport,
  MqttTransportLive,
  type MqttTransportShape,
  type MqttMessage,
} from './MqttTransport'
