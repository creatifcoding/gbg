/**
 * ADR Review Operations
 *
 * Synchronous operations using reviewRegistry.set().
 * These are meant to be called from React event handlers.
 */
import {
  reviewRegistry,
  selectedADRAtom,
  loadedADRIdsAtom,
  tierFilterAtom,
  statusFilterAtom,
  unitTypeFilterAtom,
  expandedSectionsAtom,
  adrUnitsFamily,
  unitStatusFamily,
  unitCommentsFamily,
  currentUnitsAtom,
  filteredUnitsAtom,
  currentSummaryAtom,
  allSummariesAtom,
  makeUnitKey,
  computeSummary,
} from './index'
import type { ReviewUnit, ReviewUnitTag } from '../schemas/unit'
import type { ReviewStatus, Comment, ADRTier, ReviewSummary } from '../schemas/status'
import { persistUnitStatus, persistComment } from '../persistence'

// -----------------------------------------------------------------------------
// Document Operations
// -----------------------------------------------------------------------------

/**
 * Select an ADR for review.
 * Updates currentUnitsAtom and recalculates summary.
 */
export function selectADR(adrId: string | null): void {
  reviewRegistry.set(selectedADRAtom, adrId)

  if (adrId) {
    const units = reviewRegistry.get(adrUnitsFamily(adrId))
    reviewRegistry.set(currentUnitsAtom, units)
    reviewRegistry.set(currentSummaryAtom, computeSummary(adrId, units))
    recomputeFilteredUnits()
  } else {
    reviewRegistry.set(currentUnitsAtom, [])
    reviewRegistry.set(currentSummaryAtom, null)
    reviewRegistry.set(filteredUnitsAtom, [])
  }
}

/**
 * Load units for an ADR.
 * Called after parsing markdown into units.
 */
export function loadADRUnits(adrId: string, units: ReviewUnit[]): void {
  reviewRegistry.set(adrUnitsFamily(adrId), units)

  // Initialize status for each unit
  for (const unit of units) {
    const key = makeUnitKey(adrId, unit.path)
    // Only set if not already set (preserve existing status)
    const existing = reviewRegistry.get(unitStatusFamily(key))
    if (existing === 'pending') {
      reviewRegistry.set(unitStatusFamily(key), unit.status)
    }
  }

  // Add to loaded ADRs
  const loaded = reviewRegistry.get(loadedADRIdsAtom)
  if (!loaded.includes(adrId)) {
    reviewRegistry.set(loadedADRIdsAtom, [...loaded, adrId])
  }

  // Recompute summaries
  recomputeAllSummaries()
}

// -----------------------------------------------------------------------------
// Filter Operations
// -----------------------------------------------------------------------------

/**
 * Set tier filter.
 */
export function setTierFilter(tier: ADRTier | 'all'): void {
  reviewRegistry.set(tierFilterAtom, tier)
}

/**
 * Set status filter.
 */
export function setStatusFilter(status: ReviewStatus | 'all'): void {
  reviewRegistry.set(statusFilterAtom, status)
  recomputeFilteredUnits()
}

/**
 * Set unit type filter.
 */
export function setUnitTypeFilter(type: ReviewUnitTag | 'all'): void {
  reviewRegistry.set(unitTypeFilterAtom, type)
  recomputeFilteredUnits()
}

/**
 * Recompute filtered units based on current filters.
 */
export function recomputeFilteredUnits(): void {
  const adrId = reviewRegistry.get(selectedADRAtom)
  if (!adrId) {
    reviewRegistry.set(filteredUnitsAtom, [])
    return
  }

  const units = reviewRegistry.get(adrUnitsFamily(adrId))
  const statusFilter = reviewRegistry.get(statusFilterAtom)
  const typeFilter = reviewRegistry.get(unitTypeFilterAtom)

  const filtered = units.filter((unit) => {
    // Status filter
    if (statusFilter !== 'all') {
      const key = makeUnitKey(adrId, unit.path)
      const status = reviewRegistry.get(unitStatusFamily(key))
      if (status !== statusFilter) return false
    }

    // Type filter
    if (typeFilter !== 'all' && unit._tag !== typeFilter) return false

    return true
  })

  reviewRegistry.set(filteredUnitsAtom, filtered)
}

// -----------------------------------------------------------------------------
// Unit Operations
// -----------------------------------------------------------------------------

/**
 * Set status for a unit.
 * Updates atom immediately, persists to SQLite in background.
 */
export function setUnitStatus(
  adrId: string,
  path: string,
  status: ReviewStatus,
  reviewedBy?: string
): void {
  const key = makeUnitKey(adrId, path)
  reviewRegistry.set(unitStatusFamily(key), status)

  // Recompute summary
  const units = reviewRegistry.get(adrUnitsFamily(adrId))
  reviewRegistry.set(currentSummaryAtom, computeSummary(adrId, units))
  recomputeAllSummaries()
  recomputeFilteredUnits()

  // Persist in background (fire-and-forget)
  persistUnitStatus(adrId, path, status, reviewedBy)
}

/**
 * Add a comment to a unit.
 * Updates atom immediately, persists to SQLite in background.
 */
export function addComment(adrId: string, path: string, comment: Omit<Comment, 'id' | 'path'>): void {
  const key = makeUnitKey(adrId, path)
  const existing = reviewRegistry.get(unitCommentsFamily(key))
  const newComment: Comment = {
    ...comment,
    id: `${key}:${Date.now()}`,
    path,
    timestamp: comment.timestamp,
  }
  reviewRegistry.set(unitCommentsFamily(key), [...existing, newComment])

  // Persist in background (fire-and-forget)
  persistComment(adrId, path, newComment)
}

/**
 * Get comments for a unit.
 */
export function getComments(adrId: string, path: string): Comment[] {
  const key = makeUnitKey(adrId, path)
  return reviewRegistry.get(unitCommentsFamily(key))
}

// -----------------------------------------------------------------------------
// Section Operations
// -----------------------------------------------------------------------------

/**
 * Toggle section expansion.
 */
export function toggleSection(section: string): void {
  const expanded = reviewRegistry.get(expandedSectionsAtom)
  const newExpanded = new Set(expanded)
  if (newExpanded.has(section)) {
    newExpanded.delete(section)
  } else {
    newExpanded.add(section)
  }
  reviewRegistry.set(expandedSectionsAtom, newExpanded)
}

/**
 * Expand all sections.
 */
export function expandAllSections(): void {
  reviewRegistry.set(
    expandedSectionsAtom,
    new Set(['context', 'decision', 'rationale', 'implementation'])
  )
}

/**
 * Collapse all sections.
 */
export function collapseAllSections(): void {
  reviewRegistry.set(expandedSectionsAtom, new Set())
}

// -----------------------------------------------------------------------------
// Summary Operations
// -----------------------------------------------------------------------------

/**
 * Recompute all summaries.
 */
export function recomputeAllSummaries(): void {
  const loaded = reviewRegistry.get(loadedADRIdsAtom)
  const summaries: ReviewSummary[] = loaded.map((adrId) => {
    const units = reviewRegistry.get(adrUnitsFamily(adrId))
    return computeSummary(adrId, units)
  })
  reviewRegistry.set(allSummariesAtom, summaries)
}

// -----------------------------------------------------------------------------
// Export Operations
// -----------------------------------------------------------------------------

export interface ReviewDigest {
  exportedAt: string
  adrs: Array<{
    id: string
    summary: ReviewSummary
    units: Array<{
      path: string
      tag: string
      status: ReviewStatus
      comments: Comment[]
    }>
  }>
}

/**
 * Export all review state as JSON digest.
 */
export function exportDigest(): ReviewDigest {
  const loaded = reviewRegistry.get(loadedADRIdsAtom)
  const adrs = loaded.map((adrId) => {
    const units = reviewRegistry.get(adrUnitsFamily(adrId))
    return {
      id: adrId,
      summary: computeSummary(adrId, units),
      units: units.map((unit) => {
        const key = makeUnitKey(adrId, unit.path)
        return {
          path: unit.path,
          tag: unit._tag,
          status: reviewRegistry.get(unitStatusFamily(key)),
          comments: reviewRegistry.get(unitCommentsFamily(key)),
        }
      }),
    }
  })

  return {
    exportedAt: new Date().toISOString(),
    adrs,
  }
}

/**
 * Download digest as JSON file.
 */
export function downloadDigest(): void {
  const digest = exportDigest()
  const blob = new Blob([JSON.stringify(digest, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `adr-review-digest-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
