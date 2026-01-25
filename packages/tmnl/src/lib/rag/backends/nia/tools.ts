/**
 * Nia Tools for @effect/ai
 *
 * Effect Schema-based tool definitions for Nia MCP operations.
 * These tools wrap Nia's cloud RAG API and can be consumed by LanguageModel.
 */

import { Tool, Toolkit } from '@effect/ai';
import { Schema } from 'effect';

// ============================================================================
// Tool: NiaSearch
// ============================================================================

/**
 * Semantic search across indexed repositories and documentation.
 * Uses Nia's cloud-based RAG with no cold start.
 */
export const NiaSearch = Tool.make('NiaSearch', {
  description:
    'Semantic search across indexed repositories, documentation, and research papers. ' +
    'Use this to find code patterns, API usage examples, or conceptual information.',
  success: Schema.Struct({
    results: Schema.Array(
      Schema.Struct({
        content: Schema.String,
        source: Schema.String,
        score: Schema.Number,
      })
    ),
    total: Schema.Number,
  }),
  failure: Schema.Never,
  parameters: {
    query: Schema.String.annotations({
      description: 'Natural language search query',
    }),
    repositories: Schema.optionalWith(Schema.Array(Schema.String), {
      default: () => [],
    }).annotations({
      description:
        'Optional list of repositories to search (e.g., ["Effect-TS/effect"]). Empty = search all indexed sources.',
    }),
    includeDocumentation: Schema.optionalWith(Schema.Boolean, {
      default: () => true,
    }).annotations({
      description: 'Include indexed documentation in search',
    }),
  },
});

// ============================================================================
// Tool: NiaGrep
// ============================================================================

/**
 * Regex search in repository code.
 * Precise pattern matching across files.
 */
export const NiaGrep = Tool.make('NiaGrep', {
  description:
    'Regex pattern search in repository source code. ' +
    'Use this for precise matches like function names, imports, or specific syntax.',
  success: Schema.Struct({
    matches: Schema.Array(
      Schema.Struct({
        file: Schema.String,
        lineNumber: Schema.Number,
        content: Schema.String,
        context: Schema.optional(Schema.String),
      })
    ),
    total: Schema.Number,
  }),
  failure: Schema.Never,
  parameters: {
    pattern: Schema.String.annotations({
      description: 'Regex pattern to search for (e.g., "Schema\\.Class")',
    }),
    repository: Schema.String.annotations({
      description: 'Repository to search in (e.g., "Effect-TS/effect")',
    }),
    path: Schema.optionalWith(Schema.String, {
      default: () => '',
    }).annotations({
      description: 'Optional path prefix to filter files',
    }),
    caseInsensitive: Schema.optionalWith(Schema.Boolean, {
      default: () => false,
    }),
  },
});

// ============================================================================
// Tool: NiaRead
// ============================================================================

/**
 * Read file content from indexed repository.
 * Retrieves full or partial file content.
 */
export const NiaRead = Tool.make('NiaRead', {
  description:
    'Read source code from an indexed repository. ' +
    'Use this after NiaSearch or NiaGrep to view full file content.',
  success: Schema.Struct({
    content: Schema.String,
    path: Schema.String,
    lineStart: Schema.Number,
    lineEnd: Schema.Number,
  }),
  failure: Schema.Never,
  parameters: {
    repository: Schema.String.annotations({
      description: 'Repository identifier (e.g., "Effect-TS/effect")',
    }),
    path: Schema.String.annotations({
      description: 'Path to file within repository',
    }),
    lineStart: Schema.optionalWith(Schema.Number, {
      default: () => 1,
    }).annotations({
      description: 'Starting line number (1-indexed)',
    }),
    lineEnd: Schema.optionalWith(Schema.Number, {
      default: () => 0,
    }).annotations({
      description: 'Ending line number (0 = read to end)',
    }),
  },
});

// ============================================================================
// Toolkit: NiaToolkit
// ============================================================================

/**
 * Combined toolkit with all Nia tools.
 * Use with LanguageModel.generateText({ toolkit: NiaToolkit })
 */
export const NiaToolkit = Toolkit.make(NiaSearch, NiaGrep, NiaRead);

export type NiaToolkit = typeof NiaToolkit;
