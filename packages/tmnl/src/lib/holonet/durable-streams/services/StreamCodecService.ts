/**
 * StreamCodecService
 *
 * Schema-aware encoding and decoding for durable-streams ↔ NATS integration.
 * Handles schema validation, JSON serialization, and NATS header injection/extraction.
 *
 * Key responsibilities:
 * - Validate data against Effect Schema before encoding
 * - Inject schema metadata into NATS headers (X-Schema-Id, X-Content-Type)
 * - Extract schema from headers and validate on decode
 * - Graceful error handling with typed errors
 *
 * @module holonet/durable-streams/services/StreamCodecService
 */

import { Effect, Data, Schema, ParseResult } from 'effect';
import { SchemaRegistry, SchemaNotFoundError } from '@/lib/holonet/core/schema';

// =============================================================================
// Types
// =============================================================================

/**
 * Standard NATS message header keys for schema metadata
 */
export const HEADER_SCHEMA_ID = 'X-Schema-Id';
export const HEADER_CONTENT_TYPE = 'X-Content-Type';
export const HEADER_SCHEMA_VERSION = 'X-Schema-Version';

/**
 * Headers object for NATS messages
 */
export interface SchemaHeaders {
  readonly [HEADER_SCHEMA_ID]: string;
  readonly [HEADER_CONTENT_TYPE]: string;
  readonly [HEADER_SCHEMA_VERSION]?: string;
}

/**
 * Result of encoding with schema
 */
export interface EncodeResult {
  readonly bytes: Uint8Array;
  readonly headers: SchemaHeaders;
}

/**
 * Result of decoding with schema
 */
export interface DecodeResult<A = unknown> {
  readonly data: A;
  readonly schemaId: string;
}

/**
 * Minimal interface for NATS JsMsg (only what we need)
 */
export interface JsMsgLike {
  readonly data: Uint8Array;
  readonly headers?: {
    get(key: string): string | null;
  };
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error during codec operations
 */
export class CodecError extends Data.TaggedError('CodecError')<{
  readonly operation: 'encode' | 'decode';
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when schema validation fails
 */
export class SchemaValidationError extends Data.TaggedError('SchemaValidationError')<{
  readonly schemaId: string;
  readonly operation: 'encode' | 'decode';
  readonly parseError: ParseResult.ParseError;
}> {}

/**
 * Error when schema header is missing from message
 */
export class MissingSchemaHeaderError extends Data.TaggedError('MissingSchemaHeaderError')<{
  readonly headerName: string;
  readonly message?: string;
}> {}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * StreamCodecService shape - schema-aware encoding/decoding
 */
export interface StreamCodecServiceShape {
  /**
   * Encode data with schema validation and header injection.
   *
   * 1. Look up schema by schemaId
   * 2. Validate data against schema
   * 3. Encode to JSON bytes
   * 4. Return bytes + headers for NATS publish
   */
  readonly encodeWithSchema: (
    schemaId: string,
    data: unknown
  ) => Effect.Effect<
    EncodeResult,
    CodecError | SchemaValidationError | SchemaNotFoundError
  >;

  /**
   * Decode message using schema from headers.
   *
   * 1. Extract schemaId from message headers
   * 2. Look up schema by schemaId
   * 3. Decode JSON bytes to object
   * 4. Validate against schema
   * 5. Return typed data + schemaId
   */
  readonly decodeWithSchema: <A = unknown>(
    msg: JsMsgLike
  ) => Effect.Effect<
    DecodeResult<A>,
    CodecError | SchemaValidationError | SchemaNotFoundError | MissingSchemaHeaderError
  >;

  /**
   * Decode message using a specific schema (bypass header lookup).
   * Useful when you know the schema ahead of time.
   */
  readonly decodeWithKnownSchema: <A, I>(
    msg: JsMsgLike,
    schema: Schema.Schema<A, I>
  ) => Effect.Effect<A, CodecError | SchemaValidationError>;

  /**
   * Simple JSON encoding without schema validation.
   */
  readonly encodeJson: (
    data: unknown
  ) => Effect.Effect<Uint8Array, CodecError>;

  /**
   * Simple JSON decoding without schema validation.
   */
  readonly decodeJson: (
    bytes: Uint8Array
  ) => Effect.Effect<unknown, CodecError>;
}

// =============================================================================
// Service Implementation
// =============================================================================

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class StreamCodecService extends Effect.Service<StreamCodecService>()(
  'holonet/durable-streams/StreamCodecService',
  {
    dependencies: [SchemaRegistry.Default],
    effect: Effect.gen(function* () {
      const registry = yield* SchemaRegistry;

      // ─────────────────────────────────────────────────────────────────────────
      // encodeJson - Simple JSON encoding
      // ─────────────────────────────────────────────────────────────────────────

      const encodeJson = (data: unknown): Effect.Effect<Uint8Array, CodecError> =>
        Effect.try({
          try: () => {
            const json = JSON.stringify(data);
            return textEncoder.encode(json);
          },
          catch: (error) =>
            new CodecError({
              operation: 'encode',
              reason: 'JSON serialization failed',
              cause: error,
            }),
        });

      // ─────────────────────────────────────────────────────────────────────────
      // decodeJson - Simple JSON decoding
      // ─────────────────────────────────────────────────────────────────────────

      const decodeJson = (bytes: Uint8Array): Effect.Effect<unknown, CodecError> =>
        Effect.try({
          try: () => {
            const json = textDecoder.decode(bytes);
            return JSON.parse(json);
          },
          catch: (error) =>
            new CodecError({
              operation: 'decode',
              reason: 'JSON parsing failed',
              cause: error,
            }),
        });

      // ─────────────────────────────────────────────────────────────────────────
      // encodeWithSchema - Schema-validated encoding with headers
      // ─────────────────────────────────────────────────────────────────────────

      const encodeWithSchema = (
        schemaId: string,
        data: unknown
      ): Effect.Effect<
        EncodeResult,
        CodecError | SchemaValidationError | SchemaNotFoundError
      > =>
        Effect.gen(function* () {
          // Look up schema
          const schema = yield* registry.get(schemaId);

          // Validate data against schema
          const validated = yield* Schema.decodeUnknown(schema)(data).pipe(
            Effect.mapError(
              (parseError) =>
                new SchemaValidationError({
                  schemaId,
                  operation: 'encode',
                  parseError,
                })
            )
          );

          // Encode to JSON bytes
          const bytes = yield* encodeJson(validated);

          // Build headers
          const headers: SchemaHeaders = {
            [HEADER_SCHEMA_ID]: schemaId,
            [HEADER_CONTENT_TYPE]: 'application/json',
          };

          return { bytes, headers };
        });

      // ─────────────────────────────────────────────────────────────────────────
      // decodeWithSchema - Schema-validated decoding from message
      // ─────────────────────────────────────────────────────────────────────────

      const decodeWithSchema = <A = unknown>(
        msg: JsMsgLike
      ): Effect.Effect<
        DecodeResult<A>,
        CodecError | SchemaValidationError | SchemaNotFoundError | MissingSchemaHeaderError
      > =>
        Effect.gen(function* () {
          // Extract schemaId from headers
          const schemaId = msg.headers?.get(HEADER_SCHEMA_ID);
          if (!schemaId) {
            return yield* Effect.fail(
              new MissingSchemaHeaderError({
                headerName: HEADER_SCHEMA_ID,
                message: `Missing ${HEADER_SCHEMA_ID} header in message`,
              })
            );
          }

          // Look up schema
          const schema = yield* registry.get(schemaId);

          // Decode JSON bytes
          const rawData = yield* decodeJson(msg.data);

          // Validate against schema
          const validated = yield* Schema.decodeUnknown(schema)(rawData).pipe(
            Effect.mapError(
              (parseError) =>
                new SchemaValidationError({
                  schemaId,
                  operation: 'decode',
                  parseError,
                })
            )
          );

          return { data: validated as A, schemaId };
        });

      // ─────────────────────────────────────────────────────────────────────────
      // decodeWithKnownSchema - Decode with explicit schema
      // ─────────────────────────────────────────────────────────────────────────

      const decodeWithKnownSchema = <A, I>(
        msg: JsMsgLike,
        schema: Schema.Schema<A, I>
      ): Effect.Effect<A, CodecError | SchemaValidationError> =>
        Effect.gen(function* () {
          // Decode JSON bytes
          const rawData = yield* decodeJson(msg.data);

          // Validate against provided schema
          const validated = yield* Schema.decodeUnknown(schema)(rawData).pipe(
            Effect.mapError(
              (parseError) =>
                new SchemaValidationError({
                  schemaId: 'provided-schema',
                  operation: 'decode',
                  parseError,
                })
            )
          );

          return validated;
        });

      // Return service implementation
      return {
        encodeWithSchema,
        decodeWithSchema,
        decodeWithKnownSchema,
        encodeJson,
        decodeJson,
      } satisfies StreamCodecServiceShape;
    }),
  }
) {}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Create headers object from schema metadata.
 * Useful for manual header construction.
 */
export const createSchemaHeaders = (
  schemaId: string,
  contentType = 'application/json',
  version?: string
): SchemaHeaders => ({
  [HEADER_SCHEMA_ID]: schemaId,
  [HEADER_CONTENT_TYPE]: contentType,
  ...(version ? { [HEADER_SCHEMA_VERSION]: version } : {}),
});

/**
 * Extract schema ID from NATS message headers.
 */
export const extractSchemaId = (msg: JsMsgLike): string | null =>
  msg.headers?.get(HEADER_SCHEMA_ID) ?? null;

/**
 * Check if a message has schema headers.
 */
export const hasSchemaHeaders = (msg: JsMsgLike): boolean =>
  msg.headers?.get(HEADER_SCHEMA_ID) != null;
