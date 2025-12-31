/**
 * @fileoverview Block Port Configuration Registry
 *
 * Central registry for block port configurations.
 * Aggregates co-located port configs from all block types.
 *
 * Usage:
 * 1. Each block exports its port config from `BlockType/ports.ts`
 * 2. This registry imports and indexes all configs
 * 3. LinksTab queries registry to get allowed ports for a block
 *
 * @module dataplane/schemas/block-port-registry
 */

import { HashMap, Option } from 'effect';
import type { BlockPortConfig, BlockPortSchema } from './block-port-schema';

// =============================================================================
// Registry State
// =============================================================================

/**
 * In-memory registry of block port configurations.
 * Keyed by blockType string.
 */
let registry: HashMap.HashMap<string, BlockPortConfig> = HashMap.empty();

// =============================================================================
// Registry Operations
// =============================================================================

/**
 * Register a block's port configuration.
 * Called by each block type at module load time.
 *
 * @example
 * ```typescript
 * // In MapBlock/ports.ts
 * registerBlockPortConfig(MAP_BLOCK_PORT_CONFIG);
 * ```
 */
export const registerBlockPortConfig = (config: BlockPortConfig): void => {
  registry = HashMap.set(registry, config.blockType, config);
};

/**
 * Get port configuration for a block type.
 */
export const getBlockPortConfig = (
  blockType: string
): Option.Option<BlockPortConfig> => HashMap.get(registry, blockType);

/**
 * Get all registered block types.
 */
export const getRegisteredBlockTypes = (): ReadonlyArray<string> =>
  Array.from(HashMap.keys(registry));

/**
 * Get all registered port configurations.
 */
export const getAllBlockPortConfigs = (): ReadonlyArray<BlockPortConfig> =>
  Array.from(HashMap.values(registry));

/**
 * Check if a block type has port configuration.
 */
export const hasBlockPortConfig = (blockType: string): boolean =>
  HashMap.has(registry, blockType);

/**
 * Get allowed port schemas for a block type.
 * Returns empty array if block type not registered.
 */
export const getAllowedPortSchemas = (
  blockType: string
): ReadonlyArray<BlockPortSchema> => {
  const config = HashMap.get(registry, blockType);
  return Option.isSome(config) ? config.value.allowedPorts : [];
};

/**
 * Get a specific port schema by blockType and schemaId.
 */
export const getPortSchema = (
  blockType: string,
  schemaId: string
): Option.Option<BlockPortSchema> => {
  const config = HashMap.get(registry, blockType);
  if (Option.isNone(config)) return Option.none();
  return config.value.getPortSchema(schemaId);
};

/**
 * Get default port schema IDs for a block type.
 * These are auto-created when a block is instantiated.
 */
export const getDefaultPortSchemaIds = (
  blockType: string
): ReadonlyArray<string> => {
  const config = HashMap.get(registry, blockType);
  return Option.isSome(config) ? config.value.defaultPorts : [];
};

/**
 * Check if a block can have more ports added.
 */
export const canAddPort = (
  blockType: string,
  currentPortCount: number
): boolean => {
  const config = HashMap.get(registry, blockType);
  if (Option.isNone(config)) return true; // Unconfigured blocks have no limits
  return config.value.canAddPort(currentPortCount);
};

// =============================================================================
// Debug/Testing
// =============================================================================

/**
 * Clear registry (for testing).
 */
export const clearRegistry = (): void => {
  registry = HashMap.empty();
};

/**
 * Get registry size.
 */
export const getRegistrySize = (): number => HashMap.size(registry);
