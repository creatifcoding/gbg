/**
 * GEOINT Workspace Schemas
 *
 * Effect Schema definitions for workspace persistence.
 * Captures viewport state, layer visibility, filters, and panel layouts.
 *
 * @module geoint/workspace/schemas
 */

import { Schema } from 'effect'
import { IntelSource } from '../schemas'

// =============================================================================
// Branded IDs
// =============================================================================

/** Unique workspace identifier */
export const WorkspaceId = Schema.String.pipe(Schema.brand('WorkspaceId'))
export type WorkspaceId = typeof WorkspaceId.Type

/** Generate a new workspace ID */
export const generateWorkspaceId = (): WorkspaceId =>
  `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as WorkspaceId

// =============================================================================
// Viewport State
// =============================================================================

/** Map viewport state */
export class ViewportState extends Schema.Class<ViewportState>('ViewportState')({
  /** Longitude of map center */
  longitude: Schema.Number.pipe(Schema.between(-180, 180)),
  /** Latitude of map center */
  latitude: Schema.Number.pipe(Schema.between(-90, 90)),
  /** Zoom level (0-22) */
  zoom: Schema.Number.pipe(Schema.between(0, 22)),
  /** Pitch in degrees (0-85) */
  pitch: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 85)), { default: () => 0 }),
  /** Bearing in degrees (0-360) */
  bearing: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 360)), { default: () => 0 }),
  /** Altitude for 3D views (meters) */
  altitude: Schema.optional(Schema.Number),
}) {}

/** Default viewport (world view) */
export const DEFAULT_VIEWPORT: ViewportState = new ViewportState({
  longitude: 0,
  latitude: 20,
  zoom: 2,
  pitch: 0,
  bearing: 0,
})

// =============================================================================
// Layer Configuration
// =============================================================================

/** Layer visibility configuration */
export class LayerConfig extends Schema.Class<LayerConfig>('LayerConfig')({
  /** Layer ID */
  id: Schema.String,
  /** Whether layer is visible */
  visible: Schema.Boolean,
  /** Layer opacity (0-1) */
  opacity: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 1)), { default: () => 1 }),
  /** Layer-specific settings (JSON) */
  settings: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/** Default layer visibility */
export const DEFAULT_LAYERS: LayerConfig[] = [
  new LayerConfig({ id: 'tracks', visible: true, opacity: 1 }),
  new LayerConfig({ id: 'pois', visible: true, opacity: 0.8 }),
  new LayerConfig({ id: 'flights', visible: true, opacity: 1 }),
  new LayerConfig({ id: 'features', visible: false, opacity: 0.7 }),
  new LayerConfig({ id: 'weather', visible: false, opacity: 0.6 }),
  new LayerConfig({ id: 'imagery', visible: false, opacity: 1 }),
]

// =============================================================================
// Search Filter State
// =============================================================================

/** Time range for temporal filtering */
export const TimeRange = Schema.Struct({
  /** Start timestamp (ISO string or epoch ms) */
  start: Schema.optional(Schema.Date),
  /** End timestamp (ISO string or epoch ms) */
  end: Schema.optional(Schema.Date),
  /** Whether to use live/streaming data */
  live: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
export type TimeRange = typeof TimeRange.Type

/** Geographic filter for workspace */
export const WorkspaceGeoFilter = Schema.Union(
  Schema.Struct({
    _type: Schema.Literal('viewport'),
  }),
  Schema.Struct({
    _type: Schema.Literal('radius'),
    center: Schema.Tuple(Schema.Number, Schema.Number),
    radiusKm: Schema.Number,
  }),
  Schema.Struct({
    _type: Schema.Literal('polygon'),
    coordinates: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
  })
)
export type WorkspaceGeoFilter = typeof WorkspaceGeoFilter.Type

/** Filter state for searches */
export class FilterState extends Schema.Class<FilterState>('FilterState')({
  /** Enabled intel sources */
  sources: Schema.Array(IntelSource),
  /** Time range filter */
  timeRange: Schema.optionalWith(TimeRange, {
    default: () => ({ live: true }),
  }),
  /** Geographic filter */
  geoFilter: Schema.optionalWith(WorkspaceGeoFilter, {
    default: () => ({ _type: 'viewport' as const }),
  }),
  /** Text query */
  query: Schema.optionalWith(Schema.String, { default: () => '' }),
  /** Classification filter */
  classifications: Schema.optionalWith(
    Schema.Array(Schema.Literal('friendly', 'hostile', 'neutral', 'unknown')),
    { default: () => [] }
  ),
  /** Minimum score threshold (0-1) */
  minScore: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 1)), { default: () => 0 }),
}) {}

/** Default filter state */
export const DEFAULT_FILTERS = new FilterState({
  sources: ['track', 'osm', 'opensky', 'feature'] as IntelSource[],
})

// =============================================================================
// Panel Layout
// =============================================================================

/** Panel position and size */
export class PanelLayout extends Schema.Class<PanelLayout>('PanelLayout')({
  /** Panel ID */
  id: Schema.String,
  /** Whether panel is open */
  open: Schema.Boolean,
  /** Position */
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
    })
  ),
  /** Size */
  size: Schema.optional(
    Schema.Struct({
      width: Schema.Number,
      height: Schema.Number,
    })
  ),
  /** Tab index (for tabbed panels) */
  tabIndex: Schema.optional(Schema.Number),
  /** Minimized state */
  minimized: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

/** Default panel layouts */
export const DEFAULT_PANEL_LAYOUTS: PanelLayout[] = [
  new PanelLayout({ id: 'search', open: true }),
  new PanelLayout({ id: 'results', open: true }),
  new PanelLayout({ id: 'entity', open: false }),
  new PanelLayout({ id: 'intel-summary', open: false }),
]

// =============================================================================
// Pinned Entities
// =============================================================================

/** Reference to a pinned entity */
export class PinnedEntity extends Schema.Class<PinnedEntity>('PinnedEntity')({
  /** Entity ID (source:type:id format) */
  entityId: Schema.String,
  /** Source that provided the entity */
  source: IntelSource,
  /** Optional label override */
  label: Schema.optional(Schema.String),
  /** Color override (hex) */
  color: Schema.optional(Schema.String),
  /** Pinned timestamp */
  pinnedAt: Schema.Date,
}) {}

// =============================================================================
// Workspace
// =============================================================================

/** Complete workspace state */
export class Workspace extends Schema.Class<Workspace>('Workspace')({
  /** Unique workspace ID */
  id: WorkspaceId,
  /** Workspace name */
  name: Schema.String,
  /** Optional description */
  description: Schema.optional(Schema.String),
  /** Viewport state */
  viewport: ViewportState,
  /** Layer configurations */
  layers: Schema.Array(LayerConfig),
  /** Filter state */
  filters: FilterState,
  /** Panel layouts */
  panels: Schema.Array(PanelLayout),
  /** Pinned entities */
  pinnedEntities: Schema.optionalWith(Schema.Array(PinnedEntity), { default: () => [] }),
  /** Currently selected entity ID */
  selectedEntityId: Schema.optional(Schema.String),
  /** Tags for organization */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Created timestamp */
  createdAt: Schema.Date,
  /** Last modified timestamp */
  updatedAt: Schema.Date,
  /** Last opened timestamp */
  lastOpenedAt: Schema.optional(Schema.Date),
}) {}

/** Create a new workspace with defaults */
export const createWorkspace = (name: string, description?: string): Workspace => {
  const now = new Date()
  return new Workspace({
    id: generateWorkspaceId(),
    name,
    description,
    viewport: DEFAULT_VIEWPORT,
    layers: DEFAULT_LAYERS,
    filters: DEFAULT_FILTERS,
    panels: DEFAULT_PANEL_LAYOUTS,
    pinnedEntities: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  })
}

// =============================================================================
// Workspace List Item (for UI lists)
// =============================================================================

/** Lightweight workspace reference for list displays */
export class WorkspaceListItem extends Schema.Class<WorkspaceListItem>('WorkspaceListItem')({
  id: WorkspaceId,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  lastOpenedAt: Schema.optional(Schema.Date),
  /** Preview data for thumbnail generation */
  previewViewport: Schema.optional(ViewportState),
}) {}

/** Extract list item from full workspace */
export const toListItem = (workspace: Workspace): WorkspaceListItem =>
  new WorkspaceListItem({
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    tags: workspace.tags,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    lastOpenedAt: workspace.lastOpenedAt,
    previewViewport: workspace.viewport,
  })
