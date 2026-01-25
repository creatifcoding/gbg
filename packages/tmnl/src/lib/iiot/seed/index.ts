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

  // Individual seeders
  seedMockReadings,
  seedMockAlarms,
  refreshAggregates,

  // Utilities
  clearMockData,
  getDataStats,

  // Combined seeder
  seedAll,
} from './mock-data'
