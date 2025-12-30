/**
 * EditorAI Tools
 *
 * AI SDK tool definitions for editor and knowledge operations.
 * All tools use Effect.Schema - AI SDK 6+ native support.
 *
 * @module editor-ai/tools
 */

export {
  createBaseEditorTools,
  type BaseEditorTools,
  type BaseEditorToolName,
} from './base-tools'

export {
  createKnowledgeTools,
  searchKnowledge,
  getAllSchemas,
  getAllServices,
  getAllPatterns,
  loadFullContext,
  reloadKnowledge,
  type KnowledgeTools,
  type KnowledgeToolName,
} from './knowledge-tools'
