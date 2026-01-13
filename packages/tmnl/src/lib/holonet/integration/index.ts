/**
 * Holonet Integration Layer
 *
 * High-level integrations that bridge Holonet's NATS services with
 * existing TMNL patterns (DurableStreams, EventLog, etc.).
 *
 * @module holonet/integration
 */

// Stream Processor - DurableStreams replacement
export {
  // Factory
  makeStreamProcessor,
  makeStreamProcessorLayer,

  // Service tag
  HolonetStreamProcessor,

  // Configuration
  StreamProcessorConfig,
  type StreamProcessorConfig as StreamProcessorConfigType,

  // Result types
  type PublishResult,
  type ReadResult,
  type StreamMessage,
  type StreamInfoResult,

  // Service shape
  type HolonetStreamProcessorShape,

  // Errors
  StreamProcessorError,
  StreamNotFoundError,
} from './stream-processor';
