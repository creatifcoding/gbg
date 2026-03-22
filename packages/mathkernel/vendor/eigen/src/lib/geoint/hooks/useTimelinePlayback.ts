/**
 * useTimelinePlayback Hook
 *
 * Connects TimelineControlsV2 to the GEOINT filtering system.
 * Manages playhead position, range detection, and entity filtering.
 *
 * USAGE:
 * ```tsx
 * function TimelineDrawer() {
 *   const timeline = useTimelinePlayback()
 *
 *   if (!timeline.hasTemporalData) return null
 *
 *   return (
 *     <TimelineControlsV2
 *       initialRange={timeline.detectedRange}
 *       onPlayheadChange={timeline.setPlayhead}
 *       onPlaybackChange={timeline.setPlaying}
 *       onRangeChange={timeline.setRange}
 *     >
 *       <TimelineControlsV2.PlaybackButtons />
 *       <TimelineControlsV2.Scrubber />
 *       <TimelineControlsV2.SpeedControl />
 *     </TimelineControlsV2>
 *   )
 * }
 * ```
 *
 * @module geoint/hooks/useTimelinePlayback
 */

import { useCallback, useMemo, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  resultsAtom,
  timelinePlaybackAtom,
  timelineFilteredResultsAtom,
  setTimelineEnabled,
  setTimelinePlayhead,
  setTimelineRange,
  setTimelineWindow,
  initTimelineFromResults,
  geointRegistry,
  type TimeRange,
} from '../atoms'
import type { TimelineRange } from '../machines/timelineMachine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTimelinePlaybackResult {
  /** Is timeline playback mode enabled */
  readonly enabled: boolean
  /** Current playhead position */
  readonly playhead: Date
  /** Visible time range */
  readonly range: TimeRange
  /** Window size (entities within this window of playhead are visible) */
  readonly windowMs: number
  /** Is currently playing (for display purposes) */
  readonly isPlaying: boolean

  /** Does the current result set have temporal data? */
  readonly hasTemporalData: boolean
  /** Auto-detected range from results (for initializing timeline) */
  readonly detectedRange: TimelineRange | null
  /** Filtered results count (when timeline enabled) */
  readonly filteredCount: number
  /** Total results count (for comparison) */
  readonly totalCount: number

  // Actions
  /** Set playhead position (call from onPlayheadChange) */
  readonly setPlayhead: (time: Date) => void
  /** Set playback range (call from onRangeChange) */
  readonly setRange: (range: TimelineRange) => void
  /** Set playing state */
  readonly setPlaying: (playing: boolean) => void
  /** Set window size */
  readonly setWindow: (windowMs: number) => void
  /** Enable timeline mode */
  readonly enable: () => void
  /** Disable timeline mode */
  readonly disable: () => void
  /** Toggle timeline mode */
  readonly toggle: () => void
  /** Initialize timeline from current results */
  readonly initFromResults: () => void
}

export interface UseTimelinePlaybackOptions {
  /**
   * Auto-initialize timeline when results change.
   * @default true
   */
  readonly autoInit?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for timeline playback state management.
 *
 * Connects TimelineControlsV2 UI to the GEOINT filtering system:
 * - Auto-detects time range from search results
 * - Provides callbacks for UI events
 * - Filters results based on playhead position
 */
export function useTimelinePlayback(
  options?: UseTimelinePlaybackOptions
): UseTimelinePlaybackResult {
  const { autoInit = true } = options ?? {}

  const results = useAtomValue(resultsAtom)
  const state = useAtomValue(timelinePlaybackAtom)
  const filteredResults = useAtomValue(timelineFilteredResultsAtom)

  // Detect time range from results
  const detectedRange = useMemo((): TimelineRange | null => {
    if (results.length === 0) return null

    let minTime = Infinity
    let maxTime = -Infinity

    for (const r of results) {
      const timestamp = r.retrievedAt.getTime()
      if (timestamp < minTime) minTime = timestamp
      if (timestamp > maxTime) maxTime = timestamp
    }

    if (minTime === Infinity || maxTime === -Infinity) return null

    // No range if all timestamps are the same
    if (maxTime - minTime < 1000) return null

    // Add 10% padding
    const padding = (maxTime - minTime) * 0.1 || 60 * 60 * 1000
    return {
      start: new Date(minTime - padding),
      end: new Date(maxTime + padding),
    }
  }, [results])

  const hasTemporalData = detectedRange !== null

  // Auto-initialize when results change
  useEffect(() => {
    if (autoInit && hasTemporalData && results.length > 0) {
      // Only auto-init if not already enabled
      const current = geointRegistry.get(timelinePlaybackAtom)
      if (!current.enabled) {
        initTimelineFromResults()
      }
    }
  }, [autoInit, hasTemporalData, results.length])

  // Actions
  const setPlayhead = useCallback((time: Date) => {
    setTimelinePlayhead(time)
  }, [])

  const setRange = useCallback((range: TimelineRange) => {
    setTimelineRange(range)
  }, [])

  const setPlaying = useCallback((playing: boolean) => {
    const current = geointRegistry.get(timelinePlaybackAtom)
    geointRegistry.set(timelinePlaybackAtom, {
      ...current,
      isPlaying: playing,
    })
  }, [])

  const setWindow = useCallback((windowMs: number) => {
    setTimelineWindow(windowMs)
  }, [])

  const enable = useCallback(() => {
    setTimelineEnabled(true)
  }, [])

  const disable = useCallback(() => {
    setTimelineEnabled(false)
  }, [])

  const toggle = useCallback(() => {
    const current = geointRegistry.get(timelinePlaybackAtom)
    setTimelineEnabled(!current.enabled)
  }, [])

  const initFromResults = useCallback(() => {
    initTimelineFromResults()
  }, [])

  return useMemo(
    () => ({
      // State
      enabled: state.enabled,
      playhead: state.playhead,
      range: state.range,
      windowMs: state.windowMs,
      isPlaying: state.isPlaying,

      // Computed
      hasTemporalData,
      detectedRange,
      filteredCount: filteredResults.length,
      totalCount: results.length,

      // Actions
      setPlayhead,
      setRange,
      setPlaying,
      setWindow,
      enable,
      disable,
      toggle,
      initFromResults,
    }),
    [
      state,
      hasTemporalData,
      detectedRange,
      filteredResults.length,
      results.length,
      setPlayhead,
      setRange,
      setPlaying,
      setWindow,
      enable,
      disable,
      toggle,
      initFromResults,
    ]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for timeline enabled state only.
 */
export function useTimelinePlaybackEnabled(): boolean {
  const state = useAtomValue(timelinePlaybackAtom)
  return state.enabled
}

/**
 * Hook for timeline playhead only.
 */
export function useTimelinePlayhead(): Date {
  const state = useAtomValue(timelinePlaybackAtom)
  return state.playhead
}

/**
 * Hook for timeline-filtered results only.
 */
export function useTimelineFilteredResults() {
  return useAtomValue(timelineFilteredResultsAtom)
}

export default useTimelinePlayback
