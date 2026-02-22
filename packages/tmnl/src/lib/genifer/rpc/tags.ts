/**
 * Genifer Centralized Tags
 *
 * ALL tags in one file. Named exports only. No hardcoded strings anywhere else.
 * Single source of truth for schema tags, RPC tags, and service tags.
 *
 * Pattern: follows iiot/tags.ts exactly.
 *
 * @module genifer/rpc/tags
 */

// =============================================================================
// Schema Tags
// =============================================================================

export const GeniferTreeTag = 'GeniferTree' as const
export const GeniferElementTag = 'GeniferElement' as const
export const GeniferCompositeTag = 'GeniferComposite' as const
export const GeniferSignalTag = 'GeniferSignal' as const

// =============================================================================
// Tree RPC Tags
// =============================================================================

export const TreeGetByIdTag = `${GeniferTreeTag}.GetById` as const
export const TreeFindByThreadTag = `${GeniferTreeTag}.FindByThread` as const
export const TreeFindByQualityTag = `${GeniferTreeTag}.FindByQuality` as const
export const TreeInsertTag = `${GeniferTreeTag}.Insert` as const
export const TreeUpdateRatingTag = `${GeniferTreeTag}.UpdateRating` as const
export const TreeIncrementUsageTag = `${GeniferTreeTag}.IncrementUsage` as const
export const TreeDeleteTag = `${GeniferTreeTag}.Delete` as const

// =============================================================================
// Element RPC Tags
// =============================================================================

export const ElementFindByTreeTag = `${GeniferElementTag}.FindByTree` as const
export const ElementFindByKeyTag = `${GeniferElementTag}.FindByKey` as const
export const ElementInsertBatchTag = `${GeniferElementTag}.InsertBatch` as const
export const ElementDeleteByTreeTag = `${GeniferElementTag}.DeleteByTree` as const

// =============================================================================
// Composite RPC Tags
// =============================================================================

export const CompositeFindByNameTag = `${GeniferCompositeTag}.FindByName` as const
export const CompositeInsertTag = `${GeniferCompositeTag}.Insert` as const
export const CompositeListTag = `${GeniferCompositeTag}.List` as const

// =============================================================================
// Signal RPC Tags
// =============================================================================

export const SignalRecordTag = `${GeniferSignalTag}.Record` as const
export const SignalGetForTreeTag = `${GeniferSignalTag}.GetForTree` as const

// =============================================================================
// Service Tags
// =============================================================================

export const GeniferTreeRepoTag = 'genifer/TreeRepo' as const
export const GeniferElementRepoTag = 'genifer/ElementRepo' as const
export const GeniferCompositeRepoTag = 'genifer/CompositeRepo' as const
export const GeniferSignalRepoTag = 'genifer/SignalRepo' as const

// =============================================================================
// Type Exports
// =============================================================================

export type GeniferTreeTag = typeof GeniferTreeTag
export type GeniferElementTag = typeof GeniferElementTag
export type GeniferCompositeTag = typeof GeniferCompositeTag
export type GeniferSignalTag = typeof GeniferSignalTag
