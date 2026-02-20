/**
 * @fileoverview React integration for genifer
 *
 * Provides Effect-native React components and hooks for rendering
 * JSON-driven UI with streaming, actions, and visibility support.
 */

// =============================================================================
// Atoms (module-level state)
// =============================================================================

export {
  treeAtom,
  isStreamingAtom,
  errorAtom,
  dataModelAtom,
  authStateAtom,
  actionHandlersAtom,
  loadingActionsAtom,
  pendingConfirmationAtom,
  streamFiberAtom,
  decodeErrorStreamIdsAtom,
  decodeErrorsFamily,
  decodeErrorsAtom,
  registerDecodeErrorStreamId,
  visibilityContextAtom,
  hasErrorAtom,
  hasPendingConfirmationAtom,
  checkActionLoading,
  type PendingConfirmation,
  // GenerativeContainer atom families (per-container isolation)
  containerTreeFamily,
  containerIsStreamingFamily,
  containerErrorFamily,
  getContainerAtoms,
  type GenerativeContainerId,
  type ContainerAtoms,
  type DecodeErrorEntry,
} from "./atoms"

// =============================================================================
// Hooks
// =============================================================================

export {
  // Stream hooks
  useUIStream,
  type UseUIStreamOptions,
  type UseUIStreamReturn,
  // Visibility hooks
  useIsVisible,
  useVisibility,
  // Data hooks
  useData,
  type UseDataReturn,
  // Action hooks
  useActions,
  type UseActionsReturn,
  useAction,
  type UseActionReturn,
  useConfirmation,
  type UseConfirmationReturn
} from "./hooks"

export {
  // Cluster variant of useUIStream (Effect RPC transport)
  useUIStreamCluster,
  type UseUIStreamClusterOptions,
  type UseUIStreamClusterReturn,
  // Cluster-specific atoms (isolated from HTTP mode)
  clusterTreeAtom,
  clusterIsStreamingAtom,
  clusterErrorAtom,
  clusterStreamFiberAtom,
  // Constants
  DEFAULT_CLUSTER_BASE_URL,
} from "./useUIStreamCluster"

// =============================================================================
// Renderer
// =============================================================================

export {
  Renderer,
  DefaultFallback,
  LoadingSkeleton,
  type RendererProps,
  type ComponentRenderProps,
  type ComponentRenderer,
  type ComponentRegistry
} from "./renderer"

// =============================================================================
// Provider
// =============================================================================

export {
  JSONRenderProvider,
  DefaultConfirmationDialog,
  type JSONRenderProviderProps,
  type ConfirmationDialogProps
} from "./provider"

// =============================================================================
// Generative (recursive AI-generated UI)
// =============================================================================

export {
  GenerativeContainer,
  createGenerativeContainerRenderer,
  type GenerativeContainerProps,
} from "./GenerativeContainer"

export {
  GenerativeDepthContext,
  GenerativeDepthProvider,
  useGenerativeDepth,
  type GenerativeDepthContextValue,
  type GenerativeDepthProviderProps,
} from "./generative"

// =============================================================================
// Animation
// =============================================================================

export {
  useEntrance,
  type UseEntranceOptions,
  type UseEntranceReturn,
  DURATION_MS,
  EASING_ANIMEJS,
  PROPERTY_STATES,
  STAGGER_DELAY,
} from "./animation"

// =============================================================================
// Legend State Integration (Fine-Grained Reactivity)
// =============================================================================

export {
  // Observable tree factory and mutations
  createTreeObservable,
  applyPatch,
  applyPatches,
  bulkSet,
  getElementKeys,
  hasElements,
  resetTree,
  type ObservableUITree,
  type JSONPatchOp,
} from "./observable-tree"

export {
  // Legend State powered renderer
  LegendRenderer,
  type LegendRendererProps,
} from "./legend-renderer"

// =============================================================================
// Catalog Registration (plugin API for external domain modules)
// =============================================================================

export {
  registerDomainCatalog,
  catalogRuntime,
  CatalogComponentsLive,
  renderersAtom,
  promptAtom,
  schemasAtom,
  registerCatalogAtom,
  catalogRegistry,
  getCatalogSystemPrompt,
  getCatalogRenderers,
  getCatalogSchemas,
  registerPluginCatalog,
} from "./atoms/catalog"

// =============================================================================
// Bidirectional Component State (StateSyncService + hooks)
// =============================================================================

export {
  createStateSyncService,
  getStateSyncService,
  elementStatesAtom,
  changeLogAtom,
  dirtyElementsAtom,
  type StateSyncServiceShape,
} from "./state-sync"

export {
  useComponentState,
  type UseComponentStateReturn,
} from "./useComponentState"

// =============================================================================
// Tool Registry (Client-Side Tool Calling)
// =============================================================================

export {
  createToolRegistryService,
  getToolRegistryService,
  registeredToolsAtom,
  activeCallsAtom,
  toolResultsAtom,
  type ToolRegistryServiceShape,
} from "./tool-registry"

export {
  useToolRegistry,
  useTool,
  type UseToolRegistryReturn,
  type UseToolReturn,
} from "./useTools"

// =============================================================================
// Thread Service (Conversation Management)
// =============================================================================

export {
  createThreadService,
  getThreadService,
  activeThreadAtom,
  threadHistoryAtom,
  type ThreadServiceShape,
} from "./thread-service"

// =============================================================================
// Accessibility
// =============================================================================

export { useReducedMotion } from "./useReducedMotion"

// =============================================================================
// Tree Cache (prompt-hash → UITree LRU)
// =============================================================================

export {
  TreeCache,
  getTreeCache,
  generateCacheKey,
  type TreeCacheOptions,
} from "./tree-cache"

// =============================================================================
// Error Boundary
// =============================================================================

export {
  ComponentErrorBoundary,
  type ComponentErrorBoundaryProps,
} from "./ErrorBoundary"
