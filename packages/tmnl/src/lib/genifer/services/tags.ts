/**
 * Genifer Centralized Tags
 *
 * ALL tags in one file. Single source of truth for RPC tags,
 * service tags, and schema tags.
 *
 * @module
 */

// =============================================================================
// Schema Tags
// =============================================================================

export const GeniferTreeTag = 'GeniferTree' as const
export const GeniferElementTag = 'GeniferElement' as const
export const GeniferCompositeTag = 'GeniferComposite' as const
export const GeniferSignalTag = 'GeniferSignal' as const

// =============================================================================
// RPC Tags — Tree Operations
// =============================================================================

export const TreeSaveTag = `${GeniferTreeTag}.Save` as const
export const TreeLoadTag = `${GeniferTreeTag}.Load` as const
export const TreeListRecentTag = `${GeniferTreeTag}.ListRecent` as const
export const TreeListByQualityTag = `${GeniferTreeTag}.ListByQuality` as const
export const TreeListByThreadTag = `${GeniferTreeTag}.ListByThread` as const
export const TreeRateTag = `${GeniferTreeTag}.Rate` as const
export const TreeDeleteTag = `${GeniferTreeTag}.Delete` as const

// =============================================================================
// RPC Tags — Element Operations
// =============================================================================

export const ElementListByTreeTag = `${GeniferElementTag}.ListByTree` as const
export const ElementSubtreeTag = `${GeniferElementTag}.Subtree` as const

// =============================================================================
// RPC Tags — Composite Operations
// =============================================================================

export const CompositeUpsertTag = `${GeniferCompositeTag}.Upsert` as const
export const CompositeGetTag = `${GeniferCompositeTag}.Get` as const
export const CompositeListTag = `${GeniferCompositeTag}.List` as const
export const CompositeTopRankedTag = `${GeniferCompositeTag}.TopRanked` as const
export const CompositeRateTag = `${GeniferCompositeTag}.Rate` as const
export const CompositeRefreshRankingsTag = `${GeniferCompositeTag}.RefreshRankings` as const
export const CompositeDeleteTag = `${GeniferCompositeTag}.Delete` as const

// =============================================================================
// RPC Tags — Signal Operations
// =============================================================================

export const SignalEmitTag = `${GeniferSignalTag}.Emit` as const
export const SignalListByTargetTag = `${GeniferSignalTag}.ListByTarget` as const
export const SignalListByTypeTag = `${GeniferSignalTag}.ListByType` as const

// =============================================================================
// Service Tags
// =============================================================================

export const GeniferServiceTag = 'genifer/GeniferService' as const
