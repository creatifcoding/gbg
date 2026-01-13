/**
 * Durable-Streams HTTP API
 *
 * HttpApi definition and handlers for the durable-streams NATS bridge.
 *
 * @module holonet/durable-streams/api
 */

// ─── API Schema ─────────────────────────────────────────────────────────────
export {
  HolonetDurableStreamsApi,
  StreamsApi,
  HealthApi,

  // Request/Response schemas
  CreateStreamRequest,
  CreateStreamResponse,
  ReadQueryParams,
  AppendRequestBody,
  ProducerQueryParams,

  // API Error types
  ApiInvalidTokenError,
  ApiForbiddenError,
  ApiInvalidOffsetError,
  ApiSchemaValidationError,
  ApiStreamNotFoundError,
  ApiStreamExistsError,
  ApiContentTypeMismatchError,
  ApiSequenceConflictError,
  ApiLongPollTimeoutError,
  ApiNatsConnectionError,
  ApiInternalError,

  // Re-export type helpers
  type CreateStreamRequest as CreateStreamRequestType,
  type CreateStreamResponse as CreateStreamResponseType,
  type ReadQueryParams as ReadQueryParamsType,
  type AppendRequestBody as AppendRequestBodyType,
  type ProducerQueryParams as ProducerQueryParamsType,
} from './DurableStreamsApi';

// ─── Handlers ───────────────────────────────────────────────────────────────
export {
  StreamsHandlersLive,
  HealthHandlersLive,
  HolonetDurableStreamsApiLive,
} from './handlers';
