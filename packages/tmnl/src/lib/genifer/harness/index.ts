/**
 * Genifer Harness Integration — Barrel Exports
 *
 * @module genifer/harness
 */

// Event schemas
export {
  GeniferStreamStage,
  GeniferGenerationStatus,
  GeniferGenerateStartEvent,
  GeniferStreamDeltaEvent,
  GeniferGenerateCompleteEvent,
  GeniferRefineStartEvent,
  GeniferRefineCompleteEvent,
  GeniferQualityEvent,
  GeniferEvent,
  isGenerateStart,
  isStreamDelta,
  isGenerateComplete,
  isRefineStart,
  isRefineComplete,
  isQualityEvent,
} from './schemas'

// Surface + bindings
export {
  DataSourceType,
  DataSourceBinding,
  ActionType,
  ActionBinding,
  SurfaceQuality,
  GeniferSurface,
} from './surface'

// Atoms
export {
  activeGenerationAtom,
  surfaceRegistryAtom,
  streamDeltasAtom,
  qualityMetricsAtom,
  threadHistoryAtom,
  catalogContextAtom,
  sessionTreeIdsAtom,
  focusedSurfaceIdAtom,
  surfaceCountAtom,
  type ActiveGeneration,
  type QualityMetrics,
  type CatalogContext,
} from './atoms'
