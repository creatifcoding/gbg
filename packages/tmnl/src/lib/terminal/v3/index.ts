/**
 * Terminal v3
 *
 * Reference-based block terminal built on ai-core and cursor foundations.
 *
 * Key differences from v2:
 * - AIResponseBlockV3 stores streamRef (reference to ai-core state)
 * - Content derived via useAIBlockContent() hook
 * - No dual-write: stream events go ONLY to ai-core
 * - XState machine for terminal state
 * - STX pattern for XState → effect-atom bridge
 *
 * @example
 * ```tsx
 * import { TerminalRegistryProvider, useBlockTerminal, useAIBlockContent } from '@/lib/terminal/v3'
 *
 * function Terminal() {
 *   return (
 *     <TerminalRegistryProvider>
 *       <TerminalInner />
 *     </TerminalRegistryProvider>
 *   )
 * }
 *
 * function TerminalInner() {
 *   const { blocks, executeAIQuery, isStreaming } = useBlockTerminal()
 *
 *   return (
 *     <div>
 *       {blocks.map((block) => (
 *         <BlockRenderer key={block.id} block={block} />
 *       ))}
 *     </div>
 *   )
 * }
 *
 * function AIBlockRenderer({ block }: { block: AIResponseBlockV3 }) {
 *   const content = useAIBlockContent(block)
 *   return <div>{content.text}</div>
 * }
 * ```
 */

// =============================================================================
// Schemas
// =============================================================================

export {
  // Stream reference (schema serves as both value and type via Schema.Type<>)
  StreamRef,
  // Block schemas
  AIResponseBlockV3,
  CommandBlockV3,
  InteractiveBlockV3,
  SystemBlockV3,
  ErrorBlockV3,
  GeniferBlockV3,
  BlockV3,
  // Type guards
  isAIResponseBlock,
  isCommandBlock,
  isInteractiveBlock,
  isSystemBlock,
  isErrorBlock,
  isGeniferBlock,
  isBlockActive,
  // Factories
  createAIResponseBlock,
  createCommandBlock,
  createInteractiveBlock,
  createSystemBlock,
  createErrorBlock,
  createGeniferBlock,
  createGeniferBlockWithRegions,
  // GeniferBlock specific
  SemanticRegionEntry,
} from './schemas'

// Re-export type aliases with distinct names
export type {
  StreamRefType,
  AIResponseBlockV3Type,
  CommandBlockV3Type,
  InteractiveBlockV3Type,
  SystemBlockV3Type,
  ErrorBlockV3Type,
  BlockV3Type,
  GeniferBlockV3ExportType,
  SemanticRegionEntryExportType,
} from './schemas'

// =============================================================================
// Machines
// =============================================================================

export {
  terminalMachine,
  type TerminalMachineContext,
  type TerminalMachineEvent,
  type TerminalMachineSnapshot,
  type TerminalMachineState,
  type InputMode,
  getTerminalState,
  canSubmit,
  isActive,
  isStreaming,
  isExecuting,
} from './machines'

// =============================================================================
// STX (XState + effect-atom bridge)
// =============================================================================

export {
  // Registry
  terminalRegistry,
  TerminalRegistryProvider,
  // Snapshot bridge
  terminalSnapshotAtom,
  // Derived atoms
  terminalStateAtom,
  terminalContextAtom,
  inputModeAtom,
  cwdAtom,
  canSubmitAtom,
  isActiveAtom,
  isStreamingAtom,
  isExecutingAtom,
  activeBlockIdAtom,
  activeStreamIdAtom,
  activePtyIdAtom,
  errorAtom,
  userScrolledAtom,
  // Actor operations
  terminalActorOps,
  // Actor access
  getTerminalActor,
} from './terminal-stx'

// =============================================================================
// Atoms
// =============================================================================

export {
  // State atoms
  blocksAtom,
  maxBlocksAtom,
  inputHistoryAtom,
  historyIndexAtom,
  // Derived atoms
  latestBlockAtom,
  blockCountAtom,
  aiBlocksAtom,
  commandBlocksAtom,
  interactiveBlocksAtom,
  activeInteractiveBlocksAtom,
  hasActiveInteractiveAtom,
  // Block operations
  addBlock,
  updateBlock,
  removeBlock,
  clearBlocks,
  getBlockById,
  // History operations
  addToHistory,
  historyUp,
  historyDown,
  resetHistoryIndex,
  // Initialization
  initializeBlockAtoms,
  // Effect operations
  executeCommandOp,
  executeAIQueryOp,
} from './atoms'

// =============================================================================
// Services
// =============================================================================

export {
  BlockTerminalService,
  type BlockTerminalServiceShape,
  type BlockHandle,
} from './services'

// =============================================================================
// Layers
// =============================================================================

export {
  BlockTerminalLive,
  blockTerminalRuntimeAtom,
} from './layers'

// =============================================================================
// Hooks
// =============================================================================

export {
  useBlockTerminal,
  type UseBlockTerminalResult,
  useTerminalInput,
  terminalInputValueAtom,
  type UseTerminalInputOptions,
  type UseTerminalInputResult,
  useAIBlockContent,
  useAIBlockText,
  useAIBlockIsStreaming,
  useAIBlockThinking,
  useAIBlockToolCalls,
  type AIBlockContent,
} from './hooks'

// =============================================================================
// Components
// =============================================================================

export {
  AIResponse,
  AIResponseHeader,
  AIResponsePrompt,
  AIResponseThinking,
  AIResponseContent,
  AIResponseToolCalls,
  AIResponseMeta,
  AIResponseError,
  // Markdown rendering
  StreamingRenderer,
  MarkdownEditorView,
  EditableMarkdownEditor,
  MarkdownTextEditor,
  // Copy functionality
  CopyBlockButton,
  CopyBlockButtonWithLabel,
  // Code blocks
  CodeBlockView,
  StandaloneCodeBlock,
  CodeBlockWithCopy,
  createCodeBlockWithCopy,
  // Types
  type AIResponseProps,
  type MarkdownEditorViewProps,
  type EditableMarkdownEditorProps,
  type MarkdownTextEditorProps,
} from './components/AIResponse'

// Multiline TipTap-based terminal input
export {
  TerminalInput,
  type TerminalInputRef,
  type TerminalInputProps,
  type TipTapEditor,
} from './components/TerminalInput'

export {
  ToolCallView,
  ToolCallHeader,
  ToolCallArgs,
  ToolCallResult,
  ToolCallError,
  ToolCallMeta,
  type ToolViewProps,
} from './components/ToolCallView'

export {
  registerToolComponent,
  getToolComponent,
  getRegisteredToolNames,
  hasToolComponent,
  getToolCategory,
  getCategoryInfo,
  type ToolCategory,
} from './components/ToolCallView/registry'

// Specialized tool views
export {
  ReadToolView,
  BashToolView,
  EditToolView,
  GrepToolView,
} from './components/ToolCallView/tools'

// GeniferBlock - Rich UI rendering via genifer system
export {
  GeniferBlock,
  GeniferBlockHeader,
  GeniferBlockContent,
  GeniferBlockLoadingState,
  GeniferBlockEmptyState,
  GeniferBlockSemanticRegions,
  GeniferBlockMeta,
  type GeniferBlockProps,
} from './components/GeniferBlock'
