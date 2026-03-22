/**
 * TimelineMapBridge - Bidirectional sync between TimelinePanel and map filters
 *
 * Bridges the TimelinePanel compound component with the geoint atom state,
 * enabling temporal filtering of map results based on timeline selection.
 *
 * Features:
 * - Syncs TimelinePanel range to activeFiltersAtom.customTimeRange
 * - Syncs playhead position to a playhead atom for map visualization
 * - Supports both controlled and uncontrolled modes
 * - Provides aggregation data from filtered results
 *
 * @module geoint/components/TimelineMapBridge
 */

import { FC, useCallback, useEffect, useMemo, memo, type ReactNode } from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  TimelinePanel,
  timelineRangeAtom,
  timelinePlayheadAtom,
  type TimelineRange,
} from './TimelinePanel'
import {
  geointRegistry,
  activeFiltersAtom,
  filteredResultsAtom,
  setCustomTimeRange,
  type TimeRange,
} from '../atoms'

// =============================================================================
// TYPES
// =============================================================================

export interface TimelineMapBridgeProps {
  /** Children (typically TimelinePanel subcomponents) */
  children: ReactNode
  /** Initial time range override */
  initialRange?: TimelineRange
  /** Sync mode: 'bidirectional' syncs both ways, 'timeline-to-map' only updates map from timeline */
  syncMode?: 'bidirectional' | 'timeline-to-map'
  /** Additional className */
  className?: string
  /** Callback when temporal filter is applied */
  onTemporalFilterApply?: (range: TimelineRange) => void
}

export interface AggregationBucket {
  time: Date
  count: number
}

// =============================================================================
// ATOMS
// =============================================================================

/** Current playhead position for map visualization (e.g., time cursor overlay) */
export const mapPlayheadAtom = Atom.make<Date | null>(null)

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Generate aggregation data from filtered results for timeline visualization.
 */
function useResultAggregation(bucketCount: number = 24): readonly AggregationBucket[] {
  const results = useAtomValue(filteredResultsAtom)
  const filters = useAtomValue(activeFiltersAtom)

  return useMemo(() => {
    // Get time range for aggregation
    const now = new Date()
    let start: Date
    let end: Date = now

    if (filters.temporalFilter === 'custom' && filters.customTimeRange) {
      start = filters.customTimeRange.start
      end = filters.customTimeRange.end
    } else if (filters.temporalFilter === 'lastHour') {
      start = new Date(now.getTime() - 60 * 60 * 1000)
    } else if (filters.temporalFilter === 'last24h') {
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    } else {
      // Live mode: default to last 24h for visualization
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    const totalMs = end.getTime() - start.getTime()
    const bucketMs = totalMs / bucketCount

    // Initialize buckets
    const buckets: AggregationBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
      time: new Date(start.getTime() + bucketMs * i),
      count: 0,
    }))

    // Aggregate results into buckets
    for (const result of results) {
      const timestamp = result.retrievedAt.getTime()
      if (timestamp >= start.getTime() && timestamp <= end.getTime()) {
        const bucketIndex = Math.min(
          bucketCount - 1,
          Math.floor((timestamp - start.getTime()) / bucketMs)
        )
        buckets[bucketIndex].count++
      }
    }

    return buckets
  }, [results, filters.temporalFilter, filters.customTimeRange, bucketCount])
}

/**
 * Hook to get current timeline filters.
 */
export function useTimelineFilters() {
  const filters = useAtomValue(activeFiltersAtom)
  return {
    temporalFilter: filters.temporalFilter,
    customTimeRange: filters.customTimeRange,
  }
}

/**
 * Hook to get map playhead position.
 */
export function useMapPlayhead(): Date | null {
  return useAtomValue(mapPlayheadAtom)
}

// =============================================================================
// BRIDGE COMPONENT
// =============================================================================

/**
 * TimelineMapBridge - Connects TimelinePanel to geoint temporal filtering.
 *
 * Usage:
 * ```tsx
 * <GeointRegistryProvider>
 *   <TimelineMapBridge>
 *     <TimelinePanel.PlaybackControls />
 *     <TimelinePanel.BrushSelector />
 *     <TimelinePanel.RangeDisplay />
 *   </TimelineMapBridge>
 * </GeointRegistryProvider>
 * ```
 */
export const TimelineMapBridge: FC<TimelineMapBridgeProps> = memo(function TimelineMapBridge({
  children,
  initialRange,
  syncMode = 'bidirectional',
  className,
  onTemporalFilterApply,
}) {
  // Get current filter state
  const filters = useAtomValue(activeFiltersAtom)

  // Derive controlled range from filters (for bidirectional sync)
  const controlledRange = useMemo((): TimelineRange | undefined => {
    if (syncMode === 'bidirectional' && filters.customTimeRange) {
      return {
        start: filters.customTimeRange.start,
        end: filters.customTimeRange.end,
      }
    }
    return undefined
  }, [syncMode, filters.customTimeRange])

  // Handle range change from timeline
  const handleRangeChange = useCallback((range: TimelineRange) => {
    // Update geoint filter atoms
    const timeRange: TimeRange = {
      start: range.start,
      end: range.end,
    }
    setCustomTimeRange(timeRange)

    // Also update timeline atoms for sync
    geointRegistry.set(timelineRangeAtom, range)

    // Notify callback
    onTemporalFilterApply?.(range)
  }, [onTemporalFilterApply])

  // Handle playhead change - update map playhead atom
  const handlePlayheadChange = useCallback((time: Date) => {
    geointRegistry.set(mapPlayheadAtom, time)
    geointRegistry.set(timelinePlayheadAtom, time)
  }, [])

  // Sync initial range on mount
  useEffect(() => {
    if (initialRange) {
      handleRangeChange(initialRange)
    }
  }, []) // Only on mount

  return (
    <TimelinePanel.Root
      initialRange={initialRange}
      range={controlledRange}
      onRangeChange={handleRangeChange}
      onPlayheadChange={handlePlayheadChange}
      className={className}
    >
      {children}
    </TimelinePanel.Root>
  )
})

// =============================================================================
// INTEGRATED TIMELINE COMPONENT
// =============================================================================

export interface IntegratedTimelineBarProps {
  /** Show playback controls */
  showPlayback?: boolean
  /** Show brush selector */
  showBrush?: boolean
  /** Show preset selector */
  showPresets?: boolean
  /** Show range display */
  showRange?: boolean
  /** Show status indicator */
  showStatus?: boolean
  /** Show aggregation bars in brush */
  showAggregation?: boolean
  /** Compact mode */
  compact?: boolean
  /** Additional className */
  className?: string
}

/**
 * IntegratedTimelineBar - Pre-composed timeline with map sync.
 *
 * Usage:
 * ```tsx
 * <GeointRegistryProvider>
 *   <IntegratedTimelineBar
 *     showPlayback
 *     showBrush
 *     showPresets
 *   />
 * </GeointRegistryProvider>
 * ```
 */
export const IntegratedTimelineBar: FC<IntegratedTimelineBarProps> = memo(
  function IntegratedTimelineBar({
    showPlayback = true,
    showBrush = true,
    showPresets = true,
    showRange = true,
    showStatus = false,
    showAggregation = true,
    compact = false,
    className,
  }) {
    const aggregationData = useResultAggregation()

    return (
      <TimelineMapBridge className={className}>
        {/* Top row: Presets + Range display */}
        {(showPresets || showRange) && (
          <div className="flex items-center justify-between gap-4">
            {showPresets && <TimelinePanel.PresetSelector />}
            {showRange && <TimelinePanel.RangeDisplay format={compact ? 'short' : 'medium'} />}
          </div>
        )}

        {/* Brush selector */}
        {showBrush && (
          <TimelinePanel.BrushSelector
            height={compact ? 36 : 48}
            showAggregation={showAggregation}
            aggregationData={showAggregation ? aggregationData : undefined}
          />
        )}

        {/* Bottom row: Playback controls + Status */}
        {(showPlayback || showStatus) && (
          <div className="flex items-center justify-between gap-4">
            {showPlayback && (
              <TimelinePanel.PlaybackControls
                compact={compact}
                showSpeed={!compact}
              />
            )}
            {showStatus && <TimelinePanel.StatusIndicator />}
          </div>
        )}
      </TimelineMapBridge>
    )
  }
)

// =============================================================================
// EXPORTS
// =============================================================================

export default TimelineMapBridge
