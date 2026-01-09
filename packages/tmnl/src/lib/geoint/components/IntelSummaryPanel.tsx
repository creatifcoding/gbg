/**
 * IntelSummaryPanel - Intelligence summary statistics panel
 *
 * Displays track counts, threat levels, and classification breakdowns.
 * Designed for GEOINT dashboards and operational displays.
 *
 * @see .cursor/prd/features.md F005 (Track Classification)
 * @module
 */

import { memo, useMemo } from 'react'
import { AlertTriangle, Radio, Target, Shield, HelpCircle } from 'lucide-react'
import type { Track, ThreatVolume } from '../schemas'
import { classificationColors } from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface IntelSummaryPanelProps {
  /** Tracks to summarize */
  tracks: readonly Track[]

  /** Threat volumes to display */
  threats?: readonly ThreatVolume[]

  /** Show header */
  showHeader?: boolean

  /** Compact mode */
  compact?: boolean

  /** Additional CSS class */
  className?: string

  /** Track click handler */
  onTrackClick?: (track: Track) => void

  /** Selected track ID */
  selectedTrackId?: string
}

interface ClassificationCount {
  friendly: number
  hostile: number
  neutral: number
  unknown: number
}

interface ThreatCount {
  critical: number
  high: number
  medium: number
  low: number
}

// =============================================================================
// Utility Functions
// =============================================================================

function countClassifications(tracks: readonly Track[]): ClassificationCount {
  return tracks.reduce(
    (acc, track) => {
      const classification = track.metadata.classification ?? 'unknown'
      acc[classification]++
      return acc
    },
    { friendly: 0, hostile: 0, neutral: 0, unknown: 0 } as ClassificationCount
  )
}

function countThreatLevels(threats: readonly ThreatVolume[]): ThreatCount {
  return threats.reduce(
    (acc, threat) => {
      acc[threat.level]++
      return acc
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as ThreatCount
  )
}

// =============================================================================
// Stat Card Component
// =============================================================================

interface StatCardProps {
  label: string
  value: number
  color: string
  icon?: React.ReactNode
  compact?: boolean
}

function StatCard({ label, value, color, icon, compact = false }: StatCardProps) {
  return (
    <div
      className={`flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/50 ${
        compact ? 'px-2 py-1' : 'px-3 py-2'
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && <span style={{ color }}>{icon}</span>}
        <span className={`text-neutral-400 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
      </div>
      <span
        className={`font-mono font-semibold ${compact ? 'text-sm' : 'text-base'}`}
        style={{ color }}
      >
        {value}
      </span>
    </div>
  )
}

// =============================================================================
// Track List Item
// =============================================================================

interface TrackListItemProps {
  track: Track
  isSelected: boolean
  onClick?: () => void
  compact?: boolean
}

function TrackListItem({ track, isSelected, onClick, compact = false }: TrackListItemProps) {
  const classification = track.metadata.classification ?? 'unknown'
  const color = classificationColors[classification]
  const colorRgb = `rgb(${color.join(',')})`

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded border transition-all ${
        compact ? 'p-2' : 'p-3'
      } ${
        isSelected
          ? 'bg-white/10 border-white/30'
          : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`rounded-full ${compact ? 'w-2 h-2' : 'w-3 h-3'}`}
          style={{ backgroundColor: colorRgb }}
        />
        <span className={`font-mono ${compact ? 'text-xs' : 'text-sm'}`}>{track.trackId}</span>
      </div>
      <div className={`text-neutral-500 mt-1 ${compact ? 'text-xs' : 'text-xs'}`}>
        {classification.toUpperCase()} • {track.metadata.source} •{' '}
        {((track.metadata.confidence ?? 0) * 100).toFixed(0)}%
      </div>
    </button>
  )
}

// =============================================================================
// Threat List Item
// =============================================================================

interface ThreatListItemProps {
  threat: ThreatVolume
  compact?: boolean
}

function ThreatListItem({ threat, compact = false }: ThreatListItemProps) {
  const levelColors = {
    critical: 'text-red-500',
    high: 'text-orange-500',
    medium: 'text-yellow-500',
    low: 'text-green-500',
  }

  return (
    <div
      className={`rounded border border-neutral-800 bg-neutral-900/50 ${compact ? 'p-2' : 'p-3'}`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${levelColors[threat.level]}`} />
        <span className={`font-mono uppercase ${compact ? 'text-xs' : 'text-sm'}`}>
          {threat.level}
        </span>
        {threat.trackId && (
          <span className={`text-neutral-500 ${compact ? 'text-xs' : 'text-xs'}`}>
            ({threat.trackId})
          </span>
        )}
      </div>
      <div className={`text-neutral-500 mt-1 ${compact ? 'text-xs' : 'text-xs'}`}>
        R: {threat.radius}m • H: {threat.height}m • {((threat.confidence ?? 0) * 100).toFixed(0)}%
      </div>
    </div>
  )
}

// =============================================================================
// IntelSummaryPanel
// =============================================================================

function IntelSummaryPanelComponent({
  tracks,
  threats = [],
  showHeader = true,
  compact = false,
  className = '',
  onTrackClick,
  selectedTrackId,
}: IntelSummaryPanelProps) {
  // Calculate summaries
  const classificationCounts = useMemo(() => countClassifications(tracks), [tracks])
  const threatCounts = useMemo(() => countThreatLevels(threats), [threats])

  const iconSize = compact ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-sm text-white">INTEL SUMMARY</span>
        </div>
      )}

      {/* Track Classification Stats */}
      <div className="space-y-2">
        <div className="text-xs text-neutral-500 uppercase tracking-wider">
          Classification ({tracks.length})
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Friendly"
            value={classificationCounts.friendly}
            color={`rgb(${classificationColors.friendly.join(',')})`}
            icon={<Shield className={iconSize} />}
            compact={compact}
          />
          <StatCard
            label="Hostile"
            value={classificationCounts.hostile}
            color={`rgb(${classificationColors.hostile.join(',')})`}
            icon={<Target className={iconSize} />}
            compact={compact}
          />
          <StatCard
            label="Neutral"
            value={classificationCounts.neutral}
            color={`rgb(${classificationColors.neutral.join(',')})`}
            icon={<Radio className={iconSize} />}
            compact={compact}
          />
          <StatCard
            label="Unknown"
            value={classificationCounts.unknown}
            color={`rgb(${classificationColors.unknown.join(',')})`}
            icon={<HelpCircle className={iconSize} />}
            compact={compact}
          />
        </div>
      </div>

      {/* Threat Level Stats */}
      {threats.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-neutral-500 uppercase tracking-wider">
            Threat Volumes ({threats.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Critical"
              value={threatCounts.critical}
              color="#ef4444"
              icon={<AlertTriangle className={iconSize} />}
              compact={compact}
            />
            <StatCard
              label="High"
              value={threatCounts.high}
              color="#f97316"
              icon={<AlertTriangle className={iconSize} />}
              compact={compact}
            />
            <StatCard
              label="Medium"
              value={threatCounts.medium}
              color="#eab308"
              icon={<AlertTriangle className={iconSize} />}
              compact={compact}
            />
            <StatCard
              label="Low"
              value={threatCounts.low}
              color="#22c55e"
              icon={<AlertTriangle className={iconSize} />}
              compact={compact}
            />
          </div>
        </div>
      )}

      {/* Track List */}
      {tracks.length > 0 && onTrackClick && (
        <div className="space-y-2">
          <div className="text-xs text-neutral-500 uppercase tracking-wider">Active Tracks</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tracks.map((track) => (
              <TrackListItem
                key={track.trackId}
                track={track}
                isSelected={selectedTrackId === track.trackId}
                onClick={() => onTrackClick(track)}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Threat List */}
      {threats.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-neutral-500 uppercase tracking-wider">Threat Details</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {threats.map((threat, idx) => (
              <ThreatListItem key={idx} threat={threat} compact={compact} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const IntelSummaryPanel = memo(IntelSummaryPanelComponent)
export default IntelSummaryPanel
