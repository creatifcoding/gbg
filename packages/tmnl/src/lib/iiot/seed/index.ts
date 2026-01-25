/**
 * IIoT Seed Module
 *
 * Optional development utilities for seeding test data.
 * NOT part of migrations - use for local development and testing.
 *
 * @module
 */

export {
  // Configuration
  SeedConfig,
  type SeedMode,

  // Tier 1: Asset seeders (repo-based, schema-validated)
  seedPlants,
  seedLines,
  seedMachines,
  seedSensors,
  seedAssets,

  // Tier 2: Bulk seeders (mode-dependent)
  seedMockReadings,
  seedMockAlarms,
  refreshAggregates,

  // Utilities
  clearMockData,
  getDataStats,

  // Combined seeder
  seedAll,
} from './mock-data'

// Re-export layer for convenient usage
export { AssetRepositoriesLive } from '../repos'
