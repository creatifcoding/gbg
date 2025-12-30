/**
 * AI Knowledge Decorators
 *
 * Decorators that mark code for build-time extraction into .ai-context/ artifacts.
 * The extraction script (scripts/extract-ai-context.ts) uses ts-morph to find
 * these decorators and extract metadata for KnowledgeService.
 *
 * NOTE: These decorators are primarily markers for the extraction script.
 * They use Schema.annotations() to attach metadata that ts-morph can read.
 */

import { Schema } from 'effect'
import type { PatternCategory } from '../schemas/knowledge'

// -----------------------------------------------------------------------------
// @AIKnowledge - Schema Annotation
// -----------------------------------------------------------------------------

export interface AIKnowledgeMeta {
  /** Category for grouping (e.g., "editor", "cursor", "block") */
  category: string

  /** Human-readable description */
  description: string

  /** Example usages */
  examples?: string[]
}

/**
 * Mark a Schema for AI knowledge extraction.
 *
 * Usage:
 * ```typescript
 * export const EditorId = AIKnowledge({
 *   category: 'editor',
 *   description: 'Branded ID for editor instances',
 *   examples: ['editor-panel-123', 'main-editor'],
 * })(Schema.String.pipe(Schema.brand('EditorId')))
 * ```
 *
 * The extraction script reads these annotations and generates schemas.json.
 */
export const AIKnowledge =
  (meta: AIKnowledgeMeta) =>
  <A, I, R>(schema: Schema.Schema<A, I, R>): Schema.Schema<A, I, R> => {
    // Use description only - the standard annotation property
    // Meta is stored for build-time extraction, not runtime annotations
    return schema.pipe(
      Schema.annotations({
        description: `[AIKnowledge:${meta.category}] ${meta.description}`,
      })
    )
  }

// -----------------------------------------------------------------------------
// @AIService - Service Class Decorator
// -----------------------------------------------------------------------------

export interface AIServiceMeta {
  /** Service description for AI context */
  description: string

  /** Capabilities this service provides (for tool generation) */
  capabilities: string[]
}

/**
 * Mark an Effect.Service class for AI knowledge extraction.
 *
 * Usage:
 * ```typescript
 * @AIService({
 *   description: 'Base interface for AI-controllable editors',
 *   capabilities: ['insert', 'replace', 'select', 'read'],
 * })
 * export class EditorOperations extends Context.Tag('tmnl/EditorOperations')<
 *   EditorOperations,
 *   EditorOperationsShape
 * >() {}
 * ```
 *
 * The extraction script reads the decorator and generates services.json.
 */
export function AIService(meta: AIServiceMeta) {
  return function <T extends new (...args: readonly unknown[]) => unknown>(
    target: T
  ): T {
    // Store metadata on the class for runtime access (optional)
    ;(target as unknown as { __aiService: AIServiceMeta }).__aiService = meta
    return target
  }
}

/**
 * Helper to retrieve AIService metadata from a decorated class.
 */
export function getAIServiceMeta(
  target: unknown
): AIServiceMeta | undefined {
  return (target as { __aiService?: AIServiceMeta })?.__aiService
}

// -----------------------------------------------------------------------------
// @AIPattern - Code Pattern Tagging
// -----------------------------------------------------------------------------

export interface AIPatternMeta {
  /** Pattern name (e.g., "Atom-as-State", "XState Hybrid") */
  name: string

  /** Pattern category */
  category: PatternCategory

  /** When to use this pattern */
  description: string

  /** Example code snippet */
  example: string
}

/**
 * Mark a function or method as an AI-extractable pattern.
 *
 * Usage:
 * ```typescript
 * class MyService {
 *   @AIPattern({
 *     name: 'Stream Progressive Results',
 *     category: 'effect',
 *     description: 'Stream results progressively to avoid blocking',
 *     example: 'yield* Stream.fromIterable(results).pipe(Stream.tap(...))',
 *   })
 *   search(query: string) {
 *     // ...
 *   }
 * }
 * ```
 *
 * The extraction script reads these decorators and generates patterns.json.
 */
export function AIPattern(meta: AIPatternMeta) {
  return function (
    _target: unknown,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // Store metadata on the function for runtime access (optional)
    if (descriptor.value) {
      ;(descriptor.value as { __aiPattern: AIPatternMeta }).__aiPattern = meta
    }
    return descriptor
  }
}

/**
 * Helper to retrieve AIPattern metadata from a decorated method.
 */
export function getAIPatternMeta(
  fn: unknown
): AIPatternMeta | undefined {
  return (fn as { __aiPattern?: AIPatternMeta })?.__aiPattern
}

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export type { PatternCategory } from '../schemas/knowledge'
