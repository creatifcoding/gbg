/**
 * Knowledge Tools
 *
 * AI SDK tool definitions for codebase knowledge access.
 *
 * NOTE: This is a Phase 4 implementation placeholder.
 * Full AI SDK tool integration requires Zod schemas (existing pattern in cursor/api).
 * Effect.Schema → JSON Schema bridge will be implemented in Phase 4.
 *
 * @module editor-ai/tools/knowledge-tools
 */

import { Effect } from 'effect'
import { KnowledgeService, type SearchResult } from '../services/KnowledgeService'
import type {
  CodebaseContextResult,
  PatternMatchResult,
  SchemaInfo,
  ServiceInfo,
  PatternInfo,
} from '../schemas/knowledge'

// -----------------------------------------------------------------------------
// Effect Helpers (Can be used by tool implementations in Phase 4)
// -----------------------------------------------------------------------------

/**
 * Get search results from KnowledgeService.
 */
export const searchKnowledge = (
  query: string,
  limit: number
): Effect.Effect<readonly SearchResult[], never, KnowledgeService> =>
  KnowledgeService.pipe(
    Effect.flatMap((service) => service.searchSimilar(query, limit))
  )

/**
 * Get all schemas from KnowledgeService.
 */
export const getAllSchemas = (): Effect.Effect<
  readonly SchemaInfo[],
  never,
  KnowledgeService
> =>
  KnowledgeService.pipe(Effect.flatMap((service) => service.getSchemas()))

/**
 * Get all services from KnowledgeService.
 */
export const getAllServices = (): Effect.Effect<
  readonly ServiceInfo[],
  never,
  KnowledgeService
> =>
  KnowledgeService.pipe(Effect.flatMap((service) => service.getServices()))

/**
 * Get all patterns from KnowledgeService.
 */
export const getAllPatterns = (): Effect.Effect<
  readonly PatternInfo[],
  never,
  KnowledgeService
> =>
  KnowledgeService.pipe(Effect.flatMap((service) => service.getPatterns()))

/**
 * Load full context from KnowledgeService.
 */
export const loadFullContext = (): Effect.Effect<
  {
    readonly schemas: readonly SchemaInfo[]
    readonly services: readonly ServiceInfo[]
    readonly patterns: readonly PatternInfo[]
  },
  never,
  KnowledgeService
> =>
  KnowledgeService.pipe(Effect.flatMap((service) => service.loadContext))

/**
 * Reload KnowledgeService cache.
 */
export const reloadKnowledge = (): Effect.Effect<void, never, KnowledgeService> =>
  KnowledgeService.pipe(Effect.flatMap((service) => service.reload))

// -----------------------------------------------------------------------------
// Tool Factory Placeholder (Phase 4)
// -----------------------------------------------------------------------------

/**
 * Placeholder for knowledge tools factory.
 *
 * Phase 4 implementation will:
 * 1. Use Zod schemas (matching cursor/api pattern)
 * 2. Integrate with AI SDK tool() function
 * 3. Bridge Effect.Schema types to Zod for validation
 *
 * @param runEffect - Function to run Effects with KnowledgeService
 */
export const createKnowledgeTools = (
  _runEffect: <A>(effect: Effect.Effect<A, unknown, KnowledgeService>) => Promise<A>
) => {
  // Phase 4: Will return AI SDK tool definitions
  // For now, return empty object - tools not yet wired
  return {} as KnowledgeTools
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Knowledge tools interface (to be implemented in Phase 4).
 */
export interface KnowledgeTools {
  get_codebase_context?: {
    execute: (params: {
      query?: string
      category?: 'schemas' | 'services' | 'patterns'
      limit?: number
    }) => Promise<CodebaseContextResult>
  }
  get_pattern_for_task?: {
    execute: (params: {
      task: string
      categories?: string[]
    }) => Promise<PatternMatchResult>
  }
  refresh_codebase_knowledge?: {
    execute: () => Promise<{ success: boolean; output: string }>
  }
}
