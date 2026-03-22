/**
 * ADRReviewUnitList
 *
 * Flat list view of all units (for filtering/navigation).
 */
import React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filteredUnitsAtom, reviewRegistry, unitStatusFamily, makeUnitKey } from '../atoms'
import { useADRReviewContext } from './ADRReviewProvider'
import { getUnitDisplayName, getUnitSection, type ReviewUnit } from '../schemas/unit'
import type { ReviewStatus } from '../schemas/status'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ADRReviewUnitListProps {
  /**
   * Callback when a unit is selected.
   */
  onSelectUnit?: (unit: ReviewUnit) => void

  /**
   * Currently selected unit path.
   */
  selectedPath?: string

  /**
   * Optional className for the container.
   */
  className?: string
}

// -----------------------------------------------------------------------------
// Status Indicator
// -----------------------------------------------------------------------------

function StatusDot({ status }: { status: ReviewStatus }) {
  const colors: Record<ReviewStatus, string> = {
    pending: 'bg-neutral-500',
    accepted: 'bg-emerald-500',
    rejected: 'bg-red-500',
    discuss: 'bg-amber-500',
  }
  return <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colors[status])} />
}

// -----------------------------------------------------------------------------
// List Item
// -----------------------------------------------------------------------------

interface UnitListItemProps {
  unit: ReviewUnit
  isSelected: boolean
  onClick: () => void
}

function UnitListItem({ unit, isSelected, onClick }: UnitListItemProps) {
  const key = makeUnitKey(unit.adrId, unit.path)
  const status = useAtomValue(unitStatusFamily(key))

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors',
        isSelected ? 'bg-cyan-500/20 border border-cyan-500/50' : 'hover:bg-neutral-800'
      )}
    >
      <StatusDot status={status} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-200 truncate">
          {getUnitDisplayName(unit._tag)}
        </div>
        <div className="text-xs text-neutral-500 font-mono truncate">{unit.path}</div>
      </div>
      <span className="text-xs text-neutral-600 uppercase">{getUnitSection(unit)}</span>
      <ChevronRight className="w-4 h-4 text-neutral-600" />
    </button>
  )
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ADRReviewUnitList({
  onSelectUnit,
  selectedPath,
  className,
}: ADRReviewUnitListProps) {
  const { isLoading } = useADRReviewContext()
  const units = useAtomValue(filteredUnitsAtom)

  if (isLoading) {
    return (
      <div className={cn('animate-pulse space-y-2', className)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-neutral-800 rounded-lg" />
        ))}
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <div className={cn('text-center py-8 text-neutral-500 text-sm', className)}>
        No units match the current filters.
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
        {units.length} units
      </div>
      {units.map((unit) => (
        <UnitListItem
          key={unit.path}
          unit={unit}
          isSelected={unit.path === selectedPath}
          onClick={() => onSelectUnit?.(unit)}
        />
      ))}
    </div>
  )
}
