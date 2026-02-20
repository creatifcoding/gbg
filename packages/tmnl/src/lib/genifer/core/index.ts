/**
 * @fileoverview Core genifer module with Effect-first architecture
 *
 * This module provides a fully effectual JSON-driven UI rendering system:
 * - Effect Schema for runtime validation and type safety
 * - Effect.Stream for progressive UI rendering with backpressure
 * - Effect.Fiber for cancellable action handlers
 * - Effect.Deferred for confirmation dialogs
 * - Effect.Ref for state management
 * - Effect.PubSub for broadcasting results
 * - Effect.Queue for action ordering
 * - Effect.Match for exhaustive pattern matching
 *
 * ALL functions return Effects - no sync shortcuts!
 */

// =============================================================================
// Schemas & Types
// =============================================================================

// =============================================================================
// Animation Schema
// =============================================================================

export {
  EntranceAnimation,
  AnimationProperty,
  AnimationEasing,
  AnimationDuration,
  isEntranceAnimation,
  decodeEntranceAnimation,
  decodeEntranceAnimationSync,
  type EntranceAnimation as EntranceAnimationType,
  type AnimationProperty as AnimationPropertyType,
  type AnimationEasing as AnimationEasingType,
  type AnimationDuration as AnimationDurationType,
} from "./animation-schema"

export {
  // Core UI Types
  UIElement,
  UITree,
  DataModel,

  // Actions
  Action,
  ActionConfirm,

  // Action Handlers (Success/Error)
  NavigateHandler,
  SetDataHandler,
  ChainActionHandler,

  // Validation
  ValidationCheck,
  ValidationConfig,

  // Visibility Conditions (Tagged Union)
  AuthCondition,
  PathCondition,
  EqCondition,
  NeqCondition,
  GtCondition,
  GteCondition,
  LtCondition,
  LteCondition,
  AndCondition,
  OrCondition,
  NotCondition,

  // JSON Patch
  JsonPatch,
  PatchOp,

  // Auth
  AuthState,

  // Path Reference
  PathRef,

  // Type Guards
  isPathRef,
  isUIElement,
  isUITree,
  isJsonPatch,
  isAction,

  // Decoders (return Effects!)
  decodeJsonPatch,
  decodeJsonPatchSync,
  decodeUIElement,
  decodeUITree,
  decodeAction,

  // Union Types
  type LogicExpression,
  type VisibilityCondition,
  type ActionOnSuccess,
  type ActionOnError
} from "./schemas"

// =============================================================================
// Path Utilities
// =============================================================================

export {
  // Errors
  PathNotFoundError,
  InvalidPathError,

  // Path Operations (all return Effects!)
  parsePathSegments,
  getByPath,
  getByPathOption,
  getByPathOrUndefined,
  setByPath,
  setByPathSync,

  // Dynamic Values
  resolveDynamicValue,

  // String Interpolation
  interpolateString,
  interpolateStringSync
} from "./path"

// =============================================================================
// Visibility Evaluation
// =============================================================================

export {
  // Context
  type VisibilityContext,

  // Evaluation (returns Effects!)
  evaluateLogicExpression,
  evaluateVisibility,
  evaluateVisibilitySync,

  // Builder Pattern (returns Effects!)
  visibility
} from "./visibility"

// =============================================================================
// Action Execution
// =============================================================================

export {
  // Errors
  ActionNotFoundError,
  ActionExecutionError,
  ActionCancelledError,
  ActionValidationError,

  // Types
  type ActionHandler,
  type ResolvedAction,
  type ActionResult,
  type ActionState,
  type ActionServiceConfig,

  // Resolution (returns Effect!)
  resolveAction,

  // Service Factory (returns Effect!)
  makeActionService,
  type ActionService,

  // Builder Pattern (returns Effects!)
  actionBuilder
} from "./actions"

// =============================================================================
// Validation
// =============================================================================

export {
  // Types
  type ValidationFunction,
  type SyncValidationFunction,
  type ValidationCheckResult,
  type ValidationResult,
  type ValidationContext,

  // Built-in Validators
  builtInValidationFunctions,

  // Execution (returns Effects!)
  runValidationCheck,
  runValidation,
  runValidationSync,
  runAllValidations,

  // Builder Pattern (returns Effects!)
  checkBuilder,
  validationBuilder
} from "./validation"

// =============================================================================
// Streaming
// =============================================================================

export {
  // Types
  type UIStreamEvent,
  type UIStreamOptions,

  // Patch Application (returns Effects!)
  applyPatch,
  applyPatches,

  // Stream Creation
  streamFromFetch,
  streamFromFetchProgressive,  // Queue-based progressive streaming (recommended!)
  streamFromAsyncIterable,

  // Stream Processing
  processPatches,

  // Managed Stream Service (returns Effect!)
  makeUIStream,
  type UIStreamService,

  // Utilities
  flatToTree,
  parsePatchLine
} from "./streaming"

// =============================================================================
// Catalog
// =============================================================================

export {
  // Types
  type ComponentSchema,
  type ValidationMode,
  type ComponentDefinition,
  type ActionDefinition,
  type CatalogConfig,
  type CatalogValidationResult,
  type Catalog,

  // Creation (returns Effects!)
  createCatalog,
  createCatalogSync,

  // Prompt Generation
  generateCatalogPrompt,

  // Type Helpers
  type InferCatalogComponentProps,
  type InferCatalogActionParams,

  // Builder Pattern (returns Effects!)
  catalogBuilder,

  // Common Prop Schemas
  commonProps
} from "./catalog"

// =============================================================================
// Components
// =============================================================================

export {
  // SemanticRegion for agent-addressable UI regions
  SemanticRegion,
  type SemanticRegionProps,
  type SemanticRegionType,
} from "./components"

// =============================================================================
// CatalogService (Effect Service for domain catalog composition)
// =============================================================================

export {
  // Service Tag
  CatalogComponents,
  // Layer factory
  createCatalogLayer,
  // Accessors (return Effects)
  getRenderersRecord,
  getSchemasRecord,
  getSystemPrompt,
  getRegister,
  // Types
  type DomainCatalog,
  type ComponentDef,
  type ComponentRenderProps,
  type SchemaEntry,
} from "./CatalogService"

// =============================================================================
// Interactable (Bidirectional Component State)
// =============================================================================

export {
  // Schema types
  InteractableElement,
  StateFieldDecl,
  StateChange,
  StateChangeBatch,
  StateSchema,

  // Type guard
  hasStateSchema,
} from "./interactable"

// =============================================================================
// Tool Protocol (Client-side tool calling aligned with harness)
// =============================================================================

export {
  // Schemas
  GeniferToolDefinition,
  GeniferToolCall,
  GeniferToolResult,
  ToolInvocationState,

  // Types
  type GeniferToolHandler,
} from "./tools"

// =============================================================================
// Prompt Templating
// =============================================================================

export {
  PromptTemplate,
  PromptSlot,
  CompiledPrompt,
  PromptSlotType,
} from "./prompts"

// =============================================================================
// Conversation Threads
// =============================================================================

export {
  Thread,
  ThreadMessage,
  Turn,
  TextContent,
  UITreeContent,
  ToolCallContent,
  ToolResultContent,
  ThinkingContent,
  MessageContent,
  MessageRole,
} from "./threads"
