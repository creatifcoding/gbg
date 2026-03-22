/**
 * Nia Backend
 *
 * Effect-native implementation of RagProvider using Nia MCP.
 * Cloud-based, always warm — no cold start penalty.
 */

import { Effect, Layer, pipe } from 'effect';
import {
  RagProvider,
  type RagProviderShape,
  defaultFormatContext,
} from '../services/RagProvider';
import {
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
} from '../schemas';

// ============================================================================
// MCP Tool Invocation
// ============================================================================

/**
 * Invoke Nia MCP tool via Claude Code's MCP bridge
 *
 * Note: This requires the Nia MCP server to be configured in Claude Code.
 * The actual MCP calls are handled by the Claude Code runtime.
 */
const invokeMcp = <T>(
  tool: string,
  params: Record<string, unknown>
): Effect.Effect<T, RagError> =>
  Effect.tryPromise({
    try: async () => {
      // Dynamic import to avoid bundling issues
      // This is a placeholder — actual MCP invocation happens via Claude Code
      throw new Error(
        `MCP tool ${tool} must be invoked via Claude Code runtime. ` +
        `Use the mcp__nia__* tools directly in your prompts.`
      );
    },
    catch: (err) =>
      new RagError({
        message: `Nia MCP error: ${err instanceof Error ? err.message : String(err)}`,
        code: 'SEARCH_ERROR',
      }),
  });

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Nia Backend - Stub Implementation
 *
 * This backend is designed to be used with Nia MCP tools directly.
 * For programmatic use, call the MCP tools via Claude Code's runtime.
 *
 * Usage in Telegram bot:
 * Instead of using this backend, the bot should:
 * 1. Use mcp__nia__search for semantic search
 * 2. Use mcp__nia__nia_grep for regex search
 * 3. Format results manually
 *
 * This stub exists for API compatibility with the RagProvider interface.
 */
const makeNiaProvider = (): RagProviderShape => ({
  search: (payload) =>
    pipe(
      Effect.Do,
      Effect.bind('start', () => Effect.sync(() => Date.now())),
      Effect.flatMap(() =>
        Effect.fail(
          new RagError({
            message:
              'NiaBackend.search() is a stub. Use mcp__nia__search directly via Claude Code.',
            code: 'SEARCH_ERROR',
          })
        )
      )
    ),

  listIndexes: () =>
    pipe(
      Effect.succeed(
        new ListIndexesResponse({
          indexes: [
            new IndexInfo({
              name: 'nia-cloud',
              documentCount: 0, // Cloud-based, unknown
              chunkCount: 0,
            }),
          ],
        })
      )
    ),

  build: (_payload) =>
    Effect.fail(
      new RagError({
        message: 'Nia is cloud-based. Use mcp__nia__index to index repositories.',
        code: 'BUILD_ERROR',
      })
    ),

  ask: (_payload) =>
    Effect.fail(
      new RagError({
        message:
          'NiaBackend.ask() is a stub. Use mcp__nia__search directly via Claude Code.',
        code: 'SEARCH_ERROR',
      })
    ),

  hasIndex: (_name) => Effect.succeed(true), // Nia is always available

  formatContext: defaultFormatContext,
});

// ============================================================================
// Layer
// ============================================================================

/**
 * Nia Backend Layer (Stub)
 *
 * For actual Nia usage, invoke MCP tools directly:
 * - mcp__nia__search: Semantic search across indexed repos
 * - mcp__nia__nia_grep: Regex search in repos
 * - mcp__nia__nia_read: Read file content
 * - mcp__nia__index: Index a new repository
 */
export const NiaBackendLive = Layer.succeed(RagProvider, makeNiaProvider());
