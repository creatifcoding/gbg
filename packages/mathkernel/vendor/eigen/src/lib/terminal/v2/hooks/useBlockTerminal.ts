/**
 * useBlockTerminal Hook
 *
 * Atom-based hook for OpenWarp block terminal functionality.
 * Follows Atom-as-State doctrine - no useState for shared state.
 */

import { useCallback, useRef, useEffect } from 'react'
import { useAtomValue, useAtom, useAtomSet } from '@effect-atom/atom-react'
import {
  // State atoms
  blocksAtom,
  blockCwdAtom,
  userScrolledAtom,
  inputHistoryAtom,
  historyIndexAtom,
  // Derived atoms
  latestBlockAtom,
  activeBlocksAtom,
  blockCountAtom,
  hasActiveBlockAtom,
  // ai-core integration
  isStreamingAtom,
  // Operations
  addBlock,
  updateBlock,
  removeBlock,
  clearBlocks,
  setBlockCwd,
  addToHistory,
  historyUp,
  historyDown,
  resetHistoryIndex,
  addErrorBlockOp,
  abortStreamOp,
  // Effect operations
  executeCommandOp,
  executeAIQueryOp,
  dismissBlockOp,
} from '../atoms'
import type { Block } from '../schemas'
import { createSystemBlock } from '../schemas/blocks'

export interface UseBlockTerminalOptions {
  /**
   * Initial working directory
   */
  initialCwd?: string

  /**
   * Called when a new block is added
   */
  onBlockAdded?: (block: Block) => void

  /**
   * Called when a block completes
   */
  onBlockCompleted?: (block: Block) => void

  /**
   * Called when CWD changes
   */
  onCwdChange?: (cwd: string) => void

  /**
   * Enable auto-scroll to latest block
   */
  autoScroll?: boolean
}

export interface UseBlockTerminalResult {
  // State
  blocks: readonly Block[]
  cwd: string
  latestBlock: Block | null
  activeBlocks: readonly Block[]
  blockCount: number
  hasActiveBlock: boolean
  userScrolled: boolean

  // AI streaming state (from ai-core)
  isStreaming: boolean

  // Input handling
  inputHistory: readonly string[]
  historyIndex: number
  navigateHistoryUp: () => string | null
  navigateHistoryDown: () => string | null
  resetHistory: () => void

  // Block operations
  executeCommand: (command: string) => Promise<{ blockId: string; ptyId: string; interactive: boolean }>
  executeAIQuery: (prompt: string, model?: string) => Promise<{ blockId: string }>
  addSystemMessage: (message: string) => string
  addErrorMessage: (message: string) => string
  dismissBlock: (id: string) => Promise<void>
  clearAllBlocks: () => void
  removeBlockById: (id: string) => void

  // AI stream control
  abortStream: () => void

  // Scroll control
  setUserScrolled: (scrolled: boolean) => void
  scrollToBottom: () => void

  // Container ref for scroll management
  containerRef: React.RefObject<HTMLDivElement>
}

/**
 * Hook for managing block terminal state and operations.
 *
 * @example
 * ```tsx
 * function BlockTerminal() {
 *   const {
 *     blocks,
 *     executeCommand,
 *     executeAIQuery,
 *     containerRef,
 *   } = useBlockTerminal({ initialCwd: '~' })
 *
 *   const handleSubmit = async (input: string) => {
 *     if (input.startsWith('/')) {
 *       await executeAIQuery(input.slice(1))
 *     } else {
 *       await executeCommand(input)
 *     }
 *   }
 *
 *   return (
 *     <div ref={containerRef}>
 *       {blocks.map((block) => (
 *         <BlockRenderer key={block.id} block={block} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useBlockTerminal(options: UseBlockTerminalOptions = {}): UseBlockTerminalResult {
  const {
    initialCwd = '~',
    onBlockAdded,
    onBlockCompleted,
    onCwdChange,
    autoScroll = true,
  } = options

  // Container ref for scroll management
  const containerRef = useRef<HTMLDivElement>(null)

  // Read blocks atom - handle potential Result wrapper from effect-atom
  const rawBlocks = useAtomValue(blocksAtom)

  // PATTERN: Identify what type was returned and handle accordingly
  // effect-atom can return Result<A,E> for async atoms or plain A for state atoms
  // Check for Result type structure (has _tag property like 'Initial', 'Success', 'Failure')
  const blocks: readonly Block[] = (() => {
    // If it's already an array, use it directly
    if (Array.isArray(rawBlocks)) {
      return rawBlocks
    }

    // Check if it's a Result type (has _tag property)
    const maybeResult = rawBlocks as { _tag?: string; value?: readonly Block[]; waiting?: boolean }
    if (maybeResult && typeof maybeResult === 'object' && '_tag' in maybeResult) {
      // It's a Result type - extract value based on _tag
      switch (maybeResult._tag) {
        case 'Success':
          // Success has a value property with the actual data
          return Array.isArray(maybeResult.value) ? maybeResult.value : []
        case 'Initial':
        case 'Failure':
          // Initial state or failure - return empty array
          return []
        default:
          // Unknown Result variant - log and return empty
          console.warn('[useBlockTerminal] Unknown Result _tag:', maybeResult._tag)
          return []
      }
    }

    // Fallback: If none of the above, return empty and log warning
    console.warn('[useBlockTerminal] blocksAtom returned unexpected type:', {
      type: typeof rawBlocks,
      constructor: (rawBlocks as any)?.constructor?.name,
      keys: rawBlocks && typeof rawBlocks === 'object' ? Object.keys(rawBlocks) : 'N/A',
    })
    return []
  })()
  const cwd = useAtomValue(blockCwdAtom) ?? ''
  const latestBlock = useAtomValue(latestBlockAtom) ?? null
  const rawActiveBlocks = useAtomValue(activeBlocksAtom)
  const activeBlocks = rawActiveBlocks ?? []
  const blockCount = useAtomValue(blockCountAtom) ?? 0
  const hasActiveBlock = useAtomValue(hasActiveBlockAtom) ?? false
  const [userScrolled, setUserScrolledAtom] = useAtom(userScrolledAtom)
  const rawInputHistory = useAtomValue(inputHistoryAtom)
  const inputHistory = rawInputHistory ?? []
  const historyIndex = useAtomValue(historyIndexAtom) ?? -1

  // AI streaming state from ai-core
  const isStreaming = useAtomValue(isStreamingAtom) ?? false

  // Operation atoms → callable functions via useAtomSet
  const doExecuteCommand = useAtomSet(executeCommandOp, { mode: 'promise' })
  const doExecuteAIQuery = useAtomSet(executeAIQueryOp, { mode: 'promise' })
  const doDismissBlock = useAtomSet(dismissBlockOp, { mode: 'promise' })

  // Initialize CWD on mount
  useEffect(() => {
    if (!cwd && initialCwd) {
      setBlockCwd(initialCwd)
    }
  }, [cwd, initialCwd])

  // Track previous blocks for callbacks
  // Initialize with empty array as blocks may be undefined on first render
  const prevBlocksRef = useRef<readonly Block[]>([])
  useEffect(() => {
    const prevBlocks = prevBlocksRef.current ?? []
    prevBlocksRef.current = blocks

    // Detect new blocks (both arrays guaranteed to be arrays now)
    if (blocks.length > prevBlocks.length && onBlockAdded) {
      const newBlock = blocks[blocks.length - 1]
      if (newBlock) {
        onBlockAdded(newBlock)
      }
    }

    // Detect completed blocks
    if (onBlockCompleted) {
      for (const block of blocks) {
        const prevBlock = prevBlocks.find((b) => b.id === block.id)
        if (prevBlock) {
          // Check if block just completed
          const wasActive = isBlockActive(prevBlock)
          const isNowActive = isBlockActive(block)
          if (wasActive && !isNowActive) {
            onBlockCompleted(block)
          }
        }
      }
    }
  }, [blocks, onBlockAdded, onBlockCompleted])

  // Track CWD changes
  const prevCwdRef = useRef(cwd)
  useEffect(() => {
    if (cwd !== prevCwdRef.current) {
      prevCwdRef.current = cwd
      onCwdChange?.(cwd)
    }
  }, [cwd, onCwdChange])

  // Auto-scroll behavior
  useEffect(() => {
    if (autoScroll && !userScrolled && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [blocks, autoScroll, userScrolled])

  // Operations
  const executeCommand = useCallback(async (command: string) => {
    return doExecuteCommand({ command, cwd })
  }, [cwd, doExecuteCommand])

  const executeAIQuery = useCallback(async (prompt: string, model?: string) => {
    return doExecuteAIQuery({ prompt, model })
  }, [doExecuteAIQuery])

  const addSystemMessage = useCallback((message: string) => {
    const block = createSystemBlock(message)
    addBlock(block)
    return block.id
  }, [])

  const addErrorMessage = useCallback((message: string) => {
    return addErrorBlockOp(message)
  }, [])

  const dismissBlock = useCallback(async (id: string) => {
    await doDismissBlock({ id })
  }, [doDismissBlock])

  const clearAllBlocks = useCallback(() => {
    clearBlocks()
  }, [])

  const removeBlockById = useCallback((id: string) => {
    removeBlock(id)
  }, [])

  const setUserScrolled = useCallback((scrolled: boolean) => {
    setUserScrolledAtom(scrolled)
  }, [setUserScrolledAtom])

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setUserScrolledAtom(false)
    }
  }, [setUserScrolledAtom])

  const navigateHistoryUp = useCallback(() => {
    return historyUp()
  }, [])

  const navigateHistoryDown = useCallback(() => {
    return historyDown()
  }, [])

  const resetHistory = useCallback(() => {
    resetHistoryIndex()
  }, [])

  const abortStream = useCallback(() => {
    abortStreamOp()
  }, [])

  return {
    // State
    blocks,
    cwd,
    latestBlock,
    activeBlocks,
    blockCount,
    hasActiveBlock,
    userScrolled,

    // AI streaming state
    isStreaming,

    // Input handling
    inputHistory,
    historyIndex,
    navigateHistoryUp,
    navigateHistoryDown,
    resetHistory,

    // Block operations
    executeCommand,
    executeAIQuery,
    addSystemMessage,
    addErrorMessage,
    dismissBlock,
    clearAllBlocks,
    removeBlockById,

    // AI stream control
    abortStream,

    // Scroll control
    setUserScrolled,
    scrollToBottom,

    // Container ref
    containerRef,
  }
}

// Re-export for convenience
export { isBlockActive } from '../schemas/blocks'

/**
 * Helper to check if a block is active
 */
function isBlockActive(block: Block): boolean {
  switch (block._tag) {
    case 'command':
    case 'interactive':
      return block.isRunning
    case 'ai-response':
      return block.isStreaming
    default:
      return false
  }
}
