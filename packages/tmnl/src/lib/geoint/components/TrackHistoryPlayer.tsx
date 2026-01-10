/**
 * TrackHistoryPlayer - Entity Movement Playback
 *
 * Provides playback controls for historical entity positions:
 * - Play/pause/scrub through track history
 * - Speed controls (0.5x, 1x, 2x, 4x)
 * - Visual timeline with keyframes
 * - Position interpolation
 * - Trail rendering configuration
 *
 * Compound component architecture:
 * - TrackHistoryPlayer.Root - Container with playback state
 * - TrackHistoryPlayer.Timeline - Visual timeline with scrubber
 * - TrackHistoryPlayer.PlaybackControls - Play/pause/speed buttons
 * - TrackHistoryPlayer.PositionDisplay - Current position info
 * - TrackHistoryPlayer.TrailConfig - Trail length/style configuration
 *
 * @module geoint/components/TrackHistoryPlayer
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { animate } from 'animejs'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  ChevronFirst,
  ChevronLast,
  Clock,
  MapPin,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export interface TrackPoint {
  /** Timestamp */
  timestamp: number
  /** Position [longitude, latitude] */
  position: readonly [number, number]
  /** Altitude in meters (optional) */
  altitude?: number
  /** Heading in degrees (optional) */
  heading?: number
  /** Speed (optional) */
  speed?: number
}

export type PlaybackSpeed = 0.5 | 1 | 2 | 4 | 8

export interface TrackHistoryData {
  /** Entity ID */
  entityId: string
  /** Entity name/label */
  label: string
  /** Track points */
  points: readonly TrackPoint[]
  /** Source */
  source?: string
  /** Color override */
  color?: string
}

export interface TrackHistoryContextValue {
  /** Track data */
  track: TrackHistoryData | null
  /** Is playing */
  isPlaying: boolean
  /** Playback speed */
  speed: PlaybackSpeed
  /** Current time (ms since epoch) */
  currentTime: number
  /** Start time */
  startTime: number
  /** End time */
  endTime: number
  /** Duration (ms) */
  duration: number
  /** Current position (interpolated) */
  currentPosition: { position: readonly [number, number]; heading?: number; speed?: number } | null
  /** Play */
  play: () => void
  /** Pause */
  pause: () => void
  /** Toggle play/pause */
  togglePlayPause: () => void
  /** Seek to time */
  seekTo: (time: number) => void
  /** Set speed */
  setSpeed: (speed: PlaybackSpeed) => void
  /** Step forward */
  stepForward: () => void
  /** Step backward */
  stepBackward: () => void
  /** Go to start */
  goToStart: () => void
  /** Go to end */
  goToEnd: () => void
  /** Show trail */
  showTrail: boolean
  /** Toggle trail */
  toggleTrail: () => void
  /** Trail length (number of points) */
  trailLength: number
  /** Set trail length */
  setTrailLength: (length: number) => void
  /** Compact mode */
  compact: boolean
}

export interface TrackHistoryPlayerRootProps {
  /** Track history data */
  track: TrackHistoryData
  /** Current time change callback (for map integration) */
  onTimeChange?: (time: number, position: { position: readonly [number, number]; heading?: number }) => void
  /** Close handler */
  onClose?: () => void
  /** Initial speed */
  initialSpeed?: PlaybackSpeed
  /** Compact mode */
  compact?: boolean
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

const TrackHistoryContext = createContext<TrackHistoryContextValue | null>(null)

export const useTrackHistory = () => {
  const ctx = useContext(TrackHistoryContext)
  if (!ctx) throw new Error('useTrackHistory must be used within TrackHistoryPlayer.Root')
  return ctx
}

// =============================================================================
// UTILITIES
// =============================================================================

/** Interpolate between two track points */
const interpolatePosition = (
  p1: TrackPoint,
  p2: TrackPoint,
  time: number
): { position: readonly [number, number]; heading?: number; speed?: number } => {
  const t = (time - p1.timestamp) / (p2.timestamp - p1.timestamp)
  const clampedT = Math.max(0, Math.min(1, t))

  const lon = p1.position[0] + (p2.position[0] - p1.position[0]) * clampedT
  const lat = p1.position[1] + (p2.position[1] - p1.position[1]) * clampedT

  // Interpolate heading (handle wrap-around)
  let heading: number | undefined
  if (p1.heading != null && p2.heading != null) {
    let diff = p2.heading - p1.heading
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360
    heading = (p1.heading + diff * clampedT + 360) % 360
  } else if (p2.heading != null) {
    heading = p2.heading
  }

  // Interpolate speed
  const speed =
    p1.speed != null && p2.speed != null
      ? p1.speed + (p2.speed - p1.speed) * clampedT
      : p2.speed ?? p1.speed

  return { position: [lon, lat] as const, heading, speed }
}

/** Find the position at a given time */
const getPositionAtTime = (
  points: readonly TrackPoint[],
  time: number
): { position: readonly [number, number]; heading?: number; speed?: number } | null => {
  if (points.length === 0) return null
  if (points.length === 1) {
    return { position: points[0].position, heading: points[0].heading, speed: points[0].speed }
  }

  // Find the segment containing this time
  for (let i = 0; i < points.length - 1; i++) {
    if (time >= points[i].timestamp && time <= points[i + 1].timestamp) {
      return interpolatePosition(points[i], points[i + 1], time)
    }
  }

  // Before first point
  if (time < points[0].timestamp) {
    return { position: points[0].position, heading: points[0].heading, speed: points[0].speed }
  }

  // After last point
  const last = points[points.length - 1]
  return { position: last.position, heading: last.heading, speed: last.speed }
}

/** Format time duration */
const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Format timestamp */
const formatTimestamp = (ms: number): string => {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<TrackHistoryPlayerRootProps> = ({
  track,
  onTimeChange,
  onClose,
  initialSpeed = 1,
  compact = false,
  children,
  className,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(initialSpeed)
  const [showTrail, setShowTrail] = useState(true)
  const [trailLength, setTrailLength] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)

  // Compute time bounds
  const startTime = track.points.length > 0 ? track.points[0].timestamp : 0
  const endTime = track.points.length > 0 ? track.points[track.points.length - 1].timestamp : 0
  const duration = endTime - startTime

  const [currentTime, setCurrentTime] = useState(startTime)

  // Get current position
  const currentPosition = getPositionAtTime(track.points, currentTime)

  // Enter animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [-10, 0],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    }
  }, [])

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    lastTickRef.current = performance.now()

    const tick = (now: number) => {
      const delta = now - lastTickRef.current
      lastTickRef.current = now

      setCurrentTime(prev => {
        const next = prev + delta * speed
        if (next >= endTime) {
          setIsPlaying(false)
          return endTime
        }
        return next
      })

      animationRef.current = requestAnimationFrame(tick)
    }

    animationRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, speed, endTime])

  // Notify on time change
  useEffect(() => {
    if (currentPosition) {
      onTimeChange?.(currentTime, currentPosition)
    }
  }, [currentTime, currentPosition, onTimeChange])

  const play = useCallback(() => setIsPlaying(true), [])
  const pause = useCallback(() => setIsPlaying(false), [])
  const togglePlayPause = useCallback(() => setIsPlaying(prev => !prev), [])

  const seekTo = useCallback((time: number) => {
    setCurrentTime(Math.max(startTime, Math.min(endTime, time)))
  }, [startTime, endTime])

  const stepForward = useCallback(() => {
    // Find next keyframe
    const nextPoint = track.points.find(p => p.timestamp > currentTime)
    if (nextPoint) {
      setCurrentTime(nextPoint.timestamp)
    }
  }, [currentTime, track.points])

  const stepBackward = useCallback(() => {
    // Find previous keyframe
    const prevPoints = track.points.filter(p => p.timestamp < currentTime)
    if (prevPoints.length > 0) {
      setCurrentTime(prevPoints[prevPoints.length - 1].timestamp)
    }
  }, [currentTime, track.points])

  const goToStart = useCallback(() => setCurrentTime(startTime), [startTime])
  const goToEnd = useCallback(() => setCurrentTime(endTime), [endTime])

  const toggleTrail = useCallback(() => setShowTrail(prev => !prev), [])

  const contextValue: TrackHistoryContextValue = {
    track,
    isPlaying,
    speed,
    currentTime,
    startTime,
    endTime,
    duration,
    currentPosition,
    play,
    pause,
    togglePlayPause,
    seekTo,
    setSpeed,
    stepForward,
    stepBackward,
    goToStart,
    goToEnd,
    showTrail,
    toggleTrail,
    trailLength,
    setTrailLength,
    compact,
  }

  return (
    <TrackHistoryContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-primary" />
            <span className={cn(
              'font-medium text-text-primary',
              compact ? 'text-sm' : 'text-base'
            )}>
              Track History
            </span>
            <span className="text-xs text-text-tertiary">
              {track.label}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {children}
      </div>
    </TrackHistoryContext.Provider>
  )
}

// =============================================================================
// TIMELINE COMPONENT
// =============================================================================

export interface TimelineProps {
  /** Show keyframe markers */
  showKeyframes?: boolean
  /** Additional class */
  className?: string
}

const Timeline: FC<TimelineProps> = memo(function Timeline({
  showKeyframes = true,
  className,
}) {
  const { track, currentTime, startTime, endTime, duration, seekTo, compact } = useTrackHistory()
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const progress = duration > 0 ? (currentTime - startTime) / duration : 0

  const handleSeek = useCallback((clientX: number) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percent = Math.max(0, Math.min(1, x / rect.width))
    seekTo(startTime + percent * duration)
  }, [seekTo, startTime, duration])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    handleSeek(e.clientX)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => handleSeek(e.clientX)
    const handleMouseUp = () => setIsDragging(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleSeek])

  return (
    <div className={cn('px-3 py-2', className)}>
      {/* Time labels */}
      <div className="flex items-center justify-between mb-1 text-xs font-mono text-text-tertiary">
        <span>{formatTimestamp(startTime)}</span>
        <span>{formatTimestamp(currentTime)}</span>
        <span>{formatTimestamp(endTime)}</span>
      </div>

      {/* Timeline bar */}
      <div
        ref={timelineRef}
        className="relative h-6 bg-surface-2 rounded cursor-pointer"
        onMouseDown={handleMouseDown}
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-accent-primary/30 rounded-l"
          style={{ width: `${progress * 100}%` }}
        />

        {/* Keyframe markers */}
        {showKeyframes && track && (
          <div className="absolute inset-0">
            {track.points.map((point, i) => {
              const pos = duration > 0 ? (point.timestamp - startTime) / duration : 0
              return (
                <div
                  key={i}
                  className="absolute top-1 bottom-1 w-0.5 bg-text-tertiary/30 rounded-full"
                  style={{ left: `${pos * 100}%` }}
                />
              )
            })}
          </div>
        )}

        {/* Scrubber handle */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1 bg-accent-primary rounded-full -translate-x-1/2',
            isDragging && 'w-1.5'
          )}
          style={{ left: `${progress * 100}%` }}
        >
          <div className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-accent-primary rounded-full border-2 border-surface-1',
            compact ? 'w-2 h-2' : 'w-3 h-3'
          )} />
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center justify-center mt-1 text-xs text-text-tertiary">
        <span>{formatDuration(currentTime - startTime)}</span>
        <span className="mx-1">/</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  )
})

// =============================================================================
// PLAYBACK CONTROLS COMPONENT
// =============================================================================

export interface PlaybackControlsProps {
  /** Show speed selector */
  showSpeedSelector?: boolean
  /** Additional class */
  className?: string
}

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4, 8]

const PlaybackControls: FC<PlaybackControlsProps> = memo(function PlaybackControls({
  showSpeedSelector = true,
  className,
}) {
  const {
    isPlaying,
    speed,
    togglePlayPause,
    stepBackward,
    stepForward,
    goToStart,
    goToEnd,
    setSpeed,
    compact,
  } = useTrackHistory()

  return (
    <div className={cn('px-3 py-2 flex items-center justify-center gap-1', className)}>
      {/* Go to start */}
      <button
        onClick={goToStart}
        className="p-1.5 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
        title="Go to start"
      >
        <ChevronFirst className={cn('w-4 h-4', compact && 'w-3.5 h-3.5')} />
      </button>

      {/* Step backward */}
      <button
        onClick={stepBackward}
        className="p-1.5 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
        title="Previous keyframe"
      >
        <SkipBack className={cn('w-4 h-4', compact && 'w-3.5 h-3.5')} />
      </button>

      {/* Rewind (decrease speed) */}
      <button
        onClick={() => {
          const idx = SPEEDS.indexOf(speed)
          if (idx > 0) setSpeed(SPEEDS[idx - 1])
        }}
        className="p-1.5 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
        title="Slower"
      >
        <Rewind className={cn('w-4 h-4', compact && 'w-3.5 h-3.5')} />
      </button>

      {/* Play/Pause */}
      <button
        onClick={togglePlayPause}
        className={cn(
          'p-2 rounded-full transition-colors',
          isPlaying
            ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
            : 'bg-surface-2 text-text-primary hover:bg-surface-3'
        )}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className={cn('w-5 h-5', compact && 'w-4 h-4')} />
        ) : (
          <Play className={cn('w-5 h-5', compact && 'w-4 h-4')} />
        )}
      </button>

      {/* Fast forward (increase speed) */}
      <button
        onClick={() => {
          const idx = SPEEDS.indexOf(speed)
          if (idx < SPEEDS.length - 1) setSpeed(SPEEDS[idx + 1])
        }}
        className="p-1.5 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
        title="Faster"
      >
        <FastForward className={cn('w-4 h-4', compact && 'w-3.5 h-3.5')} />
      </button>

      {/* Step forward */}
      <button
        onClick={stepForward}
        className="p-1.5 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
        title="Next keyframe"
      >
        <SkipForward className={cn('w-4 h-4', compact && 'w-3.5 h-3.5')} />
      </button>

      {/* Go to end */}
      <button
        onClick={goToEnd}
        className="p-1.5 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
        title="Go to end"
      >
        <ChevronLast className={cn('w-4 h-4', compact && 'w-3.5 h-3.5')} />
      </button>

      {/* Speed indicator */}
      {showSpeedSelector && (
        <div className="ml-2 px-2 py-0.5 bg-surface-2 rounded text-xs font-mono text-text-secondary">
          {speed}x
        </div>
      )}
    </div>
  )
})

// =============================================================================
// POSITION DISPLAY COMPONENT
// =============================================================================

export interface PositionDisplayProps {
  /** Show coordinates */
  showCoordinates?: boolean
  /** Show heading */
  showHeading?: boolean
  /** Show speed */
  showSpeed?: boolean
  /** Additional class */
  className?: string
}

const PositionDisplay: FC<PositionDisplayProps> = memo(function PositionDisplay({
  showCoordinates = true,
  showHeading = true,
  showSpeed = true,
  className,
}) {
  const { currentPosition, track, compact } = useTrackHistory()
  const color = track?.color ?? (track?.source ? SOURCE_COLORS[track.source as keyof typeof SOURCE_COLORS]?.primary : undefined) ?? SOURCE_COLORS.track.primary

  if (!currentPosition) {
    return (
      <div className={cn('px-3 py-2', className)}>
        <div className="text-xs text-text-tertiary">No position data</div>
      </div>
    )
  }

  return (
    <div className={cn('px-3 py-2', className)}>
      <div className={cn(
        'grid gap-2',
        compact ? 'grid-cols-3' : 'grid-cols-3'
      )}>
        {/* Coordinates */}
        {showCoordinates && (
          <div className="p-2 bg-surface-2 rounded">
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="w-3 h-3" style={{ color }} />
              <span className="text-xs text-text-tertiary uppercase">Position</span>
            </div>
            <div className="font-mono text-xs text-text-primary">
              <div>{currentPosition.position[1].toFixed(5)}°</div>
              <div>{currentPosition.position[0].toFixed(5)}°</div>
            </div>
          </div>
        )}

        {/* Heading */}
        {showHeading && currentPosition.heading != null && (
          <div className="p-2 bg-surface-2 rounded">
            <div className="flex items-center gap-1 mb-1">
              <div
                className="w-3 h-3 flex items-center justify-center"
                style={{ transform: `rotate(${currentPosition.heading}deg)` }}
              >
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px]" style={{ borderBottomColor: color }} />
              </div>
              <span className="text-xs text-text-tertiary uppercase">Heading</span>
            </div>
            <div className="font-mono text-xs text-text-primary">
              {currentPosition.heading.toFixed(1)}°
            </div>
          </div>
        )}

        {/* Speed */}
        {showSpeed && currentPosition.speed != null && (
          <div className="p-2 bg-surface-2 rounded">
            <div className="flex items-center gap-1 mb-1">
              <FastForward className="w-3 h-3" style={{ color }} />
              <span className="text-xs text-text-tertiary uppercase">Speed</span>
            </div>
            <div className="font-mono text-xs text-text-primary">
              {currentPosition.speed.toFixed(1)} m/s
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// TRAIL CONFIG COMPONENT
// =============================================================================

export interface TrailConfigProps {
  /** Additional class */
  className?: string
}

const TrailConfig: FC<TrailConfigProps> = memo(function TrailConfig({ className }) {
  const { showTrail, toggleTrail, trailLength, setTrailLength, compact } = useTrackHistory()

  return (
    <div className={cn('px-3 py-2 border-t border-border-subtle', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTrail}
            className={cn(
              'p-1.5 rounded transition-colors',
              showTrail
                ? 'bg-accent-primary/10 text-accent-primary'
                : 'bg-surface-2 text-text-tertiary'
            )}
            title={showTrail ? 'Hide trail' : 'Show trail'}
          >
            {showTrail ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <span className={cn(
            'text-text-secondary',
            compact ? 'text-xs' : 'text-sm'
          )}>
            Trail
          </span>
        </div>

        {showTrail && (
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={trailLength}
              onChange={e => setTrailLength(Number(e.target.value))}
              className="w-20 h-1 bg-surface-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary"
            />
            <span className="text-xs text-text-tertiary font-mono w-8 text-right">
              {trailLength}
            </span>
          </div>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const TrackHistoryPlayer = Object.assign(Root, {
  Root,
  Timeline,
  PlaybackControls,
  PositionDisplay,
  TrailConfig,
})

// Named exports
export {
  Root as TrackHistoryPlayerRoot,
  Timeline as TrackHistoryPlayerTimeline,
  PlaybackControls as TrackHistoryPlayerPlaybackControls,
  PositionDisplay as TrackHistoryPlayerPositionDisplay,
  TrailConfig as TrackHistoryPlayerTrailConfig,
}

export default TrackHistoryPlayer
