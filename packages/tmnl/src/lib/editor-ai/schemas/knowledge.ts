/**
 * Knowledge Pipeline Schemas
 *
 * Effect.Schema definitions for AI codebase knowledge extraction.
 * Used by decorators, extraction scripts, and KnowledgeService.
 */

import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// Schema Information
// -----------------------------------------------------------------------------

/**
 * Information about an extracted Schema definition.
 * Populated by @AIKnowledge decorator during build-time extraction.
 */
export const SchemaInfo = Schema.Struct({
  /** Schema variable name (e.g., "EditorId", "Selection") */
  name: Schema.String,

  /** Source file path relative to project root */
  file: Schema.String,

  /** TypeScript type signature */
  typeSignature: Schema.String,

  /** Category for grouping (e.g., "editor", "cursor", "block") */
  category: Schema.String,

  /** Human-readable description */
  description: Schema.String,

  /** Optional JSDoc comment from source */
  jsdoc: Schema.optional(Schema.String),

  /** Example usages */
  examples: Schema.optional(Schema.Array(Schema.String)),
})
export type SchemaInfo = typeof SchemaInfo.Type

// -----------------------------------------------------------------------------
// Service Information
// -----------------------------------------------------------------------------

/**
 * Method signature information for services.
 */
export const ServiceMethod = Schema.Struct({
  /** Method name */
  name: Schema.String,

  /** Full TypeScript signature */
  signature: Schema.String,

  /** Optional description */
  description: Schema.optional(Schema.String),
})
export type ServiceMethod = typeof ServiceMethod.Type

/**
 * Information about an extracted Effect.Service definition.
 * Populated by @AIService decorator during build-time extraction.
 */
export const ServiceInfo = Schema.Struct({
  /** Service class name (e.g., "EditorOperations", "EditorRegistry") */
  name: Schema.String,

  /** Source file path relative to project root */
  file: Schema.String,

  /** Context.Tag identifier (e.g., "tmnl/EditorOperations") */
  tag: Schema.String,

  /** Service description */
  description: Schema.String,

  /** Capabilities this service provides */
  capabilities: Schema.Array(Schema.String),

  /** Public method signatures */
  methods: Schema.Array(ServiceMethod),

  /** Optional JSDoc comment from source */
  jsdoc: Schema.optional(Schema.String),
})
export type ServiceInfo = typeof ServiceInfo.Type

// -----------------------------------------------------------------------------
// Pattern Information
// -----------------------------------------------------------------------------

/**
 * Pattern category discriminator.
 */
export const PatternCategory = Schema.Literal(
  'effect',
  'react',
  'atom',
  'service',
  'schema',
  'animation',
  'layer'
)
export type PatternCategory = typeof PatternCategory.Type

/**
 * Information about a code pattern.
 * Can come from @AIPattern decorators or EDIN markdown files.
 */
export const PatternInfo = Schema.Struct({
  /** Pattern name (e.g., "Atom-as-State", "XState Hybrid") */
  name: Schema.String,

  /** Pattern category */
  category: PatternCategory,

  /** When to use this pattern */
  description: Schema.String,

  /** Example code snippet */
  example: Schema.String,

  /** Source file or EDIN document */
  source: Schema.String,

  /** Anti-patterns to avoid */
  antiPatterns: Schema.optional(Schema.Array(Schema.String)),
})
export type PatternInfo = typeof PatternInfo.Type

// -----------------------------------------------------------------------------
// Codebase Knowledge (Aggregate)
// -----------------------------------------------------------------------------

/**
 * Complete codebase knowledge for AI context injection.
 * Loaded by KnowledgeService from .ai-context/ artifacts.
 */
export const CodebaseKnowledge = Schema.Struct({
  /** All decorated Schema definitions */
  schemas: Schema.Array(SchemaInfo),

  /** All decorated Service definitions */
  services: Schema.Array(ServiceInfo),

  /** All extracted patterns (decorators + EDIN) */
  patterns: Schema.Array(PatternInfo),

  /** Extraction timestamp */
  extractedAt: Schema.DateFromString,

  /** Version for cache invalidation */
  version: Schema.String,
})
export type CodebaseKnowledge = typeof CodebaseKnowledge.Type

// -----------------------------------------------------------------------------
// Tool Parameter Schemas
// -----------------------------------------------------------------------------

/**
 * Parameters for get_codebase_context tool.
 */
export const GetCodebaseContextParams = Schema.Struct({
  /** Filter by category */
  category: Schema.optional(
    Schema.Literal('schemas', 'services', 'patterns', 'all').pipe(
      Schema.annotations({ description: 'Filter knowledge by category' })
    )
  ),

  /** Search query for semantic matching */
  query: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Search query for pattern matching' })
    )
  ),

  /** Maximum results to return */
  limit: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Maximum results to return' })
    )
  ),
})
export type GetCodebaseContextParams = typeof GetCodebaseContextParams.Type

/**
 * Parameters for get_pattern_for_task tool.
 */
export const GetPatternForTaskParams = Schema.Struct({
  /** Description of implementation task */
  task: Schema.String.pipe(
    Schema.annotations({
      description: 'Description of what you want to implement',
    })
  ),

  /** Preferred pattern categories */
  categories: Schema.optional(
    Schema.Array(PatternCategory).pipe(
      Schema.annotations({ description: 'Limit to specific pattern categories' })
    )
  ),
})
export type GetPatternForTaskParams = typeof GetPatternForTaskParams.Type

// -----------------------------------------------------------------------------
// Tool Result Schemas
// -----------------------------------------------------------------------------

/**
 * Result from codebase context query.
 */
export const CodebaseContextResult = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('summary'),
    schemaCount: Schema.Number,
    serviceCount: Schema.Number,
    patternCount: Schema.Number,
  }),
  Schema.Struct({
    type: Schema.Literal('schemas'),
    schemas: Schema.Array(SchemaInfo),
  }),
  Schema.Struct({
    type: Schema.Literal('services'),
    services: Schema.Array(ServiceInfo),
  }),
  Schema.Struct({
    type: Schema.Literal('patterns'),
    patterns: Schema.Array(PatternInfo),
  }),
  Schema.Struct({
    type: Schema.Literal('search'),
    results: Schema.Array(
      Schema.Struct({
        kind: Schema.Literal('schema', 'service', 'pattern'),
        name: Schema.String,
        description: Schema.String,
        relevance: Schema.Number,
      })
    ),
  })
)
export type CodebaseContextResult = typeof CodebaseContextResult.Type

/**
 * Result from pattern matching query.
 */
export const PatternMatchResult = Schema.Struct({
  /** Recommended patterns for the task */
  recommendedPatterns: Schema.Array(PatternInfo),

  /** Relevant services to use */
  relevantServices: Schema.Array(ServiceInfo),

  /** Relevant schemas to import */
  relevantSchemas: Schema.Array(SchemaInfo),
})
export type PatternMatchResult = typeof PatternMatchResult.Type
