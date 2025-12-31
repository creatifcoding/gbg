/**
 * useBlockTerminal Hook
 *
 * Atom-based hook for OpenWarp block terminal functionality.
 * Follows Atom-as-State doctrine - no useState for shared state.
 */

import { useCallback, useRef, useEffect } from 'react'
import { useAtomValue, useAtom } from '@effect-atom/atom-react'
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

  // State from atoms
  const blocks = useAtomValue(blocksAtom)
  const cwd = useAtomValue(blockCwdAtom)
  const latestBlock = useAtomValue(latestBlockAtom)
  const activeBlocks = useAtomValue(activeBlocksAtom)
  const blockCount = useAtomValue(blockCountAtom)
  const hasActiveBlock = useAtomValue(hasActiveBlockAtom)
  const [userScrolled, setUserScrolledAtom] = useAtom(userScrolledAtom)
  const inputHistory = useAtomValue(inputHistoryAtom)
  const historyIndex = useAtomValue(historyIndexAtom)

  // Initialize CWD on mount
  useEffect(() => {
    if (!cwd && initialCwd) {
      setBlockCwd(initialCwd)
    }
  }, [cwd, initialCwd])

  // Track previous blocks for callbacks
  const prevBlocksRef = useRef<readonly Block[]>(blocks)
  useEffect(() => {
    const prevBlocks = prevBlocksRef.current
    prevBlocksRef.current = blocks

    // Detect new blocks
    if (blocks.length > prevBlocks.length && onBlockAdded) {
      const newBlock = blocks[blocks.length - 1]
      onBlockAdded(newBlock)
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
    return executeCommandOp({ command, cwd })
  }, [cwd])

  const executeAIQuery = useCallback(async (prompt: string, model?: string) => {
    return executeAIQueryOp({ prompt, model })
  }, [])

  const addSystemMessage = useCallback((message: string) => {
    const block = createSystemBlock(message)
    addBlock(block)
    return block.id
  }, [])

  const addErrorMessage = useCallback((message: string) => {
    return addErrorBlockOp(message)
  }, [])

  const dismissBlock = useCallback(async (id: string) => {
    await dismissBlockOp({ id })
  }, [])

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

  return {
    // State
    blocks,
    cwd,
    latestBlock,
    activeBlocks,
    blockCount,
    hasActiveBlock,
    userScrolled,

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
