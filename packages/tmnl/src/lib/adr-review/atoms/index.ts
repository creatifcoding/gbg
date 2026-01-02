/**
 * ADR Review Atoms
 *
 * Module-level atoms for review state management.
 * Uses effect-atom with Registry pattern for React integration.
 */
import { Atom, Registry, RegistryContext } from 'effect-atom'
import React from 'react'
import type { ReviewUnit, ReviewUnitTag } from '../schemas/unit'
import type { ReviewStatus, Comment, ADRTier, ReviewSummary } from '../schemas/status'

// -----------------------------------------------------------------------------
// Registry Singleton
// -----------------------------------------------------------------------------

/**
 * Global registry singleton for ADR review state.
 * Use reviewRegistry.set()/get() for synchronous mutations in React callbacks.
 */
export const reviewRegistry = Registry.make()

/**
 * Provider for ADR review registry.
 * Wrap ADRReview components with this so useAtomValue reads from reviewRegistry.
 */
export function ADRReviewRegistryProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return React.createElement(RegistryContext.Provider, { value: reviewRegistry as any }, children)
}

// -----------------------------------------------------------------------------
// Document-Level Atoms
// -----------------------------------------------------------------------------

/** Currently selected ADR ID */
export const selectedADRAtom = Atom.make<string | null>(null)

/** All loaded ADR IDs */
export const loadedADRIdsAtom = Atom.make<string[]>([])

/** Tier filter */
export const tierFilterAtom = Atom.make<ADRTier | 'all'>('all')

/** Status filter (unit-level) */
export const statusFilterAtom = Atom.make<ReviewStatus | 'all'>('all')

/** Unit type filter */
export const unitTypeFilterAtom = Atom.make<ReviewUnitTag | 'all'>('all')

/** Expanded sections (Set of section names) */
export const expandedSectionsAtom = Atom.make<Set<string>>(
  new Set(['context', 'decision', 'rationale', 'implementation'])
)

// -----------------------------------------------------------------------------
// Unit-Level Atoms (Atom.family pattern)
// -----------------------------------------------------------------------------

/**
 * All units for all ADRs.
 * Key: adrId, Value: ReviewUnit[]
 */
export const adrUnitsFamily = Atom.family((adrId: string) => Atom.make<ReviewUnit[]>([]))

/**
 * Unit status by path.
 * Key: `${adrId}:${path}`, Value: ReviewStatus
 *
 * Note: We use compound key because status can be changed independently
 * of the unit data itself.
 */
export const unitStatusFamily = Atom.family((key: string) => Atom.make<ReviewStatus>('pending'))

/**
 * Comments per unit.
 * Key: `${adrId}:${path}`, Value: Comment[]
 */
export const unitCommentsFamily = Atom.family((key: string) => Atom.make<Comment[]>([]))

// -----------------------------------------------------------------------------
// Derived Atoms
// -----------------------------------------------------------------------------

/**
 * Units for currently selected ADR.
 */
export const currentUnitsAtom = Atom.make<ReviewUnit[]>([])

/**
 * Filtered units based on status and type filters.
 */
export const filteredUnitsAtom = Atom.make<ReviewUnit[]>([])

/**
 * Review summary for currently selected ADR.
 */
export const currentSummaryAtom = Atom.make<ReviewSummary | null>(null)

/**
 * All review summaries (for overview panel).
 */
export const allSummariesAtom = Atom.make<ReviewSummary[]>([])

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Create compound key for unit-specific atoms.
 */
export function makeUnitKey(adrId: string, path: string): string {
  return `${adrId}:${path}`
}

/**
 * Parse compound key back to adrId and path.
 */
export function parseUnitKey(key: string): { adrId: string; path: string } {
  const idx = key.indexOf(':')
  return {
    adrId: key.slice(0, idx),
    path: key.slice(idx + 1),
  }
}

/**
 * Compute review summary for an ADR's units.
 */
export function computeSummary(adrId: string, units: ReviewUnit[]): ReviewSummary {
  const counts = { pending: 0, accepted: 0, rejected: 0, discuss: 0 }
  for (const unit of units) {
    const key = makeUnitKey(adrId, unit.path)
    const status = reviewRegistry.get(unitStatusFamily(key))
    counts[status]++
  }
  return {
    adrId,
    total: units.length,
    ...counts,
  }
}
