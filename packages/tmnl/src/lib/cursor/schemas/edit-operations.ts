/**
 * Edit Operations Schema
 *
 * Effect Schema definitions for structured edit operations used in
 * AI-native code editing (Cursor-style). Supports replace, insert,
 * delete, and create_file operations with rich metadata.
 *
 * @module cursor/schemas/edit-operations
 */

import { Schema } from 'effect'

// =============================================================================
// Branded Identifiers
// =============================================================================

/**
 * Unique identifier for an edit operation
 */
export const EditOperationId = Schema.String.pipe(
  Schema.brand('EditOperationId'),
  Schema.annotations({ description: 'Unique identifier for the edit operation' })
)
export type EditOperationId = typeof EditOperationId.Type

/**
 * File path (absolute or relative to workspace root)
 */
export const FilePath = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('FilePath'),
  Schema.annotations({ description: 'Path to the target file' })
)
export type FilePath = typeof FilePath.Type

// =============================================================================
// Operation Type
// =============================================================================

/**
 * Types of edit operations supported:
 * - replace: Replace content between lines
 * - insert: Insert content at a specific line
 * - delete: Remove content between lines
 * - create_file: Create a new file with content
 */
export const EditOperationType = Schema.Literal(
  'replace',
  'insert',
  'delete',
  'create_file'
)
export type EditOperationType = typeof EditOperationType.Type

// =============================================================================
// Confidence Level
// =============================================================================

/**
 * AI confidence in the edit operation
 */
export const ConfidenceLevel = Schema.Literal('high', 'medium', 'low')
export type ConfidenceLevel = typeof ConfidenceLevel.Type

/**
 * Numeric confidence score (0-1)
 */
export const ConfidenceScore = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.annotations({
    description: 'Confidence score between 0 and 1',
  })
)
export type ConfidenceScore = typeof ConfidenceScore.Type

// =============================================================================
// Line Position
// =============================================================================

/**
 * 1-indexed line number
 */
export const LineNumber = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.annotations({ description: '1-indexed line number' })
)
export type LineNumber = typeof LineNumber.Type

/**
 * Line range for targeting content
 */
export const LineRange = Schema.Struct({
  /** Start line (1-indexed, inclusive) */
  startLine: LineNumber,
  /** End line (1-indexed, inclusive) */
  endLine: LineNumber,
}).pipe(
  Schema.filter((range) => range.startLine <= range.endLine, {
    message: () => 'startLine must be <= endLine',
  })
)
export type LineRange = typeof LineRange.Type

// =============================================================================
// File Targeting
// =============================================================================

/**
 * Target specification for file edits.
 * Supports line-based targeting with optional column precision.
 */
export const FileTarget = Schema.Struct({
  /** Path to the target file */
  path: FilePath,
  /** Start line (1-indexed, inclusive) - required for replace/insert/delete */
  startLine: Schema.optional(LineNumber),
  /** End line (1-indexed, inclusive) - required for replace/delete */
  endLine: Schema.optional(LineNumber),
  /** Start column (1-indexed) - optional fine-grained positioning */
  startColumn: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive())
  ),
  /** End column (1-indexed) - optional fine-grained positioning */
  endColumn: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive())
  ),
})
export type FileTarget = typeof FileTarget.Type

// =============================================================================
// Edit Metadata
// =============================================================================

/**
 * Metadata for AI-generated edits.
 * Captures reasoning, confidence, and provenance.
 */
export const EditMetadata = Schema.Struct({
  /** Human-readable reasoning for the edit */
  reasoning: Schema.String.pipe(
    Schema.annotations({
      description: 'Explanation of why this edit is being made',
    })
  ),
  /** Confidence level (categorical) */
  confidence: ConfidenceLevel,
  /** Confidence score (numeric) */
  confidenceScore: Schema.optional(ConfidenceScore),
  /** Source of the edit (e.g., "user-request", "refactor", "fix-lint") */
  source: Schema.optional(Schema.String),
  /** Tags for categorization */
  tags: Schema.optional(Schema.Array(Schema.String)),
  /** Timestamp of when the edit was generated */
  generatedAt: Schema.optional(Schema.Number),
  /** Model or agent that generated the edit */
  generatedBy: Schema.optional(Schema.String),
})
export type EditMetadata = typeof EditMetadata.Type

// =============================================================================
// Operation-Specific Payloads (TaggedStruct for discrimination)
// =============================================================================

/**
 * Replace operation: Replace content between startLine and endLine
 */
export const ReplaceOperation = Schema.TaggedStruct('ReplaceOperation', {
  /** Unique operation ID */
  id: EditOperationId,
  /** Operation type discriminator */
  type: Schema.Literal('replace'),
  /** File targeting */
  target: FileTarget,
  /** New content to replace with */
  content: Schema.String.pipe(
    Schema.annotations({ description: 'New content to insert' })
  ),
  /** Original content being replaced (for undo/diff) */
  originalContent: Schema.optional(Schema.String),
  /** Edit metadata */
  metadata: EditMetadata,
})
export type ReplaceOperation = typeof ReplaceOperation.Type

/**
 * Insert operation: Insert content at a specific line
 * Content is inserted BEFORE the specified line.
 */
export const InsertOperation = Schema.TaggedStruct('InsertOperation', {
  /** Unique operation ID */
  id: EditOperationId,
  /** Operation type discriminator */
  type: Schema.Literal('insert'),
  /** File targeting (only startLine used) */
  target: FileTarget,
  /** Content to insert */
  content: Schema.String.pipe(
    Schema.annotations({ description: 'Content to insert' })
  ),
  /** Insert position relative to line */
  position: Schema.optional(Schema.Literal('before', 'after')),
  /** Edit metadata */
  metadata: EditMetadata,
})
export type InsertOperation = typeof InsertOperation.Type

/**
 * Delete operation: Remove content between startLine and endLine
 */
export const DeleteOperation = Schema.TaggedStruct('DeleteOperation', {
  /** Unique operation ID */
  id: EditOperationId,
  /** Operation type discriminator */
  type: Schema.Literal('delete'),
  /** File targeting */
  target: FileTarget,
  /** Original content being deleted (for undo) */
  originalContent: Schema.optional(Schema.String),
  /** Edit metadata */
  metadata: EditMetadata,
})
export type DeleteOperation = typeof DeleteOperation.Type

/**
 * Create file operation: Create a new file with content
 */
export const CreateFileOperation = Schema.TaggedStruct('CreateFileOperation', {
  /** Unique operation ID */
  id: EditOperationId,
  /** Operation type discriminator */
  type: Schema.Literal('create_file'),
  /** File targeting (only path used) */
  target: FileTarget,
  /** Initial file content */
  content: Schema.String.pipe(
    Schema.annotations({ description: 'Initial file content' })
  ),
  /** Whether to overwrite if file exists */
  overwrite: Schema.optional(Schema.Boolean),
  /** Edit metadata */
  metadata: EditMetadata,
})
export type CreateFileOperation = typeof CreateFileOperation.Type

// =============================================================================
// Union Type for All Operations
// =============================================================================

/**
 * Discriminated union of all edit operation types.
 * Use `_tag` field to discriminate between operation types.
 */
export const EditOperation = Schema.Union(
  ReplaceOperation,
  InsertOperation,
  DeleteOperation,
  CreateFileOperation
)
export type EditOperation = typeof EditOperation.Type

// =============================================================================
// Edit Batch (Multiple Operations)
// =============================================================================

/**
 * Batch of edit operations to be applied atomically.
 */
export const EditBatch = Schema.Struct({
  /** Unique batch ID */
  id: Schema.String.pipe(Schema.brand('EditBatchId')),
  /** Ordered list of operations */
  operations: Schema.NonEmptyArray(EditOperation),
  /** Whether operations should be applied atomically */
  atomic: Schema.optional(Schema.Boolean),
  /** Batch-level metadata */
  description: Schema.optional(Schema.String),
  /** Timestamp when batch was created */
  createdAt: Schema.Number,
})
export type EditBatch = typeof EditBatch.Type

// =============================================================================
// Operation Result
// =============================================================================

/**
 * Result status for an operation
 */
export const OperationStatus = Schema.Literal(
  'success',
  'failure',
  'skipped',
  'partial'
)
export type OperationStatus = typeof OperationStatus.Type

/**
 * Result of applying an edit operation.
 */
export const EditOperationResult = Schema.Struct({
  /** Operation ID this result is for */
  operationId: EditOperationId,
  /** Result status */
  status: OperationStatus,
  /** Error message if failed */
  error: Schema.optional(Schema.String),
  /** Lines affected (for validation) */
  linesAffected: Schema.optional(Schema.Number),
  /** Applied timestamp */
  appliedAt: Schema.optional(Schema.Number),
  /** Diff or changeset (for UI display) */
  diff: Schema.optional(Schema.String),
})
export type EditOperationResult = typeof EditOperationResult.Type

/**
 * Result of applying a batch of operations.
 */
export const EditBatchResult = Schema.Struct({
  /** Batch ID this result is for */
  batchId: Schema.String,
  /** Overall status */
  status: OperationStatus,
  /** Individual operation results */
  results: Schema.Array(EditOperationResult),
  /** Summary statistics */
  summary: Schema.Struct({
    total: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    succeeded: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    failed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    skipped: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
  /** Total duration in milliseconds */
  durationMs: Schema.optional(Schema.Number),
})
export type EditBatchResult = typeof EditBatchResult.Type

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Generate a unique EditOperationId
 */
export const generateEditOperationId = (): EditOperationId =>
  `edit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` as EditOperationId

/**
 * Create a replace operation with defaults
 */
export const createReplaceOperation = (params: {
  path: string
  startLine: number
  endLine: number
  content: string
  reasoning: string
  confidence?: ConfidenceLevel
  originalContent?: string
}): ReplaceOperation => ({
  _tag: 'ReplaceOperation',
  id: generateEditOperationId(),
  type: 'replace',
  target: {
    path: params.path as FilePath,
    startLine: params.startLine as LineNumber,
    endLine: params.endLine as LineNumber,
  },
  content: params.content,
  originalContent: params.originalContent,
  metadata: {
    reasoning: params.reasoning,
    confidence: params.confidence ?? 'medium',
    generatedAt: Date.now(),
  },
})

/**
 * Create an insert operation with defaults
 */
export const createInsertOperation = (params: {
  path: string
  startLine: number
  content: string
  reasoning: string
  confidence?: ConfidenceLevel
  position?: 'before' | 'after'
}): InsertOperation => ({
  _tag: 'InsertOperation',
  id: generateEditOperationId(),
  type: 'insert',
  target: {
    path: params.path as FilePath,
    startLine: params.startLine as LineNumber,
  },
  content: params.content,
  position: params.position,
  metadata: {
    reasoning: params.reasoning,
    confidence: params.confidence ?? 'medium',
    generatedAt: Date.now(),
  },
})

/**
 * Create a delete operation with defaults
 */
export const createDeleteOperation = (params: {
  path: string
  startLine: number
  endLine: number
  reasoning: string
  confidence?: ConfidenceLevel
  originalContent?: string
}): DeleteOperation => ({
  _tag: 'DeleteOperation',
  id: generateEditOperationId(),
  type: 'delete',
  target: {
    path: params.path as FilePath,
    startLine: params.startLine as LineNumber,
    endLine: params.endLine as LineNumber,
  },
  originalContent: params.originalContent,
  metadata: {
    reasoning: params.reasoning,
    confidence: params.confidence ?? 'medium',
    generatedAt: Date.now(),
  },
})

/**
 * Create a create_file operation with defaults
 */
export const createCreateFileOperation = (params: {
  path: string
  content: string
  reasoning: string
  confidence?: ConfidenceLevel
  overwrite?: boolean
}): CreateFileOperation => ({
  _tag: 'CreateFileOperation',
  id: generateEditOperationId(),
  type: 'create_file',
  target: {
    path: params.path as FilePath,
  },
  content: params.content,
  overwrite: params.overwrite,
  metadata: {
    reasoning: params.reasoning,
    confidence: params.confidence ?? 'medium',
    generatedAt: Date.now(),
  },
})

// =============================================================================
// Type Guards (using _tag discriminator)
// =============================================================================

export const isReplaceOperation = (op: EditOperation): op is ReplaceOperation =>
  op._tag === 'ReplaceOperation'

export const isInsertOperation = (op: EditOperation): op is InsertOperation =>
  op._tag === 'InsertOperation'

export const isDeleteOperation = (op: EditOperation): op is DeleteOperation =>
  op._tag === 'DeleteOperation'

export const isCreateFileOperation = (
  op: EditOperation
): op is CreateFileOperation => op._tag === 'CreateFileOperation'
