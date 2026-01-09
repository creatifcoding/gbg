/**
 * Swimlane Timeline Component
 *
 * Temporal visualization with entity swimlanes showing events over time.
 * Features:
 * - Virtualized lane rendering
 * - Playback controls
 * - Zoom and pan
 * - Event markers with tooltips
 * - Lane collapse/expand
 *
 * @example
 * ```tsx
 * <SwimlaneTimeline.Root
 *   lanes={lanes}
 *   events={events}
 *   onEventSelect={handleEventSelect}
 * >
 *   <SwimlaneTimeline.Header />
 *   <SwimlaneTimeline.LaneList />
 *   <SwimlaneTimeline.PlaybackControls />
 * </SwimlaneTimeline.Root>
 * ```
 *
 * @module geoint/components/SwimlaneTimeline
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
  useState,
} from 'react'
import { useMachine } from '@xstate/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { animate } from 'animejs'
import { cn } from '@/lib/utils'
import {
  swimlaneMachine,
  ZOOM_LEVELS,
  PLAYBACK_SPEEDS,
  type SwimlaneLane,
  type SwimlaneEvent,
  type ZoomLevel,
  type PlaybackState,
} from '../machines'
import { TIMING, EASING } from '../tokens'

// =============================================================================
// CONSTANTS
// =============================================================================

const LANE_HEIGHT = 48
const LANE_HEIGHT_COLLAPSED = 24
const TIME_AXIS_HEIGHT = 40
const LANE_LABEL_WIDTH = 180
const EVENT_DOT_SIZE = 10

const EVENT_COLORS = {
  start: '#22c55e',
  end: '#ef4444',
  waypoint: '#3b82f6',
  anomaly: '#f59e0b',
  update: '#8b5cf6',
} as const

// =============================================================================
// CONTEXT
// =============================================================================

interface SwimlaneTimelineContextValue {
  /** XState actor state */
  state: ReturnType<typeof swimlaneMachine.getInitialSnapshot>
  /** Send event to machine */
  send: (event: Parameters<ReturnType<typeof useMachine<typeof swimlaneMachine>>[1]>[0]) => void
  /** Lanes */
  lanes: SwimlaneLane[]
  /** Events */
  events: SwimlaneEvent[]
  /** Time range */
  timeRange: { start: Date; end: Date }
  /** Playhead position */
  playhead: Date
  /** Playback state */
  playbackState: PlaybackState
  /** Zoom level */
  zoomLevel: ZoomLevel
  /** Convert timestamp to X position (0-1) */
  timestampToPosition: (timestamp: Date) => number
  /** Convert X position (0-1) to timestamp */
  positionToTimestamp: (position: number) => Date
  /** Selected lane ID */
  selectedLaneId: string | null
  /** Selected event ID */
  selectedEventId: string | null
}

const SwimlaneTimelineContext = createContext<SwimlaneTimelineContextValue | null>(null)

export function useSwimlaneTimeline() {
  const ctx = useContext(SwimlaneTimelineContext)
  if (!ctx) throw new Error('useSwimlaneTimeline must be used within SwimlaneTimeline.Root')
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

export interface SwimlaneTimelineRootProps {
  children: ReactNode
  /** Initial lanes */
  lanes?: SwimlaneLane[]
  /** Initial events */
  events?: SwimlaneEvent[]
  /** Called when event is selected */
  onEventSelect?: (event: SwimlaneEvent | null) => void
  /** Called when lane is selected */
  onLaneSelect?: (laneId: string | null) => void
  /** Called when playhead changes */
  onPlayheadChange?: (playhead: Date) => void
  /** Additional class names */
  className?: string
}

const SwimlaneTimelineRoot: FC<SwimlaneTimelineRootProps> = ({
  children,
  lanes = [],
  events = [],
  onEventSelect,
  onLaneSelect,
  onPlayheadChange,
  className,
}) => {
  const [state, send] = useMachine(swimlaneMachine, { input: {} })

  // Sync lanes and events with machine
  useEffect(() => {
    send({ type: 'SET_LANES', lanes })
  }, [lanes, send])

  useEffect(() => {
    send({ type: 'SET_EVENTS', events })
  }, [events, send])

  // Emit callbacks
  useEffect(() => {
    const event = state.context.events.find((e) => e.id === state.context.selectedEventId) ?? null
    onEventSelect?.(event)
  }, [state.context.selectedEventId, state.context.events, onEventSelect])

  useEffect(() => {
    onLaneSelect?.(state.context.selectedLaneId)
  }, [state.context.selectedLaneId, onLaneSelect])

  useEffect(() => {
    onPlayheadChange?.(state.context.playhead)
  }, [state.context.playhead, onPlayheadChange])

  // Time conversion helpers
  const timestampToPosition = useCallback(
    (timestamp: Date): number => {
      const { start, end } = state.context.timeRange
      const range = end.getTime() - start.getTime()
      if (range === 0) return 0
      return (timestamp.getTime() - start.getTime()) / range
    },
    [state.context.timeRange]
  )

  const positionToTimestamp = useCallback(
    (position: number): Date => {
      const { start, end } = state.context.timeRange
      const range = end.getTime() - start.getTime()
      return new Date(start.getTime() + position * range)
    },
    [state.context.timeRange]
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (state.context.playbackState === 'playing') {
            send({ type: 'PAUSE' })
          } else {
            send({ type: 'PLAY' })
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.shiftKey) {
            send({ type: 'PAN_LEFT' })
          } else {
            send({ type: 'STEP_BACKWARD' })
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.shiftKey) {
            send({ type: 'PAN_RIGHT' })
          } else {
            send({ type: 'STEP_FORWARD' })
          }
          break
        case '+':
        case '=':
          e.preventDefault()
          send({ type: 'ZOOM_IN' })
          break
        case '-':
          e.preventDefault()
          send({ type: 'ZOOM_OUT' })
          break
        case 'f':
          e.preventDefault()
          send({ type: 'FIT_TO_DATA' })
          break
        case 'Escape':
          e.preventDefault()
          send({ type: 'DESELECT_EVENT' })
          send({ type: 'DESELECT_LANE' })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [send, state.context.playbackState])

  // Context value
  const contextValue = useMemo<SwimlaneTimelineContextValue>(
    () => ({
      state,
      send,
      lanes: state.context.lanes,
      events: state.context.events,
      timeRange: state.context.timeRange,
      playhead: state.context.playhead,
      playbackState: state.context.playbackState,
      zoomLevel: state.context.zoomLevel,
      timestampToPosition,
      positionToTimestamp,
      selectedLaneId: state.context.selectedLaneId,
      selectedEventId: state.context.selectedEventId,
    }),
    [state, send, timestampToPosition, positionToTimestamp]
  )

  return (
    <SwimlaneTimelineContext.Provider value={contextValue}>
      <div
        className={cn(
          'flex flex-col bg-surface-0 rounded-xl border border-border-subtle overflow-hidden',
          className
        )}
      >
        {children}
      </div>
    </SwimlaneTimelineContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface SwimlaneHeaderProps {
  className?: string
}

const SwimlaneHeader: FC<SwimlaneHeaderProps> = ({ className }) => {
  const { zoomLevel, send } = useSwimlaneTimeline()

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-1/50',
        className
      )}
    >
      <h3 className="text-sm font-medium text-text-primary">Swimlane Timeline</h3>

      <div className="flex items-center gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => send({ type: 'ZOOM_OUT' })}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
            title="Zoom out (-)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <select
            value={zoomLevel}
            onChange={(e) => send({ type: 'SET_ZOOM', level: e.target.value as ZoomLevel })}
            className="px-2 py-1 text-xs bg-surface-1 border border-border-subtle rounded text-text-primary"
          >
            {ZOOM_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>

          <button
            onClick={() => send({ type: 'ZOOM_IN' })}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
            title="Zoom in (+)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Fit to data */}
        <button
          onClick={() => send({ type: 'FIT_TO_DATA' })}
          className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
          title="Fit to data (F)"
        >
          Fit
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// TIME AXIS COMPONENT
// =============================================================================

export interface TimeAxisProps {
  className?: string
}

const TimeAxis: FC<TimeAxisProps> = ({ className }) => {
  const { timeRange, timestampToPosition, playhead } = useSwimlaneTimeline()
  const axisRef = useRef<HTMLDivElement>(null)

  // Generate tick marks
  const ticks = useMemo(() => {
    const { start, end } = timeRange
    const duration = end.getTime() - start.getTime()
    const tickCount = 8

    return Array.from({ length: tickCount + 1 }, (_, i) => {
      const time = new Date(start.getTime() + (duration * i) / tickCount)
      return {
        position: i / tickCount,
        label: formatTimeLabel(time, duration),
      }
    })
  }, [timeRange])

  const playheadPosition = timestampToPosition(playhead)

  return (
    <div
      ref={axisRef}
      className={cn('relative h-10 bg-surface-1/30 border-b border-border-subtle', className)}
      style={{ marginLeft: LANE_LABEL_WIDTH }}
    >
      {/* Tick marks */}
      {ticks.map((tick, i) => (
        <div
          key={i}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${tick.position * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-px h-2 bg-border-subtle" />
          <span className="text-xs text-text-tertiary mt-1">{tick.label}</span>
        </div>
      ))}

      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-accent-primary z-10"
        style={{ left: `${playheadPosition * 100}%` }}
      >
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-accent-primary rotate-45" />
      </div>
    </div>
  )
}

// =============================================================================
// LANE LIST COMPONENT (Virtualized)
// =============================================================================

export interface LaneListProps {
  className?: string
}

const LaneList: FC<LaneListProps> = ({ className }) => {
  const { lanes, send } = useSwimlaneTimeline()
  const parentRef = useRef<HTMLDivElement>(null)

  const visibleLanes = useMemo(
    () => lanes.filter((l) => l.visible).sort((a, b) => a.order - b.order),
    [lanes]
  )

  const virtualizer = useVirtualizer({
    count: visibleLanes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) =>
      visibleLanes[i]?.collapsed ? LANE_HEIGHT_COLLAPSED : LANE_HEIGHT,
    overscan: 5,
  })

  return (
    <div ref={parentRef} className={cn('flex-1 overflow-auto', className)}>
      <div
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const lane = visibleLanes[virtualRow.index]
          return (
            <Lane
              key={lane.id}
              lane={lane}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// LANE COMPONENT
// =============================================================================

interface LaneProps {
  lane: SwimlaneLane
  style?: React.CSSProperties
}

const Lane: FC<LaneProps> = ({ lane, style }) => {
  const {
    events,
    timestampToPosition,
    send,
    selectedLaneId,
    selectedEventId,
    playhead,
  } = useSwimlaneTimeline()

  const laneRef = useRef<HTMLDivElement>(null)
  const isSelected = selectedLaneId === lane.id

  // Get events for this lane
  const laneEvents = useMemo(
    () => events.filter((e) => e.laneId === lane.id),
    [events, lane.id]
  )

  // Animate selection
  useEffect(() => {
    if (!laneRef.current) return

    if (isSelected) {
      animate(laneRef.current, {
        backgroundColor: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.05)'],
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })
    }
  }, [isSelected])

  const handleClick = () => {
    send({ type: 'SELECT_LANE', laneId: lane.id })
  }

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (lane.collapsed) {
      send({ type: 'EXPAND_LANE', laneId: lane.id })
    } else {
      send({ type: 'COLLAPSE_LANE', laneId: lane.id })
    }
  }

  const playheadPosition = timestampToPosition(playhead)

  return (
    <div
      ref={laneRef}
      className={cn(
        'flex border-b border-border-subtle hover:bg-white/5 transition-colors cursor-pointer',
        isSelected && 'bg-white/5'
      )}
      style={style}
      onClick={handleClick}
    >
      {/* Lane label */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 border-r border-border-subtle bg-surface-1/30"
        style={{ width: LANE_LABEL_WIDTH }}
      >
        <button
          onClick={handleToggleCollapse}
          className="p-0.5 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <svg
            className={cn('w-3 h-3 transition-transform', lane.collapsed && '-rotate-90')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: lane.color }}
        />

        <span className="text-xs text-text-primary truncate">{lane.label}</span>
      </div>

      {/* Lane track */}
      <div className="flex-1 relative">
        {/* Track line */}
        {!lane.collapsed && (
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2" />
        )}

        {/* Events */}
        {laneEvents.map((event) => {
          const position = timestampToPosition(event.timestamp)
          const isEventSelected = selectedEventId === event.id

          return (
            <EventMarker
              key={event.id}
              event={event}
              position={position}
              isSelected={isEventSelected}
              collapsed={lane.collapsed}
            />
          )
        })}

        {/* Playhead line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-accent-primary/50"
          style={{ left: `${playheadPosition * 100}%` }}
        />
      </div>
    </div>
  )
}

// =============================================================================
// EVENT MARKER COMPONENT
// =============================================================================

interface EventMarkerProps {
  event: SwimlaneEvent
  position: number
  isSelected: boolean
  collapsed: boolean
}

const EventMarker: FC<EventMarkerProps> = ({ event, position, isSelected, collapsed }) => {
  const { send } = useSwimlaneTimeline()
  const markerRef = useRef<HTMLDivElement>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const color = EVENT_COLORS[event.type]
  const size = collapsed ? 6 : EVENT_DOT_SIZE

  // Animate selection
  useEffect(() => {
    if (!markerRef.current) return

    if (isSelected) {
      animate(markerRef.current, {
        scale: [1, 1.5, 1.2],
        duration: TIMING.normal,
        easing: EASING.anime.bounce,
      })
    }
  }, [isSelected])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    send({ type: 'SELECT_EVENT', eventId: event.id })
  }

  return (
    <div
      ref={markerRef}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 rounded-full cursor-pointer z-10',
        'transition-shadow hover:shadow-lg',
        isSelected && 'ring-2 ring-accent-primary ring-offset-2 ring-offset-surface-0'
      )}
      style={{
        left: `${position * 100}%`,
        transform: `translateX(-50%) translateY(-50%)`,
        width: size,
        height: size,
        backgroundColor: color,
      }}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && !collapsed && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-2 rounded shadow-lg whitespace-nowrap z-20">
          <p className="text-xs font-medium text-text-primary capitalize">{event.type}</p>
          <p className="text-xs text-text-tertiary">
            {event.timestamp.toLocaleTimeString()}
          </p>
          {event.label && (
            <p className="text-xs text-text-secondary">{event.label}</p>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// PLAYBACK CONTROLS COMPONENT
// =============================================================================

export interface PlaybackControlsProps {
  className?: string
}

const PlaybackControls: FC<PlaybackControlsProps> = ({ className }) => {
  const { playbackState, playhead, timeRange, send, state } = useSwimlaneTimeline()

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    const { start, end } = timeRange
    const timestamp = new Date(start.getTime() + position * (end.getTime() - start.getTime()))
    send({ type: 'SEEK', timestamp })
  }

  const playheadPosition =
    (playhead.getTime() - timeRange.start.getTime()) /
    (timeRange.end.getTime() - timeRange.start.getTime())

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 border-t border-border-subtle bg-surface-1/50',
        className
      )}
    >
      {/* Play/Pause/Stop buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => send({ type: 'STOP' })}
          className={cn(
            'p-1.5 rounded transition-colors',
            playbackState === 'stopped'
              ? 'bg-white/10 text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
          )}
          title="Stop"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </button>

        <button
          onClick={() => {
            if (playbackState === 'playing') {
              send({ type: 'PAUSE' })
            } else {
              send({ type: 'PLAY' })
            }
          }}
          className="p-1.5 rounded bg-accent-primary text-white hover:bg-accent-primary/80 transition-colors"
          title={playbackState === 'playing' ? 'Pause (Space)' : 'Play (Space)'}
        >
          {playbackState === 'playing' ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      </div>

      {/* Step buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => send({ type: 'STEP_BACKWARD' })}
          className="p-1 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
          title="Step backward (←)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => send({ type: 'STEP_FORWARD' })}
          className="p-1 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
          title="Step forward (→)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Seek bar */}
      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs text-text-tertiary font-mono w-20">
          {formatTimeLabel(playhead, 0)}
        </span>

        <div
          className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer relative"
          onClick={handleSeek}
        >
          <div
            className="absolute left-0 top-0 h-full bg-accent-primary/50 rounded-full"
            style={{ width: `${playheadPosition * 100}%` }}
          />
          <div
            className="absolute top-1/2 w-3 h-3 bg-accent-primary rounded-full -translate-y-1/2 shadow-lg"
            style={{ left: `calc(${playheadPosition * 100}% - 6px)` }}
          />
        </div>

        <span className="text-xs text-text-tertiary font-mono w-20 text-right">
          {formatTimeLabel(timeRange.end, 0)}
        </span>
      </div>

      {/* Speed selector */}
      <select
        value={state.context.playbackSpeed}
        onChange={(e) => send({ type: 'SET_SPEED', speed: Number(e.target.value) })}
        className="px-2 py-1 text-xs bg-surface-1 border border-border-subtle rounded text-text-primary"
      >
        {PLAYBACK_SPEEDS.map((speed) => (
          <option key={speed} value={speed}>
            {speed}x
          </option>
        ))}
      </select>

      {/* Follow mode toggle */}
      <button
        onClick={() => send({ type: 'TOGGLE_FOLLOW' })}
        className={cn(
          'px-2 py-1 text-xs rounded transition-colors',
          state.context.followMode
            ? 'bg-accent-primary text-white'
            : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
        )}
        title="Follow selected entity"
      >
        Follow
      </button>
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTimeLabel(date: Date, duration: number): string {
  if (duration > 24 * 60 * 60 * 1000) {
    // More than 24h: show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (duration > 60 * 60 * 1000) {
    // More than 1h: show time without seconds
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  // Less than 1h: show time with seconds
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const SwimlaneTimeline = Object.assign(SwimlaneTimelineRoot, {
  Root: SwimlaneTimelineRoot,
  Header: SwimlaneHeader,
  TimeAxis,
  LaneList,
  PlaybackControls,
})

// Named exports for individual imports
// Note: useSwimlaneTimeline is exported via function declaration above
