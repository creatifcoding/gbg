/**
 * useReconciler Hook
 *
 * React hook for document reconciliation operations.
 * Provides access to the ReconcilerService via the focused editor's view.
 *
 * REFACTORED: Uses effect-atom instead of React context.
 * - Subscribes to `focusedEditorAtom` for reactive focus updates
 * - Uses `useAtomSet(getEditorOperationsOp)` to get editor operations
 * - No more dependency on context version counters
 *
 * @module editor-ai/hooks/useReconciler
 */

import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { Effect, Option } from 'effect'
import { useAtomValue, useAtom, useAtomSet } from '@effect-atom/atom-react'

import {
  focusedEditorAtom,
  registeredEditorsAtom,
  getEditorOperationsOp,
} from '../atoms'
import type { EditorId } from '../schemas/editor'
import type { EditorOperationsShape } from '../services/EditorOperations'
import type {
  JSONDocument,
  ReconcileResult,
  StreamingConfig,
  MergeResult,
  StreamingStats,
} from '../reconciler'
import {
  mergeIntoEditor,
  mergeDocuments,
  createStreamingReconciler,
  processAIStream,
  pmNodeToJSON,
  decodeDocument,
} from '../reconciler'
import type { EditorView } from '@tiptap/pm/view'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ReconciliationStats {
  success: boolean
  stats: {
    inserted: number
    deleted: number
    updated: number
    moved: number
    unchanged: number
  }
  applied: boolean
  durationMs: number
}

export interface UseReconcilerResult {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /**
   * Whether we have a valid view to reconcile into.
   */
  hasView: boolean

  /**
   * Currently focused editor ID.
   */
  focusedEditorId: EditorId | null

  /**
   * Last reconciliation result.
   */
  lastResult: ReconciliationStats | null

  /**
   * Whether reconciliation is in progress.
   */
  isReconciling: boolean

  /**
   * Last error message, if any.
   */
  error: string | null

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  /**
   * Reconcile a JSONDocument into the focused editor.
   * Uses LCS-based diffing for minimal mutations.
   */
  reconcileDocument: (document: JSONDocument) => Promise<ReconciliationStats>

  /**
   * Validate a JSON object as a JSONDocument.
   * Returns parsed document or throws.
   */
  validateDocument: (json: unknown) => Promise<JSONDocument>

  /**
   * Get the current document as JSON.
   */
  getDocumentJSON: () => Promise<JSONDocument | null>

  /**
   * Compute merge preview without applying.
   */
  computeMerge: (document: JSONDocument) => Promise<MergeResult | null>

  /**
   * Process a text stream through the reconciler.
   * For testing with mock AI streams.
   */
  processStream: (
    textStream: AsyncIterable<string>,
    config?: Partial<StreamingConfig>
  ) => Promise<ReconcileResult>

  /**
   * Clear last result and error.
   */
  clearState: () => void
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Hook for document reconciliation operations.
 *
 * REFACTORED: Uses effect-atom subscriptions instead of React context.
 * - `focusedEditorAtom` triggers re-renders when focus changes
 * - `registeredEditorsAtom` triggers re-renders when editors register/unregister
 * - No dependency array issues because atoms are stable
 *
 * Usage:
 * ```tsx
 * function ReconcilerTest() {
 *   const {
 *     hasView,
 *     reconcileDocument,
 *     lastResult,
 *     isReconciling,
 *     error,
 *   } = useReconciler()
 *
 *   const handleReconcile = async (doc: JSONDocument) => {
 *     const result = await reconcileDocument(doc)
 *     console.log('Reconciled:', result)
 *   }
 *
 *   return <ReconcilerUI onReconcile={handleReconcile} />
 * }
 * ```
 */
export function useReconciler(): UseReconcilerResult {
  // Subscribe to atoms (replaces context)
  const focusedEditorOption = useAtomValue(focusedEditorAtom)
  const registeredEditors = useAtomValue(registeredEditorsAtom)

  // Get callable function from operation atom via useAtomSet
  // mode: "promise" required so setter returns Promise<Result> instead of void
  const getEditorOperations = useAtomSet(getEditorOperationsOp, { mode: 'promise' })

  // Extract focused editor ID from Option
  const focusedEditorId = Option.isSome(focusedEditorOption)
    ? focusedEditorOption.value
    : null

  // Cache for the focused editor operations (avoid re-fetching on every render)
  const editorOpsRef = useRef<EditorOperationsShape | null>(null)
  const lastFocusedIdRef = useRef<EditorId | null>(null)

  // Local state
  const [lastResult, setLastResult] = useState<ReconciliationStats | null>(null)
  const [isReconciling, setIsReconciling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Track when operations are loaded (fixes async timing issue)
  const [opsLoaded, setOpsLoaded] = useState(false)

  // ---------------------------------------------------------------------------
  // Fetch editor operations when focus changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // RACE CONDITION FIX: Check if editor is actually registered before fetching.
    // registeredEditors in deps ensures we retry when registration completes.
    const isRegistered = focusedEditorId
      ? registeredEditors.includes(focusedEditorId)
      : false

    // STRICT MODE FIX: Only skip if this is a true no-change scenario.
    // The ref tracks "what we last attempted to load" - if we unmount/remount,
    // cleanup clears it, so we'll retry the fetch.
    if (
      focusedEditorId === lastFocusedIdRef.current &&
      editorOpsRef.current !== null
    ) {
      return // Truly no change - same ID and we have operations
    }

    lastFocusedIdRef.current = focusedEditorId
    setOpsLoaded(false) // Reset while fetching

    if (!focusedEditorId) {
      editorOpsRef.current = null
      return
    }

    // Don't attempt fetch until editor is registered (race condition guard)
    if (!isRegistered) {
      console.log(
        '[useReconciler] Editor not registered yet, waiting:',
        focusedEditorId
      )
      return
    }

    // Fetch the operations for the focused editor
    // mode: "promise" returns Promise<Result.Success<R>> — unwrap with .value
    getEditorOperations({ id: focusedEditorId })
      .then((result) => {
        // Guard against stale responses (focus may have changed during fetch)
        if (lastFocusedIdRef.current !== focusedEditorId) {
          console.log('[useReconciler] Stale response, ignoring:', focusedEditorId)
          return
        }
        editorOpsRef.current = result.value
        setOpsLoaded(true) // Signal that operations are ready
        console.log('[useReconciler] Cached editor operations for:', focusedEditorId)
      })
      .catch((err) => {
        console.error('[useReconciler] Failed to get editor operations:', err)
        editorOpsRef.current = null
        setOpsLoaded(false)
      })

    // STRICT MODE FIX: Cleanup clears refs so remount will re-fetch
    return () => {
      console.log('[useReconciler] Cleanup, clearing refs for:', focusedEditorId)
      lastFocusedIdRef.current = null
      editorOpsRef.current = null
      setOpsLoaded(false)
    }
  }, [focusedEditorId, getEditorOperations, registeredEditors])

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getView = useCallback((): EditorView | null => {
    const editor = editorOpsRef.current

    // Debug logging
    console.log('[useReconciler.getView]', {
      focusedEditorId,
      hasEditor: !!editor,
      opsLoaded,
      allEditorIds: registeredEditors,
    })

    if (!editor) return null

    // Synchronously get view by running the effect
    // Effect.try() in TiptapAdapter.getEditor IS sync-safe
    try {
      const view = Effect.runSync(editor.getView)
      console.log('[useReconciler.getView] Got view:', !!view)
      return view
    } catch (err) {
      console.log('[useReconciler.getView] Error getting view:', err)
      return null
    }
  }, [focusedEditorId, opsLoaded, registeredEditors])

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // hasView is derived from whether we have cached editor operations with a valid view
  // CRITICAL: Must depend on opsLoaded to re-evaluate after async fetch completes
  const hasView = useMemo(() => {
    if (!opsLoaded || !editorOpsRef.current) return false
    return getView() !== null
  }, [getView, opsLoaded, focusedEditorId, registeredEditors])

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  const reconcileDocument = useCallback(
    async (document: JSONDocument): Promise<ReconciliationStats> => {
      setError(null)
      setIsReconciling(true)

      try {
        const view = getView()
        if (!view) {
          throw new Error('No editor view available')
        }

        const startTime = Date.now()
        const result = mergeIntoEditor(view, document)
        const durationMs = Date.now() - startTime

        const stats: ReconciliationStats = {
          success: true,
          stats: result.stats,
          applied: result.applied,
          durationMs,
        }

        setLastResult(stats)
        return stats
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        const failedResult: ReconciliationStats = {
          success: false,
          stats: { inserted: 0, deleted: 0, updated: 0, moved: 0, unchanged: 0 },
          applied: false,
          durationMs: 0,
        }
        setLastResult(failedResult)
        throw err
      } finally {
        setIsReconciling(false)
      }
    },
    [getView]
  )

  const validateDocument = useCallback(
    async (json: unknown): Promise<JSONDocument> => {
      const result = await Effect.runPromise(
        decodeDocument(json).pipe(
          Effect.mapError((e) => new Error(`Invalid document: ${e.message}`))
        )
      )
      return result
    },
    []
  )

  const getDocumentJSON = useCallback(async (): Promise<JSONDocument | null> => {
    const view = getView()
    if (!view) return null

    return pmNodeToJSON(view.state.doc) as JSONDocument
  }, [getView])

  const computeMerge = useCallback(
    async (document: JSONDocument): Promise<MergeResult | null> => {
      const view = getView()
      if (!view) return null

      const currentDoc = pmNodeToJSON(view.state.doc) as JSONDocument
      return mergeDocuments(currentDoc, document)
    },
    [getView]
  )

  const processStream = useCallback(
    async (
      textStream: AsyncIterable<string>,
      config?: Partial<StreamingConfig>
    ): Promise<ReconcileResult> => {
      setError(null)
      setIsReconciling(true)

      try {
        const view = getView()
        if (!view) {
          throw new Error('No editor view available')
        }

        const result = await Effect.runPromise(
          processAIStream(view, textStream, config)
        )

        // Convert to our stats format
        const stats: ReconciliationStats = {
          success: true,
          stats: {
            inserted: result.inserted,
            deleted: result.deleted,
            updated: result.updated,
            moved: 0,
            unchanged: 0,
          },
          applied: true,
          durationMs: result.durationMs,
        }
        setLastResult(stats)

        return result
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        throw err
      } finally {
        setIsReconciling(false)
      }
    },
    [getView]
  )

  const clearState = useCallback(() => {
    setLastResult(null)
    setError(null)
    setIsReconciling(false)
  }, [])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return useMemo(
    () => ({
      // State
      hasView,
      focusedEditorId,
      lastResult,
      isReconciling,
      error,

      // Operations
      reconcileDocument,
      validateDocument,
      getDocumentJSON,
      computeMerge,
      processStream,
      clearState,
    }),
    [
      hasView,
      focusedEditorId,
      lastResult,
      isReconciling,
      error,
      reconcileDocument,
      validateDocument,
      getDocumentJSON,
      computeMerge,
      processStream,
      clearState,
    ]
  )
}

export default useReconciler
