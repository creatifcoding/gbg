/**
 * ADR Review System
 *
 * Granular review system for Pipeline ADR documents.
 * Decomposes ADRs into reviewable units with Accept/Reject/Discuss workflow.
 *
 * Usage:
 * ```tsx
 * import { ADRReview } from '@/lib/adr-review'
 *
 * function MyReviewPage() {
 *   const markdown = '...' // ADR markdown content
 *
 *   return (
 *     <ADRReview.Provider adrId="S7" markdown={markdown}>
 *       <ADRReview.Header />
 *       <ADRReview.Filter />
 *       <ADRReview.Document />
 *     </ADRReview.Provider>
 *   )
 * }
 * ```
 */

// Components
export { ADRReview } from './components'
export type {
  ADRReviewProviderProps,
  ADRReviewHeaderProps,
  ADRReviewDocumentProps,
  ADRReviewSectionProps,
  ADRReviewUnitProps,
  ADRReviewUnitActionsProps,
  ADRReviewUnitCommentsProps,
  ADRReviewUnitListProps,
  ADRReviewFilterProps,
} from './components'

// Schemas
export {
  ReviewStatus,
  Comment,
  ADRTier,
  ADRStatus,
  ReviewSummary,
  ReviewUnit,
  UNIT_TAGS,
  UNIT_SECTIONS,
  getUnitSection,
  getUnitDisplayName,
} from './schemas'
export type {
  ReviewStatusType,
  CommentType,
  ADRTierType,
  ADRStatusType,
  ReviewSummaryType,
  ReviewUnitType,
  ReviewUnitTag,
} from './schemas'

// Atoms & Operations
export {
  reviewRegistry,
  ADRReviewRegistryProvider,
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
  parseUnitKey,
  computeSummary,
} from './atoms'

export {
  selectADR,
  loadADRUnits,
  setTierFilter,
  setStatusFilter,
  setUnitTypeFilter,
  recomputeFilteredUnits,
  setUnitStatus,
  addComment,
  getComments,
  toggleSection,
  expandAllSections,
  collapseAllSections,
  recomputeAllSummaries,
  exportDigest,
  downloadDigest,
} from './atoms/operations'
export type { ReviewDigest } from './atoms/operations'

// Parsing
export {
  parseFrontmatter,
  parseSections,
  parseTable,
  parseBulletList,
  parseLabeledBulletList,
  parseADRMarkdown,
  getSection,
  getSubsection,
  extractUnitsFromMarkdown,
  extractUnits,
  getADRMetadata,
} from './parsing'
export type {
  ADRFrontmatter,
  ADRSection,
  ADRSubsection,
  ParsedADR,
  TableRow,
  ADRMetadata,
} from './parsing'

// Hooks
export { useUnit, useDocument } from './hooks'
export type { UseUnitOptions, UseUnitReturn, UseDocumentReturn } from './hooks'
