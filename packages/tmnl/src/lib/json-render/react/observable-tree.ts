/**
 * Observable UITree for Legend State
 *
 * Provides fine-grained reactivity for streaming JSON rendering.
 * O(1) element adds, automatic batching, no React reconciliation overhead.
 *
 * @module json-render/react/observable-tree
 */

import { observable, batch, type ObservableObject } from '@legendapp/state'
import type { UIElement } from '../core/schemas'

// =============================================================================
// Types
// =============================================================================

/**
 * Observable version of UITree for Legend State
 * Structured for path-based fine-grained updates
 */
export interface ObservableUITree {
  /** Root element key */
  root: string | null
  /** Element map - each element is individually observable */
  elements: Record<string, UIElement>
}

/**
 * JSON Patch operation type
 */
export interface JSONPatchOp {
  op: 'add' | 'replace' | 'remove' | 'set'
  path: string
  value?: unknown
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a Legend State observable for UITree
 *
 * Optimized for streaming:
 * - O(1) element adds via path-based set
 * - Automatic fine-grained reactivity
 * - No object spread, no React key diffing
 *
 * @example
 * ```typescript
 * const tree$ = createTreeObservable()
 *
 * // During streaming
 * tree$.root.set('root-key')
 * tree$.elements['element-1'].set({ type: 'Text', props: { text: 'Hello' } })
 *
 * // React subscribes fine-grained
 * const element = useSelector(() => tree$.elements['element-1'].get())
 * ```
 */
export function createTreeObservable(
  initial?: Partial<ObservableUITree>
): ObservableObject<ObservableUITree> {
  return observable<ObservableUITree>({
    root: initial?.root ?? null,
    elements: initial?.elements ?? {},
  })
}

// =============================================================================
// Streaming Mutations
// =============================================================================

/**
 * Apply a single JSON patch operation to the tree
 *
 * Designed for streaming consumption:
 * - Direct path-based mutation (no spread)
 * - O(1) for element adds
 * - Triggers fine-grained Legend State reactivity
 *
 * @param tree$ - The observable tree
 * @param op - JSON Patch operation
 */
export function applyPatch(
  tree$: ObservableObject<ObservableUITree>,
  op: JSONPatchOp
): void {
  if ((op.op === 'replace' || op.op === 'set') && op.path === '/root') {
    tree$.root.set(op.value as string | null)
  } else if (op.op === 'add' && op.path.startsWith('/elements/')) {
    const key = op.path.replace('/elements/', '')
    // Legend State: set() at path creates if missing, updates if exists
    // This is O(1) - no object spread needed
    ;(tree$.elements as Record<string, { set: (v: UIElement) => void }>)[key]?.set?.(
      op.value as UIElement
    ) ?? (tree$.elements[key] = observable(op.value as UIElement))
  } else if (op.op === 'remove' && op.path.startsWith('/elements/')) {
    const key = op.path.replace('/elements/', '')
    tree$.elements[key].delete()
  }
}

/**
 * Apply multiple patches in a single batch
 *
 * Uses Legend State's batch() to coalesce all updates into one
 * React reconciliation pass.
 *
 * @param tree$ - The observable tree
 * @param patches - Array of JSON Patch operations
 */
export function applyPatches(
  tree$: ObservableObject<ObservableUITree>,
  patches: JSONPatchOp[]
): void {
  batch(() => {
    for (const patch of patches) {
      applyPatch(tree$, patch)
    }
  })
}

/**
 * Bulk set elements during initial load or batch flush
 *
 * More efficient than individual applyPatch calls when you have
 * many elements to add at once.
 *
 * @param tree$ - The observable tree
 * @param elements - Elements to add/update
 * @param root - Optional root key to set
 */
export function bulkSet(
  tree$: ObservableObject<ObservableUITree>,
  elements: Record<string, UIElement>,
  root?: string | null
): void {
  batch(() => {
    if (root !== undefined) {
      tree$.root.set(root)
    }
    // Legend State handles deep assignment efficiently
    tree$.elements.set(elements)
  })
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get element keys as an array (for iteration)
 */
export function getElementKeys(
  tree$: ObservableObject<ObservableUITree>
): string[] {
  return Object.keys(tree$.elements.get() ?? {})
}

/**
 * Check if tree has any elements
 */
export function hasElements(
  tree$: ObservableObject<ObservableUITree>
): boolean {
  const elements = tree$.elements.get()
  return elements !== null && Object.keys(elements).length > 0
}

/**
 * Reset tree to empty state
 */
export function resetTree(tree$: ObservableObject<ObservableUITree>): void {
  batch(() => {
    tree$.root.set(null)
    tree$.elements.set({})
  })
}
