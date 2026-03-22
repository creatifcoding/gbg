/**
 * Streaming Reconciler
 *
 * Bridges AI SDK streaming output to the document reconciler.
 * Uses a simple batching approach that works with standard async/await.
 *
 * Architecture:
 * 1. AI SDK emits partial JSON tokens
 * 2. TokenBuffer accumulates until valid JSON block
 * 3. BlockBatcher groups blocks for batch reconciliation
 * 4. Reconciler applies batched changes atomically
 *
 * @module editor-ai/reconciler/StreamingReconciler
 */

import { Effect } from 'effect'
import type { EditorView } from '@tiptap/pm/view'
import type { JSONNode, JSONDocument, ReconcileResult } from './types'
import { mergeIntoEditor } from './TransformBridge'
import type { TransformOptions } from './TransformBridge'

// =============================================================================
// Configuration
// =============================================================================

export interface StreamingConfig {
  /**
   * Minimum time between reconciliation batches (ms).
   * Default: 50ms (20 updates/second max)
   */
  readonly batchIntervalMs: number

  /**
   * Maximum number of blocks per batch.
   * Default: 10
   */
  readonly maxBlocksPerBatch: number

  /**
   * If true, apply changes without adding to undo history.
   * Default: false
   */
  readonly skipHistory: boolean
}

const defaultConfig: StreamingConfig = {
  batchIntervalMs: 50,
  maxBlocksPerBatch: 10,
  skipHistory: false,
}

// =============================================================================
// Token Buffer
// =============================================================================

interface TokenBufferState {
  buffer: string
  depth: number
  inString: boolean
  escaped: boolean
}

/**
 * Accumulates JSON tokens until a complete object is formed.
 */
export function createTokenBuffer() {
  const state: TokenBufferState = {
    buffer: '',
    depth: 0,
    inString: false,
    escaped: false,
  }

  return {
    /**
     * Push a token and return any complete JSON objects.
     */
    push(token: string): readonly string[] {
      const completeObjects: string[] = []
      let objectStart = -1

      for (let i = 0; i < token.length; i++) {
        const char = token[i]!
        state.buffer += char

        if (state.escaped) {
          state.escaped = false
          continue
        }

        if (char === '\\' && state.inString) {
          state.escaped = true
          continue
        }

        if (char === '"') {
          state.inString = !state.inString
          continue
        }

        if (state.inString) continue

        if (char === '{' || char === '[') {
          if (state.depth === 0) {
            objectStart = state.buffer.length - 1
          }
          state.depth++
        } else if (char === '}' || char === ']') {
          state.depth--
          if (state.depth === 0 && objectStart >= 0) {
            const jsonStr = state.buffer.slice(objectStart)
            completeObjects.push(jsonStr)
            state.buffer = ''
            objectStart = -1
          }
        }
      }

      return completeObjects
    },

    getRemaining(): string {
      return state.buffer
    },

    reset(): void {
      state.buffer = ''
      state.depth = 0
      state.inString = false
      state.escaped = false
    },
  }
}

// =============================================================================
// JSON Parser
// =============================================================================

/**
 * Safely parse JSON with error handling
 */
export function safeParseJSON(str: string): JSONNode | null {
  try {
    return JSON.parse(str) as JSONNode
  } catch {
    return null
  }
}

// =============================================================================
// Streaming Reconciler
// =============================================================================

export interface StreamingStats {
  tokensReceived: number
  blocksProcessed: number
  batchesApplied: number
  errors: number
  isComplete: boolean
}

export interface StreamingReconcilerHandle {
  /**
   * Push a token from the AI stream
   */
  pushToken(token: string): void

  /**
   * Signal end of stream and flush remaining
   */
  complete(): Promise<ReconcileResult>

  /**
   * Cancel processing
   */
  cancel(): void

  /**
   * Get current stats
   */
  getStats(): StreamingStats
}

/**
 * Create a streaming reconciler for an editor view.
 *
 * @example
 * ```typescript
 * const handle = createStreamingReconciler(view, { batchIntervalMs: 100 })
 *
 * for await (const token of aiStream) {
 *   handle.pushToken(token)
 * }
 *
 * const result = await handle.complete()
 * ```
 */
export function createStreamingReconciler(
  view: EditorView,
  config: Partial<StreamingConfig> = {}
): StreamingReconcilerHandle {
  const cfg = { ...defaultConfig, ...config }

  const tokenBuffer = createTokenBuffer()
  const pendingBlocks: JSONNode[] = []
  const accumulatedBlocks: JSONNode[] = []

  const stats: StreamingStats = {
    tokensReceived: 0,
    blocksProcessed: 0,
    batchesApplied: 0,
    errors: 0,
    isComplete: false,
  }

  let batchTimer: ReturnType<typeof setTimeout> | null = null
  let cancelled = false

  const result: ReconcileResult = {
    inserted: 0,
    deleted: 0,
    updated: 0,
    durationMs: 0,
  }

  const transformOptions: TransformOptions = {
    addToHistory: !cfg.skipHistory,
    meta: { source: 'ai-streaming' },
  }

  const applyBatch = (): void => {
    if (cancelled || pendingBlocks.length === 0) return

    // Move pending to accumulated
    accumulatedBlocks.push(...pendingBlocks)
    pendingBlocks.length = 0

    // Build document
    const doc: JSONDocument = {
      type: 'doc',
      content: accumulatedBlocks,
    }

    try {
      const mergeResult = mergeIntoEditor(view, doc, transformOptions)

      // Accumulate stats (cast to mutable for internal tracking)
      ;(result as { inserted: number }).inserted += mergeResult.stats.inserted
      ;(result as { deleted: number }).deleted += mergeResult.stats.deleted
      ;(result as { updated: number }).updated += mergeResult.stats.updated
      ;(result as { durationMs: number }).durationMs += mergeResult.stats.moved + mergeResult.stats.unchanged

      stats.batchesApplied++
    } catch (err) {
      stats.errors++
      console.warn('[StreamingReconciler] Batch apply error:', err)
    }
  }

  const scheduleBatch = (): void => {
    if (batchTimer !== null) return
    if (cancelled) return

    batchTimer = setTimeout(() => {
      batchTimer = null
      applyBatch()
    }, cfg.batchIntervalMs)
  }

  return {
    pushToken(token: string): void {
      if (cancelled || stats.isComplete) return

      stats.tokensReceived++

      const completeObjects = tokenBuffer.push(token)

      for (const jsonStr of completeObjects) {
        const node = safeParseJSON(jsonStr)
        if (node) {
          pendingBlocks.push(node)
          stats.blocksProcessed++

          // Schedule batch if we have enough blocks
          if (pendingBlocks.length >= cfg.maxBlocksPerBatch) {
            if (batchTimer) {
              clearTimeout(batchTimer)
              batchTimer = null
            }
            applyBatch()
          } else {
            scheduleBatch()
          }
        }
      }
    },

    async complete(): Promise<ReconcileResult> {
      if (cancelled) {
        return result
      }

      // Clear any pending timer
      if (batchTimer) {
        clearTimeout(batchTimer)
        batchTimer = null
      }

      // Apply any remaining blocks
      if (pendingBlocks.length > 0) {
        applyBatch()
      }

      stats.isComplete = true
      return result
    },

    cancel(): void {
      cancelled = true
      if (batchTimer) {
        clearTimeout(batchTimer)
        batchTimer = null
      }
    },

    getStats(): StreamingStats {
      return { ...stats }
    },
  }
}

// =============================================================================
// Effect Wrappers
// =============================================================================

/**
 * Process an AI text stream through the reconciler.
 * Effect wrapper for clean integration.
 */
export function processAIStream(
  view: EditorView,
  textStream: AsyncIterable<string>,
  config: Partial<StreamingConfig> = {}
): Effect.Effect<ReconcileResult> {
  return Effect.promise(async () => {
    const handle = createStreamingReconciler(view, config)

    for await (const token of textStream) {
      handle.pushToken(token)
    }

    return handle.complete()
  })
}

/**
 * Create a streaming reconciler wrapped in Effect.
 */
export function createStreamingReconcilerEffect(
  view: EditorView,
  config: Partial<StreamingConfig> = {}
): Effect.Effect<StreamingReconcilerHandle> {
  return Effect.sync(() => createStreamingReconciler(view, config))
}
