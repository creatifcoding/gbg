/**
 * Split Compare View Component
 *
 * Side-by-side temporal comparison of map states.
 * Features:
 * - Side-by-side comparison
 * - Swipe slider comparison
 * - Overlay blending
 * - Flicker animation
 * - Difference highlighting
 *
 * @example
 * ```tsx
 * <SplitCompareView.Root
 *   leftTime={hourAgo}
 *   rightTime={now}
 *   onTimeChange={handleTimeChange}
 * >
 *   <SplitCompareView.LeftPane>
 *     <GeointMap />
 *   </SplitCompareView.LeftPane>
 *   <SplitCompareView.RightPane>
 *     <GeointMap />
 *   </SplitCompareView.RightPane>
 *   <SplitCompareView.Controls />
 *   <SplitCompareView.Timeline />
 * </SplitCompareView.Root>
 * ```
 *
 * @module geoint/components/SplitCompareView
 */

import {
  FC,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react'
import { useMachine } from '@xstate/react'
import { cn } from '@/lib/utils'
import {
  splitCompareMachine,
  COMPARE_MODES,
  FLICKER_SPEEDS,
  type CompareMode,
  type PaneId,
  type TimePoint,
  type DifferenceHighlight,
} from '../machines'

// =============================================================================
// CONTEXT
// =============================================================================

interface SplitCompareContextValue {
  /** XState actor state */
  state: ReturnType<typeof splitCompareMachine.getInitialSnapshot>
  /** Send event to machine */
  send: (event: Parameters<ReturnType<typeof useMachine<typeof splitCompareMachine>>[1]>[0]) => void
  /** Current compare mode */
  mode: CompareMode
  /** Left pane time point */
  leftTime: TimePoint
  /** Right pane time point */
  rightTime: TimePoint
  /** Swipe position (0-1) */
  swipePosition: number
  /** Overlay opacity */
  overlayOpacity: number
  /** Active pane */
  activePane: PaneId
  /** Show differences */
  showDifferences: boolean
  /** Highlighted differences */
  differences: DifferenceHighlight[]
  /** Is flickering */
  isFlickering: boolean
  /** Flicker pane currently visible */
  flickerPane: PaneId
}

const SplitCompareContext = createContext<SplitCompareContextValue | null>(null)

export function useSplitCompare() {
  const ctx = useContext(SplitCompareContext)
  if (!ctx) throw new Error('useSplitCompare must be used within SplitCompareView.Root')
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

export interface SplitCompareRootProps {
  children: ReactNode
  /** Initial compare mode */
  mode?: CompareMode
  /** Left time point */
  leftTime?: TimePoint
  /** Right time point */
  rightTime?: TimePoint
  /** Called when time changes */
  onTimeChange?: (pane: PaneId, time: TimePoint) => void
  /** Called when mode changes */
  onModeChange?: (mode: CompareMode) => void
  /** Available time points */
  availableTimePoints?: TimePoint[]
  /** Additional class names */
  className?: string
}

const SplitCompareRoot: FC<SplitCompareRootProps> = ({
  children,
  mode = 'side-by-side',
  leftTime,
  rightTime,
  onTimeChange,
  onModeChange,
  availableTimePoints = [],
  className,
}) => {
  const [state, send] = useMachine(splitCompareMachine, {
    input: {
      initialMode: mode,
      initialLeftTime: leftTime,
      initialRightTime: rightTime,
    },
  })

  // Sync available time points
  useEffect(() => {
    send({ type: 'SET_AVAILABLE_TIME_POINTS', timePoints: availableTimePoints })
  }, [availableTimePoints, send])

  // Emit callbacks
  useEffect(() => {
    onTimeChange?.('left', state.context.leftPane.timePoint)
  }, [state.context.leftPane.timePoint, onTimeChange])

  useEffect(() => {
    onTimeChange?.('right', state.context.rightPane.timePoint)
  }, [state.context.rightPane.timePoint, onTimeChange])

  useEffect(() => {
    onModeChange?.(state.context.mode)
  }, [state.context.mode, onModeChange])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case '1':
          e.preventDefault()
          send({ type: 'SET_MODE', mode: 'side-by-side' })
          break
        case '2':
          e.preventDefault()
          send({ type: 'SET_MODE', mode: 'swipe' })
          break
        case '3':
          e.preventDefault()
          send({ type: 'SET_MODE', mode: 'overlay' })
          break
        case '4':
          e.preventDefault()
          send({ type: 'SET_MODE', mode: 'flicker' })
          break
        case 's':
          e.preventDefault()
          send({ type: 'SWAP_TIME_POINTS' })
          break
        case 'd':
          e.preventDefault()
          send({ type: 'TOGGLE_DIFFERENCES' })
          break
        case 'l':
          e.preventDefault()
          if (state.context.syncMode === 'locked') {
            send({ type: 'SET_SYNC_MODE', mode: 'unlocked' })
          } else {
            send({ type: 'SET_SYNC_MODE', mode: 'locked' })
          }
          break
        case ' ':
          e.preventDefault()
          if (state.context.mode === 'flicker') {
            if (state.matches('flickering')) {
              send({ type: 'STOP_FLICKER' })
            } else {
              send({ type: 'START_FLICKER' })
            }
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (state.context.mode === 'swipe') {
            send({ type: 'SWIPE_LEFT' })
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (state.context.mode === 'swipe') {
            send({ type: 'SWIPE_RIGHT' })
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [send, state])

  // Context value
  const contextValue = useMemo<SplitCompareContextValue>(
    () => ({
      state,
      send,
      mode: state.context.mode,
      leftTime: state.context.leftPane.timePoint,
      rightTime: state.context.rightPane.timePoint,
      swipePosition: state.context.swipePosition,
      overlayOpacity: state.context.overlayOpacity,
      activePane: state.context.activePane,
      showDifferences: state.context.showDifferences,
      differences: state.context.differences,
      isFlickering: state.matches('flickering'),
      flickerPane: state.context.flickerPane,
    }),
    [state, send]
  )

  return (
    <SplitCompareContext.Provider value={contextValue}>
      <div
        className={cn(
          'relative w-full h-full bg-surface-0 rounded-xl border border-border-subtle overflow-hidden',
          className
        )}
      >
        {children}
      </div>
    </SplitCompareContext.Provider>
  )
}

// =============================================================================
// PANE CONTAINER
// =============================================================================

export interface PaneContainerProps {
  children: ReactNode
  className?: string
}

const PaneContainer: FC<PaneContainerProps> = ({ children, className }) => {
  const { mode } = useSplitCompare()

  // Calculate layout based on mode
  const containerClasses = useMemo(() => {
    switch (mode) {
      case 'side-by-side':
        return 'grid grid-cols-2 gap-1'
      case 'swipe':
      case 'overlay':
      case 'flicker':
        return 'relative'
      default:
        return 'grid grid-cols-2 gap-1'
    }
  }, [mode])

  return (
    <div className={cn('flex-1 overflow-hidden', containerClasses, className)}>
      {children}
    </div>
  )
}

// =============================================================================
// LEFT PANE
// =============================================================================

export interface LeftPaneProps {
  children: ReactNode
  className?: string
}

const LeftPane: FC<LeftPaneProps> = ({ children, className }) => {
  const { mode, swipePosition, overlayOpacity, flickerPane, send } = useSplitCompare()
  const paneRef = useRef<HTMLDivElement>(null)

  // Calculate styles based on mode
  const paneStyles = useMemo<React.CSSProperties>(() => {
    switch (mode) {
      case 'side-by-side':
        return {}
      case 'swipe':
        return {
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 ${(1 - swipePosition) * 100}% 0 0)`,
        }
      case 'overlay':
        return {
          position: 'absolute',
          inset: 0,
          opacity: 1 - overlayOpacity,
        }
      case 'flicker':
        return {
          position: 'absolute',
          inset: 0,
          opacity: flickerPane === 'left' ? 1 : 0,
          transition: 'opacity 50ms ease-out',
        }
      default:
        return {}
    }
  }, [mode, swipePosition, overlayOpacity, flickerPane])

  const handleMouseEnter = useCallback(() => {
    send({ type: 'SET_ACTIVE_PANE', pane: 'left' })
  }, [send])

  return (
    <div
      ref={paneRef}
      className={cn(
        'relative bg-surface-1 overflow-hidden',
        mode === 'side-by-side' && 'border-r border-border-subtle',
        className
      )}
      style={paneStyles}
      onMouseEnter={handleMouseEnter}
    >
      {children}
      {/* Time badge */}
      <TimeBadge pane="left" />
    </div>
  )
}

// =============================================================================
// RIGHT PANE
// =============================================================================

export interface RightPaneProps {
  children: ReactNode
  className?: string
}

const RightPane: FC<RightPaneProps> = ({ children, className }) => {
  const { mode, overlayOpacity, flickerPane, send } = useSplitCompare()
  const paneRef = useRef<HTMLDivElement>(null)

  // Calculate styles based on mode
  const paneStyles = useMemo<React.CSSProperties>(() => {
    switch (mode) {
      case 'side-by-side':
        return {}
      case 'swipe':
        return {
          position: 'absolute',
          inset: 0,
        }
      case 'overlay':
        return {
          position: 'absolute',
          inset: 0,
          opacity: overlayOpacity,
        }
      case 'flicker':
        return {
          position: 'absolute',
          inset: 0,
          opacity: flickerPane === 'right' ? 1 : 0,
          transition: 'opacity 50ms ease-out',
        }
      default:
        return {}
    }
  }, [mode, overlayOpacity, flickerPane])

  const handleMouseEnter = useCallback(() => {
    send({ type: 'SET_ACTIVE_PANE', pane: 'right' })
  }, [send])

  return (
    <div
      ref={paneRef}
      className={cn(
        'relative bg-surface-1 overflow-hidden',
        className
      )}
      style={paneStyles}
      onMouseEnter={handleMouseEnter}
    >
      {children}
      {/* Time badge */}
      <TimeBadge pane="right" />
    </div>
  )
}

// =============================================================================
// TIME BADGE
// =============================================================================

interface TimeBadgeProps {
  pane: PaneId
}

const TimeBadge: FC<TimeBadgeProps> = ({ pane }) => {
  const { leftTime, rightTime, activePane } = useSplitCompare()
  const time = pane === 'left' ? leftTime : rightTime
  const isActive = activePane === pane

  return (
    <div
      className={cn(
        'absolute top-4 px-3 py-1.5 bg-surface-2/90 backdrop-blur-sm rounded-lg border transition-all duration-200',
        pane === 'left' ? 'left-4' : 'right-4',
        isActive ? 'border-accent-primary' : 'border-border-subtle'
      )}
    >
      <p className="text-xs text-text-tertiary uppercase tracking-wider">
        {pane === 'left' ? 'Before' : 'After'}
      </p>
      <p className="text-sm font-medium text-text-primary">
        {time.label ?? formatTimeLabel(time.timestamp)}
      </p>
    </div>
  )
}

// =============================================================================
// SWIPE HANDLE
// =============================================================================

export interface SwipeHandleProps {
  className?: string
}

const SwipeHandle: FC<SwipeHandleProps> = ({ className }) => {
  const { mode, swipePosition, send } = useSplitCompare()
  const handleRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (mode !== 'swipe') return null

  const handleDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const container = containerRef.current?.parentElement
      if (!container) return

      const rect = container.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const position = (clientX - rect.left) / rect.width
      send({ type: 'SET_SWIPE_POSITION', position })
    },
    [send]
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute inset-0 z-20 pointer-events-none',
        className
      )}
    >
      <div
        ref={handleRef}
        className="absolute top-0 bottom-0 w-1 bg-accent-primary cursor-ew-resize pointer-events-auto group"
        style={{ left: `${swipePosition * 100}%`, transform: 'translateX(-50%)' }}
        onMouseDown={(e) => {
          e.preventDefault()
          const handleMove = (e: MouseEvent) => handleDrag(e as unknown as React.MouseEvent)
          const handleUp = () => {
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleUp)
          }
          window.addEventListener('mousemove', handleMove)
          window.addEventListener('mouseup', handleUp)
        }}
        onTouchStart={(e) => {
          const handleMove = (e: TouchEvent) => handleDrag(e as unknown as React.TouchEvent)
          const handleUp = () => {
            window.removeEventListener('touchmove', handleMove)
            window.removeEventListener('touchend', handleUp)
          }
          window.addEventListener('touchmove', handleMove)
          window.addEventListener('touchend', handleUp)
        }}
      >
        {/* Handle grip */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-12 bg-surface-2 border border-border-subtle rounded-lg flex items-center justify-center shadow-lg group-hover:bg-surface-3 transition-colors">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-4 bg-text-tertiary rounded" />
            <div className="w-0.5 h-4 bg-text-tertiary rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// CONTROLS
// =============================================================================

export interface ControlsProps {
  className?: string
}

const Controls: FC<ControlsProps> = ({ className }) => {
  const { mode, send, state, isFlickering } = useSplitCompare()

  return (
    <div
      className={cn(
        'absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle p-2',
        className
      )}
    >
      {/* Mode selector */}
      <div className="flex gap-1">
        {COMPARE_MODES.map((m) => (
          <button
            key={m}
            onClick={() => send({ type: 'SET_MODE', mode: m })}
            className={cn(
              'px-3 py-1.5 text-xs rounded transition-colors capitalize',
              mode === m
                ? 'bg-accent-primary text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
            )}
          >
            {m.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border-subtle" />

      {/* Swap button */}
      <button
        onClick={() => send({ type: 'SWAP_TIME_POINTS' })}
        className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
        title="Swap time points (S)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </button>

      {/* Sync toggle */}
      <button
        onClick={() =>
          send({
            type: 'SET_SYNC_MODE',
            mode: state.context.syncMode === 'locked' ? 'unlocked' : 'locked',
          })
        }
        className={cn(
          'p-1.5 rounded transition-colors',
          state.context.syncMode === 'locked'
            ? 'bg-accent-primary text-white'
            : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
        )}
        title="Sync viewports (L)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {state.context.syncMode === 'locked' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          )}
        </svg>
      </button>

      {/* Differences toggle */}
      <button
        onClick={() => send({ type: 'TOGGLE_DIFFERENCES' })}
        className={cn(
          'p-1.5 rounded transition-colors',
          state.context.showDifferences
            ? 'bg-accent-primary text-white'
            : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
        )}
        title="Show differences (D)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>

      {/* Flicker controls (only in flicker mode) */}
      {mode === 'flicker' && (
        <>
          <div className="w-px h-6 bg-border-subtle" />
          <button
            onClick={() => {
              if (isFlickering) {
                send({ type: 'STOP_FLICKER' })
              } else {
                send({ type: 'START_FLICKER' })
              }
            }}
            className={cn(
              'px-3 py-1.5 text-xs rounded transition-colors',
              isFlickering
                ? 'bg-red-500 text-white'
                : 'bg-accent-primary text-white'
            )}
          >
            {isFlickering ? 'Stop' : 'Start'} Flicker
          </button>

          <select
            value={state.context.flickerSpeed}
            onChange={(e) => send({ type: 'SET_FLICKER_SPEED', speed: Number(e.target.value) })}
            className="px-2 py-1 text-xs bg-surface-1 border border-border-subtle rounded text-text-primary"
          >
            {FLICKER_SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}ms
              </option>
            ))}
          </select>
        </>
      )}

      {/* Overlay opacity slider (only in overlay mode) */}
      {mode === 'overlay' && (
        <>
          <div className="w-px h-6 bg-border-subtle" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.context.overlayOpacity}
            onChange={(e) =>
              send({ type: 'SET_OVERLAY_OPACITY', opacity: Number(e.target.value) })
            }
            className="w-24"
          />
          <span className="text-xs text-text-tertiary">
            {Math.round(state.context.overlayOpacity * 100)}%
          </span>
        </>
      )}
    </div>
  )
}

// =============================================================================
// TIMELINE SELECTOR
// =============================================================================

export interface TimelineSelectorProps {
  className?: string
}

const TimelineSelector: FC<TimelineSelectorProps> = ({ className }) => {
  const { leftTime, rightTime, send, state } = useSplitCompare()
  const { availableTimePoints } = state.context

  return (
    <div
      className={cn(
        'absolute bottom-4 left-4 right-4 z-30 bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle p-3',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {/* Left time selector */}
        <div className="flex-1">
          <label className="text-xs text-text-tertiary mb-1 block">Before</label>
          <select
            value={leftTime.timestamp.toISOString()}
            onChange={(e) => {
              const tp = availableTimePoints.find(
                (t) => t.timestamp.toISOString() === e.target.value
              )
              if (tp) send({ type: 'SET_LEFT_TIME', timePoint: tp })
            }}
            className="w-full px-3 py-2 text-sm bg-surface-2 border border-border-subtle rounded text-text-primary"
          >
            {availableTimePoints.map((tp, i) => (
              <option key={i} value={tp.timestamp.toISOString()}>
                {tp.label ?? formatTimeLabel(tp.timestamp)}
              </option>
            ))}
          </select>
        </div>

        {/* Arrow */}
        <div className="text-text-tertiary">→</div>

        {/* Right time selector */}
        <div className="flex-1">
          <label className="text-xs text-text-tertiary mb-1 block">After</label>
          <select
            value={rightTime.timestamp.toISOString()}
            onChange={(e) => {
              const tp = availableTimePoints.find(
                (t) => t.timestamp.toISOString() === e.target.value
              )
              if (tp) send({ type: 'SET_RIGHT_TIME', timePoint: tp })
            }}
            className="w-full px-3 py-2 text-sm bg-surface-2 border border-border-subtle rounded text-text-primary"
          >
            {availableTimePoints.map((tp, i) => (
              <option key={i} value={tp.timestamp.toISOString()}>
                {tp.label ?? formatTimeLabel(tp.timestamp)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// DIFFERENCE OVERLAY
// =============================================================================

export interface DifferenceOverlayProps {
  className?: string
}

const DifferenceOverlay: FC<DifferenceOverlayProps> = ({ className }) => {
  const { showDifferences, differences } = useSplitCompare()

  if (!showDifferences || differences.length === 0) return null

  return (
    <div
      className={cn(
        'absolute bottom-20 right-4 z-30 bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle p-3 min-w-[200px]',
        className
      )}
    >
      <h4 className="text-sm font-medium text-text-primary mb-2">
        {differences.length} Changes Detected
      </h4>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {differences.slice(0, 10).map((diff) => (
          <div
            key={diff.entityId}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                diff.changeType === 'added' && 'bg-green-500',
                diff.changeType === 'removed' && 'bg-red-500',
                diff.changeType === 'moved' && 'bg-blue-500',
                diff.changeType === 'modified' && 'bg-yellow-500'
              )}
            />
            <span className="text-text-secondary capitalize">{diff.changeType}</span>
            <span className="text-text-tertiary truncate">{diff.entityId}</span>
          </div>
        ))}
        {differences.length > 10 && (
          <p className="text-xs text-text-tertiary">
            +{differences.length - 10} more
          </p>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-border-subtle flex gap-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full" /> Added
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full" /> Removed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full" /> Moved
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTimeLabel(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) return 'Just now'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const SplitCompareView = Object.assign(SplitCompareRoot, {
  Root: SplitCompareRoot,
  PaneContainer,
  LeftPane,
  RightPane,
  SwipeHandle,
  Controls,
  TimelineSelector,
  DifferenceOverlay,
})

// Note: useSplitCompare is already exported via function declaration above
