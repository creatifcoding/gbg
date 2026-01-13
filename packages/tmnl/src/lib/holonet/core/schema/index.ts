/**
 * Schema Registry Module
 *
 * Central schema management for durable-streams ↔ NATS integration.
 *
 * @module holonet/core/schema
 */

// ─── Schemas and Errors ─────────────────────────────────────────────────────
export {
  // Schemas
  StreamSchemaMeta,
  type StreamSchemaMeta as StreamSchemaMetaType,
  SchemaId,
  type SchemaId as SchemaIdType,
  StreamId,
  type StreamId as StreamIdType,

  // Errors
  SchemaNotFoundError,
  StreamSchemaNotFoundError,
  SchemaAlreadyRegisteredError,
  ContentTypeParseError,
} from './schemas';

// ─── Content-Type Parser ────────────────────────────────────────────────────
export {
  type ParsedContentType,
  ParsedContentTypeSchema,
  parseContentType,
  parseContentTypeEffect,
  formatContentType,
  ContentTypeFromString,
  extractSchemaId,
  createContentType,
  isJsonContentType,
} from './content-type';

// ─── Schema Registry Service ────────────────────────────────────────────────
export {
  // Constants
  STREAM_META_BUCKET,

  // Service
  SchemaRegistry,
  type SchemaRegistryShape,

  // Layer
  SchemaRegistryLive,

  // Utilities
  createStreamSchemaMeta,
} from './SchemaRegistry';

// ─── Registry Initialization ────────────────────────────────────────────────
export {
  initSchemaRegistry,
  registerSchema,
  verifyRequiredSchemas,
} from './registry-init';
