/**
 * useDocument Hook
 *
 * Access document-level state and operations.
 */
import { useCallback } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  selectedADRAtom,
  loadedADRIdsAtom,
  currentUnitsAtom,
  filteredUnitsAtom,
  currentSummaryAtom,
  allSummariesAtom,
  tierFilterAtom,
  statusFilterAtom,
  unitTypeFilterAtom,
} from '../atoms'
import {
  selectADR,
  loadADRUnits,
  setTierFilter,
  setStatusFilter,
  setUnitTypeFilter,
  downloadDigest,
  exportDigest,
} from '../atoms/operations'
import { extractUnitsFromMarkdown } from '../parsing'
import type { ReviewUnit } from '../schemas/unit'
import type { ADRTier, ReviewStatus } from '../schemas/status'

export interface UseDocumentReturn {
  // State
  selectedADR: string | null
  loadedADRs: string[]
  units: ReviewUnit[]
  filteredUnits: ReviewUnit[]
  summary: ReturnType<typeof useAtomValue<typeof currentSummaryAtom>>
  allSummaries: ReturnType<typeof useAtomValue<typeof allSummariesAtom>>

  // Filters
  tierFilter: ADRTier | 'all'
  statusFilter: ReviewStatus | 'all'
  unitTypeFilter: string

  // Operations
  selectADR: (adrId: string | null) => void
  loadFromMarkdown: (adrId: string, markdown: string) => void
  setTierFilter: (tier: ADRTier | 'all') => void
  setStatusFilter: (status: ReviewStatus | 'all') => void
  setUnitTypeFilter: (type: string) => void
  downloadDigest: () => void
  exportDigest: () => ReturnType<typeof exportDigest>
}

export function useDocument(): UseDocumentReturn {
  const selectedADR = useAtomValue(selectedADRAtom)
  const loadedADRs = useAtomValue(loadedADRIdsAtom)
  const units = useAtomValue(currentUnitsAtom)
  const filteredUnits = useAtomValue(filteredUnitsAtom)
  const summary = useAtomValue(currentSummaryAtom)
  const allSummaries = useAtomValue(allSummariesAtom)
  const tierFilter = useAtomValue(tierFilterAtom)
  const statusFilter = useAtomValue(statusFilterAtom)
  const unitTypeFilter = useAtomValue(unitTypeFilterAtom)

  const loadFromMarkdown = useCallback((adrId: string, markdown: string) => {
    const extractedUnits = extractUnitsFromMarkdown(markdown)
    loadADRUnits(adrId, extractedUnits)
  }, [])

  return {
    selectedADR,
    loadedADRs,
    units,
    filteredUnits,
    summary,
    allSummaries,
    tierFilter,
    statusFilter,
    unitTypeFilter,
    selectADR,
    loadFromMarkdown,
    setTierFilter,
    setStatusFilter,
    setUnitTypeFilter,
    downloadDigest,
    exportDigest,
  }
}
