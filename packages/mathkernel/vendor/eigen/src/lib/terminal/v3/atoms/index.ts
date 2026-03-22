/**
 * Terminal v3 Block Atoms
 *
 * Atom-as-State doctrine for block management.
 * Blocks are the visual representation of terminal operations.
 *
 * Key difference from v2:
 * - AIResponseBlockV3 stores streamRef (reference), not content
 * - Content is derived from ai-core's streamStateByIdAtom
 */

import { Atom } from '@effect-atom/atom'
import { Effect } from 'effect'
import { terminalRegistry } from '../terminal-stx'
import {
  type BlockV3,
  type AIResponseBlockV3,
  type CommandBlockV3,
  type InteractiveBlockV3,
  isAIResponseBlock,
  isCommandBlock,
  isInteractiveBlock,
} from '../schemas'
import { blockTerminalRuntimeAtom } from '../layers'
import { BlockTerminalService, type BlockHandle } from '../services'

// =============================================================================
// State Atoms
// =============================================================================

/**
 * All blocks in the terminal
 */
export const blocksAtom = Atom.make<readonly BlockV3[]>([])

/**
 * Maximum number of blocks to retain (LRU eviction)
 */
export const maxBlocksAtom = Atom.make<number>(500)

/**
 * Command history for up/down navigation
 */
export const inputHistoryAtom = Atom.make<readonly string[]>([])

/**
 * Current history navigation index (-1 = not navigating)
 */
export const historyIndexAtom = Atom.make<number>(-1)

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Latest block (most recent)
 */
export const latestBlockAtom = Atom.make((get): BlockV3 | null => {
  const blocks = get(blocksAtom)
  return blocks.length > 0 ? blocks[blocks.length - 1] : null
})

/**
 * Block count
 */
export const blockCountAtom = Atom.make((get): number => {
  const blocks = get(blocksAtom)
  return blocks.length
})

/**
 * AI response blocks only
 */
export const aiBlocksAtom = Atom.make((get): readonly AIResponseBlockV3[] => {
  const blocks = get(blocksAtom)
  return blocks.filter(isAIResponseBlock)
})

/**
 * Command blocks only
 */
export const commandBlocksAtom = Atom.make((get): readonly CommandBlockV3[] => {
  const blocks = get(blocksAtom)
  return blocks.filter(isCommandBlock)
})

/**
 * Interactive blocks only
 */
export const interactiveBlocksAtom = Atom.make((get): readonly InteractiveBlockV3[] => {
  const blocks = get(blocksAtom)
  return blocks.filter(isInteractiveBlock)
})

/**
 * Active interactive blocks (not dismissed, no end time)
 */
export const activeInteractiveBlocksAtom = Atom.make((get): readonly InteractiveBlockV3[] => {
  const blocks = get(interactiveBlocksAtom)
  return blocks.filter((b) => !b.dismissed && b.endTime === null)
})

/**
 * Has any active interactive blocks
 */
export const hasActiveInteractiveAtom = Atom.make((get): boolean => {
  const active = get(activeInteractiveBlocksAtom)
  return active.length > 0
})

// =============================================================================
// Block Operations (registry mutations)
// =============================================================================

/**
 * Add a block to the list
 */
export const addBlock = (block: BlockV3): void => {
  terminalRegistry.update(blocksAtom, (prev) => {
    const maxBlocks = terminalRegistry.get(maxBlocksAtom)
    const next = [...prev, block]
    // LRU eviction if over limit
    if (next.length > maxBlocks) {
      return next.slice(next.length - maxBlocks)
    }
    return next
  })
}

/**
 * Update a block by ID
 */
export const updateBlock = <T extends BlockV3>(
  id: string,
  updater: (block: T) => T
): void => {
  terminalRegistry.update(blocksAtom, (prev) =>
    prev.map((b) => (b.id === id ? updater(b as T) : b))
  )
}

/**
 * Remove a block by ID
 */
export const removeBlock = (id: string): void => {
  terminalRegistry.update(blocksAtom, (prev) =>
    prev.filter((b) => b.id !== id)
  )
}

/**
 * Clear all blocks
 */
export const clearBlocks = (): void => {
  terminalRegistry.set(blocksAtom, [])
}

/**
 * Get block by ID
 */
export const getBlockById = (id: string): BlockV3 | undefined => {
  const blocks = terminalRegistry.get(blocksAtom)
  return blocks.find((b) => b.id === id)
}

// =============================================================================
// History Operations
// =============================================================================

const MAX_HISTORY = 1000

/**
 * Add input to history (deduplicated)
 */
export const addToHistory = (input: string): void => {
  if (!input.trim()) return

  terminalRegistry.update(inputHistoryAtom, (prev) => {
    // Remove duplicates
    const filtered = prev.filter((h) => h !== input)
    const next = [...filtered, input]
    // Cap at max history
    if (next.length > MAX_HISTORY) {
      return next.slice(next.length - MAX_HISTORY)
    }
    return next
  })
  // Reset history index
  terminalRegistry.set(historyIndexAtom, -1)
}

/**
 * Navigate history up (older)
 */
export const historyUp = (): string | null => {
  const history = terminalRegistry.get(inputHistoryAtom)
  if (history.length === 0) return null

  const currentIndex = terminalRegistry.get(historyIndexAtom)
  const nextIndex =
    currentIndex === -1
      ? history.length - 1
      : Math.max(0, currentIndex - 1)

  terminalRegistry.set(historyIndexAtom, nextIndex)
  return history[nextIndex] ?? null
}

/**
 * Navigate history down (newer)
 */
export const historyDown = (): string | null => {
  const history = terminalRegistry.get(inputHistoryAtom)
  const currentIndex = terminalRegistry.get(historyIndexAtom)

  if (currentIndex === -1) return null

  const nextIndex = currentIndex + 1
  if (nextIndex >= history.length) {
    // Reset to no selection
    terminalRegistry.set(historyIndexAtom, -1)
    return ''
  }

  terminalRegistry.set(historyIndexAtom, nextIndex)
  return history[nextIndex] ?? null
}

/**
 * Reset history navigation index
 */
export const resetHistoryIndex = (): void => {
  terminalRegistry.set(historyIndexAtom, -1)
}

// =============================================================================
// Registry Initialization
// =============================================================================

/**
 * Initialize all atoms in the registry.
 * Must be called before any operations.
 */
export const initializeBlockAtoms = (): void => {
  // Touch all atoms to ensure they're registered
  terminalRegistry.get(blocksAtom)
  terminalRegistry.get(maxBlocksAtom)
  terminalRegistry.get(inputHistoryAtom)
  terminalRegistry.get(historyIndexAtom)
}

// =============================================================================
// Effect Operations (runtime-bound)
// =============================================================================

/**
 * Execute a shell command.
 * Creates CommandBlockV3 or InteractiveBlockV3.
 */
export const executeCommandOp = blockTerminalRuntimeAtom.fn<{
  command: string
  cwd?: string
}>()((args, _ctx) =>
  Effect.gen(function* () {
    const service = yield* BlockTerminalService
    return yield* service.executeCommand(args)
  })
)

/**
 * Execute an AI query.
 * Creates AIResponseBlockV3 with streamRef.
 * Content is derived from ai-core, NOT stored in block.
 */
export const executeAIQueryOp = blockTerminalRuntimeAtom.fn<{
  prompt: string
  model?: string
  systemPrompt?: string
}>()((args, _ctx) =>
  Effect.gen(function* () {
    const service = yield* BlockTerminalService
    return yield* service.executeAIQuery(args)
  })
)

// =============================================================================
// Map Insertion Atoms
// =============================================================================

export {
  // Types
  type InsertionStatus,
  type PendingMapInsertion,
  // Core atoms
  pendingMapInsertionsAtom,
  editorAvailableAtom,
  // Derived atoms
  pendingCountAtom,
  latestPendingAtom,
  insertionByIdAtom,
  activeInsertionsCountAtom,
  completedInsertionsAtom,
  failedInsertionsAtom,
  // Effect operations
  mapInsertionOps,
  // Registry operations
  queueMapSync,
  queueMapTerminal,
  updateInsertionStatusSync,
  updateInsertionStatusTerminal,
  removeInsertionSync,
  isEditorAvailableSync,
  setEditorAvailableSync,
  // Initialization
  initializeMapInsertionAtoms,
} from './map-insertion'
