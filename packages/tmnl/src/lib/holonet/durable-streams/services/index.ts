/**
 * Durable-Streams Services
 *
 * Effect services for the durable-streams ↔ NATS bridge.
 *
 * @module holonet/durable-streams/services
 */

export {
  // Service
  StreamCodecService,
  type StreamCodecServiceShape,

  // Constants
  HEADER_SCHEMA_ID,
  HEADER_CONTENT_TYPE,
  HEADER_SCHEMA_VERSION,

  // Types
  type SchemaHeaders,
  type EncodeResult,
  type DecodeResult,
  type JsMsgLike,

  // Errors
  CodecError,
  SchemaValidationError,
  MissingSchemaHeaderError,

  // Utilities
  createSchemaHeaders,
  extractSchemaId,
  hasSchemaHeaders,
} from './StreamCodecService';

export {
  // Service
  ConsumerStateService,
  type ConsumerStateServiceShape,

  // Types
  type ConsumerState,
  type ConsumerOptions,

  // Errors
  ConsumerStateError,
  ConsumerNotFoundError,
} from './ConsumerStateService';

export {
  // Service
  StreamBridgeService,
  type StreamBridgeServiceShape,

  // Types
  type CreateResult,
  type ReadOptions,
  type StreamBridgeError,
} from './StreamBridgeService';
