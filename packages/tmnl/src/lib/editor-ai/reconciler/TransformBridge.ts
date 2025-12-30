/**
 * Transform Bridge
 *
 * Converts SmartMerge operations to ProseMirror transaction steps.
 * This is the final stage of the reconciliation pipeline:
 *
 *   AI JSON → SmartMerge → MergeOps → TransformBridge → PM Transaction
 *
 * Key responsibilities:
 * 1. Convert JSONNode → ProseMirror Node
 * 2. Apply MergeOps as PM transaction steps
 * 3. Handle position mapping during mutations
 * 4. Provide atomic transaction semantics
 *
 * @module editor-ai/reconciler/TransformBridge
 */

import type { Node as PMNode, Schema as PMSchema, Mark } from '@tiptap/pm/model'
import type { EditorState, Transaction, Selection } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { MergeOp, MergeResult, MergeStats } from './SmartMerge'
import type { JSONNode, JSONDocument, JSONMark } from './types'

// =============================================================================
// Types
// =============================================================================

export interface TransformResult {
  readonly transaction: Transaction
  readonly stats: MergeStats
  readonly applied: boolean
}

export interface TransformOptions {
  /**
   * If true, preserve selection after transform.
   * Default: true
   */
  readonly preserveSelection?: boolean

  /**
   * If true, add transform to undo history.
   * Default: true
   */
  readonly addToHistory?: boolean

  /**
   * Optional metadata to attach to the transaction.
   */
  readonly meta?: Record<string, unknown>
}

// =============================================================================
// JSON → ProseMirror Conversion
// =============================================================================

/**
 * Convert JSONMark to ProseMirror Mark
 */
function jsonMarkToPMMark(
  schema: PMSchema,
  jsonMark: JSONMark
): Mark | null {
  const markType = schema.marks[jsonMark.type]
  if (!markType) {
    console.warn(`[TransformBridge] Unknown mark type: ${jsonMark.type}`)
    return null
  }

  return markType.create(jsonMark.attrs ?? {})
}

/**
 * Convert JSONNode to ProseMirror Node
 */
export function jsonNodeToPMNode(
  schema: PMSchema,
  json: JSONNode
): PMNode | null {
  // Text node
  if (json.type === 'text' && json.text !== undefined) {
    const marks = (json.marks ?? [])
      .map((m) => jsonMarkToPMMark(schema, m))
      .filter((m): m is Mark => m !== null)

    return schema.text(json.text, marks)
  }

  // Get node type
  const nodeType = schema.nodes[json.type]
  if (!nodeType) {
    console.warn(`[TransformBridge] Unknown node type: ${json.type}`)
    return null
  }

  // Leaf node (no content)
  if (!json.content || json.content.length === 0) {
    try {
      return nodeType.createAndFill(json.attrs ?? {})
    } catch (err) {
      console.warn(`[TransformBridge] Failed to create leaf node: ${json.type}`, err)
      return null
    }
  }

  // Container node - recursively convert children
  const children: PMNode[] = []
  for (const childJson of json.content) {
    const child = jsonNodeToPMNode(schema, childJson)
    if (child) {
      children.push(child)
    }
  }

  try {
    return nodeType.create(json.attrs ?? {}, children)
  } catch (err) {
    console.warn(`[TransformBridge] Failed to create container: ${json.type}`, err)
    return null
  }
}

/**
 * Convert full JSONDocument to ProseMirror Node
 */
export function jsonDocumentToPMNode(
  schema: PMSchema,
  doc: JSONDocument
): PMNode | null {
  const children: PMNode[] = []

  for (const child of doc.content ?? []) {
    const pmChild = jsonNodeToPMNode(schema, child)
    if (pmChild) {
      children.push(pmChild)
    }
  }

  try {
    return schema.nodes.doc!.create({}, children)
  } catch (err) {
    console.warn('[TransformBridge] Failed to create doc node', err)
    return null
  }
}

// =============================================================================
// Position Utilities
// =============================================================================

/**
 * Find the position of the nth block in the document.
 * Returns the position at the start of the block.
 */
function findBlockPosition(doc: PMNode, blockIndex: number): number | null {
  let currentIndex = 0
  let foundPos: number | null = null

  doc.forEach((node, offset) => {
    if (foundPos !== null) return
    if (currentIndex === blockIndex) {
      foundPos = offset
      return
    }
    currentIndex++
  })

  return foundPos
}

/**
 * Get the size of the nth block in the document.
 */
function getBlockSize(doc: PMNode, blockIndex: number): number {
  let currentIndex = 0
  let size = 0

  doc.forEach((node) => {
    if (currentIndex === blockIndex) {
      size = node.nodeSize
      return
    }
    currentIndex++
  })

  return size
}

// =============================================================================
// Transform Application
// =============================================================================

/**
 * Apply a single MergeOp to a transaction.
 * Returns updated offset for position adjustments.
 */
function applyMergeOp(
  tr: Transaction,
  schema: PMSchema,
  op: MergeOp,
  positionOffset: number
): number {
  switch (op.type) {
    case 'NOOP':
      // No operation needed
      return positionOffset

    case 'INSERT': {
      const pmNode = jsonNodeToPMNode(schema, op.node)
      if (!pmNode) return positionOffset

      // Find position to insert at
      // Insert after the block at index-1, or at start if index is 0
      const doc = tr.doc
      let insertPos: number

      if (op.index === 0) {
        insertPos = 1 // After doc open tag
      } else {
        // Find end of previous block
        const prevPos = findBlockPosition(doc, op.index - 1)
        if (prevPos === null) {
          // Fallback: insert at end
          insertPos = doc.content.size
        } else {
          const prevSize = getBlockSize(doc, op.index - 1)
          insertPos = prevPos + prevSize
        }
      }

      insertPos += positionOffset
      tr.insert(insertPos, pmNode)

      return positionOffset + pmNode.nodeSize
    }

    case 'DELETE': {
      const doc = tr.doc
      const blockPos = findBlockPosition(doc, op.index)
      if (blockPos === null) return positionOffset

      const adjustedPos = blockPos + positionOffset
      const blockSize = getBlockSize(doc, op.index)

      tr.delete(adjustedPos, adjustedPos + blockSize)

      return positionOffset - blockSize
    }

    case 'UPDATE': {
      const pmNode = jsonNodeToPMNode(schema, op.to)
      if (!pmNode) return positionOffset

      const doc = tr.doc
      const blockPos = findBlockPosition(doc, op.index)
      if (blockPos === null) return positionOffset

      const adjustedPos = blockPos + positionOffset
      const oldSize = getBlockSize(doc, op.index)

      // Replace the old node with the new one
      tr.replaceWith(adjustedPos, adjustedPos + oldSize, pmNode)

      return positionOffset + (pmNode.nodeSize - oldSize)
    }

    case 'MOVE': {
      const doc = tr.doc

      // Get the node to move
      const fromPos = findBlockPosition(doc, op.fromIndex)
      if (fromPos === null) return positionOffset

      const adjustedFromPos = fromPos + positionOffset
      const nodeSize = getBlockSize(doc, op.fromIndex)
      const nodeToMove = doc.slice(adjustedFromPos, adjustedFromPos + nodeSize)

      // Delete from old position
      tr.delete(adjustedFromPos, adjustedFromPos + nodeSize)

      // Calculate new insert position (accounting for deletion)
      let insertPos: number
      if (op.toIndex === 0) {
        insertPos = 1
      } else {
        const prevPos = findBlockPosition(tr.doc, op.toIndex - 1)
        if (prevPos === null) {
          insertPos = tr.doc.content.size
        } else {
          const prevSize = getBlockSize(tr.doc, op.toIndex - 1)
          insertPos = prevPos + prevSize
        }
      }

      // Insert at new position
      tr.insert(insertPos, nodeToMove.content)

      return positionOffset // Net change is zero for moves
    }
  }
}

/**
 * Apply MergeResult to an EditorState, producing a Transaction.
 */
export function applyMergeResult(
  state: EditorState,
  mergeResult: MergeResult,
  options: TransformOptions = {}
): TransformResult {
  const { preserveSelection = true, addToHistory = true, meta = {} } = options

  const tr = state.tr

  // Set meta
  if (!addToHistory) {
    tr.setMeta('addToHistory', false)
  }
  for (const [key, value] of Object.entries(meta)) {
    tr.setMeta(key, value)
  }

  // Apply operations in order with position tracking
  let positionOffset = 0
  for (const op of mergeResult.ops) {
    positionOffset = applyMergeOp(tr, state.schema, op, positionOffset)
  }

  // Preserve selection if requested
  if (preserveSelection && tr.docChanged) {
    // Map the selection through the changes
    const mappedFrom = tr.mapping.map(state.selection.from)
    const mappedTo = tr.mapping.map(state.selection.to)
    // Use TextSelection for simplicity - works for most cases
    try {
      tr.setSelection(TextSelection.create(tr.doc, mappedFrom, mappedTo))
    } catch {
      // If selection is invalid (e.g., outside doc bounds), reset to start
      tr.setSelection(TextSelection.create(tr.doc, 1))
    }
  }

  return {
    transaction: tr,
    stats: mergeResult.stats,
    applied: tr.docChanged,
  }
}

/**
 * Apply MergeResult directly to an EditorView.
 */
export function dispatchMergeResult(
  view: EditorView,
  mergeResult: MergeResult,
  options: TransformOptions = {}
): TransformResult {
  const result = applyMergeResult(view.state, mergeResult, options)

  if (result.applied) {
    view.dispatch(result.transaction)
  }

  return result
}

// =============================================================================
// High-Level API
// =============================================================================

import { mergeDocuments } from './SmartMerge'

/**
 * Merge a new JSONDocument into an editor view.
 * This is the primary API for AI-generated content integration.
 *
 * @example
 * ```typescript
 * import { mergeIntoEditor } from './TransformBridge'
 *
 * // AI generates new document
 * const aiDoc: JSONDocument = { type: 'doc', content: [...] }
 *
 * // Merge with minimal mutations
 * const result = mergeIntoEditor(view, aiDoc)
 * console.log(`Applied: ${result.stats.updated} updates, ${result.stats.inserted} inserts`)
 * ```
 */
export function mergeIntoEditor(
  view: EditorView,
  newDoc: JSONDocument,
  options: TransformOptions = {}
): TransformResult {
  // Convert current document to JSON for comparison
  const currentDoc = pmNodeToJSON(view.state.doc) as JSONDocument

  // Compute merge operations
  const mergeResult = mergeDocuments(currentDoc, newDoc)

  // Apply to editor
  return dispatchMergeResult(view, mergeResult, options)
}

/**
 * Convert ProseMirror Node to JSONNode (for comparison)
 */
function pmNodeToJSON(node: PMNode): JSONNode {
  if (node.isText) {
    const result: JSONNode = {
      type: 'text',
      text: node.text ?? '',
    }

    if (node.marks.length > 0) {
      return {
        ...result,
        marks: node.marks.map((m) => ({
          type: m.type.name,
          attrs: m.attrs,
        })),
      }
    }

    return result
  }

  // Build content array first
  const content: JSONNode[] = []
  if (node.content.size > 0) {
    node.forEach((child) => {
      content.push(pmNodeToJSON(child))
    })
  }

  // Build object with all fields at once
  return {
    type: node.type.name,
    ...(Object.keys(node.attrs).length > 0 ? { attrs: node.attrs } : {}),
    ...(content.length > 0 ? { content } : {}),
  }
}

// =============================================================================
// Exports
// =============================================================================

export { pmNodeToJSON }
