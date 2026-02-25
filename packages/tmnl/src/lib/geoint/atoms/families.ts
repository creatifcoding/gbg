/**
 * GEOINT Panel-Scoped Atom Families
 *
 * Panel-scoped state management using Atom.family pattern.
 * Each GeointDashboardPanel instance (identified by panelId) has isolated atoms.
 *
 * Pattern: Atom.family(panelId => Atom.make(initial))
 * - Same panelId → same atom instance (memoized)
 * - Different panelId → independent atoms
 *
 * Usage:
 * ```typescript
 * const panelId = asPanelId('panel-1')
 * const viewport = viewportFamily(panelId)
 * registry.get(viewport) // Get panel-specific viewport
 * ```
 *
 * @module geoint/atoms/families
 */

import { Atom } from '@effect-atom/atom'
import { Schema } from 'effect'
import type {
  SearchResultItem,
  SearchQuery,
  SearchError,
} from '../schemas'

// =============================================================================
// PANEL ID TYPE
// =============================================================================

/**
 * Branded string for panel identification.
 * Ensures type safety when accessing panel-scoped atoms.
 */
export const PanelId = Schema.String.pipe(Schema.brand('GeointPanelId'))
export type PanelId = typeof PanelId.Type

/**
 * Convert a string to PanelId (branded type).
 * Use this when receiving panelId from props or context.
 */
export function asPanelId(value: string): PanelId {
  return value as PanelId
}

// =============================================================================
// PANEL IDENTITY (UUID + Slug)
// =============================================================================

/**
 * Panel identity structure: UUID (unique instance) + slug (human-readable).
 *
 * - uuid: Globally unique identifier for this panel instance
 * - slug: Human-readable name (e.g., "geoint-main", "geoint-detail")
 *
 * Used for:
 * - Generating panelId for atom families: `${slug}:${uuid}`
 * - Generating scopeId for hotkeys: `geoint:${slug}:${uuid}`
 */
export const PanelIdentity = Schema.Struct({
  uuid: Schema.UUID,
  slug: Schema.String,
})

export type PanelIdentity = Schema.Schema.Type<typeof PanelIdentity>

/**
 * Create a new panel identity.
 *
 * @param slug Human-readable identifier (e.g., "geoint-main")
 * @returns PanelIdentity with new UUID
 *
 * @example
 * ```typescript
 * const identity = createPanelIdentity('geoint-main')
 * // { uuid: "a1b2c3d4-...", slug: "geoint-main" }
 * ```
 */
export function createPanelIdentity(slug: string): PanelIdentity {
  // Generate UUID v4
  const uuid = crypto.randomUUID()
  return { uuid, slug }
}

/**
 * Convert PanelIdentity to PanelId for atom family keys.
 *
 * Format: `${slug}:${uuid}`
 *
 * @example
 * ```typescript
 * const identity = { uuid: "a1b2...", slug: "geoint-main" }
 * const panelId = panelIdentityToId(identity)
 * // "geoint-main:a1b2..."
 *
 * const atoms = getPanelAtoms(panelId)
 * ```
 */
export function panelIdentityToId(identity: PanelIdentity): PanelId {
  return asPanelId(`${identity.slug}:${identity.uuid}`)
}

/**
 * Convert PanelIdentity to scope ID for hotkey system.
 *
 * Format: `geoint:${slug}:${uuid}`
 *
 * @example
 * ```typescript
 * const identity = { uuid: "a1b2...", slug: "geoint-main" }
 * const scopeId = panelIdentityToScopeId(identity)
 * // "geoint:geoint-main:a1b2..."
 * ```
 */
export function panelIdentityToScopeId(identity: PanelIdentity): string {
  return `geoint:${identity.slug}:${identity.uuid}`
}

// =============================================================================
// TYPE RE-EXPORTS (from main atoms module)
// =============================================================================

export type {
  ViewportState,
  SearchStatus,
  ActiveFilters,
  TimeRange,
  LayerVisibility,
  LayerOpacity,
  PanelState,
  PanelMode,
  StreamingState,
  TimelinePlaybackState,
} from './index'

// =============================================================================
// DEFAULT VALUES
// =============================================================================

import type {
  ViewportState,
  SearchStatus,
  ActiveFilters,
  LayerVisibility,
  LayerOpacity,
  PanelState,
  StreamingState,
  TimelinePlaybackState,
  TimeRange,
} from './index'

const DEFAULT_VIEWPORT: ViewportState = {
  longitude: -122.42,
  latitude: 37.78,
  zoom: 12,
  pitch: 0,
  bearing: 0,
}

const DEFAULT_FILTERS: ActiveFilters = {
  sources: [],
  textQuery: '',
  geoFilter: 'viewport',
  radiusKm: 50,
  temporalFilter: 'live',
  customTimeRange: null,
}

const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  tracks: true,
  pois: true,
  flights: true,
  features: true,
  imagery: false,
  weather: false,
  heatmap: false,
  labels: true,
}

const DEFAULT_LAYER_OPACITY: LayerOpacity = {
  tracks: 1,
  pois: 1,
  flights: 1,
  features: 1,
  imagery: 0.8,
  weather: 0.7,
  heatmap: 0.6,
}

const DEFAULT_PANEL_STATE: PanelState = {
  sidebar: 'default',
  intelPanel: 'default',
  detailsPanel: false,
}

const DEFAULT_STREAMING_STATE: StreamingState = {
  isStreaming: false,
  pendingCount: 0,
  lastUpdate: null,
}

const DEFAULT_TIMELINE_PLAYBACK: TimelinePlaybackState = {
  enabled: false,
  playhead: new Date(),
  range: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  },
  windowMs: 5 * 60 * 1000,
  isPlaying: false,
}

// =============================================================================
// ATOM FAMILIES
// =============================================================================

/**
 * Viewport state per panel.
 * Controls map center, zoom, bearing, pitch.
 */
export const viewportFamily = Atom.family((panelId: PanelId) =>
  Atom.make<ViewportState>(DEFAULT_VIEWPORT)
)

/**
 * Search status per panel.
 */
export const searchStatusFamily = Atom.family((panelId: PanelId) =>
  Atom.make<SearchStatus>('idle')
)

/**
 * Search query per panel.
 */
export const searchQueryFamily = Atom.family((panelId: PanelId) =>
  Atom.make<SearchQuery | null>(null)
)

/**
 * Search error message per panel (string for display).
 */
export const searchErrorFamily = Atom.family((panelId: PanelId) =>
  Atom.make<string | null>(null)
)

/**
 * Search typed error per panel (for programmatic handling).
 */
export const searchTypedErrorFamily = Atom.family((panelId: PanelId) =>
  Atom.make<SearchError | null>(null)
)

/**
 * Search retry count per panel.
 */
export const searchRetryCountFamily = Atom.family((panelId: PanelId) =>
  Atom.make<number>(0)
)

/**
 * Last search timestamp per panel.
 */
export const lastSearchTimeFamily = Atom.family((panelId: PanelId) =>
  Atom.make<number | null>(null)
)

/**
 * All search results per panel.
 */
export const resultsFamily = Atom.family((panelId: PanelId) =>
  Atom.make<readonly SearchResultItem[]>([])
)

/**
 * Currently selected result per panel (for details panel).
 */
export const selectedResultFamily = Atom.family((panelId: PanelId) =>
  Atom.make<SearchResultItem | null>(null)
)

/**
 * Hovered result per panel (for highlighting on map).
 */
export const hoveredResultFamily = Atom.family((panelId: PanelId) =>
  Atom.make<SearchResultItem | null>(null)
)

/**
 * Multi-selection per panel (for batch operations).
 */
export const selectedResultsFamily = Atom.family((panelId: PanelId) =>
  Atom.make<readonly SearchResultItem[]>([])
)

/**
 * Active filters per panel.
 */
export const activeFiltersFamily = Atom.family((panelId: PanelId) =>
  Atom.make<ActiveFilters>(DEFAULT_FILTERS)
)

/**
 * Layer visibility per panel.
 */
export const layerVisibilityFamily = Atom.family((panelId: PanelId) =>
  Atom.make<LayerVisibility>(DEFAULT_LAYER_VISIBILITY)
)

/**
 * Layer opacity per panel.
 */
export const layerOpacityFamily = Atom.family((panelId: PanelId) =>
  Atom.make<LayerOpacity>(DEFAULT_LAYER_OPACITY)
)

/**
 * Panel state per panel (sidebar/intel/details visibility).
 */
export const panelStateFamily = Atom.family((panelId: PanelId) =>
  Atom.make<PanelState>(DEFAULT_PANEL_STATE)
)

/**
 * Streaming state per panel.
 */
export const streamingStateFamily = Atom.family((panelId: PanelId) =>
  Atom.make<StreamingState>(DEFAULT_STREAMING_STATE)
)

/**
 * Timeline playback state per panel.
 */
export const timelinePlaybackFamily = Atom.family((panelId: PanelId) =>
  Atom.make<TimelinePlaybackState>(DEFAULT_TIMELINE_PLAYBACK)
)

// =============================================================================
// MAP CONTROLLER ATOM FAMILIES (Phase 1)
// =============================================================================

import type { FlyToTarget, MapStyle } from '../map/schemas'

/**
 * Basemap style per panel.
 * Controls which Mapbox style URL is used.
 * Default: 'dark'
 *
 * @see MapController.cycleMapStyle()
 * @see MapController.setMapStyle()
 */
export const mapStyleFamily = Atom.family((panelId: PanelId) =>
  Atom.make<MapStyle>('dark' as MapStyle)
)

/**
 * Custom home viewport per panel.
 * Overrides DEFAULT_VIEWPORT when user calls `setHome()`.
 * null = use DEFAULT_VIEWPORT as home.
 *
 * @see MapController.setHome()
 * @see MapController.resetView()
 */
export const homeViewportFamily = Atom.family((panelId: PanelId) =>
  Atom.make<ViewportState | null>(null)
)

/**
 * Camera animation state per panel.
 * true when a flyTo/flyToBounds transition is in progress.
 * Used by cancelAnimation() and hotkey guards.
 *
 * @see MapController.flyTo()
 * @see MapController.cancelAnimation()
 */
export const isAnimatingFamily = Atom.family((panelId: PanelId) =>
  Atom.make<boolean>(false)
)

/**
 * Fly-to target per panel.
 *
 * When non-null, GeointMap applies DeckGL FlyToInterpolator and then clears it.
 * This is the panel-scoped animation trigger path consumed by MapController.flyTo().
 */
export const flyToTargetFamily = Atom.family((panelId: PanelId) =>
  Atom.make<FlyToTarget | null>(null)
)

// =============================================================================
// AGGREGATE ACCESSOR
// =============================================================================

/**
 * All panel-scoped atoms for a given panel.
 * Provides type-safe access to panel-specific state.
 */
export interface GeointPanelAtoms {
  // Viewport
  readonly viewportAtom: ReturnType<typeof viewportFamily>

  // Search
  readonly searchStatusAtom: ReturnType<typeof searchStatusFamily>
  readonly searchQueryAtom: ReturnType<typeof searchQueryFamily>
  readonly searchErrorAtom: ReturnType<typeof searchErrorFamily>
  readonly searchTypedErrorAtom: ReturnType<typeof searchTypedErrorFamily>
  readonly searchRetryCountAtom: ReturnType<typeof searchRetryCountFamily>
  readonly lastSearchTimeAtom: ReturnType<typeof lastSearchTimeFamily>

  // Results
  readonly resultsAtom: ReturnType<typeof resultsFamily>
  readonly selectedResultAtom: ReturnType<typeof selectedResultFamily>
  readonly hoveredResultAtom: ReturnType<typeof hoveredResultFamily>
  readonly selectedResultsAtom: ReturnType<typeof selectedResultsFamily>

  // Filters
  readonly activeFiltersAtom: ReturnType<typeof activeFiltersFamily>

  // Layers
  readonly layerVisibilityAtom: ReturnType<typeof layerVisibilityFamily>
  readonly layerOpacityAtom: ReturnType<typeof layerOpacityFamily>

  // Panels
  readonly panelStateAtom: ReturnType<typeof panelStateFamily>

  // Streaming
  readonly streamingStateAtom: ReturnType<typeof streamingStateFamily>

  // Timeline
  readonly timelinePlaybackAtom: ReturnType<typeof timelinePlaybackFamily>

  // MapController (Phase 1)
  readonly mapStyleAtom: ReturnType<typeof mapStyleFamily>
  readonly homeViewportAtom: ReturnType<typeof homeViewportFamily>
  readonly isAnimatingAtom: ReturnType<typeof isAnimatingFamily>
  readonly flyToTargetAtom: ReturnType<typeof flyToTargetFamily>
}

/**
 * Get all panel atoms for a given panelId.
 *
 * Returns memoized atoms - same panelId always returns same instances.
 * This is the recommended way to access panel-scoped atoms.
 *
 * @example
 * ```typescript
 * const panelId = asPanelId('panel-1')
 * const atoms = getPanelAtoms(panelId)
 *
 * // All atoms are memoized
 * registry.get(atoms.viewportAtom)
 * registry.set(atoms.searchQueryAtom, query)
 * ```
 */
export function getPanelAtoms(panelId: PanelId): GeointPanelAtoms {
  return {
    // Viewport
    viewportAtom: viewportFamily(panelId),

    // Search
    searchStatusAtom: searchStatusFamily(panelId),
    searchQueryAtom: searchQueryFamily(panelId),
    searchErrorAtom: searchErrorFamily(panelId),
    searchTypedErrorAtom: searchTypedErrorFamily(panelId),
    searchRetryCountAtom: searchRetryCountFamily(panelId),
    lastSearchTimeAtom: lastSearchTimeFamily(panelId),

    // Results
    resultsAtom: resultsFamily(panelId),
    selectedResultAtom: selectedResultFamily(panelId),
    hoveredResultAtom: hoveredResultFamily(panelId),
    selectedResultsAtom: selectedResultsFamily(panelId),

    // Filters
    activeFiltersAtom: activeFiltersFamily(panelId),

    // Layers
    layerVisibilityAtom: layerVisibilityFamily(panelId),
    layerOpacityAtom: layerOpacityFamily(panelId),

    // Panels
    panelStateAtom: panelStateFamily(panelId),

    // Streaming
    streamingStateAtom: streamingStateFamily(panelId),

    // Timeline
    timelinePlaybackAtom: timelinePlaybackFamily(panelId),

    // MapController (Phase 1)
    mapStyleAtom: mapStyleFamily(panelId),
    homeViewportAtom: homeViewportFamily(panelId),
    isAnimatingAtom: isAnimatingFamily(panelId),
    flyToTargetAtom: flyToTargetFamily(panelId),
  }
}
