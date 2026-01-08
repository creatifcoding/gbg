/**
 * AVA Schemas Module
 *
 * Exports both v1 (REST/WebSocket) and v2 (NATS JetStream) schemas.
 *
 * @module
 */

// v2 schemas (NATS-based reactive streaming)
export * from './v2'

// Note: v1 schemas are in ../schemas.ts for backwards compatibility
// Import them from 'src/lib/ava/schemas' for REST API types
