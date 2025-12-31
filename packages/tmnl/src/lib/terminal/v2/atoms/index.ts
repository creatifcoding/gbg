/**
 * Terminal v2 Atoms
 *
 * Effect-atom integration for terminal state management.
 * Follows Atom-as-State doctrine from CLAUDE.md.
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer } from 'effect'
import { TauriPtyService } from '../services/TauriPtyService'
import { AIService } from '@/lib/ai/services'
import type { TerminalMode, TerminalStatus, TerminalInstanceState, TerminalConfig } from '../schemas'
import {
  type Block,
  type BlockTerminalState,
  INITIAL_BLOCK_STATE,
  createCommandBlock,
  createAIResponseBlock,
  createInteractiveBlock,
  createErrorBlock,
  isInteractiveCommand,
  getBlockTime,
  isBlockActive,
} from '../schemas/blocks'

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Terminal runtime combining all service layers.
 * Extend this when adding more services (e.g., WebSocket fallback).
 */
export const terminalRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    TauriPtyService.Live
  )
)

// =============================================================================
// State Atoms
// =============================================================================

/**
 * Current terminal mode: ghostty (pure xterm) or openwarp (AI blocks)
 */
export const terminalModeAtom = Atom.make<TerminalMode>('ghostty')

/**
 * Global terminal status
 */
export const terminalStatusAtom = Atom.make<TerminalStatus>('disconnected')

/**
 * Active terminal ID (for multi-terminal support)
 */
export const activeTerminalIdAtom = Atom.make<string | null>(null)

/**
 * Terminal instance states (keyed by ID)
 */
export const terminalInstancesAtom = Atom.make<Map<string, TerminalInstanceState>>(new Map())

/**
 * Current terminal configuration
 */
export const terminalConfigAtom = Atom.make<Partial<TerminalConfig>>({
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontWeight: 'normal',
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
})

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Active terminal instance state
 */
export const activeTerminalAtom = Atom.make((get) => {
  const id = get(activeTerminalIdAtom)
  if (!id) return null
  const instances = get(terminalInstancesAtom)
  return instances.get(id) ?? null
})

/**
 * Whether terminal is connected and ready
 */
export const isTerminalReadyAtom = Atom.make((get) => {
  const status = get(terminalStatusAtom)
  return status === 'connected'
})

/**
 * Current working directory of active terminal
 */
export const activePwdAtom = Atom.make((get) => {
  const active = get(activeTerminalAtom)
  return active?.pwd
})

/**
 * Number of active terminals
 */
export const terminalCountAtom = Atom.make((get) => {
  const instances = get(terminalInstancesAtom)
  return instances.size
})

// =============================================================================
// Operation Atoms
// =============================================================================

/**
 * Set terminal mode
 */
export const setTerminalMode = (mode: TerminalMode) => {
  Atom.set(terminalModeAtom, mode)
}

/**
 * Toggle terminal mode between ghostty and openwarp
 */
export const toggleTerminalMode = () => {
  const current = Atom.get(terminalModeAtom)
  Atom.set(terminalModeAtom, current === 'ghostty' ? 'openwarp' : 'ghostty')
}

/**
 * Update terminal config
 */
export const updateTerminalConfig = (config: Partial<TerminalConfig>) => {
  Atom.set(terminalConfigAtom, (prev) => ({ ...prev, ...config }))
}

/**
 * Register a terminal instance
 */
export const registerTerminal = (id: string, state: Partial<TerminalInstanceState>) => {
  const fullState: TerminalInstanceState = {
    id,
    status: 'disconnected',
    mode: 'ghostty',
    lastActivity: Date.now(),
    isReady: false,
    ...state,
  }

  Atom.set(terminalInstancesAtom, (prev) => {
    const next = new Map(prev)
    next.set(id, fullState)
    return next
  })
}

/**
 * Update terminal instance state
 */
export const updateTerminalInstance = (id: string, update: Partial<TerminalInstanceState>) => {
  Atom.set(terminalInstancesAtom, (prev) => {
    const existing = prev.get(id)
    if (!existing) return prev

    const next = new Map(prev)
    next.set(id, {
      ...existing,
      ...update,
      lastActivity: Date.now(),
    })
    return next
  })
}

/**
 * Unregister a terminal instance
 */
export const unregisterTerminal = (id: string) => {
  Atom.set(terminalInstancesAtom, (prev) => {
    const next = new Map(prev)
    next.delete(id)
    return next
  })

  // Clear active if it was this terminal
  if (Atom.get(activeTerminalIdAtom) === id) {
    Atom.set(activeTerminalIdAtom, null)
  }
}

/**
 * Set active terminal
 */
export const setActiveTerminal = (id: string | null) => {
  Atom.set(activeTerminalIdAtom, id)
}

// =============================================================================
// Effect Operations (via runtime)
// =============================================================================

/**
 * Spawn a new PTY via TauriPtyService
 */
export const spawnTerminalOp = terminalRuntimeAtom.fn<{
  rows: number
  cols: number
  shell?: string
  cwd?: string
}>()((args, ctx) =>
  Effect.gen(function* () {
    ctx.set(terminalStatusAtom, 'connecting')

    try {
      const ptyService = yield* TauriPtyService
      const handle = yield* ptyService.spawn({
        rows: args.rows,
        cols: args.cols,
        shell: args.shell,
        cwd: args.cwd,
      })

      // Register instance
      registerTerminal(handle.id, {
        status: 'connected',
        isReady: true,
      })

      ctx.set(terminalStatusAtom, 'connected')
      ctx.set(activeTerminalIdAtom, handle.id)

      return handle
    } catch (e) {
      ctx.set(terminalStatusAtom, 'error')
      throw e
    }
  })
)

/**
 * Kill a terminal PTY
 */
export const killTerminalOp = terminalRuntimeAtom.fn<{ id: string }>()((args, ctx) =>
  Effect.gen(function* () {
    const ptyService = yield* TauriPtyService
    yield* ptyService.kill(args.id)

    unregisterTerminal(args.id)

    // Update status if no more terminals
    const instances = Atom.get(terminalInstancesAtom)
    if (instances.size === 0) {
      ctx.set(terminalStatusAtom, 'disconnected')
    }
  })
)

/**
 * List all PTY instances
 */
export const listTerminalsOp = terminalRuntimeAtom.fn<void>()((_, _ctx) =>
  Effect.gen(function* () {
    const ptyService = yield* TauriPtyService
    return yield* ptyService.list()
  })
)

// =============================================================================
// OpenWarp Block State Atoms
// =============================================================================

/**
 * Combined runtime for block terminal (PTY + AI services)
 */
export const blockTerminalRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    TauriPtyService.Live,
    AIService.Live
  )
)

/**
 * Block terminal state - all blocks in order
 */
export const blocksAtom = Atom.make<readonly Block[]>([])

/**
 * Current working directory for block terminal
 */
export const blockCwdAtom = Atom.make<string>('')

/**
 * Maximum blocks to retain (LRU eviction)
 */
export const maxBlocksAtom = Atom.make<number>(500)

/**
 * Whether user has scrolled (for auto-scroll behavior)
 */
export const userScrolledAtom = Atom.make<boolean>(false)

/**
 * Input history for up/down navigation
 */
export const inputHistoryAtom = Atom.make<readonly string[]>([])

/**
 * Current history index (-1 = not navigating)
 */
export const historyIndexAtom = Atom.make<number>(-1)

// =============================================================================
// OpenWarp Derived Atoms
// =============================================================================

/**
 * Latest block (for scroll-to behavior)
 */
export const latestBlockAtom = Atom.make((get) => {
  const blocks = get(blocksAtom)
  return blocks.length > 0 ? blocks[blocks.length - 1] : null
})

/**
 * Active/running blocks
 */
export const activeBlocksAtom = Atom.make((get) => {
  const blocks = get(blocksAtom)
  return blocks.filter(isBlockActive)
})

/**
 * Completed blocks
 */
export const completedBlocksAtom = Atom.make((get) => {
  const blocks = get(blocksAtom)
  return blocks.filter((b) => !isBlockActive(b))
})

/**
 * Block count
 */
export const blockCountAtom = Atom.make((get) => get(blocksAtom).length)

/**
 * Whether any block is currently active
 */
export const hasActiveBlockAtom = Atom.make((get) => get(activeBlocksAtom).length > 0)

// =============================================================================
// OpenWarp Block Operations (Synchronous)
// =============================================================================

/**
 * Add a block to the terminal
 */
export const addBlock = (block: Block) => {
  Atom.set(blocksAtom, (prev) => {
    const maxBlocks = Atom.get(maxBlocksAtom)
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
export const updateBlock = (id: string, update: Partial<Block>) => {
  Atom.set(blocksAtom, (prev) =>
    prev.map((block) =>
      block.id === id ? { ...block, ...update } as Block : block
    )
  )
}

/**
 * Remove a block by ID
 */
export const removeBlock = (id: string) => {
  Atom.set(blocksAtom, (prev) => prev.filter((b) => b.id !== id))
}

/**
 * Clear all blocks
 */
export const clearBlocks = () => {
  Atom.set(blocksAtom, [])
}

/**
 * Set block terminal CWD
 */
export const setBlockCwd = (cwd: string) => {
  Atom.set(blockCwdAtom, cwd)
}

/**
 * Add to input history
 */
export const addToHistory = (input: string) => {
  if (!input.trim()) return
  Atom.set(inputHistoryAtom, (prev) => {
    // Deduplicate consecutive entries
    if (prev.length > 0 && prev[prev.length - 1] === input) {
      return prev
    }
    // Keep last 1000 entries
    const next = [...prev, input]
    return next.length > 1000 ? next.slice(-1000) : next
  })
  Atom.set(historyIndexAtom, -1)
}

/**
 * Navigate history up
 */
export const historyUp = (): string | null => {
  const history = Atom.get(inputHistoryAtom)
  const currentIndex = Atom.get(historyIndexAtom)

  if (history.length === 0) return null

  const newIndex = currentIndex === -1
    ? history.length - 1
    : Math.max(0, currentIndex - 1)

  Atom.set(historyIndexAtom, newIndex)
  return history[newIndex] ?? null
}

/**
 * Navigate history down
 */
export const historyDown = (): string | null => {
  const history = Atom.get(inputHistoryAtom)
  const currentIndex = Atom.get(historyIndexAtom)

  if (currentIndex === -1) return null

  const newIndex = currentIndex + 1
  if (newIndex >= history.length) {
    Atom.set(historyIndexAtom, -1)
    return ''
  }

  Atom.set(historyIndexAtom, newIndex)
  return history[newIndex] ?? null
}

/**
 * Reset history navigation
 */
export const resetHistoryIndex = () => {
  Atom.set(historyIndexAtom, -1)
}

// =============================================================================
// OpenWarp Block Operations (Effect-based)
// =============================================================================

/**
 * Execute a shell command as a block
 */
export const executeCommandOp = blockTerminalRuntimeAtom.fn<{
  command: string
  cwd?: string
}>()((args, ctx) =>
  Effect.gen(function* () {
    const cwd = (args.cwd ?? Atom.get(blockCwdAtom)) || '~'

    // Add to history
    addToHistory(args.command)

    // Determine if interactive
    if (isInteractiveCommand(args.command)) {
      // Create interactive block (full PTY needed)
      const block = createInteractiveBlock(args.command, cwd)
      ctx.set(blocksAtom, (prev) => [...prev, block])

      // Spawn PTY for interactive command
      const ptyService = yield* TauriPtyService
      const handle = yield* ptyService.spawn({
        rows: 24,
        cols: 80,
        cwd,
      })

      // Write command to PTY
      yield* ptyService.write(handle.id, args.command + '\n')

      return { blockId: block.id, ptyId: handle.id, interactive: true }
    } else {
      // Create simple command block
      const block = createCommandBlock(args.command, cwd)
      ctx.set(blocksAtom, (prev) => [...prev, block])

      // Execute via PTY and capture output
      const ptyService = yield* TauriPtyService
      const handle = yield* ptyService.spawn({
        rows: 24,
        cols: 80,
        cwd,
      })

      // Collect output
      let output = ''
      yield* ptyService.write(handle.id, args.command + '\n')

      // TODO: Stream output updates to block
      // For now, mark as complete after spawn
      ctx.set(blocksAtom, (prev) =>
        prev.map((b) =>
          b.id === block.id && b._tag === 'command'
            ? { ...b, output, isRunning: false, endTime: new Date(), exitCode: 0 }
            : b
        )
      )

      return { blockId: block.id, ptyId: handle.id, interactive: false }
    }
  })
)

/**
 * Execute an AI query as a block
 */
export const executeAIQueryOp = blockTerminalRuntimeAtom.fn<{
  prompt: string
  model?: string
}>()((args, ctx) =>
  Effect.gen(function* () {
    const model = args.model ?? 'claude-sonnet-4-20250514'

    // Add to history
    addToHistory(args.prompt)

    // Create AI response block
    const block = createAIResponseBlock(args.prompt, model)
    ctx.set(blocksAtom, (prev) => [...prev, block])

    // Stream AI response
    const aiService = yield* AIService
    const handle = yield* aiService.streamChat({
      provider: 'anthropic',
      modelId: model,
      messages: [{ role: 'user', content: args.prompt }],
    })

    // Process stream and update block
    yield* Effect.forEach(
      handle.stream,
      (event) =>
        Effect.sync(() => {
          ctx.set(blocksAtom, (prev) =>
            prev.map((b) => {
              if (b.id !== block.id || b._tag !== 'ai-response') return b

              switch (event._tag) {
                case 'TextDelta':
                  return { ...b, response: b.response + event.text }
                case 'ReasoningDelta':
                  return { ...b, thinking: (b.thinking ?? '') + event.text }
                case 'ToolCall':
                  return {
                    ...b,
                    toolCalls: [...(b.toolCalls ?? []), {
                      id: event.toolId,
                      name: event.toolName,
                      input: event.input as Record<string, unknown>,
                      status: 'running' as const,
                    }],
                  }
                case 'ToolResult':
                  return {
                    ...b,
                    toolCalls: (b.toolCalls ?? []).map((tc) =>
                      tc.id === event.toolId
                        ? { ...tc, output: event.result, status: 'completed' as const }
                        : tc
                    ),
                  }
                case 'StreamComplete':
                  return { ...b, isStreaming: false, endTime: new Date() }
                case 'StreamError':
                  return { ...b, isStreaming: false, endTime: new Date() }
                default:
                  return b
              }
            })
          )
        }),
      { concurrency: 1 }
    )

    return { blockId: block.id }
  })
)

/**
 * Add an error block
 */
export const addErrorBlockOp = (message: string) => {
  const block = createErrorBlock(message)
  addBlock(block)
  return block.id
}

/**
 * Dismiss an interactive block
 */
export const dismissBlockOp = blockTerminalRuntimeAtom.fn<{ id: string }>()((args, ctx) =>
  Effect.gen(function* () {
    ctx.set(blocksAtom, (prev) =>
      prev.map((b) =>
        b.id === args.id && b._tag === 'interactive'
          ? { ...b, dismissed: true, isRunning: false, endTime: new Date() }
          : b
      )
    )
  })
)

// =============================================================================
// Tabs Atoms and Operations
// =============================================================================

export {
  // State atoms
  tabsAtom,
  activeTabIdAtom,
  activePaneIdAtom,
  // Derived atoms
  tabCountAtom,
  activeTabAtom,
  activePaneAtom,
  pinnedTabsAtom,
  unpinnedTabsAtom,
  // Session operations
  saveSessionOp,
  loadSessionOp,
  initializeTabsOp,
  // Tab operations
  createNewTabOp,
  createWebViewTabOp,
  createWidgetTabOp,
  createEditorTabOp,
  closeTabOp,
  setActiveTabOp,
  reorderTabsOp,
  updateTabTitleOp,
  pinTabOp,
  unpinTabOp,
  togglePinTabOp,
  updatePinnedTabStyleOp,
  updateTabStyleOp,
  // Pane operations
  splitPaneOp,
  closePaneOp,
  setActivePaneOp,
  resizeSplitOp,
  updateTerminalViewModeOp,
} from './tabs'
