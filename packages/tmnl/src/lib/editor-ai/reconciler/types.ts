/**
 * Document Reconciler Types
 *
 * Core types for react-reconciler integration with ProseMirror.
 * These define the opaque types that the HostConfig operates on.
 *
 * @module editor-ai/reconciler/types
 */

import type { Node as PMNode, Mark, Schema as PMSchema } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

// =============================================================================
// Reconciler Opaque Types
// =============================================================================

/**
 * Node type name (e.g., 'paragraph', 'heading', 'mapBlock')
 */
export type Type = string

/**
 * Props for node creation and updates
 */
export interface Props {
  readonly attrs?: Record<string, unknown>
  readonly marks?: readonly Mark[]
  readonly content?: readonly PMNode[]
  readonly text?: string
  readonly children?: unknown
  // React key
  readonly key?: string | number
}

/**
 * Root container - wraps EditorView for reconciler operations
 */
export interface Container {
  readonly view: EditorView
  /** Current editor state (mutable - updated before each render) */
  state: EditorState
  readonly schema: PMSchema
  /** Pending transaction for batch operations */
  transaction: Transaction | null
}

/**
 * Node instance - wraps ProseMirror node with tracking metadata
 */
export interface Instance {
  /** The underlying ProseMirror node */
  readonly node: PMNode
  /** Original type for updates */
  readonly type: Type
  /** Current props */
  props: Props
  /** Position in document (updated during commit) */
  position: number
  /** Children instances */
  children: Instance[]
  /** Parent instance */
  parent: Instance | null
}

/**
 * Text instance - simplified for text nodes
 */
export interface TextInstance {
  readonly text: string
  position: number
  parent: Instance | null
}

/**
 * Host context passed down the tree
 */
export interface HostContext {
  /** ProseMirror schema */
  readonly schema: PMSchema
  /** Parent node type (for content validation) */
  readonly parentType: Type
  /** Depth in document tree */
  readonly depth: number
}

/**
 * Update payload computed during render phase
 */
export interface UpdatePayload {
  readonly attrs?: Record<string, unknown>
  readonly marks?: readonly Mark[]
  /** Whether this is a structural change requiring rebuild */
  readonly structural?: boolean
}

// =============================================================================
// Pending Operations
// =============================================================================

/**
 * Operations queued during render phase, applied in commit
 */
export type PendingOperation =
  | {
      readonly type: 'appendChild'
      readonly parent: Instance
      readonly child: Instance | TextInstance
    }
  | {
      readonly type: 'insertBefore'
      readonly parent: Instance
      readonly child: Instance | TextInstance
      readonly before: Instance | TextInstance
    }
  | {
      readonly type: 'removeChild'
      readonly parent: Instance
      readonly child: Instance | TextInstance
    }
  | {
      readonly type: 'setNodeMarkup'
      readonly instance: Instance
      readonly attrs: Record<string, unknown>
    }
  | {
      readonly type: 'updateText'
      readonly instance: TextInstance
      readonly text: string
    }

// =============================================================================
// Reconcile Results
// =============================================================================

/**
 * Result of a reconciliation operation
 */
export interface ReconcileResult {
  /** Number of nodes inserted */
  readonly inserted: number
  /** Number of nodes deleted */
  readonly deleted: number
  /** Number of nodes updated */
  readonly updated: number
  /** Duration in milliseconds */
  readonly durationMs: number
}

/**
 * Progressive reconciliation update (for streaming)
 */
export interface ReconcileUpdate extends ReconcileResult {
  /** Block that was reconciled */
  readonly block: JSONNode
  /** Running total of blocks processed */
  readonly totalBlocks: number
}

// =============================================================================
// Document JSON Types
// =============================================================================

/**
 * JSON representation of a ProseMirror node
 * Compatible with TipTap's getJSON/setContent
 */
export interface JSONNode {
  /** Node type name */
  readonly type: string
  /** Node attributes */
  readonly attrs?: Record<string, unknown>
  /** Child nodes (for non-leaf nodes) */
  readonly content?: readonly JSONNode[]
  /** Text content (for text nodes) */
  readonly text?: string
  /** Marks on text */
  readonly marks?: readonly JSONMark[]
}

/**
 * JSON representation of a ProseMirror mark
 */
export interface JSONMark {
  readonly type: string
  readonly attrs?: Record<string, unknown>
}

/**
 * Full document JSON
 */
export interface JSONDocument {
  readonly type: 'doc'
  readonly content: readonly JSONNode[]
}

// =============================================================================
// Block Types (for streaming)
// =============================================================================

/**
 * Token emitted from AI SDK stream
 */
export interface AIToken {
  /** Raw JSON string fragment */
  readonly raw: string
  /** Parsed partial object (if complete enough) */
  readonly partial?: Partial<JSONNode>
}

/**
 * Batched block ready for reconciliation
 */
export interface BlockBatch {
  /** Complete nodes in this batch */
  readonly nodes: readonly JSONNode[]
  /** Timestamp of batch creation */
  readonly timestamp: number
  /** Whether this is the final batch */
  readonly isFinal: boolean
}

// =============================================================================
// Reconciler Errors
// =============================================================================

/**
 * Error during reconciliation
 */
export class ReconcilerError extends Error {
  readonly _tag = 'ReconcilerError'

  constructor(
    readonly operation: string,
    readonly cause: unknown,
    message?: string
  ) {
    super(message ?? `Reconciler error during ${operation}`)
    this.name = 'ReconcilerError'
  }
}

/**
 * Error during schema validation
 */
export class SchemaValidationError extends Error {
  readonly _tag = 'SchemaValidationError'

  constructor(
    readonly nodeType: string,
    readonly cause: unknown,
    message?: string
  ) {
    super(message ?? `Schema validation failed for node type: ${nodeType}`)
    this.name = 'SchemaValidationError'
  }
}
