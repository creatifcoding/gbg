/**
 * MapToolView - Inline map rendering for map-producing tool calls
 *
 * Detects GeoJSON/MapOutput results and renders:
 * - Inline BaseMap preview (primary experience)
 * - Stats overlay (markers, layers)
 * - Optional "Open in Editor" action
 *
 * @module terminal/v3/components/ToolCallView/tools/MapToolView
 */

import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { Option } from 'effect'
import { Atom } from '@effect-atom/atom'
import { cn } from '@/lib/utils'
import {
  Map as MapIcon,
  MapPin,
  Layers,
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
import type { PendingMapInsertion } from '../../../atoms'
import {
  BaseMap,
  mapRegistry,
  createMapInstanceAtoms,
  disposeInstanceAtoms,
  type MapMarker,
  type MapViewState,
} from '@/lib/primitives/map'

// Stable atom that always returns Option.none() - used when no insertion is active
const emptyInsertionAtom = Atom.make(Option.none<PendingMapInsertion>())

// =============================================================================
// Utilities
// =============================================================================

/**
 * Compute initial viewState from bounds or markers
 */
function computeViewState(mapData: DetectedMapData): MapViewState {
  // If bounds provided, center on them
  if (mapData.bounds) {
    return {
      longitude: (mapData.bounds.east + mapData.bounds.west) / 2,
      latitude: (mapData.bounds.north + mapData.bounds.south) / 2,
      zoom: 10,
      pitch: 0,
      bearing: 0,
    }
  }

  // If markers, compute centroid and auto-zoom
  if (mapData.markers && mapData.markers.length > 0) {
    const lons = mapData.markers.map((m) => m.position[0])
    const lats = mapData.markers.map((m) => m.position[1])
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)

    const centerLon = (minLon + maxLon) / 2
    const centerLat = (minLat + maxLat) / 2

    // Simple zoom calculation based on span
    const lonSpan = maxLon - minLon
    const latSpan = maxLat - minLat
    const maxSpan = Math.max(lonSpan, latSpan)
    let zoom = 12
    if (maxSpan > 10) zoom = 4
    else if (maxSpan > 5) zoom = 6
    else if (maxSpan > 1) zoom = 8
    else if (maxSpan > 0.1) zoom = 10

    return {
      longitude: centerLon,
      latitude: centerLat,
      zoom,
      pitch: 0,
      bearing: 0,
    }
  }

  // Default fallback
  return {
    longitude: -122.4194,
    latitude: 37.7749,
    zoom: 10,
    pitch: 0,
    bearing: 0,
  }
}

/**
 * Convert detected markers to BaseMap format
 */
function convertMarkers(markers: DetectedMapData['markers']): MapMarker[] {
  if (!markers) return []
  return markers.map((m, idx) => ({
    id: m.id ?? `marker-${idx}`,
    position: m.position,
    label: m.label,
    description: m.description,
    popup: m.popup,
    color: [34, 211, 238] as [number, number, number], // Cyan default
  }))
}

// =============================================================================
// Subcomponents
// =============================================================================

function StatusBadge({ status }: { status: InsertionStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs">Queued</span>
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

function SourceBadge({ source }: { source: DetectedMapData['source'] }) {
  const info = {
    explicit: { label: 'Tool', color: 'bg-blue-500/20 text-blue-400' },
    schema: { label: 'Schema', color: 'bg-purple-500/20 text-purple-400' },
    detection: { label: 'Auto', color: 'bg-cyan-500/20 text-cyan-400' },
  }[source]

  return <span className={cn('px-1.5 py-0.5 rounded text-xs', info.color)}>{info.label}</span>
}

/**
 * Stats overlay for the map
 */
function MapOverlay({
  markerCount,
  layerCount,
  title,
}: {
  markerCount: number
  layerCount: number
  title?: string
}) {
  return (
    <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
      {/* Left: Title + stats */}
      <div className="flex flex-col gap-1">
        {title && (
          <div className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
            <span className="text-white/90 text-xs font-medium">{title}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {markerCount > 0 && (
            <div className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm flex items-center gap-1.5">
              <MapPin size={10} className="text-cyan-400" />
              <span className="text-white/80 text-xs">
                {markerCount} marker{markerCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {layerCount > 0 && (
            <div className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm flex items-center gap-1.5">
              <Layers size={10} className="text-purple-400" />
              <span className="text-white/80 text-xs">
                {layerCount} layer{layerCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

function MapToolViewComponent({ call, result, isPending, className }: ToolViewProps) {
  const [insertionId, setInsertionId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Generate stable instance ID for this tool call
  const instanceId = useMemo(() => `maptool-${call.toolCallId}`, [call.toolCallId])

  // Build detection context
  const detectionCtx: DetectionContext = {
    toolName: call.toolName,
    toolCallId: call.toolCallId,
    result: result?.result,
  }

  // Attempt to detect map data
  const detectedOption = result ? detectMapData(detectionCtx) : Option.none()
  const mapData = Option.isSome(detectedOption) ? detectedOption.value : null

  // Get insertion status from atom if we've started an insertion
  const insertionAtom = useMemo(
    () => (insertionId ? insertionByIdAtom(insertionId) : emptyInsertionAtom),
    [insertionId]
  )
  const insertionOption = useAtomValue(insertionAtom)
  const insertion = Option.isSome(insertionOption) ? insertionOption.value : null

  // Create BaseMap atoms and initialize with detected data
  const baseMapAtoms = useMemo(() => createMapInstanceAtoms(instanceId), [instanceId])

  // Initialize atoms when mapData becomes available
  useEffect(() => {
    if (!mapData) return

    const viewState = computeViewState(mapData)
    const markers = convertMarkers(mapData.markers)

    mapRegistry.set(baseMapAtoms.viewStateAtom, viewState)
    mapRegistry.set(baseMapAtoms.markersAtom, markers)
  }, [mapData, baseMapAtoms])

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeInstanceAtoms(instanceId)
  }, [instanceId])

  const hasError = result?.isError
  const isComplete = result && !isPending

  // Handle "Open in Editor" action
  const handleOpenInEditor = useCallback(() => {
    if (!mapData) return

    setLocalError(null)

    // Check editor availability
    const editorCtx = getEditorMapContext()
    if (!editorCtx?.isAvailable()) {
      const insertion = queueMapTerminal(mapData)
      setInsertionId(insertion.id)
      return
    }

    // Queue and immediately try to insert
    const insertion = queueMapTerminal(mapData)
    setInsertionId(insertion.id)
    updateInsertionStatusTerminal(insertion.id, 'inserting')

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
      viewState: computeViewState(mapData),
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

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-colors',
        isPending && 'border-blue-500/30 bg-blue-500/5',
        isComplete && !hasError && 'border-blue-500/20 bg-blue-500/10',
        hasError && 'border-red-500/20 bg-red-500/5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <MapIcon size={14} className="text-blue-400" />
          <span className="font-mono text-white/80 text-xs">Map</span>
          <SourceBadge source={mapData.source} />
          {insertion && <StatusBadge status={insertion.status} />}
        </div>
        <div className="flex items-center gap-2">
          {isPending && <Loader2 size={12} className="text-blue-400 animate-spin" />}
          {isComplete && !hasError && <CheckCircle2 size={12} className="text-blue-400" />}
          {hasError && <XCircle size={12} className="text-red-400" />}
        </div>
      </div>

      {/* Inline Map Preview */}
      <div className="relative" style={{ height: 280 }}>
        <BaseMap
          instanceId={instanceId}
          height={280}
          interactive={true}
          debug={import.meta.env.DEV}
          renderOverlay={() => (
            <MapOverlay markerCount={markerCount} layerCount={layerCount} title={mapData.title} />
          )}
        />
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-white/5 flex items-center gap-2">
        <button
          onClick={handleOpenInEditor}
          disabled={insertion?.status === 'inserting' || insertion?.status === 'completed'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            insertion?.status === 'completed'
              ? 'bg-green-500/20 text-green-400 cursor-default'
              : insertion?.status === 'inserting'
              ? 'bg-blue-500/20 text-blue-400 cursor-wait'
              : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 cursor-pointer'
          )}
        >
          {insertion?.status === 'completed' ? (
            <>
              <CheckCircle2 size={12} />
              In Editor
            </>
          ) : insertion?.status === 'inserting' ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Inserting...
            </>
          ) : (
            <>
              <ExternalLink size={12} />
              Copy to Editor
            </>
          )}
        </button>

        <span className="text-white/30 text-xs font-mono ml-auto">{call.toolName}</span>
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
