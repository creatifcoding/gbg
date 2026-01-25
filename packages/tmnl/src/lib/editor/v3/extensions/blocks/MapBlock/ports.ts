/**
 * @fileoverview MapBlock Port Configuration
 *
 * Co-located port schema definition for MapBlock.
 * Defines what ports MapBlock instances can have.
 *
 * Currently restricted to GeoJSON only:
 * - GeoJSON FeatureCollection inputs (for layers)
 * - GeoJSON FeatureCollection outputs (selected features)
 *
 * Future: Table inputs, JSON config, viewport events
 *
 * @module editor/v3/extensions/blocks/MapBlock/ports
 */

import { Option } from 'effect';
import {
  BlockPortConfig,
  BlockPortSchema,
} from '@/lib/dataplane/schemas/block-port-schema';
import { geojsonType } from '@/lib/dataplane/schemas/port-types';
import { registerBlockPortConfig } from '@/lib/dataplane/schemas/block-port-registry';

// =============================================================================
// Port Schema Definitions (GeoJSON Only)
// =============================================================================

/**
 * GeoJSON FeatureCollection input.
 * Renders geographic features on the map.
 * Multiple inputs allowed for layering.
 */
export const GEOJSON_LAYER_INPUT = new BlockPortSchema({
  id: 'geojson-layer',
  label: 'GeoJSON Layer' as 'GeoJSON Layer',
  description: Option.some('Geographic features to render on map'),
  dataType: geojsonType('featurecollection'),
  direction: 'in',
  position: 'left',
  cardinality: 'multi', // Multiple layers supported
  required: false,
  customValidatorId: Option.none(),
});

/**
 * Selected features output.
 * Emits GeoJSON of currently selected features.
 */
export const SELECTED_FEATURES_OUTPUT = new BlockPortSchema({
  id: 'selected-features',
  label: 'Selected Features' as 'Selected Features',
  description: Option.some('Currently selected geographic features'),
  dataType: geojsonType('featurecollection'),
  direction: 'out',
  position: 'right',
  cardinality: 'single',
  required: false,
  customValidatorId: Option.none(),
});

// =============================================================================
// Block Port Configuration
// =============================================================================

/**
 * Complete port configuration for MapBlock.
 * Currently restricted to GeoJSON in/out only.
 */
export const MAP_BLOCK_PORT_CONFIG = new BlockPortConfig({
  blockType: 'map',
  allowedPorts: [
    GEOJSON_LAYER_INPUT,
    SELECTED_FEATURES_OUTPUT,
  ],
  // Default to one GeoJSON input on creation
  defaultPorts: ['geojson-layer'],
  maxPorts: Option.some(10), // Reasonable limit
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get allowed input port schemas for MapBlock.
 */
export const getMapInputSchemas = (): ReadonlyArray<BlockPortSchema> =>
  MAP_BLOCK_PORT_CONFIG.inputSchemas;

/**
 * Get allowed output port schemas for MapBlock.
 */
export const getMapOutputSchemas = (): ReadonlyArray<BlockPortSchema> =>
  MAP_BLOCK_PORT_CONFIG.outputSchemas;

/**
 * Check if a port schema ID is valid for MapBlock.
 */
export const isValidMapPortSchema = (schemaId: string): boolean =>
  MAP_BLOCK_PORT_CONFIG.isPortAllowed(schemaId);

/**
 * Get a specific port schema by ID.
 */
export const getMapPortSchema = (
  schemaId: string
): Option.Option<BlockPortSchema> =>
  MAP_BLOCK_PORT_CONFIG.getPortSchema(schemaId);

// =============================================================================
// Auto-Registration
// =============================================================================

// Register MapBlock port config when this module is imported
registerBlockPortConfig(MAP_BLOCK_PORT_CONFIG);
