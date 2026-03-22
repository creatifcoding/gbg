/**
 * GEOINT Panel Visitor — renders a GEOINT map surface inside a panel
 *
 * Registers visitor IDs:
 *   - `geoint:map` — Full GEOINT map with deck.gl + Mapbox, entity overlay
 *
 * Each visitor creates an isolated GeointMap instance scoped to the panel,
 * with search, entity management, and viewport controls.
 *
 * @module floating/visitors/geoint-visitor
 */

import * as React from 'react'
import { panelRegistry, type PanelContentProps } from '../panel-registry'

// =============================================================================
// Lazy-loaded GEOINT Map Panel
// =============================================================================

/**
 * Lazy-load GeointMap to avoid pulling deck.gl + Mapbox into the main bundle.
 * Falls back to a loading state while the chunk downloads.
 */
const LazyGeointMap = React.lazy(() =>
  import('@/lib/geoint/components/GeointMap').then((mod) => ({
    default: mod.GeointMap,
  }))
)

/**
 * GeointMapPanel — panel-embedded GEOINT map with full deck.gl rendering.
 *
 * Receives panelId for state isolation. Uses the panel's container
 * dimensions for responsive map sizing.
 */
function GeointMapPanel({ panelId, data }: PanelContentProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 })

  // Track container resize for deck.gl viewport
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.floor(width), height: Math.floor(height) })
        }
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Extract initial config from visitor data if provided
  const config = (data as GeointPanelData | undefined) ?? {}

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0a0a',
      }}
    >
      <React.Suspense
        fallback={
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
              fontSize: 'var(--tmnl-text-xs, 12px)',
              color: '#737373',
              letterSpacing: '0.04em',
            }}
          >
            LOADING GEOINT MAP…
          </div>
        }
      >
        <LazyGeointMap
          instanceId={`panel-${panelId}`}
          height={dimensions.height}
          interactive
          debug={config.debug ?? false}
          initialViewState={config.initialViewState}
          mapStyle={config.mapStyle}
          flyToTarget={config.flyToTarget ?? null}
        />
      </React.Suspense>
    </div>
  )
}

// =============================================================================
// Types
// =============================================================================

/**
 * Optional data payload when spawning a GEOINT panel.
 * Passed via spawnPanel('geoint:map', { data: { ... } })
 */
interface GeointPanelData {
  /** Enable debug overlay on map */
  debug?: boolean
  /** Initial view state (center, zoom, bearing, pitch) */
  initialViewState?: {
    longitude?: number
    latitude?: number
    zoom?: number
    bearing?: number
    pitch?: number
  }
  /** Mapbox style URL */
  mapStyle?: string
  /** Initial fly-to target */
  flyToTarget?: {
    longitude: number
    latitude: number
    zoom?: number
    pitch?: number
    bearing?: number
  } | null
}

// =============================================================================
// Registration
// =============================================================================

export function registerGeointVisitors() {
  panelRegistry.register('geoint:map', {
    label: 'GEOINT Map',
    icon: '🌍',
    description: 'Interactive GEOINT map with deck.gl + Mapbox — tracks, flights, POIs, weather, imagery',
    category: 'geoint',
    component: GeointMapPanel,
    stateTier: 'full', // Map state (viewport, layers, entities) must persist during virtualization
    defaults: {
      width: 900,
      height: 700,
      mode: 'tiled',
      accent: 'rgba(6, 182, 212, 0.5)', // cyan-500
    },
  })
}
