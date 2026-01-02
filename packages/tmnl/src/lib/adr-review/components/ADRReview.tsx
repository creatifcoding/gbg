/**
 * ADRReview Compound Component
 *
 * Object.assign + Context pattern for composable ADR review UI.
 *
 * Usage:
 * ```tsx
 * <ADRReview.Provider adrId="S7" markdown={content}>
 *   <ADRReview.Header />
 *   <ADRReview.Filter />
 *   <ADRReview.Document />
 * </ADRReview.Provider>
 *
 * // Or with custom layout:
 * <ADRReview.Provider adrId="S7" markdown={content}>
 *   <ADRReview.Header />
 *   <div className="grid grid-cols-3 gap-4">
 *     <ADRReview.UnitList />
 *     <div className="col-span-2">
 *       <ADRReview.Document useFiltered />
 *     </div>
 *   </div>
 * </ADRReview.Provider>
 * ```
 */
import { ADRReviewProvider, useADRReviewContext } from './ADRReviewProvider'
import { ADRReviewHeader } from './ADRReviewHeader'
import { ADRReviewDocument } from './ADRReviewDocument'
import { ADRReviewSection, ADRReviewSectionTitle, ADRReviewSectionContent, useSectionContext } from './ADRReviewSection'
import { ADRReviewUnit, ADRReviewUnitContent, ADRReviewUnitActionsSlot, ADRReviewUnitCommentsSlot, useUnitContext } from './ADRReviewUnit'
import { ADRReviewUnitActions } from './ADRReviewUnitActions'
import { ADRReviewUnitComments } from './ADRReviewUnitComments'
import { ADRReviewUnitList } from './ADRReviewUnitList'
import { ADRReviewFilter } from './ADRReviewFilter'

// -----------------------------------------------------------------------------
// Root Component (placeholder for namespace)
// -----------------------------------------------------------------------------

function ADRReviewRoot() {
  return null
}

// -----------------------------------------------------------------------------
// Compound Component
// -----------------------------------------------------------------------------

/**
 * ADRReview compound component.
 *
 * Sub-components:
 * - `ADRReview.Provider` — Context provider, wraps all other components
 * - `ADRReview.Header` — Document title, status, progress bar
 * - `ADRReview.Filter` — Status and type filter controls
 * - `ADRReview.Document` — Section-organized unit container
 * - `ADRReview.Section` — Collapsible section
 * - `ADRReview.SectionTitle` — Section header text
 * - `ADRReview.SectionContent` — Section body
 * - `ADRReview.Unit` — Single reviewable unit
 * - `ADRReview.UnitContent` — Unit content (custom layout)
 * - `ADRReview.UnitActions` — Accept/Reject/Discuss buttons
 * - `ADRReview.UnitComments` — Comment thread
 * - `ADRReview.UnitList` — Flat list view for navigation
 *
 * Hooks:
 * - `useADRReviewContext()` — Access current ADR metadata
 * - `useSectionContext()` — Access current section state
 * - `useUnitContext()` — Access current unit state
 */
export const ADRReview = Object.assign(ADRReviewRoot, {
  // Provider
  Provider: ADRReviewProvider,

  // Document-level
  Header: ADRReviewHeader,
  Document: ADRReviewDocument,
  Filter: ADRReviewFilter,

  // Section-level
  Section: ADRReviewSection,
  SectionTitle: ADRReviewSectionTitle,
  SectionContent: ADRReviewSectionContent,

  // Unit-level
  Unit: ADRReviewUnit,
  UnitContent: ADRReviewUnitContent,
  UnitActions: ADRReviewUnitActionsSlot,
  UnitComments: ADRReviewUnitCommentsSlot,

  // Standalone components (for custom layouts)
  UnitActionsStandalone: ADRReviewUnitActions,
  UnitCommentsStandalone: ADRReviewUnitComments,

  // Navigation
  UnitList: ADRReviewUnitList,

  // Hooks
  useContext: useADRReviewContext,
  useSectionContext,
  useUnitContext,
})

export type { ADRReviewProviderProps } from './ADRReviewProvider'
export type { ADRReviewHeaderProps } from './ADRReviewHeader'
export type { ADRReviewDocumentProps } from './ADRReviewDocument'
export type { ADRReviewSectionProps } from './ADRReviewSection'
export type { ADRReviewUnitProps } from './ADRReviewUnit'
export type { ADRReviewUnitActionsProps } from './ADRReviewUnitActions'
export type { ADRReviewUnitCommentsProps } from './ADRReviewUnitComments'
export type { ADRReviewUnitListProps } from './ADRReviewUnitList'
export type { ADRReviewFilterProps } from './ADRReviewFilter'
