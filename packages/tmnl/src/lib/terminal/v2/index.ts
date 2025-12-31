/**
 * Terminal v2 Module
 *
 * Effect-TS based terminal with OpenWarp block mode support.
 *
 * Features:
 * - PTY management via TauriPtyService
 * - Block-based terminal (OpenWarp mode)
 * - AI integration for natural language commands
 * - Effect-atom state management
 *
 * @example
 * ```tsx
 * import {
 *   useBlockTerminal,
 *   BlocksView,
 *   BlockInput,
 *   blocksAtom,
 *   terminalModeAtom,
 * } from '@/lib/terminal/v2'
 *
 * function BlockTerminal() {
 *   const {
 *     blocks,
 *     executeCommand,
 *     executeAIQuery,
 *     containerRef,
 *   } = useBlockTerminal({ initialCwd: '~' })
 *
 *   return (
 *     <div className="flex flex-col h-full">
 *       <BlocksView
 *         blocks={blocks}
 *         containerRef={containerRef}
 *         autoScroll
 *       />
 *       <BlockInput
 *         onSubmit={(cmd, isAI, thinking) => {
 *           if (isAI) executeAIQuery(cmd, thinking)
 *           else executeCommand(cmd)
 *         }}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */

// =============================================================================
// Services
// =============================================================================

export { TauriPtyService } from './services/TauriPtyService'

// =============================================================================
// Schemas
// =============================================================================

export {
  // Terminal schemas
  TerminalStatus,
  TerminalMode,
  CursorStyle,
  TerminalTheme,
  TerminalConfig,
  TerminalInstanceState,
  PtySpawnOptions,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalPwdChangeEvent,
  TerminalEvent,
  // Block schemas
  BlockType,
  ToolCallStatus,
  ToolCall,
  TokenUsage,
  CommandBlock,
  AIResponseBlock,
  InteractiveBlock,
  ErrorBlock,
  SystemBlock,
  Block,
  BlockTerminalState,
  INITIAL_BLOCK_STATE,
  // Block helpers
  isInteractiveCommand,
  createCommandBlock,
  createAIResponseBlock,
  createInteractiveBlock,
  createErrorBlock,
  createSystemBlock,
  getBlockTime,
  isBlockActive,
} from './schemas'

export type {
  TerminalStatus,
  TerminalMode,
  CursorStyle,
  TerminalTheme,
  TerminalConfig,
  TerminalInstanceState,
  PtySpawnOptions,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalPwdChangeEvent,
  TerminalEvent,
  BlockType,
  ToolCallStatus,
  ToolCall,
  TokenUsage,
  CommandBlock,
  AIResponseBlock,
  InteractiveBlock,
  ErrorBlock,
  SystemBlock,
  Block,
  BlockTerminalState,
} from './schemas'

// =============================================================================
// Atoms
// =============================================================================

export {
  // Runtime atoms
  terminalRuntimeAtom,
  blockTerminalRuntimeAtom,
  // Terminal state atoms
  terminalModeAtom,
  terminalStatusAtom,
  activeTerminalIdAtom,
  terminalInstancesAtom,
  terminalConfigAtom,
  // Terminal derived atoms
  activeTerminalAtom,
  isTerminalReadyAtom,
  activePwdAtom,
  terminalCountAtom,
  // Terminal operations
  setTerminalMode,
  toggleTerminalMode,
  updateTerminalConfig,
  registerTerminal,
  updateTerminalInstance,
  unregisterTerminal,
  setActiveTerminal,
  spawnTerminalOp,
  killTerminalOp,
  listTerminalsOp,
  // Block state atoms
  blocksAtom,
  blockCwdAtom,
  maxBlocksAtom,
  userScrolledAtom,
  inputHistoryAtom,
  historyIndexAtom,
  // Block derived atoms
  latestBlockAtom,
  activeBlocksAtom,
  completedBlocksAtom,
  blockCountAtom,
  hasActiveBlockAtom,
  // Block operations
  addBlock,
  updateBlock,
  removeBlock,
  clearBlocks,
  setBlockCwd,
  addToHistory,
  historyUp,
  historyDown,
  resetHistoryIndex,
  executeCommandOp,
  executeAIQueryOp,
  addErrorBlockOp,
  dismissBlockOp,
} from './atoms'

// =============================================================================
// Hooks
// =============================================================================

export {
  useBlockTerminal,
  isBlockActive as isBlockActiveHelper,
  type UseBlockTerminalOptions,
  type UseBlockTerminalResult,
} from './hooks'

// =============================================================================
// Components
// =============================================================================

export {
  // Block components
  CommandBlock as CommandBlockComponent,
  AIResponseBlock as AIResponseBlockComponent,
  InteractiveBlock as InteractiveBlockComponent,
  ErrorBlock as ErrorBlockComponent,
  SystemBlock as SystemBlockComponent,
  // Container components
  BlocksView,
  // Input components
  BlockInput,
  // Types
  type CommandBlockProps,
  type AIResponseBlockProps,
  type InteractiveBlockProps,
  type ErrorBlockProps,
  type SystemBlockProps,
  type BlocksViewProps,
  type BlockInputProps,
} from './components'
