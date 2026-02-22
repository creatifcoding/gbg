/**
 * @fileoverview GEOINT Domain Catalog for CatalogComponents Service
 *
 * Full-featured GEOINT dashboard components for genifer.
 * Enables LLMs to generate operational dashboards with map, search, entity panel, and timeline.
 *
 * @module genifer/catalog/geoint-domain-catalog
 */

import { Schema } from 'effect'
import type { DomainCatalog, ComponentRenderProps } from '@/lib/genifer/core/CatalogService'
import type { EntranceAnimation } from '@/lib/genifer/core/animation-schema'

import { GeointDashboardPanel } from '@/lib/geoint/components'
import type { LayoutMode } from '@/lib/geoint/atoms/layoutAtoms'

// =============================================================================
// Prop Schemas
// =============================================================================

/**
 * Schema for GeointDashboard component props.
 * panelId is required; all other props have sensible defaults.
 */
const GeointDashboardPropsSchema = Schema.Struct({
  /** Unique ID for panel state isolation */
  panelId: Schema.String,
  /** Display label in header */
  label: Schema.optional(Schema.String),
  /** Initial layout mode: command (3-column), focus (fullscreen map), analytics (grid) */
  initialLayout: Schema.optional(Schema.Literal('command', 'focus', 'analytics')),
  /** Enable keyboard shortcuts for layout switching (Ctrl+1/2/3) */
  enableShortcuts: Schema.optional(Schema.Boolean),
  /** Custom CSS class name */
  className: Schema.optional(Schema.String),
})

// =============================================================================
// Renderers
// =============================================================================

/**
 * Renderer for GeointDashboard component.
 * Maps genifer element props to GeointDashboardPanel props.
 */
function GeointDashboardRenderer({ element, onAction }: ComponentRenderProps) {
  // Extract props with sensible defaults
  const panelId = (element.props['panelId'] as string) ?? element.key
  const label = (element.props['label'] as string) ?? 'GEOINT Dashboard'
  const initialLayout = (element.props['initialLayout'] as LayoutMode) ?? 'command'
  const enableShortcuts = (element.props['enableShortcuts'] as boolean) ?? true
  const className = element.props['className'] as string | undefined

  // Handle close action if provided
  const handleClose = () => {
    if (onAction) {
      onAction({ name: 'close', params: { panelId } })
    }
  }

  return (
    <GeointDashboardPanel
      panelId={panelId}
      label={label}
      initialLayout={initialLayout}
      enableShortcuts={enableShortcuts}
      onClose={handleClose}
      className={className}
    />
  )
}

// =============================================================================
// Default Entrance Animations
// =============================================================================

/**
 * Default animations for GEOINT components.
 * Dashboards use a subtle scale+opacity entrance for impact.
 */
const defaultAnimations = {
  /** Dashboard entrance - subtle scale with opacity */
  dashboard: {
    property: 'opacity+scale',
    easing: 'out-cubic',
    duration: 'normal',
  } satisfies EntranceAnimation,
}

// =============================================================================
// Domain Catalog Export
// =============================================================================

/**
 * GEOINT Domain Catalog
 *
 * Components for geospatial intelligence dashboards:
 * - GeointDashboard: Full-featured dashboard with map, search, entity panel, timeline
 *
 * ## Composition with Layout Components
 *
 * GeointDashboard is designed to work seamlessly with the layout library.
 * It fills its container (100% width/height) and adapts via CSS container queries.
 *
 * ### Standalone (fullscreen)
 * @example
 * ```json
 * { "root": "dash", "elements": { "dash": { "type": "GeointDashboard", "props": { "panelId": "main" } } } }
 * ```
 *
 * ### Inside VStack with header
 * @example
 * ```json
 * {
 *   "root": "layout",
 *   "elements": {
 *     "layout": { "type": "VStack", "props": { "gap": 16 }, "children": ["header", "dash"] },
 *     "header": { "type": "Heading", "props": { "level": 1, "text": "Operations Center" } },
 *     "dash": { "type": "GeointDashboard", "props": { "panelId": "ops" } }
 *   }
 * }
 * ```
 *
 * ### Side-by-side comparison (Grid)
 * @example
 * ```json
 * {
 *   "root": "grid",
 *   "elements": {
 *     "grid": { "type": "Grid", "props": { "template": "1fr 1fr", "gap": 16 }, "children": ["left", "right"] },
 *     "left": { "type": "GeointDashboard", "props": { "panelId": "region-a", "label": "Region A" } },
 *     "right": { "type": "GeointDashboard", "props": { "panelId": "region-b", "label": "Region B" } }
 *   }
 * }
 * ```
 *
 * ### With AspectRatio constraint
 * @example
 * ```json
 * {
 *   "root": "aspect",
 *   "elements": {
 *     "aspect": { "type": "AspectRatio", "props": { "ratio": 1.777 }, "children": ["dash"] },
 *     "dash": { "type": "GeointDashboard", "props": { "panelId": "16x9" } }
 *   }
 * }
 * ```
 *
 * ### In Flex with sidebar
 * @example
 * ```json
 * {
 *   "root": "flex",
 *   "elements": {
 *     "flex": { "type": "Flex", "props": { "gap": 16 }, "children": ["sidebar", "main"] },
 *     "sidebar": { "type": "FlexItem", "props": { "basis": "300px", "shrink": 0 }, "children": ["nav"] },
 *     "nav": { "type": "VStack", "props": { "gap": 8 }, "children": [] },
 *     "main": { "type": "FlexItem", "props": { "grow": 1 }, "children": ["dash"] },
 *     "dash": { "type": "GeointDashboard", "props": { "panelId": "main" } }
 *   }
 * }
 * ```
 */
export const geointDomainCatalog: DomainCatalog = {
  name: 'TMNL Geoint',
  components: {
    /**
     * GeointDashboard
     *
     * Full-featured GEOINT dashboard with:
     * - Interactive map (DeckGL + Mapbox)
     * - Search panel (sidebar)
     * - Entity detail panel (right)
     * - Timeline controls (bottom)
     *
     * Supports 3 layout modes:
     * - command: 3-column command center (default)
     * - focus: Full-screen map with floating panels
     * - analytics: Grid-based analytics dashboard
     *
     * Keyboard shortcuts:
     * - Ctrl+1: Command layout
     * - Ctrl+2: Focus layout
     * - Ctrl+3: Analytics layout
     */
    GeointDashboard: {
      schema: GeointDashboardPropsSchema,
      renderer: GeointDashboardRenderer,
      description:
        'Full-featured GEOINT dashboard with interactive map, search panel, entity details, and timeline. ' +
        'Supports 3 layouts: command (3-column default), focus (fullscreen map), analytics (grid). ' +
        'Responsive via CSS container queries — panels auto-adapt to container width: ' +
        'full (1200px+), compact (900-1199px), minimal (600-899px), map-focus (<600px). ' +
        '\n\n' +
        'LAYOUT COMPOSITION: ' +
        'Works with any layout container. Common patterns: ' +
        '(1) Grid template="1fr 1fr" for side-by-side dashboards; ' +
        '(2) VStack with Heading for titled dashboard; ' +
        '(3) AspectRatio ratio=1.777 for 16:9 constraint; ' +
        '(4) FlexItem grow=1 inside Flex with fixed sidebar. ' +
        '\n\n' +
        'Each instance needs a unique panelId for state isolation.',
      hasChildren: false, // Self-contained - no children slots, but CAN be a child of containers
      defaultEntrance: defaultAnimations.dashboard,
    },
  },
}

export default geointDomainCatalog
