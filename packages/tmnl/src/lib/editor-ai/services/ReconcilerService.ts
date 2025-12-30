/**
 * ReconcilerService
 *
 * Effect.Service wrapper for the document reconciler.
 * Bridges AI-generated structured documents to ProseMirror editors.
 *
 * Features:
 * - One-shot document reconciliation
 * - Streaming document reconciliation (token batching)
 * - Document diffing and minimal mutations
 *
 * @module editor-ai/services/ReconcilerService
 */

import { Context, Effect, Layer, Ref } from 'effect'
import type { EditorView } from '@tiptap/pm/view'
import type {
  JSONDocument,
  JSONNode,
  ReconcileResult,
  StreamingConfig,
  StreamingStats,
  MergeResult,
  MergeStats,
} from '../reconciler'
import {
  mergeIntoEditor,
  mergeDocuments,
  createStreamingReconciler,
  processAIStream,
  pmNodeToJSON,
  decodeDocument,
} from '../reconciler'
import type { TransformOptions } from '../reconciler'
import { AIService } from '../decorators'

// =============================================================================
// Types
// =============================================================================

/**
 * Document reconciliation result with detailed stats.
 */
export interface ReconciliationResult {
  readonly success: boolean
  readonly stats: MergeStats
  readonly applied: boolean
  readonly durationMs: number
}

/**
 * Streaming reconciliation handle for controlled document streaming.
 */
export interface DocumentStreamHandle {
  /** Push a JSON token from the AI stream */
  readonly pushToken: (token: string) => Effect.Effect<void>

  /** Push a complete block (already parsed) */
  readonly pushBlock: (block: JSONNode) => Effect.Effect<void>

  /** Signal end of stream and flush remaining */
  readonly complete: Effect.Effect<ReconcileResult>

  /** Cancel processing */
  readonly cancel: Effect.Effect<void>

  /** Get current streaming stats */
  readonly getStats: Effect.Effect<StreamingStats>
}

// =============================================================================
// ReconcilerService Shape
// =============================================================================

/**
 * Service interface for document reconciliation.
 */
export interface ReconcilerServiceShape {
  // ---------------------------------------------------------------------------
  // One-shot Operations
  // ---------------------------------------------------------------------------

  /**
   * Reconcile a complete JSONDocument into an editor.
   * Computes minimal diff and applies atomic transaction.
   */
  readonly reconcileDocument: (
    view: EditorView,
    document: JSONDocument,
    options?: TransformOptions
  ) => Effect.Effect<ReconciliationResult>

  /**
   * Compute merge operations without applying.
   * Useful for preview or validation.
   */
  readonly computeMerge: (
    view: EditorView,
    document: JSONDocument
  ) => Effect.Effect<MergeResult>

  /**
   * Validate a JSONDocument against the schema.
   */
  readonly validateDocument: (
    document: unknown
  ) => Effect.Effect<JSONDocument, Error>

  // ---------------------------------------------------------------------------
  // Streaming Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a streaming document handle for controlled reconciliation.
   * Use when you need fine-grained control over streaming.
   */
  readonly createDocumentStream: (
    view: EditorView,
    config?: Partial<StreamingConfig>
  ) => Effect.Effect<DocumentStreamHandle>

  /**
   * Process an AI text stream through the reconciler.
   * Convenience method for AI SDK integration.
   */
  readonly processStream: (
    view: EditorView,
    textStream: AsyncIterable<string>,
    config?: Partial<StreamingConfig>
  ) => Effect.Effect<ReconcileResult>

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Convert current editor document to JSONDocument.
   * Useful for diffing or serialization.
   */
  readonly getDocumentJSON: (view: EditorView) => Effect.Effect<JSONDocument>

  /**
   * Check if current document matches target document.
   * Returns true if no merge operations needed.
   */
  readonly isDocumentEqual: (
    view: EditorView,
    target: JSONDocument
  ) => Effect.Effect<boolean>
}

// =============================================================================
// ReconcilerService Tag
// =============================================================================

@AIService({
  description: 'Document reconciler for AI-generated structured content',
  capabilities: [
    'reconcile JSONDocument into ProseMirror',
    'compute minimal diff (LCS algorithm)',
    'stream document blocks with batching',
    'validate against Effect.Schema',
  ],
})
export class ReconcilerService extends Context.Tag('tmnl/ReconcilerService')<
  ReconcilerService,
  ReconcilerServiceShape
>() {}

// =============================================================================
// Live Implementation
// =============================================================================

/**
 * Create ReconcilerService.Live layer.
 */
export const ReconcilerServiceLive: Layer.Layer<ReconcilerService> = Layer.succeed(
  ReconcilerService,
  ReconcilerService.of({
    // -------------------------------------------------------------------------
    // One-shot Operations
    // -------------------------------------------------------------------------

    reconcileDocument: (view, document, options = {}) =>
      Effect.gen(function* () {
        const startTime = Date.now()

        // Apply reconciliation
        const result = mergeIntoEditor(view, document, options)

        const durationMs = Date.now() - startTime

        return {
          success: true,
          stats: result.stats,
          applied: result.applied,
          durationMs,
        }
      }).pipe(
        Effect.withSpan('ReconcilerService.reconcileDocument', {
          attributes: {
            blockCount: document.content?.length ?? 0,
          },
        }),
        Effect.catchAll((error) =>
          Effect.succeed({
            success: false,
            stats: { inserted: 0, deleted: 0, updated: 0, moved: 0, unchanged: 0 },
            applied: false,
            durationMs: 0,
          } satisfies ReconciliationResult)
        )
      ),

    computeMerge: (view, document) =>
      Effect.sync(() => {
        const currentDoc = pmNodeToJSON(view.state.doc) as JSONDocument
        return mergeDocuments(currentDoc, document)
      }).pipe(Effect.withSpan('ReconcilerService.computeMerge')),

    validateDocument: (document) =>
      decodeDocument(document).pipe(
        Effect.mapError((parseError) =>
          new Error(`Invalid document: ${parseError.message}`)
        ),
        Effect.withSpan('ReconcilerService.validateDocument')
      ),

    // -------------------------------------------------------------------------
    // Streaming Operations
    // -------------------------------------------------------------------------

    createDocumentStream: (view, config = {}) =>
      Ref.make(false).pipe(
        Effect.map((cancelledRef) => {
          const handle = createStreamingReconciler(view, config)

          const streamHandle: DocumentStreamHandle = {
            pushToken: (token) =>
              Ref.get(cancelledRef).pipe(
                Effect.flatMap((cancelled) => {
                  if (!cancelled) {
                    handle.pushToken(token)
                  }
                  return Effect.void
                })
              ),

            pushBlock: (block) =>
              Ref.get(cancelledRef).pipe(
                Effect.flatMap((cancelled) => {
                  if (!cancelled) {
                    handle.pushToken(JSON.stringify(block))
                  }
                  return Effect.void
                })
              ),

            complete: Effect.promise(() => handle.complete()),

            cancel: Ref.set(cancelledRef, true).pipe(
              Effect.tap(() => Effect.sync(() => handle.cancel()))
            ),

            getStats: Effect.sync(() => handle.getStats()),
          }

          return streamHandle
        }),
        Effect.withSpan('ReconcilerService.createDocumentStream')
      ),

    processStream: (view, textStream, config = {}) =>
      processAIStream(view, textStream, config).pipe(
        Effect.withSpan('ReconcilerService.processStream')
      ),

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    getDocumentJSON: (view) =>
      Effect.sync(() => pmNodeToJSON(view.state.doc) as JSONDocument).pipe(
        Effect.withSpan('ReconcilerService.getDocumentJSON')
      ),

    isDocumentEqual: (view, target) =>
      Effect.gen(function* () {
        const currentDoc = pmNodeToJSON(view.state.doc) as JSONDocument
        const mergeResult = mergeDocuments(currentDoc, target)

        // Equal if no operations needed (all NOOPs)
        return mergeResult.ops.every((op) => op.type === 'NOOP')
      }).pipe(Effect.withSpan('ReconcilerService.isDocumentEqual')),
  })
)
