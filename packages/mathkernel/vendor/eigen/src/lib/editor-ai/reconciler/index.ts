/**
 * Document Reconciler Module
 *
 * Custom React renderer for ProseMirror documents.
 * Enables AI-generated document structures to be reconciled
 * into ProseMirror with minimal diff and atomic transactions.
 *
 * @module editor-ai/reconciler
 */

// Core reconciler
export { DocumentReconciler } from './DocumentReconciler'
export type { ReconcilerInstance } from './DocumentReconciler'

// Types
export type {
  Type,
  Props,
  Container,
  Instance,
  TextInstance,
  HostContext,
  UpdatePayload,
  PendingOperation,
  ReconcileResult,
  ReconcileUpdate,
  JSONNode,
  JSONMark,
  JSONDocument,
  AIToken,
  BlockBatch,
} from './types'

export { ReconcilerError, SchemaValidationError } from './types'

// Schemas
export {
  // Core schemas
  JSONMark as JSONMarkSchema,
  JSONNode as JSONNodeSchema,
  JSONDocument as JSONDocumentSchema,

  // Block schemas (with Schema suffix to avoid component collision)
  ParagraphBlock as ParagraphBlockSchema,
  HeadingBlock as HeadingBlockSchema,
  CodeBlock as CodeBlockSchema,
  BulletList as BulletListSchema,
  OrderedList as OrderedListSchema,
  ListItem as ListItemSchema,
  Blockquote as BlockquoteSchema,
  HorizontalRule as HorizontalRuleSchema,

  // Custom TMNL block schemas
  MapBlock as MapBlockSchema,
  Scene3DBlock as Scene3DBlockSchema,
  DataGridBlock as DataGridBlockSchema,

  // Unions
  StandardBlock as StandardBlockSchema,
  CustomBlock as CustomBlockSchema,
  AnyBlock as AnyBlockSchema,

  // AI SDK StandardSchema exports (drop-in for Zod)
  JSONDocumentStandard,
  BlockArrayStandard,
  SingleBlockStandard,
  StandardBlockStandard,
  CustomBlockStandard,

  // Validation helpers
  decodeDocument,
  decodeNode,
  encodeDocument,
  isValidDocument,
  isValidNode,
} from './schemas'

// Schema types
export type {
  JSONNodeType,
} from './schemas'

// Smart Merge
export {
  computeMergeOps,
  mergeDocuments,
  computeTextDiff,
  computeBlockHash,
  nodesEqual,
  computeLCS,
} from './SmartMerge'

export type {
  MergeOp,
  MergeResult,
  MergeStats,
  TextOp,
} from './SmartMerge'

// Transform Bridge
export {
  jsonNodeToPMNode,
  jsonDocumentToPMNode,
  applyMergeResult,
  dispatchMergeResult,
  mergeIntoEditor,
  pmNodeToJSON,
} from './TransformBridge'

export type {
  TransformResult,
  TransformOptions,
} from './TransformBridge'

// Streaming Reconciler
export {
  createStreamingReconciler,
  createStreamingReconcilerEffect,
  processAIStream,
  createTokenBuffer,
  safeParseJSON,
} from './StreamingReconciler'

export type {
  StreamingConfig,
  StreamingReconcilerHandle,
  StreamingStats,
} from './StreamingReconciler'

// Block Components
export {
  // Document structure
  Doc,
  Paragraph,
  Heading,
  Text,

  // Standard blocks
  CodeBlock,
  Blockquote,
  BulletList,
  OrderedList,
  ListItem,
  HorizontalRule,

  // Custom TMNL blocks
  MapBlock,
  Scene3DBlock,
  DataGridBlock,

  // Mark components
  Bold,
  Italic,
  Code,
  Link,
  Strike,

  // Utilities
  createMarkedText,
  BlockComponents,
  getBlockComponent,
  jsonNodeToComponent,
  jsonDocumentToComponents,
} from './components'
