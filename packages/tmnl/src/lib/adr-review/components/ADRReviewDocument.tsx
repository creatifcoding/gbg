/**
 * ADRReviewDocument
 *
 * Full document container that organizes units by section.
 */
import React, { useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { currentUnitsAtom, filteredUnitsAtom, reviewRegistry, unitStatusFamily, makeUnitKey } from '../atoms'
import { useADRReviewContext } from './ADRReviewProvider'
import { ADRReviewSection } from './ADRReviewSection'
import { ADRReviewUnit } from './ADRReviewUnit'
import { getUnitSection, type ReviewUnit } from '../schemas/unit'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ADRReviewDocumentProps {
  /**
   * Whether to use filtered units or all units.
   */
  useFiltered?: boolean

  /**
   * Optional className for the container.
   */
  className?: string

  /**
   * Children to render (custom layout).
   * If not provided, renders default section-based layout.
   */
  children?: React.ReactNode
}

// -----------------------------------------------------------------------------
// Group Units by Section
// -----------------------------------------------------------------------------

function groupBySection(units: ReviewUnit[]): Record<string, ReviewUnit[]> {
  const groups: Record<string, ReviewUnit[]> = {
    context: [],
    decision: [],
    rationale: [],
    implementation: [],
  }

  for (const unit of units) {
    const section = getUnitSection(unit)
    if (groups[section]) {
      groups[section].push(unit)
    }
  }

  return groups
}

// -----------------------------------------------------------------------------
// Section Stats
// -----------------------------------------------------------------------------

function getSectionStats(
  adrId: string,
  units: ReviewUnit[]
): { accepted: number; total: number } {
  let accepted = 0
  for (const unit of units) {
    const key = makeUnitKey(adrId, unit.path)
    const status = reviewRegistry.get(unitStatusFamily(key))
    if (status === 'accepted') accepted++
  }
  return { accepted, total: units.length }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ADRReviewDocument({
  useFiltered = false,
  className,
  children,
}: ADRReviewDocumentProps) {
  const { adrId, isLoading } = useADRReviewContext()
  const allUnits = useAtomValue(currentUnitsAtom)
  const filteredUnits = useAtomValue(filteredUnitsAtom)

  const units = useFiltered ? filteredUnits : allUnits

  const sections = useMemo(() => groupBySection(units), [units])

  const sectionOrder = ['context', 'decision', 'rationale', 'implementation'] as const

  if (children) {
    return <div className={cn('space-y-6', className)}>{children}</div>
  }

  if (isLoading) {
    return (
      <div className={cn('animate-pulse space-y-4', className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-neutral-800 rounded-lg" />
        ))}
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <div className={cn('text-center py-12 text-neutral-500', className)}>
        {adrId ? 'No units found for this ADR.' : 'Select an ADR to begin review.'}
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {sectionOrder.map((sectionName) => {
        const sectionUnits = sections[sectionName]
        if (sectionUnits.length === 0) return null

        return (
          <ADRReviewSection
            key={sectionName}
            name={sectionName}
            unitCount={adrId ? getSectionStats(adrId, sectionUnits) : undefined}
          >
            {sectionUnits.map((unit) => (
              <ADRReviewUnit key={unit.path} unit={unit} />
            ))}
          </ADRReviewSection>
        )
      })}
    </div>
  )
}
