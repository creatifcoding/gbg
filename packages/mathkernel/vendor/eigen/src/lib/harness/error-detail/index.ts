/**
 * Error detail compound component system.
 *
 * @module harness/error-detail
 */

// Tokens
export { ACCENT, SEMANTIC, ALPHA, borderTint, bgTint, separatorColor, actionBorderColor, badgeBgColor, badgeBorderColor } from './tokens'
export type { BgHue } from './tokens'

// Registry
export { categoryOf, SEVERITY_WEIGHT } from './category-registry'
export type { CategoryConfig, SeverityLabel } from './category-registry'

// Types
export type { ErrorDetailState, ErrorDetailActions, ErrorDetailMeta, ErrorDetailContextValue, ActionDef, CategoryMatch } from './types'

// Context + Provider
export { ErrorDetailContext, useErrorDetail, ErrorDetailProvider } from './detail-context'

// Compound parts
export { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, InlineRawCause, ActionFooter, ActionButton, CopyDiagnosticButton, formatTimestamp } from './detail-parts'
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
