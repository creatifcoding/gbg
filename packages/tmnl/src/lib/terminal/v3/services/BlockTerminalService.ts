/**
 * BlockTerminalService v3
 *
 * Effect.Service for terminal block operations.
 * COMPOSES AICoreService and TauriPtyService - no dual-write.
 *
 * Key principle: AI blocks store streamRef, content derived from ai-core.
 * This service writes stream events ONLY to ai-core's streamStatesByIdAtom.
 */

import { Context, Effect, Layer, Stream, Ref } from 'effect'
import {
  AICoreService,
  type StreamHandle,
  initStreamStateById,
  applyStreamEventById,
  setActiveHandleById,
  clearActiveHandleById,
  userMessage,
} from '@/lib/ai-core'
import { TauriPtyService, type PtyHandle } from '../../v2/services/TauriPtyService'
import { terminalActorOps, terminalRegistry } from '../terminal-stx'
import {
  addBlock,
  updateBlock,
  addToHistory,
} from '../atoms'
import {
  createAIResponseBlock,
  createCommandBlock,
  createInteractiveBlock,
  createErrorBlock,
  type StreamRef,
  type CommandBlockV3,
  type InteractiveBlockV3,
} from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface BlockHandle {
  /** Unique block ID */
  readonly blockId: string
  /** Block type */
  readonly blockType: 'command' | 'ai-response' | 'interactive'
  /** Abort the operation */
  readonly abort: () => Effect.Effect<void>
  /** When the operation started */
  readonly startedAt: number
}

export interface BlockTerminalServiceShape {
  /**
   * Execute an AI query, creating an AIResponseBlock.
   * Returns immediately; stream updates go to ai-core's streamStatesByIdAtom.
   */
  readonly executeAIQuery: (args: {
    prompt: string
    model?: string
  }) => Effect.Effect<BlockHandle, Error>

  /**
   * Execute a shell command, creating a CommandBlock or InteractiveBlock.
   */
  readonly executeCommand: (args: {
    command: string
    cwd?: string
  }) => Effect.Effect<BlockHandle, Error>

  /**
   * Abort a block by ID
   */
  readonly abortBlock: (blockId: string) => Effect.Effect<void>

  /**
   * Abort the currently active operation
   */
  readonly abortCurrent: () => Effect.Effect<void>
}

// =============================================================================
// Service Tag
// =============================================================================

export class BlockTerminalService extends Context.Tag('tmnl/terminal/v3/BlockTerminalService')<
  BlockTerminalService,
  BlockTerminalServiceShape
>() {
  /**
   * Live implementation with AICoreService and TauriPtyService
   */
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const aiCore = yield* AICoreService
      const ptyService = yield* TauriPtyService

      // Track active handles by block ID
      const activeHandlesRef = yield* Ref.make<Map<string, StreamHandle | PtyHandle>>(new Map())

      // -----------------------------------------------------------------------
      // executeAIQuery
      // -----------------------------------------------------------------------
      const executeAIQuery = (args: { prompt: string; model?: string }) =>
        Effect.gen(function* () {
          const model = args.model ?? 'claude-sonnet-4-20250514'

          // Add to history
          addToHistory(args.prompt)

          // Get stream from ai-core FIRST to get requestId
          const handle = yield* aiCore.streamChat({
            messages: [userMessage(args.prompt)],
            modelId: model,
          })

          const requestId = handle.metadata.requestId

          // Create stream reference
          const streamRef: StreamRef = {
            requestId,
            modelId: handle.metadata.modelId,
            provider: handle.metadata.provider,
          }

          // Create block with reference (NO content copy)
          const block = createAIResponseBlock(args.prompt, streamRef)
          addBlock(block)

          // Initialize stream state in ai-core
          initStreamStateById(requestId)

          // Store handle in ai-core registry for abort
          setActiveHandleById(requestId, handle)

          // Update local tracking
          yield* Ref.update(activeHandlesRef, (map) => {
            const next = new Map(map)
            next.set(block.id, handle)
            return next
          })

          // Notify XState machine
          terminalActorOps.submitAIQuery(args.prompt, model)
          terminalActorOps.streamStarted(block.id, requestId)

          // Process stream in background - updates go to ai-core ONLY
          // IMPORTANT: Use forkDaemon to ensure fiber survives parent completion
          yield* Effect.forkDaemon(
            Stream.runForEach(handle.stream, (event) =>
              Effect.sync(() => {
                console.log('[BlockTerminalService] Stream event:', event._tag, requestId)
                // ONLY update ai-core state - block derives content from here
                applyStreamEventById(requestId, event)

                // Signal completion to machine
                if (event._tag === 'StreamComplete' || event._tag === 'StreamError') {
                  console.log('[BlockTerminalService] Stream complete/error, notifying machine')
                  terminalActorOps.streamComplete()
                  clearActiveHandleById(requestId)
                }
              })
            ).pipe(
              Effect.catchAll((error) =>
                Effect.sync(() => {
                  console.error('[BlockTerminalService] Stream processing error:', error)
                  terminalActorOps.error(String(error))
                  clearActiveHandleById(requestId)
                })
              )
            )
          )

          // Return handle for caller
          const blockHandle: BlockHandle = {
            blockId: block.id,
            blockType: 'ai-response',
            abort: () =>
              Effect.gen(function* () {
                yield* handle.abort()
                clearActiveHandleById(requestId)
                terminalActorOps.abort()
              }),
            startedAt: Date.now(),
          }

          return blockHandle
        })

      // -----------------------------------------------------------------------
      // executeCommand
      // -----------------------------------------------------------------------
      const executeCommand = (args: { command: string; cwd?: string }) =>
        Effect.gen(function* () {
          const cwd = args.cwd ?? '~'

          // Add to history
          addToHistory(args.command)

          // Determine if interactive
          const isInteractive = isInteractiveCommand(args.command)

          if (isInteractive) {
            // Create interactive block
            const ptyHandle = yield* ptyService.spawn({
              rows: 24,
              cols: 80,
              cwd,
            })

            const block = createInteractiveBlock(args.command, cwd, ptyHandle.id)
            addBlock(block)

            // Write command to PTY
            yield* ptyHandle.write(args.command + '\n')

            // Track handle
            yield* Ref.update(activeHandlesRef, (map) => {
              const next = new Map(map)
              next.set(block.id, ptyHandle)
              return next
            })

            // Notify machine
            terminalActorOps.submitCommand(args.command)
            terminalActorOps.executionStarted(block.id, ptyHandle.id)

            const blockHandle: BlockHandle = {
              blockId: block.id,
              blockType: 'interactive',
              abort: () =>
                Effect.gen(function* () {
                  yield* ptyHandle.kill()
                  updateBlock<InteractiveBlockV3>(block.id, (b) => ({
                    ...b,
                    endTime: new Date(),
                    dismissed: true,
                  }))
                  terminalActorOps.abort()
                }),
              startedAt: Date.now(),
            }

            return blockHandle
          } else {
            // Non-interactive command - capture output
            const block = createCommandBlock(args.command, cwd)
            addBlock(block)

            const ptyHandle = yield* ptyService.spawn({
              rows: 24,
              cols: 80,
              cwd,
            })

            // Update block with PTY ID
            updateBlock<CommandBlockV3>(block.id, (b) => ({
              ...b,
              ptyId: ptyHandle.id,
            }))

            // Write command
            yield* ptyHandle.write(args.command + '\n')

            // Notify machine
            terminalActorOps.submitCommand(args.command)
            terminalActorOps.executionStarted(block.id, ptyHandle.id)

            // Capture output in background
            yield* Effect.fork(
              Stream.runForEach(ptyHandle.events, (event) =>
                Effect.sync(() => {
                  if (event._tag === 'TerminalData') {
                    updateBlock<CommandBlockV3>(block.id, (b) => ({
                      ...b,
                      output: b.output + event.data,
                    }))
                  } else if (event._tag === 'TerminalExit') {
                    updateBlock<CommandBlockV3>(block.id, (b) => ({
                      ...b,
                      exitCode: event.exitCode,
                      endTime: new Date(),
                      ptyId: null,
                    }))
                    terminalActorOps.executionComplete(event.exitCode)
                  }
                })
              ).pipe(
                Effect.catchAll((error) =>
                  Effect.sync(() => {
                    updateBlock<CommandBlockV3>(block.id, (b) => ({
                      ...b,
                      output: b.output + `\nError: ${error}`,
                      exitCode: 1,
                      endTime: new Date(),
                      ptyId: null,
                    }))
                    terminalActorOps.error(String(error))
                  })
                )
              )
            )

            const blockHandle: BlockHandle = {
              blockId: block.id,
              blockType: 'command',
              abort: () =>
                Effect.gen(function* () {
                  yield* ptyHandle.kill()
                  updateBlock<CommandBlockV3>(block.id, (b) => ({
                    ...b,
                    exitCode: -1,
                    endTime: new Date(),
                    ptyId: null,
                  }))
                  terminalActorOps.abort()
                }),
              startedAt: Date.now(),
            }

            return blockHandle
          }
        })

      // -----------------------------------------------------------------------
      // abortBlock
      // -----------------------------------------------------------------------
      const abortBlock = (blockId: string) =>
        Effect.gen(function* () {
          const handles = yield* Ref.get(activeHandlesRef)
          const handle = handles.get(blockId)

          if (handle) {
            if ('abort' in handle) {
              // StreamHandle
              yield* handle.abort()
            } else if ('kill' in handle) {
              // PtyHandle
              yield* handle.kill()
            }

            yield* Ref.update(activeHandlesRef, (map) => {
              const next = new Map(map)
              next.delete(blockId)
              return next
            })
          }

          terminalActorOps.abort()
        })

      // -----------------------------------------------------------------------
      // abortCurrent
      // -----------------------------------------------------------------------
      const abortCurrent = () =>
        Effect.gen(function* () {
          const handles = yield* Ref.get(activeHandlesRef)

          // Abort all active handles
          for (const [blockId, handle] of handles) {
            if ('abort' in handle) {
              yield* handle.abort()
            } else if ('kill' in handle) {
              yield* handle.kill()
            }
          }

          yield* Ref.set(activeHandlesRef, new Map())
          terminalActorOps.abort()
        })

      return {
        executeAIQuery,
        executeCommand,
        abortBlock,
        abortCurrent,
      }
    })
  )
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Whitelist of simple commands that run non-interactive
 */
const SIMPLE_COMMANDS = new Set([
  'ls',
  'pwd',
  'echo',
  'cat',
  'head',
  'tail',
  'wc',
  'date',
  'whoami',
  'hostname',
  'uname',
  'which',
  'type',
  'file',
  'stat',
  'du',
  'df',
  'free',
  'uptime',
  'id',
  'groups',
  'env',
  'printenv',
  'set',
  'export',
  'alias',
  'history',
  'clear',
])

/**
 * Check if a command should run interactively
 */
function isInteractiveCommand(command: string): boolean {
  const trimmed = command.trim()
  const firstWord = trimmed.split(/\s+/)[0]

  // Simple commands run non-interactive
  if (SIMPLE_COMMANDS.has(firstWord)) {
    return false
  }

  // Commands that definitely need interactive PTY
  const interactiveCommands = [
    'vim',
    'nvim',
    'vi',
    'nano',
    'emacs',
    'htop',
    'top',
    'less',
    'more',
    'man',
    'ssh',
    'telnet',
    'python',
    'python3',
    'node',
    'irb',
    'rails',
    'psql',
    'mysql',
    'mongo',
    'redis-cli',
  ]

  if (interactiveCommands.includes(firstWord)) {
    return true
  }

  // Default to non-interactive for unknown commands
  // (user can always prefix with `exec` or similar for interactive)
  return false
}
