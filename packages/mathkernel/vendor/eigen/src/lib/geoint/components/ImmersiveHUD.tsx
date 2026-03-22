/**
 * Immersive HUD Component
 *
 * Full-screen immersive mode with glassmorphism HUD overlays.
 * Features:
 * - Glassmorphism overlay panels
 * - Auto-hide on inactivity
 * - Entity tracking with follow mode
 * - Keyboard shortcuts
 * - anime.js animations
 *
 * @example
 * ```tsx
 * <ImmersiveHUD.Root onEntitySelect={handleSelect}>
 *   <ImmersiveHUD.QuickStats results={results} />
 *   <ImmersiveHUD.Alerts alerts={alerts} />
 *   <ImmersiveHUD.EntityInfo entity={selectedEntity} />
 *   <ImmersiveHUD.Minimap viewport={viewport} />
 *   <ImmersiveHUD.Timeline range={range} playhead={playhead} />
 *   <ImmersiveHUD.Compass heading={heading} />
 *   <ImmersiveHUD.Coordinates position={cursorPosition} />
 * </ImmersiveHUD.Root>
 * ```
 *
 * @module geoint/components/ImmersiveHUD
 */

import {
  FC,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  useMemo,
} from 'react'
import { useMachine } from '@xstate/react'
import { animate } from 'animejs'
import { cn } from '@/lib/utils'
import {
  immersiveHudMachine,
  type HudOverlay,
  type HudPosition,
  type OverlayState,
  type EntityTrackingState,
} from '../machines'
import { TIMING, EASING, SOURCE_COLORS, CLASSIFICATION_COLORS } from '../tokens'
import type { SearchResultItem, IntelSource } from '../schemas'

// =============================================================================
// GLASSMORPHISM TOKENS
// =============================================================================

const GLASS = {
  /** Standard glassmorphism background */
  bg: 'bg-surface-0/60 backdrop-blur-xl',
  /** Darker variant for contrast */
  bgDark: 'bg-surface-0/80 backdrop-blur-xl',
  /** Lighter variant for emphasis */
  bgLight: 'bg-surface-0/40 backdrop-blur-lg',
  /** Border for glass panels */
  border: 'border border-white/10',
  /** Shadow for depth */
  shadow: 'shadow-2xl shadow-black/20',
  /** Glow effect for active states */
  glow: 'ring-1 ring-accent-primary/20',
} as const

const POSITION_CLASSES: Record<HudPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
}

// =============================================================================
// CONTEXT
// =============================================================================

export interface ImmersiveHUDContextValue {
  /** XState actor state */
  state: ReturnType<typeof immersiveHudMachine.getInitialSnapshot>
  /** Send event to machine */
  send: (event: Parameters<ReturnType<typeof useMachine<typeof immersiveHudMachine>>[1]>[0]) => void
  /** Get overlay state */
  getOverlay: (overlay: HudOverlay) => OverlayState
  /** Toggle overlay visibility */
  toggleOverlay: (overlay: HudOverlay) => void
  /** Entity tracking state */
  tracking: EntityTrackingState
  /** Track an entity */
  trackEntity: (entityId: string) => void
  /** Stop tracking */
  stopTracking: () => void
}

const ImmersiveHUDContext = createContext<ImmersiveHUDContextValue | null>(null)

export function useImmersiveHUD() {
  const ctx = useContext(ImmersiveHUDContext)
  if (!ctx) throw new Error('useImmersiveHUD must be used within ImmersiveHUD.Root')
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

export interface ImmersiveHUDRootProps {
  children: ReactNode
  /** Initial preset */
  preset?: 'minimal' | 'standard' | 'detailed'
  /** Auto-hide timeout in ms */
  autoHideTimeout?: number
  /** Called when entity is selected */
  onEntitySelect?: (entityId: string) => void
  /** Called when tracking changes */
  onTrackingChange?: (tracking: EntityTrackingState) => void
  /** Additional class names */
  className?: string
}

const ImmersiveHUDRoot: FC<ImmersiveHUDRootProps> = ({
  children,
  preset = 'standard',
  autoHideTimeout = 5000,
  onEntitySelect,
  onTrackingChange,
  className,
}) => {
  const [state, send] = useMachine(immersiveHudMachine, {
    input: { autoHideTimeout, initialPreset: preset },
  })

  const containerRef = useRef<HTMLDivElement>(null)

  // Emit tracking changes
  useEffect(() => {
    onTrackingChange?.(state.context.tracking)
  }, [state.context.tracking, onTrackingChange])

  // Handle mouse movement for user activity
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      send({ type: 'CURSOR_MOVE', x: e.clientX, y: e.clientY })
    },
    [send]
  )

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Preset shortcuts (Shift + 1/2/3)
      if (e.shiftKey && e.key === '1') {
        e.preventDefault()
        send({ type: 'APPLY_PRESET', preset: 'minimal' })
        return
      }
      if (e.shiftKey && e.key === '2') {
        e.preventDefault()
        send({ type: 'APPLY_PRESET', preset: 'standard' })
        return
      }
      if (e.shiftKey && e.key === '3') {
        e.preventDefault()
        send({ type: 'APPLY_PRESET', preset: 'detailed' })
        return
      }

      // Overlay toggles
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        send({ type: 'HOTKEY_TOGGLE', overlay: 'quickStats' })
        return
      }
      if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        send({ type: 'HOTKEY_TOGGLE', overlay: 'alerts' })
        return
      }
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        send({ type: 'HOTKEY_TOGGLE', overlay: 'entityInfo' })
        return
      }
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        send({ type: 'HOTKEY_TOGGLE', overlay: 'minimap' })
        return
      }
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        send({ type: 'HOTKEY_TOGGLE', overlay: 'timeline' })
        return
      }

      // Visibility controls
      if (e.key === 'h' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        if (state.context.visibility === 'hidden') {
          send({ type: 'SHOW_ALL' })
        } else {
          send({ type: 'HIDE_ALL' })
        }
        return
      }

      // Escape to stop tracking
      if (e.key === 'Escape') {
        e.preventDefault()
        send({ type: 'ESCAPE' })
        return
      }

      // Follow toggle (F)
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        send({ type: 'TOGGLE_FOLLOW' })
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [send, state.context.visibility])

  // Context value
  const contextValue = useMemo<ImmersiveHUDContextValue>(
    () => ({
      state,
      send,
      getOverlay: (overlay) => state.context.overlays[overlay],
      toggleOverlay: (overlay) => send({ type: 'TOGGLE_OVERLAY', overlay }),
      tracking: state.context.tracking,
      trackEntity: (entityId) => {
        send({ type: 'TRACK_ENTITY', entityId })
        onEntitySelect?.(entityId)
      },
      stopTracking: () => send({ type: 'STOP_TRACKING' }),
    }),
    [state, send, onEntitySelect]
  )

  return (
    <ImmersiveHUDContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn('relative w-full h-full overflow-hidden', className)}
        onMouseMove={handleMouseMove}
        onClick={() => send({ type: 'USER_ACTIVITY' })}
      >
        {children}
      </div>
    </ImmersiveHUDContext.Provider>
  )
}

// =============================================================================
// GLASS PANEL WRAPPER
// =============================================================================

interface GlassPanelProps {
  overlay: HudOverlay
  children: ReactNode
  className?: string
  /** Override position from machine */
  position?: HudPosition
}

const GlassPanel: FC<GlassPanelProps> = ({ overlay, children, className, position: overridePosition }) => {
  const { getOverlay, state } = useImmersiveHUD()
  const overlayState = getOverlay(overlay)
  const panelRef = useRef<HTMLDivElement>(null)

  const position = overridePosition ?? overlayState.position
  const isVisible = overlayState.visible && state.context.visibility !== 'hidden'

  // Animate visibility changes
  useEffect(() => {
    if (!panelRef.current) return

    if (isVisible) {
      animate(panelRef.current, {
        opacity: [0, overlayState.opacity],
        scale: [0.95, 1],
        translateY: [10, 0],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    } else {
      animate(panelRef.current, {
        opacity: 0,
        scale: 0.95,
        duration: TIMING.fast,
        easing: EASING.anime.in,
      })
    }
  }, [isVisible, overlayState.opacity])

  // Animate opacity changes (dim mode)
  useEffect(() => {
    if (!panelRef.current || !isVisible) return

    animate(panelRef.current, {
      opacity: overlayState.opacity,
      duration: TIMING.normal,
      easing: EASING.anime.inOut,
    })
  }, [overlayState.opacity, isVisible])

  if (!overlayState.visible) return null

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed z-50',
        POSITION_CLASSES[position],
        GLASS.bg,
        GLASS.border,
        GLASS.shadow,
        'rounded-xl',
        'transition-transform',
        className
      )}
      style={{ opacity: 0 }}
    >
      {children}
    </div>
  )
}

// =============================================================================
// QUICK STATS OVERLAY
// =============================================================================

export interface QuickStatsProps {
  /** Total result count */
  totalCount: number
  /** Live/streaming count */
  liveCount: number
  /** Hostile count */
  hostileCount?: number
  /** Source breakdown */
  sourceBreakdown?: Record<IntelSource, number>
  className?: string
}

const QuickStats: FC<QuickStatsProps> = ({
  totalCount,
  liveCount,
  hostileCount = 0,
  sourceBreakdown,
  className,
}) => {
  const { getOverlay, toggleOverlay } = useImmersiveHUD()
  const overlayState = getOverlay('quickStats')

  return (
    <GlassPanel overlay="quickStats" className={cn('p-3 min-w-[140px]', className)}>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Stats</span>
          <button
            onClick={() => toggleOverlay('quickStats')}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="space-y-1">
          <StatRow
            icon="◉"
            label="Tracks"
            value={totalCount}
            color="text-text-primary"
          />
          <StatRow
            icon="○"
            label="Live"
            value={liveCount}
            color="text-green-400"
            pulse={liveCount > 0}
          />
          {hostileCount > 0 && (
            <StatRow
              icon="⬡"
              label="Hostile"
              value={hostileCount}
              color="text-red-400"
            />
          )}
        </div>

        {/* Expanded source breakdown */}
        {overlayState.expanded && sourceBreakdown && (
          <div className="pt-2 border-t border-white/10 space-y-1">
            {Object.entries(sourceBreakdown).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    'capitalize',
                    SOURCE_COLORS[source as IntelSource]?.tailwind.primary ?? 'text-text-secondary'
                  )}
                >
                  {source}
                </span>
                <span className="text-text-primary font-mono">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  )
}

interface StatRowProps {
  icon: string
  label: string
  value: number
  color?: string
  pulse?: boolean
}

const StatRow: FC<StatRowProps> = ({ icon, label, value, color = 'text-text-primary', pulse }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-1.5">
      <span className={cn('text-xs', color, pulse && 'animate-pulse')}>{icon}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
    <span className={cn('text-sm font-mono font-medium', color)}>{value}</span>
  </div>
)

// =============================================================================
// ALERTS OVERLAY
// =============================================================================

export interface AlertItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  timestamp: Date
  entityId?: string
}

export interface AlertsOverlayProps {
  alerts: AlertItem[]
  maxVisible?: number
  onAlertClick?: (alert: AlertItem) => void
  className?: string
}

const AlertsOverlay: FC<AlertsOverlayProps> = ({
  alerts,
  maxVisible = 3,
  onAlertClick,
  className,
}) => {
  const { toggleOverlay, trackEntity } = useImmersiveHUD()
  const visibleAlerts = alerts.slice(0, maxVisible)

  const handleAlertClick = (alert: AlertItem) => {
    if (alert.entityId) {
      trackEntity(alert.entityId)
    }
    onAlertClick?.(alert)
  }

  const severityColors = {
    critical: 'border-l-red-500 bg-red-500/10',
    warning: 'border-l-yellow-500 bg-yellow-500/10',
    info: 'border-l-blue-500 bg-blue-500/10',
  }

  const severityIcons = {
    critical: '🔴',
    warning: '⚠',
    info: 'ℹ',
  }

  return (
    <GlassPanel overlay="alerts" className={cn('p-3 min-w-[200px] max-w-[280px]', className)}>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Alerts</span>
            {alerts.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">
                {alerts.length}
              </span>
            )}
          </div>
          <button
            onClick={() => toggleOverlay('alerts')}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Alert List */}
        {visibleAlerts.length > 0 ? (
          <div className="space-y-1.5">
            {visibleAlerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className={cn(
                  'w-full text-left p-2 rounded-lg border-l-2 transition-colors',
                  'hover:bg-white/5',
                  severityColors[alert.severity]
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs">{severityIcons[alert.severity]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary truncate">{alert.message}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {formatTimeAgo(alert.timestamp)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {alerts.length > maxVisible && (
              <p className="text-xs text-text-tertiary text-center pt-1">
                +{alerts.length - maxVisible} more
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary text-center py-2">No alerts</p>
        )}
      </div>
    </GlassPanel>
  )
}

// =============================================================================
// ENTITY INFO OVERLAY
// =============================================================================

export interface EntityInfoOverlayProps {
  entity: SearchResultItem | null
  onClose?: () => void
  onFollow?: () => void
  isFollowing?: boolean
  className?: string
}

const EntityInfoOverlay: FC<EntityInfoOverlayProps> = ({
  entity,
  onClose,
  onFollow,
  // isFollowing prop available but we use tracking.following from context
  className,
}) => {
  const { stopTracking, send, tracking } = useImmersiveHUD()

  if (!entity) return null

  const handleClose = () => {
    stopTracking()
    onClose?.()
  }

  const handleFollow = () => {
    send({ type: 'TOGGLE_FOLLOW' })
    onFollow?.()
  }

  // Get entity-specific data
  const classification = 'classification' in entity ? (entity as any).classification : 'unknown'
  const classColors = CLASSIFICATION_COLORS[classification as keyof typeof CLASSIFICATION_COLORS]

  return (
    <GlassPanel
      overlay="entityInfo"
      position="top-right"
      className={cn('p-3 min-w-[220px] max-w-[280px]', className)}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn('w-2 h-2 rounded-full', classColors?.tailwind.bg ?? 'bg-gray-500')}
            />
            <span className="text-sm font-medium text-text-primary truncate max-w-[160px]">
              {entity.id}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Entity Details */}
        <div className="space-y-2">
          <DetailRow label="Type" value={entity._tag} />
          <DetailRow label="Source" value={'source' in entity ? String((entity as any).source) : 'unknown'} />
          {'speed' in entity && <DetailRow label="Speed" value={`${(entity as any).speed} kts`} />}
          {'heading' in entity && <DetailRow label="Heading" value={`${(entity as any).heading}°`} />}
          {'altitude' in entity && <DetailRow label="Altitude" value={`FL${Math.round((entity as any).altitude / 100)}`} />}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-white/10">
          <button
            onClick={handleFollow}
            className={cn(
              'flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors',
              tracking.following
                ? 'bg-accent-primary text-white'
                : 'bg-white/10 text-text-secondary hover:bg-white/20'
            )}
          >
            {tracking.following ? '◉ Following' : '○ Follow'}
          </button>
          <button className="px-2 py-1.5 text-xs font-medium bg-white/10 text-text-secondary hover:bg-white/20 rounded-lg transition-colors">
            Details →
          </button>
        </div>
      </div>
    </GlassPanel>
  )
}

interface DetailRowProps {
  label: string
  value: string
}

const DetailRow: FC<DetailRowProps> = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-text-tertiary">{label}</span>
    <span className="text-text-primary font-mono">{value}</span>
  </div>
)

// =============================================================================
// MINIMAP OVERLAY
// =============================================================================

export interface MinimapOverlayProps {
  /** Viewport bounds [west, south, east, north] */
  viewport?: [number, number, number, number]
  /** Full map bounds */
  mapBounds?: [number, number, number, number]
  /** Entity positions */
  entities?: Array<{ id: string; lng: number; lat: number; color?: string }>
  className?: string
}

const MinimapOverlay: FC<MinimapOverlayProps> = ({
  viewport,
  mapBounds,
  entities = [],
  className,
}) => {
  return (
    <GlassPanel overlay="minimap" className={cn('p-2', className)}>
      <div className="w-[100px] h-[80px] bg-surface-1/50 rounded-lg relative overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 opacity-30">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border border-white/10" />
          ))}
        </div>

        {/* Viewport indicator */}
        {viewport && mapBounds && (
          <div
            className="absolute border-2 border-accent-primary/50 bg-accent-primary/10"
            style={calculateViewportStyle(viewport, mapBounds)}
          />
        )}

        {/* Entity dots */}
        {entities.slice(0, 50).map((entity) => (
          <div
            key={entity.id}
            className="absolute w-1 h-1 rounded-full"
            style={{
              backgroundColor: entity.color ?? '#22c55e',
              left: `${Math.random() * 90 + 5}%`,
              top: `${Math.random() * 90 + 5}%`,
            }}
          />
        ))}
      </div>
    </GlassPanel>
  )
}

// =============================================================================
// TIMELINE OVERLAY
// =============================================================================

export interface TimelineOverlayProps {
  /** Current playhead position (0-1) */
  playhead: number
  /** Is playing */
  isPlaying?: boolean
  /** Timeline range label */
  rangeLabel?: string
  /** Playback speed */
  speed?: number
  /** Callbacks */
  onPlay?: () => void
  onPause?: () => void
  onSeek?: (position: number) => void
  className?: string
}

const TimelineOverlay: FC<TimelineOverlayProps> = ({
  playhead,
  isPlaying = false,
  rangeLabel = '24h',
  speed = 1,
  onPlay,
  onPause,
  onSeek,
  className,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    onSeek?.(Math.max(0, Math.min(1, position)))
  }

  return (
    <GlassPanel
      overlay="timeline"
      position="bottom-right"
      className={cn('p-3 min-w-[300px]', className)}
    >
      <div className="space-y-2">
        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Track */}
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer relative"
          >
            <div
              className="absolute left-0 top-0 h-full bg-accent-primary/50 rounded-full"
              style={{ width: `${playhead * 100}%` }}
            />
            <div
              className="absolute top-1/2 w-3 h-3 bg-accent-primary rounded-full -translate-y-1/2 shadow-lg"
              style={{ left: `calc(${playhead * 100}% - 6px)` }}
            />
          </div>

          {/* Range */}
          <span className="text-xs text-text-tertiary font-mono w-10 text-right">{rangeLabel}</span>
        </div>

        {/* Speed indicator */}
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>{isPlaying ? 'Playing' : 'Paused'}</span>
          <span>{speed}x</span>
        </div>
      </div>
    </GlassPanel>
  )
}

// =============================================================================
// COMPASS OVERLAY
// =============================================================================

export interface CompassOverlayProps {
  /** Heading in degrees (0-360) */
  heading: number
  className?: string
}

const CompassOverlay: FC<CompassOverlayProps> = ({ heading, className }) => {
  return (
    <GlassPanel overlay="compass" className={cn('p-2', className)}>
      <div className="w-12 h-12 relative">
        {/* Compass ring */}
        <div className="absolute inset-0 border-2 border-white/20 rounded-full" />

        {/* Cardinal points */}
        <div
          className="absolute inset-0 transition-transform duration-300"
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-xs font-bold text-red-400">
            N
          </span>
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-xs text-text-tertiary">
            S
          </span>
          <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
            W
          </span>
          <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
            E
          </span>
        </div>

        {/* Center arrow (fixed) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-l-transparent border-r-transparent border-b-accent-primary" />
        </div>
      </div>
    </GlassPanel>
  )
}

// =============================================================================
// COORDINATES OVERLAY
// =============================================================================

export interface CoordinatesOverlayProps {
  /** Longitude */
  lng: number
  /** Latitude */
  lat: number
  /** Zoom level */
  zoom?: number
  /** Coordinate format */
  format?: 'decimal' | 'dms'
  className?: string
}

const CoordinatesOverlay: FC<CoordinatesOverlayProps> = ({
  lng,
  lat,
  zoom,
  format = 'decimal',
  className,
}) => {
  const formatCoord = (value: number, isLat: boolean): string => {
    if (format === 'dms') {
      const direction = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')
      const abs = Math.abs(value)
      const deg = Math.floor(abs)
      const min = Math.floor((abs - deg) * 60)
      const sec = ((abs - deg - min / 60) * 3600).toFixed(1)
      return `${deg}°${min}'${sec}"${direction}`
    }
    return value.toFixed(6)
  }

  return (
    <GlassPanel overlay="coordinates" className={cn('px-3 py-2', className)}>
      <div className="flex items-center gap-3 text-xs font-mono">
        <span className="text-text-primary">{formatCoord(lat, true)}</span>
        <span className="text-text-tertiary">/</span>
        <span className="text-text-primary">{formatCoord(lng, false)}</span>
        {zoom !== undefined && (
          <>
            <span className="text-text-tertiary">@</span>
            <span className="text-text-secondary">z{zoom.toFixed(1)}</span>
          </>
        )}
      </div>
    </GlassPanel>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function calculateViewportStyle(
  viewport: [number, number, number, number],
  mapBounds: [number, number, number, number]
): React.CSSProperties {
  const [vWest, vSouth, vEast, vNorth] = viewport
  const [mWest, mSouth, mEast, mNorth] = mapBounds

  const mapWidth = mEast - mWest
  const mapHeight = mNorth - mSouth

  const left = ((vWest - mWest) / mapWidth) * 100
  const top = ((mNorth - vNorth) / mapHeight) * 100
  const width = ((vEast - vWest) / mapWidth) * 100
  const height = ((vNorth - vSouth) / mapHeight) * 100

  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  }
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const ImmersiveHUD = Object.assign(ImmersiveHUDRoot, {
  Root: ImmersiveHUDRoot,
  QuickStats,
  Alerts: AlertsOverlay,
  EntityInfo: EntityInfoOverlay,
  Minimap: MinimapOverlay,
  Timeline: TimelineOverlay,
  Compass: CompassOverlay,
  Coordinates: CoordinatesOverlay,
  GlassPanel,
})

// Named exports for individual imports
// Note: useImmersiveHUD is exported via function declaration above
// Types are exported via their interface declarations
