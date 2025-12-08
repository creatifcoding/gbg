/**
 * TMNL Testbed System
 *
 * Registry and utilities for testbed navigation.
 *
 * NOTE: This module provides DATA only. Search is handled by consumers
 * using src/lib/search drivers. See TestbedSearchItem for the indexable shape.
 */

export {
  // Types
  type TestbedStatus,
  type TestbedCategory,
  type TestbedVersion,
  type TestbedEntry,
  type TestbedSearchItem,
  // Registry
  TESTBED_REGISTRY,
  CATEGORY_META,
  // Helpers
  getAllTestbedVersions,
  getTestbedsByCategory,
  getPrimaryVersion,
  getTestbedById,
  getSearchableTestbeds,
} from './registry'
