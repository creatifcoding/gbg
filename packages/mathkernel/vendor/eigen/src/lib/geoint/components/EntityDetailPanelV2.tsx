/**
 * EntityDetailPanelV2 - Kori-Integrated Entity Detail Panel
 *
 * Bridges the Kori entity selection system with EntityDetailCard.
 * Automatically displays the currently selected entity from search results.
 *
 * Features:
 * - Auto-syncs with Kori selection state
 * - Multi-entity tabs when multiple selected
 * - Smooth transitions between entities
 * - Integration with useGeointEntity for per-entity state
 *
 * @module geoint/components/EntityDetailPanelV2
 */

import {
  memo,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type FC,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { animate } from 'animejs'
import { cn } from '@/lib/utils'
import { X, ChevronRight, Pin, PinOff, Eye, EyeOff } from 'lucide-react'
import { EntityDetailCard, type DetailTab } from './EntityDetailCard'
import {
  useGeointSelection,
  useGeointEntity,
} from '../hooks'
import { resultsAtom } from '../atoms'
import { searchResultToEntity } from '../cards/registry'
import { SOURCE_COLORS, TIMING, EASING } from '../tokens'
import type { SearchResultItem, IntelSource } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export interface EntityDetailPanelV2Props {
  /** Initial tab to display */
  initialTab?: DetailTab
  /** Show close button */
  showClose?: boolean
  /** Close handler */
  onClose?: () => void
  /** Compact mode */
  compact?: boolean
  /** Additional class */
  className?: string
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate entity ID from search result (matches Kori bridge pattern).
 */
function getEntityIdFromResult(result: SearchResultItem): string {
  switch (result._tag) {
    case 'SearchResultFlight':
      return `flight:${result.icao24}`
    case 'SearchResultPoi':
      return `poi:${result.poiId}`
    case 'SearchResultWeather':
      return `weather:${result.locationName}`
    case 'SearchResultTrack':
      return `track:${result.trackId}`
    case 'SearchResultImagery':
      return `imagery:${result.itemId}`
    case 'SearchResultFeature':
      return `feature:${result.featureId}`
    default:
      // Fallback for unknown types
      return `unknown:${Date.now()}`
  }
}

// =============================================================================
// ENTITY TAB BUTTON
// =============================================================================

interface EntityTabButtonProps {
  result: SearchResultItem
  entityId: string
  isActive: boolean
  onClick: () => void
  onClose: () => void
}

const EntityTabButton: FC<EntityTabButtonProps> = memo(function EntityTabButton({
  result,
  entityId,
  isActive,
  onClick,
  onClose,
}) {
  const entity = useGeointEntity(entityId)

  // Get label from result
  const label = useMemo(() => {
    switch (result._tag) {
      case 'SearchResultFlight':
        return result.callsign || result.icao24
      case 'SearchResultPoi':
        return result.name || result.poiId
      case 'SearchResultWeather':
        return result.locationName
      case 'SearchResultTrack':
        return result.label || result.trackId
      case 'SearchResultImagery':
        return result.label || result.itemId
      case 'SearchResultFeature':
        return result.label || result.featureId
      default:
        return entityId
    }
  }, [result, entityId])

  const sourceColor = SOURCE_COLORS[result.source as IntelSource]?.primary ?? '#6b7280'

  return (
    <button
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-xs font-mono',
        'border-b-2 transition-colors',
        isActive
          ? 'border-accent-primary text-text-primary bg-surface-2'
          : 'border-transparent text-text-tertiary hover:text-text-secondary hover:bg-surface-2/50'
      )}
      onClick={onClick}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: sourceColor }}
      />
      <span className="truncate max-w-[100px]">{label}</span>
      {entity.isPinned && (
        <Pin className="w-3 h-3 text-accent-primary flex-shrink-0" />
      )}
      <button
        className="p-0.5 hover:bg-surface-3 rounded flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          entity.deselect()
          onClose()
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </button>
  )
})

// =============================================================================
// QUICK ACTIONS BAR
// =============================================================================

interface QuickActionsProps {
  entityId: string
}

const QuickActions: FC<QuickActionsProps> = memo(function QuickActions({ entityId }) {
  const entity = useGeointEntity(entityId)

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border-subtle bg-surface-0/50">
      <button
        onClick={entity.isPinned ? entity.unpin : entity.pin}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
          entity.isPinned
            ? 'bg-accent-primary/20 text-accent-primary'
            : 'text-text-tertiary hover:bg-surface-2'
        )}
        title={entity.isPinned ? 'Unpin' : 'Pin'}
      >
        {entity.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        <span>{entity.isPinned ? 'Unpin' : 'Pin'}</span>
      </button>

      <button
        onClick={entity.isSelected ? entity.deselect : entity.select}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
          entity.isSelected
            ? 'bg-blue-500/20 text-blue-400'
            : 'text-text-tertiary hover:bg-surface-2'
        )}
        title={entity.isSelected ? 'Deselect' : 'Select'}
      >
        {entity.isSelected ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
    </div>
  )
})

// =============================================================================
// EMPTY STATE
// =============================================================================

const EmptyState: FC = memo(function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-text-tertiary p-8">
      <ChevronRight className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-sm text-center">
        Select an entity from the search results or map to view details
      </p>
      <p className="text-xs mt-2 text-text-tertiary/70">
        Shift+Click to multi-select
      </p>
    </div>
  )
})

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * EntityDetailPanelV2 - Kori-integrated entity detail panel.
 *
 * Automatically displays the currently selected entity(ies) from search results,
 * using the Kori selection system for state management.
 *
 * @example
 * ```tsx
 * <GeointShell>
 *   <SearchPanel />
 *   <EntityDetailPanelV2 />
 *   <Map />
 * </GeointShell>
 * ```
 */
export const EntityDetailPanelV2: FC<EntityDetailPanelV2Props> = memo(function EntityDetailPanelV2({
  initialTab = 'overview',
  showClose = true,
  onClose,
  compact = false,
  className,
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const prevSelectedCountRef = useRef(0)

  // Get selection state from Kori
  const selection = useGeointSelection()

  // Get all search results to map IDs back to data
  const results = useAtomValue(resultsAtom)

  // Map selected entity IDs to their corresponding search results
  const selectedEntities = useMemo(() => {
    const entityMap = new Map<string, SearchResultItem>()

    // Build ID->result map from all results
    for (const result of results) {
      const id = getEntityIdFromResult(result)
      entityMap.set(id, result)
    }

    // Get results for selected IDs
    return selection.selectedIds
      .map((id) => {
        const result = entityMap.get(id)
        return result ? { id, result } : null
      })
      .filter((e): e is { id: string; result: SearchResultItem } => e !== null)
  }, [selection.selectedIds, results])

  // Track active tab index for multi-entity view
  const [activeEntityIndex, setActiveEntityIndex] = React.useState(0)

  // Clamp active index when selection changes
  useEffect(() => {
    if (activeEntityIndex >= selectedEntities.length) {
      setActiveEntityIndex(Math.max(0, selectedEntities.length - 1))
    }
  }, [selectedEntities.length, activeEntityIndex])

  // Animate when selection count changes
  useEffect(() => {
    if (
      containerRef.current &&
      selectedEntities.length !== prevSelectedCountRef.current
    ) {
      const growing = selectedEntities.length > prevSelectedCountRef.current

      animate(containerRef.current, {
        scale: growing ? [0.98, 1] : [1.02, 1],
        opacity: [0.9, 1],
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })

      prevSelectedCountRef.current = selectedEntities.length
    }
  }, [selectedEntities.length])

  // Get current active entity
  const activeEntity = selectedEntities[activeEntityIndex]

  // Convert to ComposedEntity for EntityDetailCard
  const composedEntity = useMemo(() => {
    if (!activeEntity) return null
    return searchResultToEntity(activeEntity.result)
  }, [activeEntity])

  // Handle entity close
  const handleEntityClose = useCallback(
    (entityId: string) => {
      // The entity is already deselected by the tab button click handler
      // Just update the active index if needed
      const index = selectedEntities.findIndex((e) => e.id === entityId)
      if (index === activeEntityIndex && selectedEntities.length > 1) {
        setActiveEntityIndex(Math.max(0, index - 1))
      }
    },
    [selectedEntities, activeEntityIndex]
  )

  // Handle panel close
  const handleClose = useCallback(() => {
    selection.clearSelection()
    onClose?.()
  }, [selection, onClose])

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
        'min-w-[320px] max-w-[480px]',
        className
      )}
    >
      {/* Header with tabs when multiple selected */}
      {selectedEntities.length > 1 && (
        <div className="flex items-center justify-between bg-surface-0 border-b border-border-subtle">
          <div className="flex overflow-x-auto">
            {selectedEntities.map((entity, i) => (
              <EntityTabButton
                key={entity.id}
                result={entity.result}
                entityId={entity.id}
                isActive={i === activeEntityIndex}
                onClick={() => setActiveEntityIndex(i)}
                onClose={() => handleEntityClose(entity.id)}
              />
            ))}
          </div>
          <span className="px-2 text-xs text-text-tertiary font-mono">
            {selectedEntities.length} selected
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {composedEntity ? (
          <EntityDetailCard
            entity={composedEntity}
            initialTab={initialTab}
            onClose={selectedEntities.length === 1 && showClose ? handleClose : undefined}
            compact={compact}
          >
            <EntityDetailCard.Header showExpand={!compact} />
            <EntityDetailCard.TabNav />
            <EntityDetailCard.Overview showMinimap={!compact} />
            <EntityDetailCard.History />
            <EntityDetailCard.Relations />
            <EntityDetailCard.RawData />
            <EntityDetailCard.ActionBar />
          </EntityDetailCard>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Quick actions for current entity */}
      {activeEntity && (
        <QuickActions entityId={activeEntity.id} />
      )}
    </div>
  )
})

// Need React import for useState
import * as React from 'react'

export default EntityDetailPanelV2
