/**
 * Document Reconciler
 *
 * Custom React renderer for ProseMirror documents.
 * Uses react-reconciler with PMHostConfig to bridge React's
 * reconciliation algorithm to ProseMirror's document model.
 *
 * Usage:
 * ```typescript
 * import { DocumentReconciler } from './DocumentReconciler'
 *
 * // Create a reconciler bound to an editor
 * const reconciler = DocumentReconciler.create(editorView)
 *
 * // Render React elements to the document
 * reconciler.render(
 *   <doc>
 *     <paragraph>
 *       <text>Hello World</text>
 *     </paragraph>
 *   </doc>
 * )
 *
 * // Update with new content
 * reconciler.render(
 *   <doc>
 *     <paragraph>
 *       <text>Updated content</text>
 *     </paragraph>
 *   </doc>
 * )
 *
 * // Cleanup
 * reconciler.unmount()
 * ```
 *
 * @module editor-ai/reconciler/DocumentReconciler
 */

// @ts-expect-error - react-reconciler types don't match runtime export
import Reconciler from 'react-reconciler'
import type { ReactNode } from 'react'
import type { EditorView } from '@tiptap/pm/view'
import type { Container, Instance, ReconcileResult } from './types'
import { PMHostConfig } from './PMHostConfig'

// =============================================================================
// Reconciler Instance
// =============================================================================

/**
 * Create the react-reconciler instance with our PMHostConfig
 */
const reconciler = Reconciler(PMHostConfig)

// Enable concurrent features (React 18+)
reconciler.injectIntoDevTools({
  bundleType: process.env.NODE_ENV === 'development' ? 1 : 0,
  version: '0.1.0',
  rendererPackageName: 'tmnl-document-reconciler',
})

// =============================================================================
// Types
// =============================================================================

interface ReconcilerInstance {
  /**
   * Render React elements to the ProseMirror document.
   * Returns a promise that resolves when the render is complete.
   */
  render: (element: ReactNode) => Promise<ReconcileResult>

  /**
   * Unmount the reconciler and cleanup.
   */
  unmount: () => void

  /**
   * Get the current container state.
   */
  getContainer: () => Container

  /**
   * Check if the reconciler is mounted.
   */
  isMounted: () => boolean
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a DocumentReconciler bound to an EditorView.
 */
function create(view: EditorView): ReconcilerInstance {
  // Create the container that wraps the EditorView
  const container: Container = {
    view,
    state: view.state,
    schema: view.state.schema,
    transaction: null,
  }

  // Create the fiber root
  // ConcurrentRoot mode for React 18+ features
  const root = reconciler.createContainer(
    container,
    1, // ConcurrentRoot
    null, // hydrationCallbacks
    false, // isStrictMode
    null, // concurrentUpdatesByDefaultOverride
    '', // identifierPrefix
    (error: unknown) => {
      console.error('[DocumentReconciler] Recoverable error:', error)
    },
    null // transitionCallbacks
  )

  let mounted = true

  return {
    render: (element: ReactNode): Promise<ReconcileResult> => {
      return new Promise((resolve) => {
        const startTime = performance.now()

        // Update the container's state reference (may have changed)
        container.state = view.state

        // Schedule the update
        reconciler.updateContainer(element, root, null, () => {
          const endTime = performance.now()

          resolve({
            inserted: 0, // TODO: Track actual counts
            deleted: 0,
            updated: 0,
            durationMs: endTime - startTime,
          })
        })
      })
    },

    unmount: (): void => {
      if (!mounted) return
      mounted = false

      // Clear the container
      reconciler.updateContainer(null, root, null, () => {
        // Cleanup complete
      })
    },

    getContainer: (): Container => container,

    isMounted: (): boolean => mounted,
  }
}

// =============================================================================
// Utility: JSON to React Elements
// =============================================================================

import type { JSONNode, JSONDocument } from './types'
import { createElement } from 'react'

/**
 * Internal type for JSON with optional key for React reconciliation
 */
interface JSONNodeWithKey extends JSONNode {
  key?: string | number
}

/**
 * Convert JSON document structure to React elements.
 * This bridges AI-generated JSON to the reconciler.
 */
function jsonToElements(json: JSONDocument | JSONNodeWithKey, key?: string | number): ReactNode {
  // Document root
  if (json.type === 'doc' && 'content' in json) {
    const doc = json as JSONDocument
    return createElement(
      'doc',
      { key: key ?? 'root' },
      doc.content?.map((child, i) => jsonToElements(child, i)) ?? null
    )
  }

  const node = json as JSONNodeWithKey

  // Text node
  if (node.type === 'text' && node.text) {
    return createElement('text', {
      key: key ?? node.key,
      text: node.text,
      marks: node.marks,
    })
  }

  // Container node
  return createElement(
    node.type,
    {
      key: key ?? node.key,
      ...node.attrs,
    },
    node.content?.map((child, i) => jsonToElements(child, i)) ?? null
  )
}

/**
 * Convenience method: render JSON directly without manual element creation.
 */
async function renderJSON(
  reconciler: ReconcilerInstance,
  json: JSONDocument
): Promise<ReconcileResult> {
  const elements = jsonToElements(json)
  return reconciler.render(elements)
}

// =============================================================================
// Exports
// =============================================================================

export const DocumentReconciler = {
  create,
  jsonToElements,
  renderJSON,
}

export type { ReconcilerInstance }
