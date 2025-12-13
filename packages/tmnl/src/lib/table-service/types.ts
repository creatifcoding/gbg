/**
 * TableService Schema Types
 *
 * Effect Schema definitions for variant preset management.
 * Enables runtime validation, localStorage serialization, and type inference.
 *
 * @module
 */

import { Schema } from 'effect'
import { GridVariant, GridVariantPartial } from '@/lib/data-grid/schemas/variant'

// =============================================================================
// BRANDED IDS
// =============================================================================

/**
 * Branded preset identifier for type safety.
 */
export const PresetId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('PresetId')
)
export type PresetId = typeof PresetId.Type

/**
 * Branded grid instance identifier.
 */
export const GridId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('GridId')
)
export type GridId = typeof GridId.Type

// =============================================================================
// PRESET
// =============================================================================

/**
 * A saved variant preset with metadata.
 */
export const Preset = Schema.Struct({
  /** Unique preset identifier */
  id: PresetId,
  /** Human-readable name */
  name: Schema.NonEmptyString,
  /** The variant configuration */
  variant: GridVariant,
  /** Creation timestamp */
  createdAt: Schema.DateFromSelf,
  /** Last update timestamp */
  updatedAt: Schema.DateFromSelf,
  /** Whether this is a built-in preset (non-deletable) */
  isBuiltIn: Schema.optional(Schema.Boolean),
})
export type Preset = typeof Preset.Type

// =============================================================================
// GRID OVERRIDE
// =============================================================================

/**
 * Per-grid variant overrides for layered inheritance.
 *
 * Resolution order: gridOverride > activePreset > defaultVariant
 */
export const GridOverride = Schema.Struct({
  /** The grid instance this override applies to */
  gridId: GridId,
  /** Base preset to inherit from (optional) */
  basePresetId: Schema.optional(PresetId),
  /** Partial overrides applied on top of base */
  overrides: GridVariantPartial,
  /** Last update timestamp */
  updatedAt: Schema.DateFromSelf,
})
export type GridOverride = typeof GridOverride.Type

// =============================================================================
// SERVICE STATE
// =============================================================================

/**
 * Complete TableService state for persistence.
 */
export const TableServiceState = Schema.Struct({
  /** All saved presets (built-in + user-created) */
  presets: Schema.Array(Preset),
  /** Per-grid overrides keyed by GridId */
  gridOverrides: Schema.Record({
    key: Schema.String,
    value: GridOverride,
  }),
  /** Currently active global preset (null = use default) */
  activePresetId: Schema.NullOr(PresetId),
  /** Schema version for migration */
  version: Schema.Number,
})
export type TableServiceState = typeof TableServiceState.Type

// =============================================================================
// PERSISTENCE ENVELOPE
// =============================================================================

/**
 * localStorage envelope with version for migration.
 */
export const PersistedState = Schema.Struct({
  version: Schema.Number,
  state: TableServiceState,
  lastPersistedAt: Schema.DateFromSelf,
})
export type PersistedState = typeof PersistedState.Type

// =============================================================================
// CONSTANTS
// =============================================================================

export const CURRENT_VERSION = 1
export const STORAGE_KEY = 'tmnl:table-service:state'

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialState: TableServiceState = {
  presets: [],
  gridOverrides: {},
  activePresetId: null,
  version: CURRENT_VERSION,
}
