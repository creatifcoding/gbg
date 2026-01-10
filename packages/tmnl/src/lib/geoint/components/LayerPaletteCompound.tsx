/**
 * LayerPaletteCompound - Enhanced Layer Control System
 *
 * Compound component architecture for layer management:
 * - Collapsible groups with anime.js animations
 * - Master toggle per group
 * - Opacity sliders for fine control
 * - Preset configurations (Mission, Analysis, Overview)
 * - Keyboard shortcuts
 *
 * @module geoint/components/LayerPaletteCompound
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { Atom } from '@effect-atom/atom'
import { animate } from 'animejs'
import {
  Eye,
  EyeOff,
  ChevronDown,
  Layers,
  Map,
  Activity,
  Radio,
  Crosshair,
  RotateCcw,
  Bookmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING } from '../tokens'
import type { GeointLayerVisibility } from './GeointMap'

// =============================================================================
// TYPES
// =============================================================================

export interface PaletteLayerConfig {
  id: keyof GeointLayerVisibility
  label: string
  description?: string
  icon?: typeof Eye
  color: 'cyan' | 'orange' | 'purple' | 'green' | 'blue' | 'pink'
  group: 'tracks' | 'analysis' | 'overlays' | 'imagery'
}

export interface LayerPreset {
  id: string
  name: string
  icon: typeof Map
  description: string
  visibility: Partial<GeointLayerVisibility>
}

export interface LayerPaletteContextValue {
  /** Current visibility state */
  visibility: GeointLayerVisibility
  /** Layer opacities (0-1) */
  opacities: Record<keyof GeointLayerVisibility, number>
  /** Toggle a single layer */
  toggleLayer: (layer: keyof GeointLayerVisibility) => void
  /** Set layer opacity */
  setOpacity: (layer: keyof GeointLayerVisibility, opacity: number) => void
  /** Toggle all layers in a group */
  toggleGroup: (group: PaletteLayerConfig['group']) => void
  /** Check if group is fully enabled */
  isGroupEnabled: (group: PaletteLayerConfig['group']) => boolean
  /** Apply a preset */
  applyPreset: (presetId: string) => void
  /** Reset to defaults */
  resetToDefaults: () => void
  /** Animation state */
  animate: boolean
  /** Toggle animation */
  toggleAnimate: () => void
  /** Compact mode */
  compact: boolean
}

export interface LayerPaletteRootProps {
  /** Current visibility state */
  visibility: GeointLayerVisibility
  /** Visibility change handler */
  onVisibilityChange: (visibility: GeointLayerVisibility) => void
  /** Animation state */
  animate?: boolean
  /** Animation change handler */
  onAnimateChange?: (animate: boolean) => void
  /** Compact mode */
  compact?: boolean
  /** Custom presets */
  presets?: readonly LayerPreset[]
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// LAYER CONFIGURATION
// =============================================================================

const LAYER_CONFIGS: readonly PaletteLayerConfig[] = [
  // Tracks group
  { id: 'paths', label: 'Track Paths', description: 'Historical movement trails', icon: Activity, color: 'cyan', group: 'tracks' },
  { id: 'positions', label: 'Positions', description: 'Current entity locations', icon: Radio, color: 'cyan', group: 'tracks' },
  { id: 'headings', label: 'Headings', description: 'Direction indicators', icon: Crosshair, color: 'cyan', group: 'tracks' },

  // Analysis group
  { id: 'heatmap', label: 'Heatmap', description: 'Density visualization', icon: Activity, color: 'orange', group: 'analysis' },
  { id: 'trips', label: 'Animated Tracks', description: 'Time-lapse playback', icon: Activity, color: 'orange', group: 'analysis' },

  // Overlays group
  { id: 'positionedEntities', label: 'Entities', description: '3D positioned models', icon: Layers, color: 'purple', group: 'overlays' },
  { id: 'labels', label: 'Labels', description: 'Text annotations', icon: Map, color: 'green', group: 'overlays' },
]

const DEFAULT_PRESETS: readonly LayerPreset[] = [
  {
    id: 'mission',
    name: 'Mission',
    icon: Crosshair,
    description: 'Essential operational layers',
    visibility: {
      paths: true,
      positions: true,
      headings: true,
      heatmap: false,
      trips: false,
      positionedEntities: true,
      labels: true,
    },
  },
  {
    id: 'analysis',
    name: 'Analysis',
    icon: Activity,
    description: 'Full analysis with heatmaps',
    visibility: {
      paths: true,
      positions: true,
      headings: false,
      heatmap: true,
      trips: true,
      positionedEntities: false,
      labels: false,
    },
  },
  {
    id: 'overview',
    name: 'Overview',
    icon: Map,
    description: 'Clean situational view',
    visibility: {
      paths: false,
      positions: true,
      headings: false,
      heatmap: false,
      trips: false,
      positionedEntities: true,
      labels: true,
    },
  },
]

const DEFAULT_VISIBILITY: GeointLayerVisibility = {
  paths: true,
  positions: true,
  headings: true,
  heatmap: false,
  trips: false,
  positionedEntities: true,
  labels: true,
}

const DEFAULT_OPACITIES: Record<keyof GeointLayerVisibility, number> = {
  paths: 1,
  positions: 1,
  headings: 1,
  heatmap: 0.7,
  trips: 1,
  positionedEntities: 1,
  labels: 1,
}

// =============================================================================
// ATOMS
// =============================================================================

export const layerOpacitiesAtom = Atom.make(DEFAULT_OPACITIES)

// =============================================================================
// CONTEXT
// =============================================================================

const LayerPaletteContext = createContext<LayerPaletteContextValue | null>(null)

export const useLayerPalette = () => {
  const ctx = useContext(LayerPaletteContext)
  if (!ctx) throw new Error('useLayerPalette must be used within LayerPaletteCompound.Root')
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<LayerPaletteRootProps> = ({
  visibility,
  onVisibilityChange,
  animate: animateProp = false,
  onAnimateChange,
  compact = false,
  presets = DEFAULT_PRESETS,
  children,
  className,
}) => {
  const [opacities, setOpacities] = useState(DEFAULT_OPACITIES)
  const [animateState, setAnimateState] = useState(animateProp)

  const toggleLayer = useCallback((layer: keyof GeointLayerVisibility) => {
    onVisibilityChange({ ...visibility, [layer]: !visibility[layer] })
  }, [visibility, onVisibilityChange])

  const setOpacity = useCallback((layer: keyof GeointLayerVisibility, opacity: number) => {
    setOpacities((prev) => ({ ...prev, [layer]: opacity }))
  }, [])

  const toggleGroup = useCallback((group: PaletteLayerConfig['group']) => {
    const groupLayers = LAYER_CONFIGS.filter((l) => l.group === group)
    const allEnabled = groupLayers.every((l) => visibility[l.id])
    const newVisibility = { ...visibility }
    groupLayers.forEach((l) => {
      newVisibility[l.id] = !allEnabled
    })
    onVisibilityChange(newVisibility)
  }, [visibility, onVisibilityChange])

  const isGroupEnabled = useCallback((group: PaletteLayerConfig['group']) => {
    const groupLayers = LAYER_CONFIGS.filter((l) => l.group === group)
    return groupLayers.every((l) => visibility[l.id])
  }, [visibility])

  const applyPreset = useCallback((presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (preset) {
      onVisibilityChange({ ...visibility, ...preset.visibility })
    }
  }, [presets, visibility, onVisibilityChange])

  const resetToDefaults = useCallback(() => {
    onVisibilityChange(DEFAULT_VISIBILITY)
    setOpacities(DEFAULT_OPACITIES)
  }, [onVisibilityChange])

  const toggleAnimate = useCallback(() => {
    const newState = !animateState
    setAnimateState(newState)
    onAnimateChange?.(newState)
  }, [animateState, onAnimateChange])

  const contextValue: LayerPaletteContextValue = {
    visibility,
    opacities,
    toggleLayer,
    setOpacity,
    toggleGroup,
    isGroupEnabled,
    applyPreset,
    resetToDefaults,
    animate: animateState,
    toggleAnimate,
    compact,
  }

  return (
    <LayerPaletteContext.Provider value={contextValue}>
      <div className={cn('flex flex-col gap-2', className)}>
        {children}
      </div>
    </LayerPaletteContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  /** Show reset button */
  showReset?: boolean
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({
  showReset = true,
  className,
}) {
  const { resetToDefaults, compact } = useLayerPalette()

  return (
    <div className={cn(
      'flex items-center justify-between pb-2 border-b border-border-subtle',
      className
    )}>
      <div className="flex items-center gap-2">
        <Layers className={cn(
          'text-accent-primary',
          compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
        )} />
        <span className={cn(
          'font-mono font-medium text-text-primary',
          compact ? 'text-xs' : 'text-sm'
        )}>
          LAYERS
        </span>
      </div>
      {showReset && (
        <button
          className="p-1 hover:bg-surface-2 rounded transition-colors"
          onClick={resetToDefaults}
          title="Reset to defaults"
        >
          <RotateCcw className="w-3.5 h-3.5 text-text-tertiary hover:text-text-primary" />
        </button>
      )}
    </div>
  )
})

// =============================================================================
// COLLAPSIBLE GROUP
// =============================================================================

export interface GroupProps {
  /** Group identifier */
  group: PaletteLayerConfig['group']
  /** Group title */
  title: string
  /** Group icon */
  icon?: typeof Layers
  /** Default open state */
  defaultOpen?: boolean
  /** Children (layer toggles) */
  children: ReactNode
  /** Additional class */
  className?: string
}

const Group: FC<GroupProps> = ({
  group,
  title,
  icon: Icon = Layers,
  defaultOpen = true,
  children,
  className,
}) => {
  const { toggleGroup, isGroupEnabled, compact } = useLayerPalette()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLButtonElement>(null)

  // Animate expand/collapse
  useEffect(() => {
    if (!contentRef.current) return

    if (isOpen) {
      contentRef.current.style.height = '0'
      contentRef.current.style.opacity = '0'
      animate(contentRef.current, {
        height: [0, contentRef.current.scrollHeight],
        opacity: [0, 1],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    } else {
      animate(contentRef.current, {
        height: [contentRef.current.scrollHeight, 0],
        opacity: [1, 0],
        duration: TIMING.fast,
        easing: EASING.anime.in,
      })
    }
  }, [isOpen])

  const groupEnabled = isGroupEnabled(group)

  return (
    <div className={cn('border-b border-border-subtle last:border-b-0', className)}>
      <button
        ref={headerRef}
        className="w-full flex items-center justify-between py-2 group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn(
            'text-text-tertiary group-hover:text-text-secondary transition-colors',
            compact ? 'w-3 h-3' : 'w-3.5 h-3.5'
          )} />
          <span className={cn(
            'text-text-secondary group-hover:text-text-primary transition-colors uppercase tracking-wider',
            compact ? 'text-xs' : 'text-xs'
          )}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Master toggle */}
          <button
            className={cn(
              'p-1 rounded transition-colors',
              groupEnabled
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-2 text-text-tertiary hover:text-text-secondary'
            )}
            onClick={(e) => {
              e.stopPropagation()
              toggleGroup(group)
            }}
            title={groupEnabled ? 'Disable all' : 'Enable all'}
          >
            {groupEnabled ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
          </button>
          <ChevronDown className={cn(
            'w-4 h-4 text-text-tertiary transition-transform',
            isOpen && 'rotate-180'
          )} />
        </div>
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden"
        style={{ height: isOpen ? 'auto' : 0 }}
      >
        <div className="pb-2 space-y-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// LAYER TOGGLE
// =============================================================================

export interface LayerToggleCompoundProps {
  /** Layer ID */
  layer: keyof GeointLayerVisibility
  /** Show opacity slider */
  showOpacity?: boolean
  /** Additional class */
  className?: string
}

const LayerToggle: FC<LayerToggleCompoundProps> = memo(function LayerToggle({
  layer,
  showOpacity = false,
  className,
}) {
  const { visibility, opacities, toggleLayer, setOpacity, compact } = useLayerPalette()
  const config = LAYER_CONFIGS.find((c) => c.id === layer)
  const toggleRef = useRef<HTMLButtonElement>(null)

  if (!config) return null

  const isActive = visibility[layer]
  const Icon = config.icon ?? Eye

  const colorClasses: Record<string, { active: string; inactive: string }> = {
    cyan: {
      active: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      inactive: 'bg-surface-2 text-text-tertiary border-border-subtle hover:bg-surface-3',
    },
    orange: {
      active: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      inactive: 'bg-surface-2 text-text-tertiary border-border-subtle hover:bg-surface-3',
    },
    purple: {
      active: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      inactive: 'bg-surface-2 text-text-tertiary border-border-subtle hover:bg-surface-3',
    },
    green: {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      inactive: 'bg-surface-2 text-text-tertiary border-border-subtle hover:bg-surface-3',
    },
    blue: {
      active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      inactive: 'bg-surface-2 text-text-tertiary border-border-subtle hover:bg-surface-3',
    },
    pink: {
      active: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      inactive: 'bg-surface-2 text-text-tertiary border-border-subtle hover:bg-surface-3',
    },
  }

  const colors = colorClasses[config.color]

  // Toggle animation
  const handleToggle = () => {
    toggleLayer(layer)
    if (toggleRef.current) {
      animate(toggleRef.current, {
        scale: [0.95, 1],
        duration: TIMING.fast,
        easing: EASING.anime.bounce,
      })
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        ref={toggleRef}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded border transition-all flex-1',
          compact ? 'text-xs' : 'text-sm',
          isActive ? colors.active : colors.inactive
        )}
        onClick={handleToggle}
      >
        <Icon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className="flex-1 text-left truncate">{config.label}</span>
        {isActive ? (
          <Eye className="w-3 h-3" />
        ) : (
          <EyeOff className="w-3 h-3 opacity-50" />
        )}
      </button>

      {showOpacity && isActive && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={opacities[layer]}
          onChange={(e) => setOpacity(layer, parseFloat(e.target.value))}
          className="w-16 h-1 bg-surface-3 rounded-full appearance-none cursor-pointer"
          title={`Opacity: ${Math.round(opacities[layer] * 100)}%`}
        />
      )}
    </div>
  )
})

// =============================================================================
// PRESETS
// =============================================================================

export interface PresetsProps {
  /** Additional class */
  className?: string
}

const Presets: FC<PresetsProps> = memo(function Presets({ className }) {
  const { applyPreset, compact } = useLayerPalette()
  const containerRef = useRef<HTMLDivElement>(null)

  // Stagger animation on mount
  useEffect(() => {
    if (containerRef.current) {
      const children = Array.from(containerRef.current.children)
      children.forEach((child, i) => {
        animate(child, {
          opacity: [0, 1],
          translateY: [5, 0],
          delay: i * 50,
          duration: TIMING.normal,
          easing: EASING.anime.out,
        })
      })
    }
  }, [])

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Bookmark className="w-3.5 h-3.5 text-text-tertiary" />
        <span className={cn(
          'text-text-tertiary uppercase tracking-wider',
          compact ? 'text-xs' : 'text-xs'
        )}>
          Presets
        </span>
      </div>
      <div ref={containerRef} className="flex gap-1">
        {DEFAULT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded border border-border-subtle',
              'bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary',
              'transition-colors',
              compact ? 'text-xs' : 'text-sm'
            )}
            onClick={() => applyPreset(preset.id)}
            title={preset.description}
          >
            <preset.icon className="w-3 h-3" />
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
})

// =============================================================================
// QUICK TOGGLES (All on/off)
// =============================================================================

export interface QuickTogglesProps {
  /** Additional class */
  className?: string
}

const QuickToggles: FC<QuickTogglesProps> = memo(function QuickToggles({ className }) {
  const { visibility, toggleLayer } = useLayerPalette()

  const allEnabled = Object.values(visibility).every(Boolean)
  const noneEnabled = Object.values(visibility).every((v) => !v)

  const enableAll = () => {
    Object.keys(visibility).forEach((key) => {
      if (!visibility[key as keyof GeointLayerVisibility]) {
        toggleLayer(key as keyof GeointLayerVisibility)
      }
    })
  }

  const disableAll = () => {
    Object.keys(visibility).forEach((key) => {
      if (visibility[key as keyof GeointLayerVisibility]) {
        toggleLayer(key as keyof GeointLayerVisibility)
      }
    })
  }

  return (
    <div className={cn('flex gap-1', className)}>
      <button
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          allEnabled
            ? 'bg-accent-primary/20 text-accent-primary'
            : 'bg-surface-2 text-text-tertiary hover:text-text-secondary'
        )}
        onClick={enableAll}
        disabled={allEnabled}
      >
        <Eye className="w-3 h-3" />
        <span>All</span>
      </button>
      <button
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          noneEnabled
            ? 'bg-red-500/20 text-red-400'
            : 'bg-surface-2 text-text-tertiary hover:text-text-secondary'
        )}
        onClick={disableAll}
        disabled={noneEnabled}
      >
        <EyeOff className="w-3 h-3" />
        <span>None</span>
      </button>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const LayerPaletteCompound = Object.assign(Root, {
  Root,
  Header,
  Group,
  LayerToggle,
  Presets,
  QuickToggles,
})

// Named exports for direct imports
export {
  Root as LayerPaletteCompoundRoot,
  Header as LayerPaletteHeader,
  Group as LayerPaletteGroup,
  LayerToggle as LayerPaletteLayerToggle,
  Presets as LayerPalettePresets,
  QuickToggles as LayerPaletteQuickToggles,
}

export default LayerPaletteCompound
