/**
 * RVN Mapbox Configuration
 *
 * Brutalist map style configuration for Mapbox GL.
 * Monochrome with high contrast, minimal labels.
 *
 * @example
 * ```tsx
 * import mapboxgl from 'mapbox-gl'
 * import { RVN_MAPBOX_STYLE } from './rvn-mapbox-config'
 *
 * const map = new mapboxgl.Map({
 *   container: 'map',
 *   style: RVN_MAPBOX_STYLE,
 * })
 * ```
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnMapboxColors {
  background: string
  water: string
  land: string
  roads: string
  roadOutline: string
  buildings: string
  buildingOutline: string
  labels: string
  boundaries: string
  parks: string
}

interface RvnMapboxStyle {
  version: 8
  name: string
  sources: Record<string, unknown>
  layers: unknown[]
  glyphs: string
}

// -----------------------------------------------------------------------------
// Color Palette
// -----------------------------------------------------------------------------

export const RVN_MAP_COLORS: RvnMapboxColors = {
  background: '#e6e6e6',
  water: '#ffffff',
  land: '#f0f0f0',
  roads: '#ffffff',
  roadOutline: '#000000',
  buildings: '#d0d0d0',
  buildingOutline: '#000000',
  labels: '#000000',
  boundaries: '#000000',
  parks: '#e8e8e8',
} as const

// -----------------------------------------------------------------------------
// Style Configuration
// -----------------------------------------------------------------------------

/**
 * Minimal brutalist Mapbox style.
 *
 * Apply to mapbox-gl Map instance:
 * ```tsx
 * new mapboxgl.Map({
 *   style: RVN_MAPBOX_STYLE,
 *   // or for Mapbox-hosted sources:
 *   // style: 'mapbox://styles/mapbox/light-v11'
 *   // then apply RVN_MAP_LAYER_OVERRIDES
 * })
 * ```
 */
export const RVN_MAPBOX_STYLE: RvnMapboxStyle = {
  version: 8,
  name: 'RVN Tactical',
  sources: {
    // Add your tile sources here
    // Example:
    // 'mapbox': {
    //   type: 'vector',
    //   url: 'mapbox://mapbox.mapbox-streets-v8'
    // }
  },
  layers: [
    // Background
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': RVN_MAP_COLORS.background,
      },
    },
  ],
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
}

// -----------------------------------------------------------------------------
// Layer Overrides
// -----------------------------------------------------------------------------

/**
 * Paint property overrides to apply to existing Mapbox styles.
 *
 * Use with setPaintProperty:
 * ```tsx
 * Object.entries(RVN_MAP_LAYER_OVERRIDES).forEach(([layer, paint]) => {
 *   Object.entries(paint).forEach(([prop, value]) => {
 *     try {
 *       map.setPaintProperty(layer, prop, value)
 *     } catch (e) {
 *       // Layer might not exist
 *     }
 *   })
 * })
 * ```
 */
export const RVN_MAP_LAYER_OVERRIDES: Record<string, Record<string, unknown>> = {
  // Background layers
  background: {
    'background-color': RVN_MAP_COLORS.background,
  },

  // Water
  water: {
    'fill-color': RVN_MAP_COLORS.water,
    'fill-outline-color': RVN_MAP_COLORS.boundaries,
  },

  // Land/landuse
  landuse: {
    'fill-color': RVN_MAP_COLORS.land,
  },

  // Parks
  'landuse-park': {
    'fill-color': RVN_MAP_COLORS.parks,
  },

  // Buildings
  building: {
    'fill-color': RVN_MAP_COLORS.buildings,
    'fill-outline-color': RVN_MAP_COLORS.buildingOutline,
  },

  // Roads
  'road-primary': {
    'line-color': RVN_MAP_COLORS.roads,
    'line-width': 2,
  },
  'road-secondary': {
    'line-color': RVN_MAP_COLORS.roads,
    'line-width': 1.5,
  },
  'road-street': {
    'line-color': RVN_MAP_COLORS.roads,
    'line-width': 1,
  },

  // Labels
  'place-label': {
    'text-color': RVN_MAP_COLORS.labels,
    'text-halo-color': RVN_MAP_COLORS.background,
    'text-halo-width': 1,
  },

  // Boundaries
  'admin-boundary': {
    'line-color': RVN_MAP_COLORS.boundaries,
    'line-width': 1,
    'line-dasharray': [2, 2],
  },
} as const

// -----------------------------------------------------------------------------
// Grid Overlay Generator
// -----------------------------------------------------------------------------

/**
 * Generate a grid overlay for the map.
 * Returns SVG pattern data URL for use as background.
 *
 * @example
 * ```tsx
 * const gridPattern = generateGridPattern(50)
 * element.style.backgroundImage = `url("${gridPattern}")`
 * ```
 */
export function generateGridPattern(gridSize: number = 50, color: string = '#00000010'): string {
  const svg = `
    <svg width="${gridSize}" height="${gridSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
          <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="${color}" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  `
  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`
}

// -----------------------------------------------------------------------------
// Map Configuration Helpers
// -----------------------------------------------------------------------------

/**
 * Default map configuration options
 */
export const RVN_MAP_DEFAULTS = {
  /** Initial zoom level */
  zoom: 12,
  /** Minimum zoom */
  minZoom: 2,
  /** Maximum zoom */
  maxZoom: 18,
  /** Pitch (tilt) */
  pitch: 0,
  /** Bearing (rotation) */
  bearing: 0,
  /** Disable rotation */
  dragRotate: false,
  /** Disable pitch */
  pitchWithRotate: false,
  /** Touch zoom with two fingers */
  touchZoomRotate: true,
} as const

/**
 * Grid background CSS for static maps
 */
export const RVN_STATIC_GRID_CSS: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(#00000008 1px, transparent 1px),
    linear-gradient(90deg, #00000008 1px, transparent 1px)
  `,
  backgroundSize: '50px 50px',
}

export type { RvnMapboxColors, RvnMapboxStyle }
