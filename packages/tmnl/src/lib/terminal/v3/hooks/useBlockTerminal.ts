/**
 * useBlockTerminal Hook
 *
 * Main hook for terminal v3 - provides state and operations.
 * Clean atom reads, no Result unwrapping needed.
 */

import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import { useCallback, useMemo } from 'react'
import {
  // STX atoms
  terminalStateAtom,
  terminalContextAtom,
  inputModeAtom,
  canSubmitAtom,
  isActiveAtom,
  isStreamingAtom,
  isExecutingAtom,
  activeBlockIdAtom,
  activeStreamIdAtom,
  activePtyIdAtom,
  errorAtom,
  userScrolledAtom,
  cwdAtom,
  terminalActorOps,
  type InputMode,
} from '../terminal-stx'
import {
  // Block atoms
  blocksAtom,
  latestBlockAtom,
  blockCountAtom,
  historyUp,
  historyDown,
  resetHistoryIndex,
  clearBlocks,
  // Effect operations
  executeCommandOp,
  executeAIQueryOp,
} from '../atoms'
import {
  // AI-core for active stream content
  streamStateByIdAtom,
  type AIStreamState,
} from '@/lib/ai-core'
import type { BlockHandle } from '../services'
import type { BlockV3, TerminalMachineState } from '../'

// =============================================================================
// Types
// =============================================================================

export interface UseBlockTerminalResult {
  // Machine state (from stx)
  state: TerminalMachineState
  inputMode: InputMode
  canSubmit: boolean
  isActive: boolean
  isStreaming: boolean
  isExecuting: boolean
  cwd: string
  error: string | null
  userScrolled: boolean

  // Active operation info
  activeBlockId: string | null
  activeStreamId: string | null
  activePtyId: string | null

  // Blocks (reference-based)
  blocks: readonly BlockV3[]
  latestBlock: BlockV3 | null
  blockCount: number

  // Active stream content (derived from ai-core)
  activeStreamContent: AIStreamState | null

  // Operations
  executeCommand: (command: string, cwd?: string) => Promise<BlockHandle>
  executeAIQuery: (prompt: string, model?: string) => Promise<BlockHandle>
  abort: () => void

  // Mode control
  setMode: (mode: InputMode) => void
  toggleMode: () => void

  // Navigation
  setCwd: (cwd: string) => void
  setScroll: (userScrolled: boolean) => void

  // History
  historyUp: () => string | null
  historyDown: () => string | null
  resetHistoryIndex: () => void

  // Block management
  clearBlocks: () => void
}

// =============================================================================
// Hook
// =============================================================================

export function useBlockTerminal(): UseBlockTerminalResult {
  // ---------------------------------------------------------------------------
  // Machine state (clean reads, no Result unwrapping)
  // ---------------------------------------------------------------------------
  const state = useAtomValue(terminalStateAtom)
  const context = useAtomValue(terminalContextAtom)
  const inputMode = useAtomValue(inputModeAtom)
  const canSubmit = useAtomValue(canSubmitAtom)
  const isActive = useAtomValue(isActiveAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const isExecuting = useAtomValue(isExecutingAtom)
  const cwd = useAtomValue(cwdAtom)
  const error = useAtomValue(errorAtom)
  const userScrolled = useAtomValue(userScrolledAtom)

  // Active operation info
  const activeBlockId = useAtomValue(activeBlockIdAtom)
  const activeStreamId = useAtomValue(activeStreamIdAtom)
  const activePtyId = useAtomValue(activePtyIdAtom)

  // ---------------------------------------------------------------------------
  // Blocks
  // ---------------------------------------------------------------------------
  const blocks = useAtomValue(blocksAtom)
  const latestBlock = useAtomValue(latestBlockAtom)
  const blockCount = useAtomValue(blockCountAtom)

  // ---------------------------------------------------------------------------
  // Active stream content (derived from ai-core by ID)
  // ---------------------------------------------------------------------------
  // IMPORTANT: Always call useAtomValue unconditionally to satisfy Rules of Hooks.
  // Use a stable atom reference via useMemo, defaulting to a no-op stream ID.
  const activeStreamAtom = useMemo(
    () => streamStateByIdAtom(activeStreamId ?? '__no_active_stream__'),
    [activeStreamId]
  )
  const activeStreamContentRaw = useAtomValue(activeStreamAtom)
  // Only return content if we have an active stream
  const activeStreamContent = activeStreamId ? activeStreamContentRaw : null

  // ---------------------------------------------------------------------------
  // Operations (via useAtomSet with promise mode)
  // ---------------------------------------------------------------------------
  const doExecuteCommand = useAtomSet(executeCommandOp, { mode: 'promise' })
  const doExecuteAIQuery = useAtomSet(executeAIQueryOp, { mode: 'promise' })

  const executeCommand = useCallback(
    async (command: string, commandCwd?: string): Promise<BlockHandle> => {
      return doExecuteCommand({ command, cwd: commandCwd })
    },
    [doExecuteCommand]
  )

  const executeAIQuery = useCallback(
    async (prompt: string, model?: string): Promise<BlockHandle> => {
      return doExecuteAIQuery({ prompt, model })
    },
    [doExecuteAIQuery]
  )

  const abort = useCallback(() => {
    terminalActorOps.abort()
  }, [])

  // ---------------------------------------------------------------------------
  // Mode control
  // ---------------------------------------------------------------------------
  const setMode = useCallback((mode: InputMode) => {
    terminalActorOps.setMode(mode)
  }, [])

  const toggleMode = useCallback(() => {
    terminalActorOps.toggleMode()
  }, [])

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const setCwd = useCallback((newCwd: string) => {
    terminalActorOps.setCwd(newCwd)
  }, [])

  const setScroll = useCallback((scrolled: boolean) => {
    terminalActorOps.setScroll(scrolled)
  }, [])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    // Machine state
    state,
    inputMode,
    canSubmit,
    isActive,
    isStreaming,
    isExecuting,
    cwd,
    error,
    userScrolled,

    // Active operation info
    activeBlockId,
    activeStreamId,
    activePtyId,

    // Blocks
    blocks,
    latestBlock,
    blockCount,

    // Active stream content
    activeStreamContent,

    // Operations
    executeCommand,
    executeAIQuery,
    abort,

    // Mode control
    setMode,
    toggleMode,

    // Navigation
    setCwd,
    setScroll,

    // History
    historyUp,
    historyDown,
    resetHistoryIndex,

    // Block management
    clearBlocks,
  }
}
