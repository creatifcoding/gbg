/**
 * Terminal v2 Atoms
 *
 * Effect-atom integration for terminal state management.
 * Follows Atom-as-State doctrine from CLAUDE.md.
 *
 * CRITICAL: Uses overlayRegistry for synchronous operations to match
 * the React context provided by OverlayRegistryProvider in main.tsx.
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer, Stream } from 'effect'
import { overlayRegistry } from '@/lib/overlays'
import { TauriPtyService } from '../services/TauriPtyService'
import {
  AICoreService,
  SSEAdapter,
  ToolBridge,
  userMessage,
  type AIStreamEvent,
  // Global state sync functions
  applyStreamEvent,
  setConnecting,
  clearStream,
  setActiveHandle,
  // Registry and atoms for cross-module access
  aiCoreRegistry,
  activeHandleAtom as aiCoreActiveHandleAtom,
  isStreamingAtom as aiCoreIsStreamingAtom,
} from '@/lib/ai-core'
import { MCPClientRegistry } from '@/lib/mcp/services'
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
  overlayRegistry.set(terminalModeAtom, mode)
}

/**
 * Toggle terminal mode between ghostty and openwarp
 */
export const toggleTerminalMode = () => {
  const current = overlayRegistry.get(terminalModeAtom)
  overlayRegistry.set(terminalModeAtom, current === 'ghostty' ? 'openwarp' : 'ghostty')
}

/**
 * Update terminal config
 */
export const updateTerminalConfig = (config: Partial<TerminalConfig>) => {
  const prev = overlayRegistry.get(terminalConfigAtom)
  overlayRegistry.set(terminalConfigAtom, { ...prev, ...config })
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

  const prev = overlayRegistry.get(terminalInstancesAtom)
  const next = new Map(prev)
  next.set(id, fullState)
  overlayRegistry.set(terminalInstancesAtom, next)
}

/**
 * Update terminal instance state
 */
export const updateTerminalInstance = (id: string, update: Partial<TerminalInstanceState>) => {
  const prev = overlayRegistry.get(terminalInstancesAtom)
  const existing = prev.get(id)
  if (!existing) return

  const next = new Map(prev)
  next.set(id, {
    ...existing,
    ...update,
    lastActivity: Date.now(),
  })
  overlayRegistry.set(terminalInstancesAtom, next)
}

/**
 * Unregister a terminal instance
 */
export const unregisterTerminal = (id: string) => {
  const prev = overlayRegistry.get(terminalInstancesAtom)
  const next = new Map(prev)
  next.delete(id)
  overlayRegistry.set(terminalInstancesAtom, next)

  // Clear active if it was this terminal
  if (overlayRegistry.get(activeTerminalIdAtom) === id) {
    overlayRegistry.set(activeTerminalIdAtom, null)
  }
}

/**
 * Set active terminal
 */
export const setActiveTerminal = (id: string | null) => {
  overlayRegistry.set(activeTerminalIdAtom, id)
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
    const instances = overlayRegistry.get(terminalInstancesAtom)
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
 * AICoreService depends on SSEAdapter and ToolBridge (which depends on MCPClientRegistry)
 */
export const blockTerminalRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    TauriPtyService.Live,
    AICoreService.Live.pipe(
      Layer.provide(SSEAdapter.Live),
      Layer.provide(
        ToolBridge.Live.pipe(Layer.provide(MCPClientRegistry.Live))
      )
    )
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
// Registry Initialization
// =============================================================================
// CRITICAL: Initialize all atoms in overlayRegistry with their default values.
// Without this, atoms read from overlayRegistry return undefined because they
// were only initialized in the global default registry.

// Terminal state atoms
overlayRegistry.set(terminalModeAtom, 'ghostty')
overlayRegistry.set(terminalStatusAtom, 'disconnected')
overlayRegistry.set(activeTerminalIdAtom, null)
overlayRegistry.set(terminalInstancesAtom, new Map())
overlayRegistry.set(terminalConfigAtom, {
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontWeight: 'normal',
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
})

// Block terminal atoms
overlayRegistry.set(blocksAtom, [])
overlayRegistry.set(blockCwdAtom, '')
overlayRegistry.set(maxBlocksAtom, 500)
overlayRegistry.set(userScrolledAtom, false)
overlayRegistry.set(inputHistoryAtom, [])
overlayRegistry.set(historyIndexAtom, -1)

// =============================================================================
// OpenWarp Derived Atoms
// =============================================================================

/**
 * Helper to safely extract array value from atom read result.
 * Handles both direct array values AND Result<T[], E> wrapper types.
 *
 * @pattern Identification and handling - check type structure and extract appropriately
 */
function safeGetBlocks<T>(value: unknown): readonly T[] {
  // Direct array - most common case
  if (Array.isArray(value)) {
    return value as readonly T[]
  }

  // Check for Result type wrapper (has _tag: 'Initial' | 'Success' | 'Failure')
  const maybeResult = value as { _tag?: string; value?: readonly T[] }
  if (maybeResult && typeof maybeResult === 'object' && '_tag' in maybeResult) {
    if (maybeResult._tag === 'Success' && Array.isArray(maybeResult.value)) {
      return maybeResult.value
    }
    // Initial or Failure - return empty
    return []
  }

  // Fallback for undefined/null/other
  return []
}

/**
 * Latest block (for scroll-to behavior)
 */
export const latestBlockAtom = Atom.make((get) => {
  const blocks = safeGetBlocks<Block>(get(blocksAtom))
  return blocks.length > 0 ? blocks[blocks.length - 1] : null
})

/**
 * Active/running blocks
 */
export const activeBlocksAtom = Atom.make((get) => {
  const blocks = safeGetBlocks<Block>(get(blocksAtom))
  return blocks.filter(isBlockActive)
})

/**
 * Completed blocks
 */
export const completedBlocksAtom = Atom.make((get) => {
  const blocks = safeGetBlocks<Block>(get(blocksAtom))
  return blocks.filter((b) => !isBlockActive(b))
})

/**
 * Block count
 */
export const blockCountAtom = Atom.make((get) => {
  const blocks = safeGetBlocks<Block>(get(blocksAtom))
  return blocks.length
})

/**
 * Whether any block is currently active
 */
export const hasActiveBlockAtom = Atom.make((get) => {
  const active = safeGetBlocks<Block>(get(activeBlocksAtom))
  return active.length > 0
})

// =============================================================================
// OpenWarp Block Operations (Synchronous)
// =============================================================================

/**
 * Add a block to the terminal
 */
export const addBlock = (block: Block) => {
  const prev = overlayRegistry.get(blocksAtom) ?? []
  const maxBlocks = overlayRegistry.get(maxBlocksAtom)
  const next = [...prev, block]
  // LRU eviction if over limit
  if (next.length > maxBlocks) {
    overlayRegistry.set(blocksAtom, next.slice(next.length - maxBlocks))
  } else {
    overlayRegistry.set(blocksAtom, next)
  }
}

/**
 * Update a block by ID
 */
export const updateBlock = (id: string, update: Partial<Block>) => {
  const prev = overlayRegistry.get(blocksAtom) ?? []
  overlayRegistry.set(
    blocksAtom,
    prev.map((block) =>
      block.id === id ? { ...block, ...update } as Block : block
    )
  )
}

/**
 * Remove a block by ID
 */
export const removeBlock = (id: string) => {
  const prev = overlayRegistry.get(blocksAtom) ?? []
  overlayRegistry.set(blocksAtom, prev.filter((b) => b.id !== id))
}

/**
 * Clear all blocks
 */
export const clearBlocks = () => {
  overlayRegistry.set(blocksAtom, [])
}

/**
 * Set block terminal CWD
 */
export const setBlockCwd = (cwd: string) => {
  overlayRegistry.set(blockCwdAtom, cwd)
}

/**
 * Add to input history
 */
export const addToHistory = (input: string) => {
  if (!input.trim()) return
  const prev = overlayRegistry.get(inputHistoryAtom) ?? []
  // Deduplicate consecutive entries
  if (prev.length > 0 && prev[prev.length - 1] === input) {
    return
  }
  // Keep last 1000 entries
  const next = [...prev, input]
  overlayRegistry.set(inputHistoryAtom, next.length > 1000 ? next.slice(-1000) : next)
  overlayRegistry.set(historyIndexAtom, -1)
}

/**
 * Navigate history up
 */
export const historyUp = (): string | null => {
  const history = overlayRegistry.get(inputHistoryAtom) ?? []
  const currentIndex = overlayRegistry.get(historyIndexAtom)

  if (history.length === 0) return null

  const newIndex = currentIndex === -1
    ? history.length - 1
    : Math.max(0, currentIndex - 1)

  overlayRegistry.set(historyIndexAtom, newIndex)
  return history[newIndex] ?? null
}

/**
 * Navigate history down
 */
export const historyDown = (): string | null => {
  const history = overlayRegistry.get(inputHistoryAtom) ?? []
  const currentIndex = overlayRegistry.get(historyIndexAtom)

  if (currentIndex === -1) return null

  const newIndex = currentIndex + 1
  if (newIndex >= history.length) {
    overlayRegistry.set(historyIndexAtom, -1)
    return ''
  }

  overlayRegistry.set(historyIndexAtom, newIndex)
  return history[newIndex] ?? null
}

/**
 * Reset history navigation
 */
export const resetHistoryIndex = () => {
  overlayRegistry.set(historyIndexAtom, -1)
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
    const cwd = (args.cwd ?? overlayRegistry.get(blockCwdAtom)) || '~'

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
 * Uses ai-core streaming with new event types
 * Syncs to global ai-core state for cross-system visibility
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

    // Set global ai-core state to connecting
    setConnecting()

    // Helper to mark block as failed
    const markBlockFailed = (errorMsg: string) => {
      ctx.set(blocksAtom, (prev) =>
        prev.map((b) =>
          b.id === block.id && b._tag === 'ai-response'
            ? { ...b, isStreaming: false, endTime: new Date(), response: b.response || `Error: ${errorMsg}` }
            : b
        )
      )
      setActiveHandle(null)
      clearStream()
    }

    // Stream AI response via ai-core
    const aiCore = yield* AICoreService
    const handleResult = yield* Effect.either(
      aiCore.streamChat({
        messages: [userMessage(args.prompt)],
        modelId: model,
      })
    )

    if (handleResult._tag === 'Left') {
      const error = handleResult.left
      console.error('[executeAIQueryOp] streamChat failed:', error)
      markBlockFailed(error instanceof Error ? error.message : String(error))
      return { blockId: block.id }
    }

    const handle = handleResult.right

    // Store handle for abort capability
    setActiveHandle(handle)

    // Process stream and update block
    // Event types from ai-core: TextDelta, ThinkingDelta, ToolCallComplete, ToolResult, StreamComplete, StreamError
    // NOTE: Stream.runForEach for Stream consumption (Effect.forEach is for Iterables)
    const streamResult = yield* Effect.either(
      Stream.runForEach(handle.stream, (event: AIStreamEvent) =>
        Effect.sync(() => {
          // Sync to global ai-core state for visibility
          applyStreamEvent(event)

          // Update block-local state
          ctx.set(blocksAtom, (prev) =>
            prev.map((b) => {
              if (b.id !== block.id || b._tag !== 'ai-response') return b

              switch (event._tag) {
                case 'TextDelta':
                  return { ...b, response: b.response + event.text }
                case 'ThinkingDelta':
                  // Renamed from ReasoningDelta in ai-core
                  return { ...b, thinking: (b.thinking ?? '') + event.thinking }
                case 'ToolCallComplete':
                  // ToolCallComplete has toolCallId, toolName, args (not input)
                  return {
                    ...b,
                    toolCalls: [...(b.toolCalls ?? []), {
                      id: event.toolCallId,
                      name: event.toolName,
                      input: event.args as Record<string, unknown>,
                      status: 'running' as const,
                    }],
                  }
                case 'ToolResult':
                  // ToolResult has toolCallId (not toolId)
                  return {
                    ...b,
                    toolCalls: (b.toolCalls ?? []).map((tc) =>
                      tc.id === event.toolCallId
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
        })
      )
    )

    if (streamResult._tag === 'Left') {
      const error = streamResult.left
      console.error('[executeAIQueryOp] stream processing failed:', error)
      markBlockFailed(error instanceof Error ? error.message : String(error))
      return { blockId: block.id }
    }

    // Clear handle after stream completes
    setActiveHandle(null)

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

/**
 * Abort the current AI stream
 * Uses ai-core registry to access handle and clear state
 */
export const abortStreamOp = (): void => {
  const { get } = aiCoreRegistry
  const handle = get(aiCoreActiveHandleAtom)
  if (handle) {
    // Abort is an Effect - run it via the registry's runtime
    // Since abort() returns Effect.Effect<void>, we need to run it
    // But the handle.abort() is designed to be Effect-native
    // For now, we use Effect.runSync since abort is synchronous (sets a Ref)
    Effect.runSync(handle.abort())
    // Clear state via registry functions
    setActiveHandle(null)
    clearStream()
  }
}

/**
 * Re-export isStreaming atom for hook consumption
 */
export { aiCoreIsStreamingAtom as isStreamingAtom }

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
