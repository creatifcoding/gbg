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

// DataSource resolver
export {
  DataSourceResolver,
  DataSourceResolverLive,
  DataSourceError,
  atomDirectoryAtom,
  queryDirectoryAtom,
  rpcDirectoryAtom,
  type DataSourceResolverShape,
  type QueryFn,
  type RpcFn,
} from './DataSourceResolver'

// Harness service
export {
  GeniferHarnessServiceTag,
  GeniferHarnessServiceLive,
  GeniferHarnessError,
  type GeniferHarnessServiceShape,
  type GenerateOptions,
  type GenerateResult,
  type RefineOptions,
  type RefineResult,
  type QueryOperation,
  type QueryResult,
} from './GeniferHarnessService'

// ToolDefinitions (TypeBox)
export {
  GeniferGenerateParams,
  GeniferRefineParams,
  GeniferQueryParams,
  createGeniferGenerateTool,
  createGeniferRefineTool,
  createGeniferQueryTool,
  type GeniferGenerateDetails,
  type GeniferRefineDetails,
  type GeniferQueryDetails,
} from './tools'

// Bridge (wires ToolDefinition.execute → GeniferHarnessService)
export { createGeniferTools } from './bridge'

// Panel visitor (Genifer surface in floating panel)
export {
  GeniferPanelVisitor,
  geniferPanelSurfaces,
  registerGeniferPanelVisitor,
  type GeniferPanelData,
} from './panel-visitor'

// spawn_panel tool
export {
  SpawnPanelParams,
  createSpawnPanelTool,
  type SpawnPanelParams as SpawnPanelParamsType,
  type SpawnPanelDetails,
  type SpawnPanelBridge,
} from './spawn-panel-tool'
