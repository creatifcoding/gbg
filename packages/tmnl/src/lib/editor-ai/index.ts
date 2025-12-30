/**
 * EditorAI Service Layer
 *
 * Decoupled, service-oriented AI integration for editors.
 * AI agents (Cursor, drawer chat, etc.) consume services — they don't know implementation details.
 *
 * Features:
 * - EditorOperations: Base interface every editor implements
 * - EditorRegistry: Tracks registered editors and focus state
 * - EditorAIBridge: Primary interface for AI agents
 * - TiptapAdapter: EditorOperations implementation for TipTap
 * - Streaming insertion: Effect.Stream → editor with chunk batching
 *
 * @module editor-ai
 */

// -----------------------------------------------------------------------------
// Schemas - Knowledge
// -----------------------------------------------------------------------------

export {
  // Knowledge types
  SchemaInfo,
  ServiceInfo,
  ServiceMethod,
  PatternInfo,
  PatternCategory,
  CodebaseKnowledge,

  // Tool parameter schemas
  GetCodebaseContextParams,
  GetPatternForTaskParams,

  // Tool result schemas
  CodebaseContextResult,
  PatternMatchResult,
} from './schemas/knowledge'

// -----------------------------------------------------------------------------
// Schemas - Editor
// -----------------------------------------------------------------------------

export {
  EditorId,
  Selection,
  EditorMetadata,
  StreamingState,
  InsertionResult,
} from './schemas/editor'

export type {
  EditorId as EditorIdType,
  Selection as SelectionType,
  EditorMetadata as EditorMetadataType,
  StreamingState as StreamingStateType,
  InsertionResult as InsertionResultType,
} from './schemas/editor'

// -----------------------------------------------------------------------------
// Schemas - Operations
// -----------------------------------------------------------------------------

export {
  InsertTextPayload,
  ReplaceSelectionPayload,
  SetSelectionPayload,
  GetContentRangePayload,
  FocusEditorPayload,
  OperationSuccess,
  InsertTextResult,
  SelectionResult,
  ContentResult,
  ListEditorsResult,
  AIContext,
} from './schemas/operations'

// -----------------------------------------------------------------------------
// Schemas - Errors
// -----------------------------------------------------------------------------

export {
  EditorNotFoundError,
  NoEditorFocusedError,
  EditorOperationError,
  StreamAbortedError,
  AIStreamError,
  // Factory functions
  makeEditorNotFoundError,
  makeNoEditorFocusedError,
  makeEditorOperationError,
  makeStreamAbortedError,
  makeAIStreamError,
  type EditorError,
} from './schemas/errors'

// -----------------------------------------------------------------------------
// Decorators
// -----------------------------------------------------------------------------

export {
  // Decorator functions
  AIKnowledge,
  AIService,
  AIPattern,

  // Metadata types
  type AIKnowledgeMeta,
  type AIServiceMeta,
  type AIPatternMeta,

  // Helpers
  getAIServiceMeta,
  getAIPatternMeta,
} from './decorators'

// -----------------------------------------------------------------------------
// Services - EditorOperations
// -----------------------------------------------------------------------------

export {
  EditorOperations,
  type EditorOperationsShape,
  type InsertionHandle,
} from './services/EditorOperations'

// -----------------------------------------------------------------------------
// Services - EditorRegistry
// -----------------------------------------------------------------------------

export {
  EditorRegistry,
  EditorRegistryLive,
  type EditorRegistryShape,
} from './services/EditorRegistry'

// -----------------------------------------------------------------------------
// Services - EditorAIBridge
// -----------------------------------------------------------------------------

export {
  EditorAIBridge,
  EditorAIBridgeLive,
  EditorAIBridgeFullLive,
  type EditorAIBridgeShape,
} from './services/EditorAIBridge'

// -----------------------------------------------------------------------------
// Services - KnowledgeService
// -----------------------------------------------------------------------------

export {
  KnowledgeService,
  type KnowledgeServiceShape,
  type SearchResult,
  makeKnowledgeServiceLive,
  KnowledgeServiceLive,
} from './services/KnowledgeService'

// -----------------------------------------------------------------------------
// Adapters
// -----------------------------------------------------------------------------

export { TiptapAdapter } from './adapters'

// -----------------------------------------------------------------------------
// Atoms
// -----------------------------------------------------------------------------

export {
  // Runtime
  editorAIRuntimeAtom,

  // State atoms
  registeredEditorsAtom,
  focusedEditorAtom,
  editorCountAtom,

  // Operation atoms
  focusEditorOp,
  insertTextOp,
  replaceSelectionOp,
  getSelectionOp,
  getSelectedTextOp,
  getContextOp,
  streamInsertOp,
  createInsertionHandleOp,

  // Atom families
  isEditorRegisteredAtom,
  isEditorFocusedAtom,

  // Convenience export
  editorAIOps,
} from './atoms'

// -----------------------------------------------------------------------------
// Tools
// -----------------------------------------------------------------------------

export {
  createKnowledgeTools,
  type KnowledgeTools,
} from './tools/knowledge-tools'

// -----------------------------------------------------------------------------
// Components (Phase 3)
// -----------------------------------------------------------------------------

export {
  EditorAIProvider,
  useEditorAIContext,
  type EditorAIContextValue,
  type EditorAIProviderProps,
  withEditorAI,
  withEditorAIRef,
  type WithEditorAIConfig,
  type WithEditorAIInjectedProps,
} from './components'

// -----------------------------------------------------------------------------
// Hooks (Phase 3)
// -----------------------------------------------------------------------------

export { useEditorAI, type UseEditorAIResult } from './hooks'
