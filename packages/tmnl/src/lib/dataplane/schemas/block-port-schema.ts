/**
 * @fileoverview Block Port Schema Definition
 *
 * Layer 2 of BlockPortSchema architecture:
 * Defines allowed port slots for blocks with validation.
 *
 * A BlockPortSchema specifies:
 * - What data types a port can accept/emit
 * - Port direction (input/output/bidirectional)
 * - Cardinality (single port vs multiple instances)
 * - Visual position constraints
 * - Runtime validation schema for payloads
 *
 * @module dataplane/schemas/block-port-schema
 */

import { Schema, Option, Either, Effect } from 'effect';
import {
  PortDataTypeSpec,
  geojsonType,
  tableType,
  jsonType,
} from './port-types';
import { PortDirection, PortPosition } from './link';

// =============================================================================
// Port Cardinality
// =============================================================================

/**
 * How many instances of this port slot can exist.
 *
 * - `single`: Exactly one port of this type allowed
 * - `multi`: Multiple ports of this type allowed (e.g., "Add Input")
 */
export const PortCardinality = Schema.Literal('single', 'multi');
export type PortCardinality = typeof PortCardinality.Type;

// =============================================================================
// BlockPortSchema
// =============================================================================

/**
 * Schema definition for a port slot on a block.
 *
 * This defines WHAT KINDS of ports a block can have,
 * not the actual port instances (which are created at runtime).
 *
 * @example
 * ```typescript
 * // MapBlock can have GeoJSON input ports
 * const geojsonInput = new BlockPortSchema({
 *   id: 'geojson-input',
 *   label: 'GeoJSON Data',
 *   description: Option.some('Geographic data to render on map'),
 *   dataType: geojsonType('featurecollection'),
 *   direction: 'in',
 *   position: 'left',
 *   cardinality: 'multi', // Can add multiple GeoJSON inputs
 *   required: false,
 *   payloadValidator: Option.none(), // Use default GeoJSON validation
 * });
 * ```
 */
export class BlockPortSchema extends Schema.TaggedClass<BlockPortSchema>()(
  'BlockPortSchema',
  {
    /** Unique identifier for this port slot (e.g., 'geojson-input', 'table-output') */
    id: Schema.String.pipe(Schema.minLength(1)),

    /** Human-readable label shown in UI */
    label: Schema.NonEmptyString,

    /** Optional description for tooltip/help */
    description: Schema.OptionFromNullOr(Schema.String),

    /** Data type this port handles */
    dataType: PortDataTypeSpec,

    /** Direction of data flow */
    direction: PortDirection,

    /** Default visual position on block */
    position: PortPosition,

    /** Whether multiple instances of this port are allowed */
    cardinality: PortCardinality,

    /** Whether at least one port of this type is required */
    required: Schema.Boolean,

    /**
     * Optional custom payload validator schema name.
     * If None, uses default validation for the dataType.
     * If Some, looks up custom validator by name from registry.
     */
    customValidatorId: Schema.OptionFromNullOr(Schema.String),
  }
) {
  /** Check if this is an input port */
  get isInput(): boolean {
    return this.direction === 'in' || this.direction === 'inout';
  }

  /** Check if this is an output port */
  get isOutput(): boolean {
    return this.direction === 'out' || this.direction === 'inout';
  }

  /** Check if multiple instances are allowed */
  get allowsMultiple(): boolean {
    return this.cardinality === 'multi';
  }

  /** Get display string for the port type */
  get typeDisplay(): string {
    const dir =
      this.direction === 'in'
        ? '→'
        : this.direction === 'out'
          ? '←'
          : '↔';
    return `${dir} ${this.dataType.displayName}`;
  }
}

// =============================================================================
// Block Port Configuration
// =============================================================================

/**
 * Complete port configuration for a block type.
 * Defines all allowed port schemas for a specific block.
 *
 * @example
 * ```typescript
 * const mapBlockPortConfig = new BlockPortConfig({
 *   blockType: 'map',
 *   allowedPorts: [geojsonInputSchema, tableInputSchema],
 *   defaultPorts: ['geojson-input'], // Auto-create on block instantiation
 * });
 * ```
 */
export class BlockPortConfig extends Schema.TaggedClass<BlockPortConfig>()(
  'BlockPortConfig',
  {
    /**
     * Block type this config applies to.
     * Matches BlockType literal from shared schemas.
     */
    blockType: Schema.String.pipe(Schema.minLength(1)),

    /** Array of allowed port schemas */
    allowedPorts: Schema.Array(BlockPortSchema),

    /**
     * Port schema IDs to auto-create on block instantiation.
     * Subset of allowedPorts[].id values.
     */
    defaultPorts: Schema.Array(Schema.String),

    /**
     * Maximum total ports allowed on this block.
     * None = unlimited.
     */
    maxPorts: Schema.OptionFromNullOr(Schema.Number),
  }
) {
  /** Get a port schema by ID */
  getPortSchema(id: string): Option.Option<BlockPortSchema> {
    const found = this.allowedPorts.find((p) => p.id === id);
    return found ? Option.some(found) : Option.none();
  }

  /** Check if a port schema ID is allowed */
  isPortAllowed(id: string): boolean {
    return this.allowedPorts.some((p) => p.id === id);
  }

  /** Get all input port schemas */
  get inputSchemas(): ReadonlyArray<BlockPortSchema> {
    return this.allowedPorts.filter((p) => p.isInput);
  }

  /** Get all output port schemas */
  get outputSchemas(): ReadonlyArray<BlockPortSchema> {
    return this.allowedPorts.filter((p) => p.isOutput);
  }

  /** Get required port schemas */
  get requiredSchemas(): ReadonlyArray<BlockPortSchema> {
    return this.allowedPorts.filter((p) => p.required);
  }

  /** Check if adding a port would exceed max */
  canAddPort(currentCount: number): boolean {
    if (Option.isNone(this.maxPorts)) return true;
    return currentCount < Option.getOrThrow(this.maxPorts);
  }
}

// =============================================================================
// Validation Result
// =============================================================================

/**
 * Result of validating a port against a schema.
 */
export const PortValidationError = Schema.TaggedStruct('PortValidationError', {
  portSchemaId: Schema.String,
  message: Schema.String,
  field: Schema.OptionFromNullOr(Schema.String),
});
export type PortValidationError = typeof PortValidationError.Type;

/**
 * Validate that a port creation request matches a BlockPortSchema.
 */
export const validatePortCreation = (
  schema: BlockPortSchema,
  request: {
    direction: string;
    dataType: PortDataTypeSpec;
    position: string;
  }
): Either.Either<true, PortValidationError> => {
  // Check direction matches
  if (schema.direction !== request.direction && schema.direction !== 'inout') {
    return Either.left({
      _tag: 'PortValidationError' as const,
      portSchemaId: schema.id,
      message: `Direction mismatch: expected ${schema.direction}, got ${request.direction}`,
      field: Option.some('direction'),
    });
  }

  // Check data type is compatible
  if (!schema.dataType.accepts(request.dataType)) {
    return Either.left({
      _tag: 'PortValidationError' as const,
      portSchemaId: schema.id,
      message: `Data type mismatch: expected ${schema.dataType.displayName}, got ${request.dataType.displayName}`,
      field: Option.some('dataType'),
    });
  }

  // Check position is allowed (could be more sophisticated)
  if (schema.position !== request.position) {
    return Either.left({
      _tag: 'PortValidationError' as const,
      portSchemaId: schema.id,
      message: `Position mismatch: expected ${schema.position}, got ${request.position}`,
      field: Option.some('position'),
    });
  }

  return Either.right(true);
};

// =============================================================================
// Factory Helpers
// =============================================================================

/**
 * Create a GeoJSON input port schema.
 */
export const createGeoJSONInputSchema = (
  id: string,
  options?: {
    label?: string;
    description?: string;
    position?: 'left' | 'right' | 'top' | 'bottom';
    cardinality?: 'single' | 'multi';
    required?: boolean;
  }
): BlockPortSchema =>
  new BlockPortSchema({
    id,
    label: (options?.label ?? 'GeoJSON Input') as typeof Schema.NonEmptyString.Type,
    description: options?.description
      ? Option.some(options.description)
      : Option.none(),
    dataType: geojsonType('featurecollection'),
    direction: 'in',
    position: options?.position ?? 'left',
    cardinality: options?.cardinality ?? 'multi',
    required: options?.required ?? false,
    customValidatorId: Option.none(),
  });

/**
 * Create a table input port schema.
 */
export const createTableInputSchema = (
  id: string,
  options?: {
    label?: string;
    description?: string;
    position?: 'left' | 'right' | 'top' | 'bottom';
    cardinality?: 'single' | 'multi';
    required?: boolean;
  }
): BlockPortSchema =>
  new BlockPortSchema({
    id,
    label: (options?.label ?? 'Table Input') as typeof Schema.NonEmptyString.Type,
    description: options?.description
      ? Option.some(options.description)
      : Option.none(),
    dataType: tableType('any'),
    direction: 'in',
    position: options?.position ?? 'left',
    cardinality: options?.cardinality ?? 'multi',
    required: options?.required ?? false,
    customValidatorId: Option.none(),
  });

/**
 * Create a JSON input port schema.
 */
export const createJSONInputSchema = (
  id: string,
  options?: {
    label?: string;
    description?: string;
    position?: 'left' | 'right' | 'top' | 'bottom';
    cardinality?: 'single' | 'multi';
    required?: boolean;
  }
): BlockPortSchema =>
  new BlockPortSchema({
    id,
    label: (options?.label ?? 'JSON Input') as typeof Schema.NonEmptyString.Type,
    description: options?.description
      ? Option.some(options.description)
      : Option.none(),
    dataType: jsonType(),
    direction: 'in',
    position: options?.position ?? 'left',
    cardinality: options?.cardinality ?? 'multi',
    required: options?.required ?? false,
    customValidatorId: Option.none(),
  });

/**
 * Create a JSON output port schema.
 */
export const createJSONOutputSchema = (
  id: string,
  options?: {
    label?: string;
    description?: string;
    position?: 'left' | 'right' | 'top' | 'bottom';
    cardinality?: 'single' | 'multi';
  }
): BlockPortSchema =>
  new BlockPortSchema({
    id,
    label: (options?.label ?? 'JSON Output') as typeof Schema.NonEmptyString.Type,
    description: options?.description
      ? Option.some(options.description)
      : Option.none(),
    dataType: jsonType(),
    direction: 'out',
    position: options?.position ?? 'right',
    cardinality: options?.cardinality ?? 'single',
    required: false,
    customValidatorId: Option.none(),
  });
