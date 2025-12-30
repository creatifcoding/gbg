/**
 * Knowledge Tools
 *
 * AI SDK tool definitions for codebase knowledge access.
 * Uses Effect.Schema directly - AI SDK 6+ native support.
 *
 * @module editor-ai/tools/knowledge-tools
 */

import { tool } from 'ai'
import { Effect, Schema } from 'effect'
import { KnowledgeService, type SearchResult } from '../services/KnowledgeService'
import {
  GetCodebaseContextParams,
  GetPatternForTaskParams,
  type CodebaseContextResult,
  type PatternMatchResult,
  type SchemaInfo,
  type ServiceInfo,
  type PatternInfo,
} from '../schemas/knowledge'

// -----------------------------------------------------------------------------
// Tool Factory
// -----------------------------------------------------------------------------

/**
 * Creates knowledge tools for AI SDK integration.
 *
 * @param runEffect - Function to run Effects with KnowledgeService layer
 * @returns Tool definitions compatible with AI SDK streamText/generateText
 *
 * @example
 * ```ts
 * const runEffect = <A>(effect: Effect.Effect<A, unknown, KnowledgeService>) =>
 *   Effect.runPromise(effect.pipe(Effect.provide(KnowledgeService.Default)))
 *
 * const tools = createKnowledgeTools(runEffect)
 * ```
 */
export function createKnowledgeTools(
  runEffect: <A>(effect: Effect.Effect<A, unknown, KnowledgeService>) => Promise<A>
) {
  return {
    get_codebase_context: tool({
      description:
        'Get relevant codebase patterns, schemas, and conventions. Use category to filter, or query for semantic search.',
      parameters: GetCodebaseContextParams,
      execute: async ({ category, query, limit }) => {
        // Semantic search if query provided
        if (query) {
          const results = await runEffect(
            Effect.gen(function* () {
              const service = yield* KnowledgeService
              return yield* service.searchSimilar(query, limit ?? 10)
            })
          )

          return {
            type: 'search' as const,
            results: results.map((r) => ({
              kind: r.kind,
              name: r.name,
              description: r.description,
              relevance: r.relevance,
            })),
          }
        }

        // Category-specific results
        if (category === 'schemas') {
          const schemas = await runEffect(
            Effect.gen(function* () {
              const service = yield* KnowledgeService
              return yield* service.getSchemas()
            })
          )
          return { type: 'schemas' as const, schemas: schemas.slice(0, limit ?? 20) }
        }

        if (category === 'services') {
          const services = await runEffect(
            Effect.gen(function* () {
              const service = yield* KnowledgeService
              return yield* service.getServices()
            })
          )
          return { type: 'services' as const, services: services.slice(0, limit ?? 20) }
        }

        if (category === 'patterns') {
          const patterns = await runEffect(
            Effect.gen(function* () {
              const service = yield* KnowledgeService
              return yield* service.getPatterns()
            })
          )
          return { type: 'patterns' as const, patterns: patterns.slice(0, limit ?? 20) }
        }

        // Default: return summary
        const ctx = await runEffect(
          Effect.gen(function* () {
            const service = yield* KnowledgeService
            return yield* service.loadContext
          })
        )

        return {
          type: 'summary' as const,
          schemaCount: ctx.schemas.length,
          serviceCount: ctx.services.length,
          patternCount: ctx.patterns.length,
        }
      },
    }),

    get_pattern_for_task: tool({
      description:
        'Get the recommended pattern for a specific implementation task. Describe what you want to build.',
      parameters: GetPatternForTaskParams,
      execute: async ({ task, categories }) => {
        const results = await runEffect(
          Effect.gen(function* () {
            const service = yield* KnowledgeService
            return yield* service.searchSimilar(task, 10)
          })
        )

        // Filter by categories if specified
        const filtered = categories
          ? results.filter((r) =>
              categories.includes(r.kind as typeof categories[number])
            )
          : results

        // Separate by kind
        const patterns = filtered.filter((r) => r.kind === 'pattern')
        const services = filtered.filter((r) => r.kind === 'service')
        const schemas = filtered.filter((r) => r.kind === 'schema')

        return {
          recommendedPatterns: patterns.slice(0, 3).map((r) => ({
            name: r.name,
            category: 'effect' as const, // Default category
            description: r.description,
            example: '', // Would need full pattern data
            source: '',
          })),
          relevantServices: services.slice(0, 3).map((r) => ({
            name: r.name,
            file: '',
            tag: '',
            description: r.description,
            capabilities: [],
            methods: [],
          })),
          relevantSchemas: schemas.slice(0, 3).map((r) => ({
            name: r.name,
            file: '',
            typeSignature: '',
            category: 'editor',
            description: r.description,
          })),
        }
      },
    }),

    refresh_codebase_knowledge: tool({
      description:
        'Re-extract codebase patterns from decorated code. Use when patterns may have changed.',
      parameters: Schema.Struct({}),
      execute: async () => {
        await runEffect(
          Effect.gen(function* () {
            const service = yield* KnowledgeService
            yield* service.reload
          })
        )

        return { success: true, message: 'Knowledge cache reloaded' }
      },
    }),
  }
}

// -----------------------------------------------------------------------------
// Effect Helpers (for direct usage)
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
// Types
// -----------------------------------------------------------------------------

export type KnowledgeTools = ReturnType<typeof createKnowledgeTools>
export type KnowledgeToolName = keyof KnowledgeTools
