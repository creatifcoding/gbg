/**
 * LayerPalette - Reusable layer toggle controls for GEOINT maps
 *
 * Provides visibility toggles for all GEOINT layer types.
 * Can be used standalone or within drawers/panels.
 *
 * @see .cursor/prd/features.md F002 (Feature Layers)
 * @module
 */

import { memo, useCallback } from 'react'
import { Eye, EyeOff, Play, Pause, Layers } from 'lucide-react'
import type { GeointLayerVisibility } from './GeointMap'

// =============================================================================
// Types
// =============================================================================

export interface LayerPaletteProps {
  /** Current visibility state */
  visibility: GeointLayerVisibility

  /** Visibility change handler */
  onVisibilityChange: (visibility: GeointLayerVisibility) => void

  /** Animation state (for trips layer) */
  animate?: boolean

  /** Animation toggle handler */
  onAnimateChange?: (animate: boolean) => void

  /** Show header with title */
  showHeader?: boolean

  /** Compact mode (smaller buttons) */
  compact?: boolean

  /** Additional CSS class */
  className?: string
}

export interface LayerToggleProps {
  label: string
  active: boolean
  onClick: () => void
  color?: 'cyan' | 'orange' | 'purple' | 'green'
  compact?: boolean
}

// =============================================================================
// Layer Toggle Button
// =============================================================================

export function LayerToggle({ label, active, onClick, color = 'cyan', compact = false }: LayerToggleProps) {
  const colorClasses = {
    cyan: active
      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
      : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:bg-neutral-700',
    orange: active
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:bg-neutral-700',
    purple: active
      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:bg-neutral-700',
    green: active
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:bg-neutral-700',
  }

  const sizeClasses = compact
    ? 'px-2 py-1 text-xs gap-1'
    : 'px-3 py-1.5 text-sm gap-2'

  return (
    <button
      onClick={onClick}
      className={`rounded flex items-center border transition-colors ${sizeClasses} ${colorClasses[color]}`}
    >
      {active ? (
        <Eye className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
      ) : (
        <EyeOff className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
      )}
      {label}
    </button>
  )
}

// =============================================================================
// Layer Palette
// =============================================================================

function LayerPaletteComponent({
  visibility,
  onVisibilityChange,
  animate = false,
  onAnimateChange,
  showHeader = true,
  compact = false,
  className = '',
}: LayerPaletteProps) {
  const toggleLayer = useCallback(
    (layer: keyof GeointLayerVisibility) => {
      onVisibilityChange({ ...visibility, [layer]: !visibility[layer] })
    },
    [visibility, onVisibilityChange]
  )

  const toggleAnimate = useCallback(() => {
    onAnimateChange?.(!animate)
  }, [animate, onAnimateChange])

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-sm text-white">LAYERS</span>
        </div>
      )}

      {/* Track Layers */}
      <div className="space-y-2">
        <div className="text-xs text-neutral-500 uppercase tracking-wider">Tracks</div>

        <div className="flex items-center justify-between">
          <span className={`text-neutral-400 ${compact ? 'text-xs' : 'text-sm'}`}>Paths</span>
          <LayerToggle
            label={visibility.paths ? 'On' : 'Off'}
            active={visibility.paths}
            onClick={() => toggleLayer('paths')}
            color="cyan"
            compact={compact}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-neutral-400 ${compact ? 'text-xs' : 'text-sm'}`}>Positions</span>
          <LayerToggle
            label={visibility.positions ? 'On' : 'Off'}
            active={visibility.positions}
            onClick={() => toggleLayer('positions')}
            color="cyan"
            compact={compact}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-neutral-400 ${compact ? 'text-xs' : 'text-sm'}`}>Headings</span>
          <LayerToggle
            label={visibility.headings ? 'On' : 'Off'}
            active={visibility.headings}
            onClick={() => toggleLayer('headings')}
            color="cyan"
            compact={compact}
          />
        </div>
      </div>

      {/* Analysis Layers */}
      <div className="space-y-2">
        <div className="text-xs text-neutral-500 uppercase tracking-wider">Analysis</div>

        <div className="flex items-center justify-between">
          <span className={`text-neutral-400 ${compact ? 'text-xs' : 'text-sm'}`}>Heatmap</span>
          <LayerToggle
            label={visibility.heatmap ? 'On' : 'Off'}
            active={visibility.heatmap}
            onClick={() => toggleLayer('heatmap')}
            color="orange"
            compact={compact}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-neutral-400 ${compact ? 'text-xs' : 'text-sm'}`}>Animated</span>
          <div className="flex gap-2">
            <LayerToggle
              label={visibility.trips ? 'On' : 'Off'}
              active={visibility.trips}
              onClick={() => toggleLayer('trips')}
              color="orange"
              compact={compact}
            />
            {onAnimateChange && (
              <button
                onClick={toggleAnimate}
                className={`rounded flex items-center border transition-colors ${
                  compact ? 'px-1.5 py-1' : 'px-2 py-1.5'
                } ${
                  animate
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:bg-neutral-700'
                }`}
              >
                {animate ? (
                  <Pause className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                ) : (
                  <Play className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overlay Layers */}
      <div className="space-y-2">
        <div className="text-xs text-neutral-500 uppercase tracking-wider">Overlays</div>

        <div className="flex items-center justify-between">
          <span className={`text-neutral-400 ${compact ? 'text-xs' : 'text-sm'}`}>Positioned Entities</span>
          <LayerToggle
            label={visibility.positionedEntities ? 'On' : 'Off'}
            active={visibility.positionedEntities}
            onClick={() => toggleLayer('positionedEntities')}
            color="purple"
            compact={compact}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-neutral-400 ${compact ? 'text-xs' : 'text-sm'}`}>Labels</span>
          <LayerToggle
            label={visibility.labels ? 'On' : 'Off'}
            active={visibility.labels}
            onClick={() => toggleLayer('labels')}
            color="green"
            compact={compact}
          />
        </div>
      </div>
    </div>
  )
}

export const LayerPalette = memo(LayerPaletteComponent)
export default LayerPalette
