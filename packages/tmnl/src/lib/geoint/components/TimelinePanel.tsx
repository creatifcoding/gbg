/**
 * TimelinePanel - Temporal Filtering and Playback Controls
 *
 * Compound component architecture for:
 * - Time range selection (brush interaction)
 * - Playback controls (play/pause/speed)
 * - Temporal aggregation visualization
 * - Integration with search time filters
 *
 * Uses anime.js v4 for animations, effect-atom for state.
 *
 * @module geoint/components/TimelinePanel
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
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Atom } from '@effect-atom/atom'
import { animate } from 'animejs'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  Clock,
  Calendar,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export interface TimelineRange {
  start: Date
  end: Date
}

export interface TimelineContextValue {
  /** Current time range selection */
  range: TimelineRange
  /** Current playhead position */
  playhead: Date
  /** Playback state */
  isPlaying: boolean
  /** Playback speed multiplier */
  speed: number
  /** Available presets */
  presets: readonly TimePreset[]
  /** Set time range */
  setRange: (range: TimelineRange) => void
  /** Set playhead position */
  setPlayhead: (time: Date) => void
  /** Toggle play/pause */
  togglePlay: () => void
  /** Set playback speed */
  setSpeed: (speed: number) => void
  /** Jump to preset */
  applyPreset: (presetId: string) => void
  /** Step forward by amount */
  stepForward: (ms: number) => void
  /** Step backward by amount */
  stepBackward: (ms: number) => void
}

export interface TimePreset {
  id: string
  label: string
  getRange: () => TimelineRange
}

export interface TimelinePanelRootProps {
  /** Initial time range */
  initialRange?: TimelineRange
  /** Controlled range */
  range?: TimelineRange
  /** Range change callback */
  onRangeChange?: (range: TimelineRange) => void
  /** Playhead change callback */
  onPlayheadChange?: (time: Date) => void
  /** Custom presets */
  presets?: readonly TimePreset[]
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// DEFAULT PRESETS
// =============================================================================

const DEFAULT_PRESETS: readonly TimePreset[] = [
  {
    id: 'last-hour',
    label: 'Last Hour',
    getRange: () => ({
      start: new Date(Date.now() - 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    id: 'last-6h',
    label: 'Last 6 Hours',
    getRange: () => ({
      start: new Date(Date.now() - 6 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    id: 'last-24h',
    label: 'Last 24 Hours',
    getRange: () => ({
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    id: 'last-7d',
    label: 'Last 7 Days',
    getRange: () => ({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    id: 'last-30d',
    label: 'Last 30 Days',
    getRange: () => ({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
]

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8] as const

// =============================================================================
// ATOMS
// =============================================================================

/** Timeline range atom */
export const timelineRangeAtom = Atom.make<TimelineRange>({
  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: new Date(),
})

/** Playhead position atom */
export const timelinePlayheadAtom = Atom.make<Date>(new Date())

/** Playing state atom */
export const timelinePlayingAtom = Atom.make(false)

/** Playback speed atom */
export const timelineSpeedAtom = Atom.make(1)

// =============================================================================
// CONTEXT
// =============================================================================

const TimelineContext = createContext<TimelineContextValue | null>(null)

export const useTimeline = () => {
  const ctx = useContext(TimelineContext)
  if (!ctx) throw new Error('useTimeline must be used within TimelinePanel.Root')
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<TimelinePanelRootProps> = ({
  initialRange,
  range: controlledRange,
  onRangeChange,
  onPlayheadChange,
  presets = DEFAULT_PRESETS,
  children,
  className,
}) => {
  const defaultRange = initialRange ?? {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  }

  const [internalRange, setInternalRange] = useState<TimelineRange>(defaultRange)
  const [playhead, setPlayheadInternal] = useState<Date>(defaultRange.end)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const range = controlledRange ?? internalRange
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Set range (internal or callback)
  const setRange = useCallback((newRange: TimelineRange) => {
    if (controlledRange) {
      onRangeChange?.(newRange)
    } else {
      setInternalRange(newRange)
      onRangeChange?.(newRange)
    }
  }, [controlledRange, onRangeChange])

  // Set playhead
  const setPlayhead = useCallback((time: Date) => {
    setPlayheadInternal(time)
    onPlayheadChange?.(time)
  }, [onPlayheadChange])

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  // Apply preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (preset) {
      const newRange = preset.getRange()
      setRange(newRange)
      setPlayhead(newRange.end)
    }
  }, [presets, setRange, setPlayhead])

  // Step forward
  const stepForward = useCallback((ms: number) => {
    setPlayhead(new Date(Math.min(playhead.getTime() + ms, range.end.getTime())))
  }, [playhead, range.end, setPlayhead])

  // Step backward
  const stepBackward = useCallback((ms: number) => {
    setPlayhead(new Date(Math.max(playhead.getTime() - ms, range.start.getTime())))
  }, [playhead, range.start, setPlayhead])

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      const stepMs = 1000 * speed // 1 real second = speed seconds of playback time
      const intervalMs = 100 // Update every 100ms for smooth playback

      playIntervalRef.current = setInterval(() => {
        setPlayheadInternal((prev) => {
          const next = new Date(prev.getTime() + (stepMs / 10))
          if (next >= range.end) {
            setIsPlaying(false)
            return range.end
          }
          onPlayheadChange?.(next)
          return next
        })
      }, intervalMs)
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
      }
    }
  }, [isPlaying, speed, range.end, onPlayheadChange])

  const contextValue: TimelineContextValue = {
    range,
    playhead,
    isPlaying,
    speed,
    presets,
    setRange,
    setPlayhead,
    togglePlay,
    setSpeed,
    applyPreset,
    stepForward,
    stepBackward,
  }

  return (
    <TimelineContext.Provider value={contextValue}>
      <div className={cn('flex flex-col gap-2', className)}>
        {children}
      </div>
    </TimelineContext.Provider>
  )
}

// =============================================================================
// PLAYBACK CONTROLS
// =============================================================================

export interface PlaybackControlsProps {
  /** Show speed selector */
  showSpeed?: boolean
  /** Compact mode */
  compact?: boolean
  /** Additional class */
  className?: string
}

const PlaybackControls: FC<PlaybackControlsProps> = memo(function PlaybackControls({
  showSpeed = true,
  compact = false,
  className,
}) {
  const { isPlaying, speed, togglePlay, setSpeed, stepForward, stepBackward } = useTimeline()
  const playButtonRef = useRef<HTMLButtonElement>(null)

  // Animate play button on state change
  useEffect(() => {
    if (playButtonRef.current) {
      animate(playButtonRef.current, {
        scale: [0.9, 1],
        duration: TIMING.fast,
        ease: EASING.anime.bounce,
      })
    }
  }, [isPlaying])

  const buttonClass = cn(
    'flex items-center justify-center rounded transition-colors',
    compact ? 'w-7 h-7' : 'w-9 h-9',
    'bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary'
  )

  const iconClass = compact ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Skip to start */}
      <button
        className={buttonClass}
        onClick={() => stepBackward(Infinity)}
        title="Jump to start"
      >
        <SkipBack className={iconClass} />
      </button>

      {/* Step back */}
      <button
        className={buttonClass}
        onClick={() => stepBackward(60 * 1000)}
        title="Step back 1 minute"
      >
        <Rewind className={iconClass} />
      </button>

      {/* Play/Pause */}
      <button
        ref={playButtonRef}
        className={cn(
          buttonClass,
          isPlaying
            ? 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
            : ''
        )}
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className={iconClass} />
        ) : (
          <Play className={iconClass} />
        )}
      </button>

      {/* Step forward */}
      <button
        className={buttonClass}
        onClick={() => stepForward(60 * 1000)}
        title="Step forward 1 minute"
      >
        <FastForward className={iconClass} />
      </button>

      {/* Skip to end */}
      <button
        className={buttonClass}
        onClick={() => stepForward(Infinity)}
        title="Jump to end"
      >
        <SkipForward className={iconClass} />
      </button>

      {/* Speed selector */}
      {showSpeed && (
        <div className="ml-2 flex items-center gap-1">
          <span className={cn(
            'text-text-tertiary',
            compact ? 'text-xs' : 'text-sm'
          )}>
            {speed}x
          </span>
          <div className="flex gap-0.5">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                className={cn(
                  'px-1.5 py-0.5 rounded text-xs transition-colors',
                  s === speed
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
                )}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

// =============================================================================
// BRUSH SELECTOR (Timeline scrubber)
// =============================================================================

export interface BrushSelectorProps {
  /** Height of the brush area */
  height?: number
  /** Show aggregation bars */
  showAggregation?: boolean
  /** Aggregation data (counts per time bucket) */
  aggregationData?: readonly { time: Date; count: number }[]
  /** Additional class */
  className?: string
}

const BrushSelector: FC<BrushSelectorProps> = memo(function BrushSelector({
  height = 48,
  showAggregation = true,
  aggregationData,
  className,
}) {
  const { range, playhead, setPlayhead, setRange } = useTimeline()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState<'playhead' | 'start' | 'end' | null>(null)

  // Calculate position from time
  const timeToPosition = useCallback((time: Date): number => {
    const totalMs = range.end.getTime() - range.start.getTime()
    const offsetMs = time.getTime() - range.start.getTime()
    return (offsetMs / totalMs) * 100
  }, [range])

  // Calculate time from position
  const positionToTime = useCallback((percent: number): Date => {
    const totalMs = range.end.getTime() - range.start.getTime()
    const offsetMs = totalMs * (percent / 100)
    return new Date(range.start.getTime() + offsetMs)
  }, [range])

  // Handle mouse down
  const handleMouseDown = useCallback((e: ReactMouseEvent, type: 'playhead' | 'start' | 'end') => {
    e.preventDefault()
    setIsDragging(true)
    setDragType(type)
  }, [])

  // Handle mouse move
  useEffect(() => {
    if (!isDragging || !containerRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect()
      const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const time = positionToTime(percent)

      if (dragType === 'playhead') {
        setPlayhead(time)
      } else if (dragType === 'start') {
        setRange({ ...range, start: new Date(Math.min(time.getTime(), range.end.getTime() - 1000)) })
      } else if (dragType === 'end') {
        setRange({ ...range, end: new Date(Math.max(time.getTime(), range.start.getTime() + 1000)) })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setDragType(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragType, positionToTime, setPlayhead, setRange, range])

  // Click to set playhead
  const handleClick = useCallback((e: ReactMouseEvent) => {
    if (isDragging) return
    const rect = containerRef.current!.getBoundingClientRect()
    const percent = ((e.clientX - rect.left) / rect.width) * 100
    setPlayhead(positionToTime(percent))
  }, [isDragging, positionToTime, setPlayhead])

  const playheadPosition = timeToPosition(playhead)

  // Generate mock aggregation if not provided
  const bars = aggregationData ?? Array.from({ length: 24 }, (_, i) => ({
    time: new Date(range.start.getTime() + ((range.end.getTime() - range.start.getTime()) / 24) * i),
    count: Math.random() * 100,
  }))

  const maxCount = Math.max(...bars.map((b) => b.count), 1)

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full bg-surface-1 rounded-md overflow-hidden cursor-crosshair',
        className
      )}
      style={{ height }}
      onClick={handleClick}
    >
      {/* Aggregation bars */}
      {showAggregation && (
        <div className="absolute inset-0 flex items-end gap-px px-0.5 pb-0.5">
          {bars.map((bar, i) => (
            <div
              key={i}
              className="flex-1 bg-accent-primary/30 rounded-t-sm transition-all"
              style={{
                height: `${(bar.count / maxCount) * 80}%`,
              }}
            />
          ))}
        </div>
      )}

      {/* Track */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-surface-3 rounded-full" />

      {/* Progress fill */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1 bg-accent-primary/50 rounded-full"
        style={{
          left: 0,
          width: `${playheadPosition}%`,
        }}
      />

      {/* Playhead handle */}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full',
          'bg-accent-primary border-2 border-surface-0 shadow-md cursor-grab',
          isDragging && dragType === 'playhead' && 'cursor-grabbing scale-125'
        )}
        style={{ left: `${playheadPosition}%` }}
        onMouseDown={(e) => handleMouseDown(e, 'playhead')}
      />

      {/* Playhead line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-accent-primary/70"
        style={{ left: `${playheadPosition}%` }}
      />
    </div>
  )
})

// =============================================================================
// PRESET SELECTOR
// =============================================================================

export interface PresetSelectorProps {
  /** Additional class */
  className?: string
}

const PresetSelector: FC<PresetSelectorProps> = memo(function PresetSelector({
  className,
}) {
  const { presets, range, applyPreset } = useTimeline()
  const [isOpen, setIsOpen] = useState(false)

  // Find current preset (if any matches)
  const currentPreset = presets.find((p) => {
    const pRange = p.getRange()
    const tolerance = 60 * 1000 // 1 minute tolerance
    return (
      Math.abs(pRange.start.getTime() - range.start.getTime()) < tolerance &&
      Math.abs(pRange.end.getTime() - range.end.getTime()) < tolerance
    )
  })

  return (
    <div className={cn('relative', className)}>
      <button
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
          'bg-surface-2 hover:bg-surface-3 text-text-secondary transition-colors'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar className="w-4 h-4" />
        <span>{currentPreset?.label ?? 'Custom Range'}</span>
        <ChevronDown className={cn(
          'w-4 h-4 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 py-1 bg-surface-2 border border-border-subtle rounded-md shadow-lg z-10">
          {presets.map((preset) => (
            <button
              key={preset.id}
              className={cn(
                'w-full px-3 py-1.5 text-left text-sm transition-colors',
                preset.id === currentPreset?.id
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
              )}
              onClick={() => {
                applyPreset(preset.id)
                setIsOpen(false)
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// RANGE DISPLAY
// =============================================================================

export interface RangeDisplayProps {
  /** Date format */
  format?: 'short' | 'medium' | 'long'
  /** Show duration */
  showDuration?: boolean
  /** Additional class */
  className?: string
}

const RangeDisplay: FC<RangeDisplayProps> = memo(function RangeDisplay({
  format = 'medium',
  showDuration = true,
  className,
}) {
  const { range, playhead } = useTimeline()

  const formatDate = (date: Date): string => {
    switch (format) {
      case 'short':
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      case 'medium':
        return date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      case 'long':
        return date.toLocaleString()
    }
  }

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (60 * 60 * 1000))
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const duration = range.end.getTime() - range.start.getTime()

  return (
    <div className={cn('flex items-center gap-3 text-sm', className)}>
      <div className="flex items-center gap-1.5">
        <Clock className="w-4 h-4 text-text-tertiary" />
        <span className="text-text-secondary">{formatDate(range.start)}</span>
        <span className="text-text-tertiary">→</span>
        <span className="text-text-secondary">{formatDate(range.end)}</span>
      </div>

      {showDuration && (
        <span className="text-text-tertiary">
          ({formatDuration(duration)})
        </span>
      )}

      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-text-tertiary">Playhead:</span>
        <span className="text-accent-primary font-mono text-xs">
          {formatDate(playhead)}
        </span>
      </div>
    </div>
  )
})

// =============================================================================
// STATUS INDICATOR
// =============================================================================

export interface StatusIndicatorProps {
  /** Additional class */
  className?: string
}

const StatusIndicator: FC<StatusIndicatorProps> = memo(function StatusIndicator({
  className,
}) {
  const { isPlaying, speed } = useTimeline()
  const indicatorRef = useRef<HTMLDivElement>(null)

  // Pulse animation when playing
  useEffect(() => {
    if (isPlaying && indicatorRef.current) {
      animate(indicatorRef.current, {
        scale: [1, 1.2, 1],
        opacity: [1, 0.7, 1],
        duration: 1000 / speed,
        loop: true,
        ease: EASING.anime.inOut,
      })
    }
  }, [isPlaying, speed])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        ref={indicatorRef}
        className={cn(
          'w-2 h-2 rounded-full',
          isPlaying ? 'bg-green-500' : 'bg-gray-500'
        )}
      />
      <span className="text-xs text-text-tertiary">
        {isPlaying ? `Playing ${speed}x` : 'Paused'}
      </span>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const TimelinePanel = Object.assign(Root, {
  Root,
  PlaybackControls,
  BrushSelector,
  PresetSelector,
  RangeDisplay,
  StatusIndicator,
})

// Named exports for direct imports
export {
  Root as TimelinePanelRoot,
  PlaybackControls as TimelinePanelPlaybackControls,
  BrushSelector as TimelinePanelBrushSelector,
  PresetSelector as TimelinePanelPresetSelector,
  RangeDisplay as TimelinePanelRangeDisplay,
  StatusIndicator as TimelinePanelStatusIndicator,
}

export default TimelinePanel
