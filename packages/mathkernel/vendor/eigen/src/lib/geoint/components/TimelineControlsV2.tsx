/**
 * TimelineControlsV2 - XState-Integrated Timeline Controls
 *
 * Enhanced timeline playback controls with:
 * - XState machine integration (timelinePlaybackMachine)
 * - Loop modes (none, loop, bounce)
 * - Keyboard shortcuts (space, j/k, ,/.)
 * - Smooth scrubbing with requestAnimationFrame
 * - Visual playhead indicator with anime.js animation
 *
 * @module geoint/components/TimelineControlsV2
 */

import {
  createContext,
  useContext,
  memo,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type FC,
  type ReactNode,
} from 'react'
import { useMachine } from '@xstate/react'
import { animate } from 'animejs'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  Repeat,
  Repeat1,
  ArrowLeftRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING } from '../tokens'
import {
  timelinePlaybackMachine,
  SPEED_OPTIONS,
  type TimelineSpeed,
  type LoopMode,
  type TimelineRange,
  type TimelinePlaybackContext,
} from '../machines/timelineMachine'

// =============================================================================
// TYPES
// =============================================================================

export interface TimelineControlsV2ContextValue {
  /** Current playhead position (Date) */
  playhead: Date
  /** Current range */
  range: TimelineRange
  /** Is playing */
  isPlaying: boolean
  /** Playback speed */
  speed: TimelineSpeed
  /** Loop mode */
  loopMode: LoopMode
  /** Is at start boundary */
  isAtStart: boolean
  /** Is at end boundary */
  isAtEnd: boolean
  /** Playhead position as percentage (0-100) */
  playheadPercent: number

  // Actions
  play: () => void
  pause: () => void
  toggle: () => void
  stop: () => void
  setSpeed: (speed: TimelineSpeed) => void
  speedUp: () => void
  speedDown: () => void
  seek: (position: number) => void
  seekPercent: (percent: number) => void
  stepForward: () => void
  stepBackward: () => void
  jumpToStart: () => void
  jumpToEnd: () => void
  setRange: (range: TimelineRange) => void
  setLoopMode: (mode: LoopMode) => void
  toggleLoop: () => void
}

export interface TimelineControlsV2RootProps {
  /** Initial range */
  initialRange?: TimelineRange
  /** Initial playhead */
  initialPlayhead?: Date
  /** Initial speed */
  initialSpeed?: TimelineSpeed
  /** Initial loop mode */
  initialLoopMode?: LoopMode
  /** Step size in ms (default: 60000 = 1 minute) */
  stepSize?: number
  /** Enable keyboard shortcuts */
  enableKeyboard?: boolean
  /** On playhead change */
  onPlayheadChange?: (time: Date) => void
  /** On range change */
  onRangeChange?: (range: TimelineRange) => void
  /** On playback state change */
  onPlaybackChange?: (playing: boolean) => void
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

const TimelineControlsV2Context = createContext<TimelineControlsV2ContextValue | null>(null)

export const useTimelineControlsV2 = () => {
  const ctx = useContext(TimelineControlsV2Context)
  if (!ctx) {
    throw new Error('useTimelineControlsV2 must be used within TimelineControlsV2.Root')
  }
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<TimelineControlsV2RootProps> = ({
  initialRange,
  initialPlayhead,
  initialSpeed = 1,
  initialLoopMode = 'none',
  stepSize = 60 * 1000,
  enableKeyboard = true,
  onPlayheadChange,
  onRangeChange,
  onPlaybackChange,
  children,
  className,
}) => {
  const defaultRange = initialRange ?? {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  }

  // XState machine
  const [state, send] = useMachine(timelinePlaybackMachine, {
    input: {
      initialPlayhead: (initialPlayhead ?? defaultRange.end).getTime(),
      initialRange: defaultRange,
      initialSpeed,
      initialLoopMode,
      stepSize,
    },
  })

  const context = state.context as TimelinePlaybackContext
  const isPlaying = state.matches('playing')

  // Derived values
  const playhead = useMemo(() => new Date(context.playhead), [context.playhead])
  const range = useMemo<TimelineRange>(
    () => ({
      start: new Date(context.rangeStart),
      end: new Date(context.rangeEnd),
    }),
    [context.rangeStart, context.rangeEnd]
  )
  const playheadPercent = useMemo(() => {
    const total = context.rangeEnd - context.rangeStart
    const offset = context.playhead - context.rangeStart
    return total > 0 ? (offset / total) * 100 : 0
  }, [context.playhead, context.rangeStart, context.rangeEnd])
  const isAtStart = context.playhead <= context.rangeStart
  const isAtEnd = context.playhead >= context.rangeEnd

  // Emit callbacks
  useEffect(() => {
    onPlayheadChange?.(playhead)
  }, [playhead, onPlayheadChange])

  useEffect(() => {
    onRangeChange?.(range)
  }, [range, onRangeChange])

  useEffect(() => {
    onPlaybackChange?.(isPlaying)
  }, [isPlaying, onPlaybackChange])

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboard || !context.keyboardEnabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          send({ type: 'TOGGLE' })
          break
        case 'k':
          e.preventDefault()
          send({ type: 'STEP_BACKWARD' })
          break
        case 'j':
          e.preventDefault()
          send({ type: 'STEP_FORWARD' })
          break
        case ',':
        case '<':
          e.preventDefault()
          send({ type: 'SPEED_DOWN' })
          break
        case '.':
        case '>':
          e.preventDefault()
          send({ type: 'SPEED_UP' })
          break
        case 'Home':
          e.preventDefault()
          send({ type: 'JUMP_START' })
          break
        case 'End':
          e.preventDefault()
          send({ type: 'JUMP_END' })
          break
        case 'l':
          e.preventDefault()
          send({ type: 'TOGGLE_LOOP' })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableKeyboard, context.keyboardEnabled, send])

  // Actions
  const actions = useMemo(
    () => ({
      play: () => send({ type: 'PLAY' }),
      pause: () => send({ type: 'PAUSE' }),
      toggle: () => send({ type: 'TOGGLE' }),
      stop: () => send({ type: 'STOP' }),
      setSpeed: (speed: TimelineSpeed) => send({ type: 'SET_SPEED', speed }),
      speedUp: () => send({ type: 'SPEED_UP' }),
      speedDown: () => send({ type: 'SPEED_DOWN' }),
      seek: (position: number) => send({ type: 'SEEK', position }),
      seekPercent: (percent: number) => send({ type: 'SEEK_PERCENT', percent }),
      stepForward: () => send({ type: 'STEP_FORWARD' }),
      stepBackward: () => send({ type: 'STEP_BACKWARD' }),
      jumpToStart: () => send({ type: 'JUMP_START' }),
      jumpToEnd: () => send({ type: 'JUMP_END' }),
      setRange: (r: TimelineRange) =>
        send({ type: 'SET_RANGE', start: r.start.getTime(), end: r.end.getTime() }),
      setLoopMode: (mode: LoopMode) => send({ type: 'SET_LOOP_MODE', mode }),
      toggleLoop: () => send({ type: 'TOGGLE_LOOP' }),
    }),
    [send]
  )

  const contextValue: TimelineControlsV2ContextValue = useMemo(
    () => ({
      playhead,
      range,
      isPlaying,
      speed: context.speed,
      loopMode: context.loopMode,
      isAtStart,
      isAtEnd,
      playheadPercent,
      ...actions,
    }),
    [playhead, range, isPlaying, context.speed, context.loopMode, isAtStart, isAtEnd, playheadPercent, actions]
  )

  return (
    <TimelineControlsV2Context.Provider value={contextValue}>
      <div className={cn('flex flex-col gap-2', className)}>{children}</div>
    </TimelineControlsV2Context.Provider>
  )
}

// =============================================================================
// PLAYBACK BUTTONS
// =============================================================================

export interface PlaybackButtonsProps {
  /** Compact mode */
  compact?: boolean
  /** Show skip buttons */
  showSkip?: boolean
  /** Additional class */
  className?: string
}

const PlaybackButtons: FC<PlaybackButtonsProps> = memo(function PlaybackButtons({
  compact = false,
  showSkip = true,
  className,
}) {
  const ctx = useTimelineControlsV2()
  const playButtonRef = useRef<HTMLButtonElement>(null)

  // Animate play button on state change
  useEffect(() => {
    if (playButtonRef.current) {
      animate(playButtonRef.current, {
        scale: [0.85, 1],
        duration: TIMING.fast,
        easing: EASING.anime.bounce,
      })
    }
  }, [ctx.isPlaying])

  const buttonClass = cn(
    'flex items-center justify-center rounded transition-colors',
    compact ? 'w-7 h-7' : 'w-9 h-9',
    'bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary'
  )

  const iconClass = compact ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {showSkip && (
        <button
          className={cn(buttonClass, ctx.isAtStart && 'opacity-50')}
          onClick={ctx.jumpToStart}
          disabled={ctx.isAtStart}
          title="Jump to start (Home)"
        >
          <SkipBack className={iconClass} />
        </button>
      )}

      <button
        className={cn(buttonClass, ctx.isAtStart && 'opacity-50')}
        onClick={ctx.stepBackward}
        disabled={ctx.isAtStart}
        title="Step backward (k)"
      >
        <Rewind className={iconClass} />
      </button>

      <button
        ref={playButtonRef}
        className={cn(
          buttonClass,
          compact ? 'w-9 h-9' : 'w-11 h-11',
          ctx.isPlaying
            ? 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
            : 'bg-accent-primary text-white hover:bg-accent-primary/90'
        )}
        onClick={ctx.toggle}
        title={ctx.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {ctx.isPlaying ? (
          <Pause className={cn(iconClass, compact ? '' : 'w-5 h-5')} />
        ) : (
          <Play className={cn(iconClass, compact ? '' : 'w-5 h-5')} />
        )}
      </button>

      <button
        className={cn(buttonClass, ctx.isAtEnd && 'opacity-50')}
        onClick={ctx.stepForward}
        disabled={ctx.isAtEnd}
        title="Step forward (j)"
      >
        <FastForward className={iconClass} />
      </button>

      {showSkip && (
        <button
          className={cn(buttonClass, ctx.isAtEnd && 'opacity-50')}
          onClick={ctx.jumpToEnd}
          disabled={ctx.isAtEnd}
          title="Jump to end (End)"
        >
          <SkipForward className={iconClass} />
        </button>
      )}
    </div>
  )
})

// =============================================================================
// SPEED CONTROL
// =============================================================================

export interface SpeedControlProps {
  /** Compact mode */
  compact?: boolean
  /** Additional class */
  className?: string
}

const SpeedControl: FC<SpeedControlProps> = memo(function SpeedControl({
  compact: _compact = false,
  className,
}) {
  const { speed, setSpeed, speedUp, speedDown } = useTimelineControlsV2()

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-2"
        onClick={speedDown}
        title="Slower (<)"
      >
        <Rewind className="w-3 h-3" />
      </button>

      <div className="flex gap-0.5">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            className={cn(
              'px-1.5 py-0.5 rounded text-xs font-mono transition-colors',
              s === speed
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
            )}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>

      <button
        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-2"
        onClick={speedUp}
        title="Faster (>)"
      >
        <FastForward className="w-3 h-3" />
      </button>
    </div>
  )
})

// =============================================================================
// LOOP MODE CONTROL
// =============================================================================

export interface LoopControlProps {
  /** Compact mode */
  compact?: boolean
  /** Additional class */
  className?: string
}

const LoopControl: FC<LoopControlProps> = memo(function LoopControl({
  compact = false,
  className,
}) {
  const { loopMode, setLoopMode, toggleLoop } = useTimelineControlsV2()

  const modes: { mode: LoopMode; icon: typeof Repeat; label: string; title: string }[] = [
    { mode: 'none', icon: Repeat, label: 'Off', title: 'No loop' },
    { mode: 'loop', icon: Repeat1, label: 'Loop', title: 'Loop continuously' },
    { mode: 'bounce', icon: ArrowLeftRight, label: 'Bounce', title: 'Bounce back and forth' },
  ]

  if (compact) {
    // Compact: single toggle button
    const current = modes.find((m) => m.mode === loopMode)!
    const Icon = current.icon

    return (
      <button
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          loopMode !== 'none'
            ? 'bg-accent-primary/20 text-accent-primary'
            : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2',
          className
        )}
        onClick={toggleLoop}
        title="Toggle loop mode (l)"
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {modes.map(({ mode, icon: Icon, label, title }) => (
        <button
          key={mode}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            loopMode === mode
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
          )}
          onClick={() => setLoopMode(mode)}
          title={title}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
})

// =============================================================================
// SCRUBBER / TRACK
// =============================================================================

export interface ScrubberProps {
  /** Height in pixels */
  height?: number
  /** Show time labels */
  showLabels?: boolean
  /** Show playhead time tooltip */
  showTooltip?: boolean
  /** Additional class */
  className?: string
}

const Scrubber: FC<ScrubberProps> = memo(function Scrubber({
  height = 32,
  showLabels = true,
  showTooltip = true,
  className,
}) {
  const { playheadPercent, range, playhead, seekPercent, isPlaying } = useTimelineControlsV2()
  const trackRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // Animate playhead position
  useEffect(() => {
    if (playheadRef.current && !isDraggingRef.current) {
      // Use CSS transition for smooth movement during playback
      playheadRef.current.style.left = `${playheadPercent}%`
    }
  }, [playheadPercent])

  // Handle mouse events for scrubbing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true
      const rect = trackRef.current!.getBoundingClientRect()
      const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      seekPercent(percent)

      const handleMouseMove = (e: MouseEvent) => {
        const percent = Math.max(
          0,
          Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
        )
        seekPercent(percent)
      }

      const handleMouseUp = () => {
        isDraggingRef.current = false
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [seekPercent]
  )

  // Format time for display
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Track */}
      <div
        ref={trackRef}
        className="relative bg-surface-3 rounded-full cursor-pointer"
        style={{ height }}
        onMouseDown={handleMouseDown}
      >
        {/* Progress fill */}
        <div
          className="absolute top-0 left-0 h-full bg-accent-primary/30 rounded-full transition-all"
          style={{ width: `${playheadPercent}%` }}
        />

        {/* Playhead */}
        <div
          ref={playheadRef}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-accent-primary rounded-full shadow-md',
            'transition-all duration-100',
            isPlaying && 'ring-2 ring-accent-primary/50 ring-offset-2 ring-offset-surface-1'
          )}
          style={{ left: `${playheadPercent}%` }}
        >
          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-0 rounded text-xs font-mono whitespace-nowrap shadow-lg border border-border-subtle">
              {formatTime(playhead)}
            </div>
          )}
        </div>
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between text-xs text-text-tertiary font-mono">
          <span>{formatTime(range.start)}</span>
          <span>{formatTime(range.end)}</span>
        </div>
      )}
    </div>
  )
})

// =============================================================================
// TIME DISPLAY
// =============================================================================

export interface TimeDisplayProps {
  /** Format: 'time' | 'datetime' | 'relative' */
  format?: 'time' | 'datetime' | 'relative'
  /** Additional class */
  className?: string
}

const TimeDisplay: FC<TimeDisplayProps> = memo(function TimeDisplay({
  format = 'time',
  className,
}) {
  const { playhead, range, playheadPercent, isPlaying } = useTimelineControlsV2()

  const formatValue = useMemo(() => {
    switch (format) {
      case 'datetime':
        return playhead.toLocaleString()
      case 'relative': {
        const elapsed = playhead.getTime() - range.start.getTime()
        const total = range.end.getTime() - range.start.getTime()
        const minutes = Math.floor(elapsed / 60000)
        const totalMinutes = Math.floor(total / 60000)
        return `${minutes}m / ${totalMinutes}m`
      }
      default:
        return playhead.toLocaleTimeString()
    }
  }, [playhead, range, format])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 bg-surface-2 rounded text-sm font-mono',
          isPlaying && 'text-accent-primary'
        )}
      >
        {isPlaying && (
          <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
        )}
        <span>{formatValue}</span>
      </div>
      <span className="text-xs text-text-tertiary">
        {Math.round(playheadPercent)}%
      </span>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const TimelineControlsV2 = Object.assign(Root, {
  Root,
  PlaybackButtons,
  SpeedControl,
  LoopControl,
  Scrubber,
  TimeDisplay,
})

// Named exports
export {
  Root as TimelineControlsV2Root,
  PlaybackButtons as TimelineControlsV2PlaybackButtons,
  SpeedControl as TimelineControlsV2SpeedControl,
  LoopControl as TimelineControlsV2LoopControl,
  Scrubber as TimelineControlsV2Scrubber,
  TimeDisplay as TimelineControlsV2TimeDisplay,
}

export default TimelineControlsV2
