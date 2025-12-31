/**
 * @fileoverview Port Data Type Registry
 *
 * Layer 1 of BlockPortSchema architecture:
 * Canonical data types with Effect.Schema validation.
 *
 * Types are hierarchical:
 * - geojson (base geographic data)
 *   - geojson:point, geojson:line, geojson:polygon (specializations)
 * - table (tabular data)
 * - json (generic structured data)
 * - stream (continuous event stream)
 *
 * Future: deck.gl layer types (layer:scatterplot, layer:hexagon, etc.)
 *
 * @module dataplane/schemas/port-types
 */

import { Schema, Option } from 'effect';

// =============================================================================
// Port Data Type Hierarchy
// =============================================================================

/**
 * Base port data type categories.
 * These are the top-level types that ports can handle.
 */
export const PortDataTypeCategory = Schema.Literal(
  'geojson',
  'table',
  'json',
  'stream',
  'layer' // Future: deck.gl layer types
);
export type PortDataTypeCategory = typeof PortDataTypeCategory.Type;

/**
 * GeoJSON specializations.
 * Allows ports to accept specific geometry types.
 */
export const GeoJSONSubtype = Schema.Literal(
  'any', // Accepts any GeoJSON
  'point',
  'multipoint',
  'linestring',
  'multilinestring',
  'polygon',
  'multipolygon',
  'geometrycollection',
  'feature',
  'featurecollection'
);
export type GeoJSONSubtype = typeof GeoJSONSubtype.Type;

/**
 * Table specializations.
 * For row-level vs cell-level granularity.
 */
export const TableSubtype = Schema.Literal(
  'any', // Accepts any table data
  'row', // Single row
  'cell', // Single cell value
  'column' // Column array
);
export type TableSubtype = typeof TableSubtype.Type;

/**
 * Stream specializations.
 * For different streaming semantics.
 */
export const StreamSubtype = Schema.Literal(
  'any', // Any stream
  'discrete', // Event-based discrete values
  'continuous', // Continuous signal
  'batched' // Batched updates
);
export type StreamSubtype = typeof StreamSubtype.Type;

/**
 * Layer specializations (for future deck.gl integration).
 * Placeholder for typed layer connections.
 */
export const LayerSubtype = Schema.Literal(
  'any', // Any layer
  'scatterplot',
  'hexagon',
  'arc',
  'line',
  'polygon',
  'icon',
  'text',
  'heatmap'
);
export type LayerSubtype = typeof LayerSubtype.Type;

// =============================================================================
// Composite Port Data Type
// =============================================================================

/**
 * Full port data type specification.
 * Combines category with optional subtype for precise typing.
 *
 * @example
 * ```typescript
 * // Accept any GeoJSON
 * const anyGeo: PortDataTypeSpec = { category: 'geojson', subtype: Option.none() };
 *
 * // Accept only point features
 * const pointOnly: PortDataTypeSpec = { category: 'geojson', subtype: Option.some('point') };
 *
 * // Accept table rows
 * const rowData: PortDataTypeSpec = { category: 'table', subtype: Option.some('row') };
 * ```
 */
export class PortDataTypeSpec extends Schema.TaggedClass<PortDataTypeSpec>()(
  'PortDataTypeSpec',
  {
    /** Top-level data category */
    category: PortDataTypeCategory,

    /**
     * Optional subtype within the category.
     * If None, accepts any subtype within the category.
     */
    subtype: Schema.OptionFromNullOr(Schema.String),
  }
) {
  /**
   * Check if this type spec accepts the given type.
   * A type accepts another if:
   * - Categories match AND
   * - Either this subtype is None (wildcard) OR subtypes match
   */
  accepts(other: PortDataTypeSpec): boolean {
    if (this.category !== other.category) return false;
    if (Option.isNone(this.subtype)) return true; // Wildcard
    if (Option.isNone(other.subtype)) return true; // Other is wildcard
    return Option.getOrThrow(this.subtype) === Option.getOrThrow(other.subtype);
  }

  /** Human-readable type string */
  get displayName(): string {
    const sub = Option.getOrElse(this.subtype, () => 'any');
    return sub === 'any' ? this.category : `${this.category}:${sub}`;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a GeoJSON port data type specification.
 */
export const geojsonType = (
  subtype?: GeoJSONSubtype
): PortDataTypeSpec =>
  new PortDataTypeSpec({
    category: 'geojson',
    subtype: subtype && subtype !== 'any' ? Option.some(subtype) : Option.none(),
  });

/**
 * Create a table port data type specification.
 */
export const tableType = (subtype?: TableSubtype): PortDataTypeSpec =>
  new PortDataTypeSpec({
    category: 'table',
    subtype: subtype && subtype !== 'any' ? Option.some(subtype) : Option.none(),
  });

/**
 * Create a JSON port data type specification.
 */
export const jsonType = (): PortDataTypeSpec =>
  new PortDataTypeSpec({
    category: 'json',
    subtype: Option.none(),
  });

/**
 * Create a stream port data type specification.
 */
export const streamType = (subtype?: StreamSubtype): PortDataTypeSpec =>
  new PortDataTypeSpec({
    category: 'stream',
    subtype: subtype && subtype !== 'any' ? Option.some(subtype) : Option.none(),
  });

/**
 * Create a layer port data type specification (future).
 */
export const layerType = (subtype?: LayerSubtype): PortDataTypeSpec =>
  new PortDataTypeSpec({
    category: 'layer',
    subtype: subtype && subtype !== 'any' ? Option.some(subtype) : Option.none(),
  });

// =============================================================================
// Type Guards
// =============================================================================

export const isGeoJSONType = (spec: PortDataTypeSpec): boolean =>
  spec.category === 'geojson';

export const isTableType = (spec: PortDataTypeSpec): boolean =>
  spec.category === 'table';

export const isJSONType = (spec: PortDataTypeSpec): boolean =>
  spec.category === 'json';

export const isStreamType = (spec: PortDataTypeSpec): boolean =>
  spec.category === 'stream';

export const isLayerType = (spec: PortDataTypeSpec): boolean =>
  spec.category === 'layer';
