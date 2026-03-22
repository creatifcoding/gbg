/**
 * RAG Module
 *
 * Effect-native RAG (Retrieval-Augmented Generation) system.
 *
 * Architecture:
 * - Schemas: Effect Schema types for payloads/responses
 * - RPC: Typed procedures via @effect/rpc
 * - Services: RagProvider abstraction
 * - Backends: LEANN, Nia, etc.
 *
 * Usage:
 * ```typescript
 * import { RagProvider, LeannBackendLive } from '@/lib/rag';
 *
 * const program = Effect.gen(function* () {
 *   const rag = yield* RagProvider;
 *   const results = yield* rag.search(new SearchPayload({ query: 'effect-atom' }));
 *   const context = rag.formatContext(results);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(LeannBackendLive)));
 * ```
 */

// Schemas
export {
  SearchPayload,
  SearchResponse,
  SearchResult,
  ListIndexesResponse,
  IndexInfo,
  BuildPayload,
  BuildResponse,
  AskPayload,
  AskResponse,
  RagError,
} from './schemas';

// RPC Protocol
export { RagRpcs, Search, ListIndexes, Build, Ask } from './rpc';

// Services
export {
  RagProvider,
  type RagProviderShape,
  defaultFormatContext,
  makeRpcHandlers,
} from './services/RagProvider';

// Backends
export { LeannBackendLive } from './backends/LeannBackend';

// Nia (Agentic RAG with Effect AI)
export {
  NiaMcpClient,
  NiaMcpClientLive,
  NiaSearch,
  NiaGrep,
  NiaRead,
  NiaToolkit,
  NiaToolHandlers,
  NiaLive,
} from './backends/nia';

// ============================================================================
// Convenience: RPC Server Layer
// ============================================================================

import { Effect, Layer, pipe } from 'effect';
import { RagRpcs } from './rpc';
import { RagProvider, makeRpcHandlers } from './services/RagProvider';
import { LeannBackendLive } from './backends/LeannBackend';

/**
 * RAG RPC Handler Layer
 *
 * Provides typed handlers for RagRpcs protocol.
 * Requires RagProvider to be provided.
 */
export const RagRpcHandlersLive = RagRpcs.toLayer(makeRpcHandlers);

/**
 * Complete RAG Layer with LEANN backend
 *
 * Provides:
 * - RagProvider (LEANN implementation)
 * - RPC handlers for Search, ListIndexes, Build, Ask
 */
export const RagLive = pipe(
  RagRpcHandlersLive,
  Layer.provide(LeannBackendLive)
);

// ============================================================================
// Convenience: Direct Service Access
// ============================================================================

/**
 * Search the codebase (convenience function)
 */
export const search = (query: string, topK = 3) =>
  Effect.gen(function* () {
    const rag = yield* RagProvider;
    const { SearchPayload } = yield* Effect.promise(() => import('./schemas'));
    return yield* rag.search(new SearchPayload({ query, topK }));
  });

/**
 * Get formatted context for LLM injection
 */
export const getContext = (query: string, topK = 3) =>
  Effect.gen(function* () {
    const rag = yield* RagProvider;
    const { SearchPayload } = yield* Effect.promise(() => import('./schemas'));
    const results = yield* rag.search(new SearchPayload({ query, topK }));
    return rag.formatContext(results);
  });

/**
 * Check if index exists
 */
export const hasIndex = (name = 'tmnl-codebase') =>
  Effect.gen(function* () {
    const rag = yield* RagProvider;
    return yield* rag.hasIndex(name);
  });
