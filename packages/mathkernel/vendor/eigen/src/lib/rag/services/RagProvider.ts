/**
 * RAG Provider Service
 *
 * Effect.Service abstraction for RAG backends.
 * Decouples protocol from implementation (LEANN, Nia, etc.)
 */

import { Context, Effect, Layer } from 'effect';
import type {
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
// Service Interface
// ============================================================================

export interface RagProviderShape {
  /**
   * Search the codebase for relevant snippets
   */
  readonly search: (
    payload: SearchPayload
  ) => Effect.Effect<SearchResponse, RagError>;

  /**
   * List all available indexes
   */
  readonly listIndexes: () => Effect.Effect<ListIndexesResponse, RagError>;

  /**
   * Build a new index from source files
   */
  readonly build: (
    payload: BuildPayload
  ) => Effect.Effect<BuildResponse, RagError>;

  /**
   * Ask a question with RAG context
   */
  readonly ask: (payload: AskPayload) => Effect.Effect<AskResponse, RagError>;

  /**
   * Check if a specific index exists
   */
  readonly hasIndex: (name: string) => Effect.Effect<boolean, RagError>;

  /**
   * Format search results as context for LLM injection
   */
  readonly formatContext: (response: SearchResponse) => string;
}

// ============================================================================
// Service Tag
// ============================================================================

export class RagProvider extends Context.Tag('tmnl/rag/RagProvider')<
  RagProvider,
  RagProviderShape
>() {}

// ============================================================================
// Utility: Context Formatter
// ============================================================================

/**
 * Default context formatter for LLM injection
 */
export const defaultFormatContext = (response: SearchResponse): string => {
  if (response.results.length === 0) {
    return '';
  }

  const contextBlocks = response.results.map(
    (r, i) =>
      `[Context ${i + 1}] ${r.source}${r.lineStart ? `:${r.lineStart}-${r.lineEnd}` : ''}:\n\`\`\`\n${r.content.trim()}\n\`\`\``
  );

  return `\n\n--- CODEBASE CONTEXT (${response.results.length} snippets, ${response.durationMs}ms) ---\n${contextBlocks.join('\n\n')}`;
};

// ============================================================================
// RPC Handler Layer
// ============================================================================

/**
 * Create RPC handler layer from RagProvider service
 */
export const makeRpcHandlers = Effect.gen(function* () {
  const provider = yield* RagProvider;

  return {
    Search: (payload: SearchPayload) => provider.search(payload),
    ListIndexes: () => provider.listIndexes(),
    Build: (payload: BuildPayload) => provider.build(payload),
    Ask: (payload: AskPayload) => provider.ask(payload),
  };
});
