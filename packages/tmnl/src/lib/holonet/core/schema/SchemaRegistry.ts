/**
 * Schema Registry Service
 *
 * Central registry for Effect schemas used in durable-streams ↔ NATS integration.
 * Provides schema registration, lookup, and Standard Schema V1 conversion.
 *
 * Features:
 * - Register schemas by ID at startup
 * - Lookup schemas for encode/decode operations
 * - Store per-stream schema metadata in NATS KV
 * - Convert to Standard Schema V1 for client introspection
 *
 * @module holonet/core/schema/SchemaRegistry
 */

import { Effect, Ref, HashMap, Option, Schema } from 'effect';
import {
  type StreamSchemaMeta,
  SchemaNotFoundError,
  StreamSchemaNotFoundError,
  SchemaAlreadyRegisteredError,
} from './schemas';
import { parseContentType, type ParsedContentType } from './content-type';

// =============================================================================
// Constants
// =============================================================================

/** KV bucket name for stream schema metadata */
export const STREAM_META_BUCKET = 'STREAM_META';

// =============================================================================
// Service Shape
// =============================================================================

export interface SchemaRegistryShape {
  // ─── Schema Registration ───────────────────────────────────────────────────

  /**
   * Register a schema by ID.
   * Typically called at application startup for known schemas.
   *
   * @param schemaId - Unique identifier for the schema
   * @param schema - Effect Schema to register
   * @returns void on success, fails if already registered
   */
  readonly register: <A, I>(
    schemaId: string,
    schema: Schema.Schema<A, I>
  ) => Effect.Effect<void, SchemaAlreadyRegisteredError>;

  /**
   * Register a schema, overwriting if it already exists.
   * Useful for hot-reloading scenarios.
   *
   * @param schemaId - Unique identifier for the schema
   * @param schema - Effect Schema to register
   */
  readonly registerOrUpdate: <A, I>(
    schemaId: string,
    schema: Schema.Schema<A, I>
  ) => Effect.Effect<void>;

  /**
   * Unregister a schema by ID.
   *
   * @param schemaId - ID of schema to remove
   */
  readonly unregister: (schemaId: string) => Effect.Effect<void>;

  // ─── Schema Lookup ─────────────────────────────────────────────────────────

  /**
   * Get a schema by ID.
   *
   * @param schemaId - Schema ID to lookup
   * @returns The schema or fails with SchemaNotFoundError
   */
  readonly get: (
    schemaId: string
  ) => Effect.Effect<Schema.Schema<unknown, unknown>, SchemaNotFoundError>;

  /**
   * Get a schema by ID, returning null if not found.
   *
   * @param schemaId - Schema ID to lookup
   */
  readonly getOrNull: (
    schemaId: string
  ) => Effect.Effect<Schema.Schema<unknown, unknown> | null>;

  /**
   * Check if a schema is registered.
   *
   * @param schemaId - Schema ID to check
   */
  readonly has: (schemaId: string) => Effect.Effect<boolean>;

  /**
   * List all registered schema IDs.
   */
  readonly listIds: () => Effect.Effect<ReadonlyArray<string>>;

  // ─── Stream Schema Metadata ────────────────────────────────────────────────

  /**
   * Get schema metadata for a stream.
   * This retrieves the schema ID and content type associated with a stream.
   *
   * Note: This is an in-memory lookup. For NATS KV persistence,
   * use the integration layer which combines this with NatsKVService.
   *
   * @param streamId - Stream ID to lookup
   */
  readonly getForStream: (
    streamId: string
  ) => Effect.Effect<StreamSchemaMeta, StreamSchemaNotFoundError>;

  /**
   * Get schema metadata for a stream, returning null if not found.
   *
   * @param streamId - Stream ID to lookup
   */
  readonly getForStreamOrNull: (
    streamId: string
  ) => Effect.Effect<StreamSchemaMeta | null>;

  /**
   * Set schema metadata for a stream.
   *
   * @param streamId - Stream ID
   * @param meta - Schema metadata to associate with the stream
   */
  readonly setForStream: (
    streamId: string,
    meta: StreamSchemaMeta
  ) => Effect.Effect<void>;

  /**
   * Set schema metadata for a stream from Content-Type header.
   *
   * @param streamId - Stream ID
   * @param contentType - Content-Type header value
   */
  readonly setForStreamFromContentType: (
    streamId: string,
    contentType: string
  ) => Effect.Effect<void>;

  /**
   * Remove schema metadata for a stream.
   *
   * @param streamId - Stream ID
   */
  readonly removeForStream: (streamId: string) => Effect.Effect<void>;

  // ─── Standard Schema ───────────────────────────────────────────────────────

  /**
   * Convert an Effect Schema to Standard Schema V1.
   * Useful for client introspection and interop.
   *
   * @param schemaId - Schema ID to convert
   * @returns Standard Schema V1 JSON representation
   */
  readonly toStandardSchema: (
    schemaId: string
  ) => Effect.Effect<unknown, SchemaNotFoundError>;

  // ─── Content-Type Utilities ────────────────────────────────────────────────

  /**
   * Parse a Content-Type string and extract schema info.
   *
   * @param contentType - Content-Type header value
   */
  readonly parseContentType: (contentType: string) => ParsedContentType;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class SchemaRegistry extends Effect.Service<SchemaRegistry>()(
  'holonet/core/SchemaRegistry',
  {
    effect: Effect.gen(function* () {
      // ─────────────────────────────────────────────────────────────────────────
      // INTERNAL STATE
      // ─────────────────────────────────────────────────────────────────────────

      // Schema registry: schemaId -> Schema
      const schemasRef = yield* Ref.make(
        HashMap.empty<string, Schema.Schema<unknown, unknown>>()
      );

      // Stream metadata: streamId -> StreamSchemaMeta
      const streamMetaRef = yield* Ref.make(
        HashMap.empty<string, StreamSchemaMeta>()
      );

      // ─────────────────────────────────────────────────────────────────────────
      // SCHEMA REGISTRATION
      // ─────────────────────────────────────────────────────────────────────────

      const register = <A, I>(
        schemaId: string,
        schema: Schema.Schema<A, I>
      ): Effect.Effect<void, SchemaAlreadyRegisteredError> =>
        Effect.gen(function* () {
          const schemas = yield* Ref.get(schemasRef);

          if (HashMap.has(schemas, schemaId)) {
            return yield* Effect.fail(
              new SchemaAlreadyRegisteredError({ schemaId })
            );
          }

          yield* Ref.update(
            schemasRef,
            HashMap.set(schemaId, schema as Schema.Schema<unknown, unknown>)
          );
        });

      const registerOrUpdate = <A, I>(
        schemaId: string,
        schema: Schema.Schema<A, I>
      ): Effect.Effect<void> =>
        Ref.update(
          schemasRef,
          HashMap.set(schemaId, schema as Schema.Schema<unknown, unknown>)
        );

      const unregister = (schemaId: string): Effect.Effect<void> =>
        Ref.update(schemasRef, HashMap.remove(schemaId));

      // ─────────────────────────────────────────────────────────────────────────
      // SCHEMA LOOKUP
      // ─────────────────────────────────────────────────────────────────────────

      const get = (
        schemaId: string
      ): Effect.Effect<Schema.Schema<unknown, unknown>, SchemaNotFoundError> =>
        Effect.gen(function* () {
          const schemas = yield* Ref.get(schemasRef);
          const schemaOpt = HashMap.get(schemas, schemaId);

          if (Option.isNone(schemaOpt)) {
            return yield* Effect.fail(new SchemaNotFoundError({ schemaId }));
          }

          return schemaOpt.value;
        });

      const getOrNull = (
        schemaId: string
      ): Effect.Effect<Schema.Schema<unknown, unknown> | null> =>
        Effect.gen(function* () {
          const schemas = yield* Ref.get(schemasRef);
          const schemaOpt = HashMap.get(schemas, schemaId);
          return Option.isNone(schemaOpt) ? null : schemaOpt.value;
        });

      const has = (schemaId: string): Effect.Effect<boolean> =>
        Effect.gen(function* () {
          const schemas = yield* Ref.get(schemasRef);
          return HashMap.has(schemas, schemaId);
        });

      const listIds = (): Effect.Effect<ReadonlyArray<string>> =>
        Effect.gen(function* () {
          const schemas = yield* Ref.get(schemasRef);
          return Array.from(HashMap.keys(schemas));
        });

      // ─────────────────────────────────────────────────────────────────────────
      // STREAM SCHEMA METADATA
      // ─────────────────────────────────────────────────────────────────────────

      const getForStream = (
        streamId: string
      ): Effect.Effect<StreamSchemaMeta, StreamSchemaNotFoundError> =>
        Effect.gen(function* () {
          const meta = yield* Ref.get(streamMetaRef);
          const metaOpt = HashMap.get(meta, streamId);

          if (Option.isNone(metaOpt)) {
            return yield* Effect.fail(
              new StreamSchemaNotFoundError({ streamId })
            );
          }

          return metaOpt.value;
        });

      const getForStreamOrNull = (
        streamId: string
      ): Effect.Effect<StreamSchemaMeta | null> =>
        Effect.gen(function* () {
          const meta = yield* Ref.get(streamMetaRef);
          const metaOpt = HashMap.get(meta, streamId);
          return Option.isNone(metaOpt) ? null : metaOpt.value;
        });

      const setForStream = (
        streamId: string,
        meta: StreamSchemaMeta
      ): Effect.Effect<void> =>
        Ref.update(streamMetaRef, HashMap.set(streamId, meta));

      const setForStreamFromContentType = (
        streamId: string,
        contentType: string
      ): Effect.Effect<void> =>
        Effect.gen(function* () {
          const parsed = parseContentType(contentType);

          const meta: StreamSchemaMeta = {
            schemaId: parsed.schemaId ?? 'application/json',
            contentType: parsed.mimeType,
            version: parsed.version,
            registeredAt: Date.now(),
          };

          yield* setForStream(streamId, meta);
        });

      const removeForStream = (streamId: string): Effect.Effect<void> =>
        Ref.update(streamMetaRef, HashMap.remove(streamId));

      // ─────────────────────────────────────────────────────────────────────────
      // STANDARD SCHEMA
      // ─────────────────────────────────────────────────────────────────────────

      const toStandardSchema = (
        schemaId: string
      ): Effect.Effect<unknown, SchemaNotFoundError> =>
        Effect.gen(function* () {
          const schema = yield* get(schemaId);
          // Schema.standardSchemaV1 converts Effect Schema to Standard Schema V1
          return Schema.standardSchemaV1(schema);
        });

      // ─────────────────────────────────────────────────────────────────────────
      // RETURN SERVICE
      // ─────────────────────────────────────────────────────────────────────────

      return {
        register,
        registerOrUpdate,
        unregister,
        get,
        getOrNull,
        has,
        listIds,
        getForStream,
        getForStreamOrNull,
        setForStream,
        setForStreamFromContentType,
        removeForStream,
        toStandardSchema,
        parseContentType,
      } satisfies SchemaRegistryShape;
    }),
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const SchemaRegistryLive = SchemaRegistry.Default;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a schema metadata object from Content-Type and optional Standard Schema.
 */
export const createStreamSchemaMeta = (
  schemaId: string,
  contentType: string,
  options?: {
    version?: number;
    standardSchema?: unknown;
  }
): StreamSchemaMeta => ({
  schemaId,
  contentType,
  version: options?.version,
  standardSchema: options?.standardSchema,
  registeredAt: Date.now(),
});
