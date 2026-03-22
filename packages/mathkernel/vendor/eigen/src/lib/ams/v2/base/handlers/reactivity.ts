/**
 * Asset Event Reactivity
 *
 * EventLog.groupReactivity for cache invalidation.
 * Maps events to cache keys that should be invalidated.
 *
 * @module @gbg/tmnl/ams/v2/base/handlers/reactivity
 */

import * as EventLog from '@effect/experimental/EventLog'
import { AssetEvents } from '../events/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Reactivity Keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache key constants for AMS
 */
export const AMS_CACHE_KEYS = {
  /** All assets list/index */
  ASSETS_LIST: 'ams:assets:list',
  /** Assets by site */
  ASSETS_BY_SITE: 'ams:assets:by-site',
  /** Assets by sector */
  ASSETS_BY_SECTOR: 'ams:assets:by-sector',
  /** Assets by container */
  ASSETS_BY_CONTAINER: 'ams:assets:by-container',
  /** Asset properties */
  ASSET_PROPERTIES: 'ams:assets:properties',
  /** Asset traits */
  ASSET_TRAITS: 'ams:assets:traits',
  /** Asset counts */
  ASSET_COUNTS: 'ams:assets:counts',
  /** Search index */
  SEARCH_INDEX: 'ams:search:index',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Reactivity Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset Reactivity Layer
 *
 * Invalidates cache keys when events are written.
 * Each event type maps to the cache keys it affects.
 */
export const AssetReactivity = EventLog.groupReactivity(AssetEvents, {
  // Asset lifecycle events invalidate list/count caches
  AssetCreated: [
    AMS_CACHE_KEYS.ASSETS_LIST,
    AMS_CACHE_KEYS.ASSETS_BY_SITE,
    AMS_CACHE_KEYS.ASSET_COUNTS,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],
  AssetUpdated: [
    AMS_CACHE_KEYS.ASSETS_LIST,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],
  AssetMoved: [
    AMS_CACHE_KEYS.ASSETS_BY_SITE,
    AMS_CACHE_KEYS.ASSETS_BY_SECTOR,
    AMS_CACHE_KEYS.ASSETS_BY_CONTAINER,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],
  AssetDeleted: [
    AMS_CACHE_KEYS.ASSETS_LIST,
    AMS_CACHE_KEYS.ASSETS_BY_SITE,
    AMS_CACHE_KEYS.ASSET_COUNTS,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],

  // Property events invalidate property cache
  PropertyChanged: [
    AMS_CACHE_KEYS.ASSET_PROPERTIES,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],
  PropertyRemoved: [
    AMS_CACHE_KEYS.ASSET_PROPERTIES,
    AMS_CACHE_KEYS.SEARCH_INDEX,
  ],

  // Trait events invalidate trait cache
  TraitAdded: [
    AMS_CACHE_KEYS.ASSET_TRAITS,
  ],
  TraitRemoved: [
    AMS_CACHE_KEYS.ASSET_TRAITS,
  ],
})
