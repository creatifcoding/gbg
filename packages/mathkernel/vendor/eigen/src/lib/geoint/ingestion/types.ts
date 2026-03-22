/**
 * Ingestion Types - Browser-safe type definitions
 *
 * IMPORTANT: This file MUST NOT import anything that pulls in @effect/sql-pg
 * or other Node.js-only dependencies. Only import from 'effect' core.
 *
 * These types are re-exported for use in browser code (atoms, testbeds)
 * without contaminating the bundle with server-side dependencies.
 *
 * @module geoint/ingestion/types
 */

import { Schema } from 'effect'

// =============================================================================
// Types (pure TypeScript - no runtime dependencies)
// =============================================================================

/**
 * Ingester names for individual control
 */
export type IngesterName = 'flight' | 'osm' | 'weather' | 'imagery'

/**
 * Processor names (stream consumers like materializers)
 */
export type ProcessorName = 'flightMaterializer' | 'osmMaterializer' | 'weatherMaterializer'

/**
 * Combined component name for lifecycle management
 */
export type ComponentName = IngesterName | ProcessorName

// =============================================================================
// Schemas (Effect Schema - browser-safe)
// =============================================================================

/**
 * Status of an individual ingester
 */
export const IngesterStatus = Schema.Struct({
  name: Schema.String,
  running: Schema.Boolean,
  startedAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  error: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type IngesterStatus = typeof IngesterStatus.Type

/**
 * Status of a single materializer
 */
export const MaterializerStatus = Schema.Struct({
  name: Schema.String,
  running: Schema.Boolean,
  startedAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  eventsProcessed: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  entitiesCreated: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  entitiesUpdated: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type MaterializerStatus = typeof MaterializerStatus.Type

/**
 * Combined materializer status for all materializers
 */
export const MaterializersStatus = Schema.Struct({
  flight: MaterializerStatus,
  osm: MaterializerStatus,
  weather: MaterializerStatus,
})
export type MaterializersStatus = typeof MaterializersStatus.Type

/**
 * Combined orchestrator status
 */
export const OrchestratorStatus = Schema.Struct({
  running: Schema.Boolean,
  ingesters: Schema.Array(IngesterStatus),
  materializers: MaterializersStatus,
  startedAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
})
export type OrchestratorStatus = typeof OrchestratorStatus.Type
