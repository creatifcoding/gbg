/**
 * Error detail compound component system.
 *
 * @module harness/error-detail
 */

// Registry
export { categoryOf, SEVERITY_WEIGHT } from './category-registry'
export type { CategoryConfig } from './category-registry'

// Types
export type { ErrorDetailState, ErrorDetailActions, ErrorDetailMeta, ErrorDetailContextValue, ActionDef, CategoryMatch } from './types'

// Context + Provider
export { ErrorDetailContext, useErrorDetail, ErrorDetailProvider } from './detail-context'

// Compound parts
export { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, InlineRawCause, ActionFooter, CopyDiagnosticButton, formatTimestamp } from './detail-parts'
export type { MetadataRow } from './detail-parts'

// Match dispatch
export { matchCategory } from './category-matcher'

// Detail components
export {
  StreamErrorDetail,
  NetworkErrorDetail,
  SessionErrorDetail,
  ToolErrorDetail,
  ModelErrorDetail,
  DefectDetail,
  InterruptionDetail,
  FallbackDetail,
} from './details'
