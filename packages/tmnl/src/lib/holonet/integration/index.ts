/**
 * Holonet Integration Layer
 *
 * High-level integrations that bridge Holonet's NATS services with
 * existing TMNL patterns (DurableStreams, EventLog, etc.).
 *
 * @module holonet/integration
 */

export {
  makeStreamProcessor,
  makeStreamProcessorLayer,
  HolonetStreamProcessor,
  StreamProcessorConfig,
  type StreamProcessorConfig as StreamProcessorConfigType,
  type PublishResult,
  type ReadResult,
  type StreamMessage,
  type StreamInfoResult,
  type HolonetStreamProcessorShape,
  StreamProcessorError,
  StreamNotFoundError,
} from './stream-processor';

// durable-streams-client removed — consumers should use @tmnl/msh StreamProcessor
