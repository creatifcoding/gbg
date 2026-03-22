/**
 * Schema Registry Initialization
 *
 * Register all known schemas at application startup.
 * This ensures schemas are available for encode/decode operations.
 *
 * Usage:
 * ```typescript
 * import { initSchemaRegistry } from '@/lib/holonet/core/schema';
 *
 * // At application startup
 * const program = Effect.gen(function* () {
 *   yield* initSchemaRegistry;
 *   // ... rest of app
 * });
 * ```
 *
 * @module holonet/core/schema/registry-init
 */

import { Effect, Schema } from 'effect';
import { SchemaRegistry } from './SchemaRegistry';

// =============================================================================
// Schema Imports
// =============================================================================

// Block event schemas from DurableBlockStream
import {
  BlockEvent,
  BlockCreated,
  BlockUpdated,
  BlockDeleted,
  BlockSelectionChanged,
  BlockFocusModeChanged,
  BlockState,
  BlockStateSnapshot,
} from '@/lib/blocks/services/DurableBlockStream';

// =============================================================================
// Schema Registration
// =============================================================================

/**
 * Register all known schemas.
 *
 * This Effect should be run at application startup to populate
 * the SchemaRegistry with all known schemas.
 */
export const initSchemaRegistry = Effect.gen(function* () {
  const registry = yield* SchemaRegistry;

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCK SCHEMAS
  // ─────────────────────────────────────────────────────────────────────────

  // Block event union (most common)
  yield* registry.registerOrUpdate('BlockEvent', BlockEvent);

  // Individual block event types
  yield* registry.registerOrUpdate('BlockCreated', BlockCreated);
  yield* registry.registerOrUpdate('BlockUpdated', BlockUpdated);
  yield* registry.registerOrUpdate('BlockDeleted', BlockDeleted);
  yield* registry.registerOrUpdate('BlockSelectionChanged', BlockSelectionChanged);
  yield* registry.registerOrUpdate('BlockFocusModeChanged', BlockFocusModeChanged);

  // Block state schemas
  yield* registry.registerOrUpdate('BlockState', BlockState);
  yield* registry.registerOrUpdate('BlockStateSnapshot', BlockStateSnapshot);

  // ─────────────────────────────────────────────────────────────────────────
  // GENERIC SCHEMAS
  // ─────────────────────────────────────────────────────────────────────────

  // Generic JSON (no validation, accepts any JSON)
  yield* registry.registerOrUpdate('application/json', Schema.Unknown);

  // Generic string
  yield* registry.registerOrUpdate('text/plain', Schema.String);

  // ─────────────────────────────────────────────────────────────────────────
  // GEOINT SCHEMAS (when available)
  // ─────────────────────────────────────────────────────────────────────────

  // Note: Add geoint schemas here when they are defined
  // yield* registry.registerOrUpdate('GeointEvent', GeointEvent);

  Effect.logDebug('SchemaRegistry initialized with known schemas');
});

/**
 * Register a single schema at runtime.
 * Convenience wrapper for dynamic registration.
 */
export const registerSchema = <A, I>(
  schemaId: string,
  schema: Schema.Schema<A, I>
) =>
  Effect.gen(function* () {
    const registry = yield* SchemaRegistry;
    yield* registry.registerOrUpdate(schemaId, schema);
  });

/**
 * Check if all required schemas are registered.
 * Useful for health checks.
 */
export const verifyRequiredSchemas = Effect.gen(function* () {
  const registry = yield* SchemaRegistry;

  const required = ['BlockEvent', 'application/json'];
  const missing: string[] = [];

  for (const schemaId of required) {
    const exists = yield* registry.has(schemaId);
    if (!exists) {
      missing.push(schemaId);
    }
  }

  if (missing.length > 0) {
    return yield* Effect.fail(
      new Error(`Missing required schemas: ${missing.join(', ')}`)
    );
  }

  return true;
});
