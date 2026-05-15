/**
 * @tmnl/msh Integration Layer
 * @module @tmnl/msh/integration
 */

export {
  makeStreamProcessor,
  makeStreamProcessorLayer,
  MshStreamProcessor,
  StreamProcessorConfig,
  type StreamProcessorConfig as StreamProcessorConfigType,
  type PublishResult,
  type ReadResult,
  type StreamMessage,
  type StreamInfoResult,
  type MshStreamProcessorShape,
  StreamProcessorError,
  StreamNotFoundError,
} from './stream-processor';
