/**
 * @fileoverview React integration for json-render
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
  visibilityContextAtom,
  hasErrorAtom,
  hasPendingConfirmationAtom,
  checkActionLoading,
  type PendingConfirmation
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
