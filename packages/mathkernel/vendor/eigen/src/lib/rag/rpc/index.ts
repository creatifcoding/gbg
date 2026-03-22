/**
 * RAG RPC Protocol
 *
 * Effect Rpc definitions for RAG operations.
 * Schema-typed procedures with error handling.
 */

import { Rpc, RpcGroup } from '@effect/rpc';
import { Schema } from 'effect';
import {
  SearchPayload,
  SearchResponse,
  ListIndexesResponse,
  BuildPayload,
  BuildResponse,
  AskPayload,
  AskResponse,
  RagError,
} from '../schemas';

// ============================================================================
// RPC Definitions
// ============================================================================

/**
 * Search the codebase for relevant snippets
 */
export const Search = Rpc.make('Search', {
  payload: SearchPayload,
  success: SearchResponse,
  error: RagError,
});

/**
 * List all available indexes
 */
export const ListIndexes = Rpc.make('ListIndexes', {
  success: ListIndexesResponse,
  error: RagError,
});

/**
 * Build a new index from source files
 */
export const Build = Rpc.make('Build', {
  payload: BuildPayload,
  success: BuildResponse,
  error: RagError,
});

/**
 * Ask a question with RAG context
 */
export const Ask = Rpc.make('Ask', {
  payload: AskPayload,
  success: AskResponse,
  error: RagError,
});

// ============================================================================
// RPC Group
// ============================================================================

/**
 * RAG RPC Protocol
 *
 * Provides typed procedures for:
 * - Search: Semantic search over indexed codebase
 * - ListIndexes: List available indexes
 * - Build: Create new index from sources
 * - Ask: RAG-powered Q&A
 */
export class RagRpcs extends RpcGroup.make(
  Search,
  ListIndexes,
  Build,
  Ask
) {}

// Re-export for convenience
export type { SearchPayload, SearchResponse, ListIndexesResponse, BuildPayload, BuildResponse, AskPayload, AskResponse, RagError };
