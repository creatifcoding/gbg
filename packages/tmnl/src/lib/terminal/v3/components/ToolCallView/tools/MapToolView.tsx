/**
 * MapToolView - Specialized view for map-producing tool calls
 *
 * Detects GeoJSON/MapOutput results and provides:
 * - Preview stats (markers, layers, bounds)
 * - "Open in Editor" action to insert MapBlock
 * - Insertion status tracking
 *
 * @module terminal/v3/components/ToolCallView/tools/MapToolView
 */

import { memo, useState, useCallback, useEffect } from 'react'
import { Option } from 'effect'
import { cn } from '@/lib/utils'
import {
  Map,
  MapPin,
  Layers,
  Maximize2,
  CheckCircle2,
  Loader2,
  XCircle,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import { useAtomValue } from '@effect-atom/atom-react'
import type { ToolViewProps } from '../registry'
import { detectMapData, type DetectionContext } from '../detection'
import {
  queueMapTerminal,
  updateInsertionStatusTerminal,
  insertionByIdAtom,
  type InsertionStatus,
} from '../../../atoms'
import { getEditorMapContext } from '@/lib/commands/defaults'
import type { DetectedMapData, MapBounds } from '../../../schemas/map-output'

// =============================================================================
// Subcomponents
// =============================================================================

/**
 * Display bounds info
 */
function BoundsDisplay({ bounds }: { bounds: MapBounds }) {
  return (
    <div className="flex items-center gap-2 text-white/50">
      <Maximize2 size={12} />
      <span className="font-mono text-xs">
        {bounds.south.toFixed(2)}°N - {bounds.north.toFixed(2)}°N,{' '}
        {bounds.west.toFixed(2)}°E - {bounds.east.toFixed(2)}°E
      </span>
    </div>
  )
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: InsertionStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs">
          Queued
        </span>
      )
    case 'inserting':
      return (
        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" />
          Inserting
        </span>
      )
    case 'completed':
      return (
        <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-xs flex items-center gap-1">
          <CheckCircle2 size={10} />
          Inserted
        </span>
      )
    case 'failed':
      return (
        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-xs flex items-center gap-1">
          <XCircle size={10} />
          Failed
        </span>
      )
  }
}

/**
 * Source badge showing how the map was detected
 */
function SourceBadge({ source }: { source: DetectedMapData['source'] }) {
  const info = {
    explicit: { label: 'Tool', color: 'bg-blue-500/20 text-blue-400' },
    schema: { label: 'Schema', color: 'bg-purple-500/20 text-purple-400' },
    detection: { label: 'Auto', color: 'bg-cyan-500/20 text-cyan-400' },
  }[source]

  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs', info.color)}>
      {info.label}
    </span>
  )
}

// =============================================================================
// Main Component
// =============================================================================

function MapToolViewComponent({ call, result, isPending, className }: ToolViewProps) {
  const [insertionId, setInsertionId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Build detection context
  const detectionCtx: DetectionContext = {
    toolName: call.toolName,
    toolCallId: call.toolCallId,
    result: result?.result,
  }

  // Attempt to detect map data
  const detectedOption = result ? detectMapData(detectionCtx) : Option.none()

  // Get insertion status from atom if we've started an insertion
  const insertionAtom = insertionId ? insertionByIdAtom(insertionId) : null
  const insertionOption = useAtomValue(insertionAtom ?? null) ?? Option.none()
  const insertion = Option.isSome(insertionOption) ? insertionOption.value : null

  const hasError = result?.isError
  const isComplete = result && !isPending
  const mapData = Option.isSome(detectedOption) ? detectedOption.value : null

  // Handle "Open in Editor" action
  const handleOpenInEditor = useCallback(() => {
    if (!mapData) return

    setLocalError(null)

    // Check editor availability
    const editorCtx = getEditorMapContext()
    if (!editorCtx?.isAvailable()) {
      // Queue for later
      const insertion = queueMapTerminal(mapData)
      setInsertionId(insertion.id)
      return
    }

    // Queue and immediately try to insert
    const insertion = queueMapTerminal(mapData)
    setInsertionId(insertion.id)

    // Mark as inserting
    updateInsertionStatusTerminal(insertion.id, 'inserting')

    // Focus editor and insert
    editorCtx.focus()

    const success = editorCtx.insertMap({
      markers: mapData.markers?.map((m) => ({
        id: m.id,
        position: m.position,
        label: m.label,
        description: m.description,
        popup: m.popup,
      })),
      layers: mapData.layers?.map((l) => ({
        id: l.id,
        type: l.type,
        data: l.data,
        style: l.style,
      })),
      viewState: mapData.bounds
        ? {
            latitude: (mapData.bounds.north + mapData.bounds.south) / 2,
            longitude: (mapData.bounds.east + mapData.bounds.west) / 2,
            zoom: 10, // Default zoom
          }
        : undefined,
    })

    if (success) {
      updateInsertionStatusTerminal(insertion.id, 'completed')
    } else {
      updateInsertionStatusTerminal(insertion.id, 'failed', 'Insert command failed')
      setLocalError('Failed to insert into editor')
    }
  }, [mapData])

  // If no map data detected, return null (fall through to default view)
  if (!mapData) {
    return null
  }

  const markerCount = mapData.markers?.length ?? 0
  const layerCount = mapData.layers?.length ?? 0
  const hasBounds = mapData.bounds !== undefined

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isPending && 'border-blue-500/30 bg-blue-500/5',
        isComplete && !hasError && 'border-blue-500/20 bg-blue-500/10',
        hasError && 'border-red-500/20 bg-red-500/5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Map size={14} className="text-blue-400" />
          <span className="font-mono text-white/80 text-xs">Map Data</span>
          <SourceBadge source={mapData.source} />
          {insertion && <StatusBadge status={insertion.status} />}
        </div>
        <div className="flex items-center gap-2">
          {isPending && <Loader2 size={12} className="text-blue-400 animate-spin" />}
          {isComplete && !hasError && <CheckCircle2 size={12} className="text-blue-400" />}
          {hasError && <XCircle size={12} className="text-red-400" />}
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-4 text-sm">
          {/* Markers */}
          {markerCount > 0 && (
            <div className="flex items-center gap-1.5 text-white/70">
              <MapPin size={12} className="text-red-400" />
              <span className="text-xs">{markerCount} marker{markerCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          {/* Layers */}
          {layerCount > 0 && (
            <div className="flex items-center gap-1.5 text-white/70">
              <Layers size={12} className="text-purple-400" />
              <span className="text-xs">{layerCount} layer{layerCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          {/* Bounds */}
          {hasBounds && mapData.bounds && <BoundsDisplay bounds={mapData.bounds} />}
        </div>
      </div>

      {/* Title if present */}
      {mapData.title && (
        <div className="px-3 py-2 border-b border-white/5">
          <span className="text-white/80 text-sm">{mapData.title}</span>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2 flex items-center gap-2">
        <button
          onClick={handleOpenInEditor}
          disabled={insertion?.status === 'inserting' || insertion?.status === 'completed'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            insertion?.status === 'completed'
              ? 'bg-green-500/20 text-green-400 cursor-default'
              : insertion?.status === 'inserting'
                ? 'bg-blue-500/20 text-blue-400 cursor-wait'
                : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer'
          )}
        >
          {insertion?.status === 'completed' ? (
            <>
              <CheckCircle2 size={12} />
              Inserted
            </>
          ) : insertion?.status === 'inserting' ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Inserting...
            </>
          ) : (
            <>
              <ExternalLink size={12} />
              Open in Editor
            </>
          )}
        </button>

        {/* Tool name hint */}
        <span className="text-white/30 text-xs font-mono ml-auto">
          {call.toolName}
        </span>
      </div>

      {/* Error display */}
      {(localError || insertion?.error) && (
        <div className="px-3 py-2 border-t border-red-500/20 bg-red-500/5 flex items-center gap-2">
          <AlertCircle size={12} className="text-red-400" />
          <span className="text-red-300 text-xs">{localError || insertion?.error}</span>
        </div>
      )}
    </div>
  )
}

export const MapToolView = memo(MapToolViewComponent)
