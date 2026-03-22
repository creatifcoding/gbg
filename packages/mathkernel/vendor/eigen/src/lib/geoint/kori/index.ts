/**
 * GEOINT Kori Bridge Module
 *
 * Bridges GEOINT search results to Kori entities with reactive atom state.
 * Enables live tracking via Effect streams with trait updates.
 *
 * Architecture:
 * - SearchResultItem → TraitBundle → KoriEntity (initial hydration)
 * - Stream subscriptions → Trait updates → Atom updates (live tracking)
 * - Atom.family for per-entity UI state
 * - Effect HashSet/HashMap for immutable collections
 *
 * @module geoint/kori
 */

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Service Tag
  GeointKoriBridge,
  // Live Layer
  GeointKoriBridgeLive,
  // Types
  type EntityId,
  type StreamSubscription,
  type LiveDataUpdate,
  type SpawnResult,
  type GeointKoriBridgeOps,
  // Convenience Effects
  spawnEntity,
  hydrateEntities,
  getBridgeStats,
} from './GeointKoriBridge'

// ─────────────────────────────────────────────────────────────────────────────
// Search Result Mapping
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Core mapper
  mapSearchResultToTraits,
  mapSearchResultsToTraits,
  // Type helpers
  getEntityType,
  getEntityLabel,
  getMarkerTraitId,
  // Types
  type TraitBundle,
  type GeointEntityType,
} from './search-result-mapper'

// ─────────────────────────────────────────────────────────────────────────────
// Entity Atoms (Atom.family pattern)
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Registry & Provider
  geointRegistry,
  GeointRegistryProvider,
  // Atom families
  entityUIStateFamily,
  entityAnimationFamily,
  entityLiveDataFamily,
  // Global atoms
  selectedEntityIds,
  hoveredEntityId,
  pinnedEntityIds,
  visibleEntityIds,
  liveEntityIds,
  entityTypeMap,
  // Operations
  entityOps,
  // Types
  type EntityUIState,
  type EntityAnimationState,
  type EntityPosition,
  type EntityLiveData,
  // Defaults
  DEFAULT_ENTITY_UI_STATE,
  DEFAULT_ENTITY_ANIMATION_STATE,
} from './entity-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// GEOINT Traits
// ─────────────────────────────────────────────────────────────────────────────

export * from './traits'
