/**
 * File Tools for Cursor Server
 *
 * AI SDK tool definitions for codebase file manipulation.
 * Provides read, write, edit, and search capabilities for
 * AI-driven code modifications.
 *
 * Uses Effect Schema for type-safe input validation.
 * Pattern follows evolution-agent-tools.ts archetype.
 *
 * @module cursor/tools/file-tools
 */

import { Schema, JSONSchema } from 'effect';
import { jsonSchema, tool } from 'ai';

// =============================================================================
// Tool Context (injected at runtime)
// =============================================================================

/**
 * Context interface for file tools.
 * Injected at runtime to provide file system access.
 */
export interface FileToolsContext {
  /** Read file content */
  readFile: (
    path: string
  ) => Promise<{ success: boolean; content?: string; error?: string }>;
  /** Write file content */
  writeFile: (
    path: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Edit file by replacing content */
  editFile: (
    path: string,
    oldContent: string,
    newContent: string,
    replaceAll?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  /** List files matching pattern */
  listFiles: (pattern: string, path?: string) => Promise<string[]>;
  /** Search for content in files */
  searchFiles: (
    query: string,
    options?: {
      path?: string;
      caseSensitive?: boolean;
      maxResults?: number;
    }
  ) => Promise<Array<{ path: string; line: number; content: string }>>;
}

let _context: FileToolsContext | null = null;

/**
 * Set the file tools context.
 * Must be called before using any file tools.
 */
export function setFileToolsContext(ctx: FileToolsContext): void {
  _context = ctx;
}

/**
 * Clear the file tools context.
 */
export function clearFileToolsContext(): void {
  _context = null;
}

function getContext(): FileToolsContext {
  if (!_context) {
    throw new Error(
      'File tools context not set. Call setFileToolsContext first.'
    );
  }
  return _context;
}

// =============================================================================
// Tool Input Schemas
// =============================================================================

/**
 * Schema for editing a file
 */
export const EditFileInputSchema = Schema.Struct({
  path: Schema.String.pipe(
    Schema.annotations({ description: 'Path to the file to edit' })
  ),
  oldString: Schema.String.pipe(
    Schema.annotations({ description: 'The string to find and replace' })
  ),
  newString: Schema.String.pipe(
    Schema.annotations({ description: 'The replacement string' })
  ),
  replaceAll: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Replace all occurrences (default: false, first only)',
      })
    )
  ),
});
export type EditFileInput = Schema.Schema.Type<typeof EditFileInputSchema>;

/**
 * Schema for reading a file
 */
export const ReadFileInputSchema = Schema.Struct({
  path: Schema.String.pipe(
    Schema.annotations({ description: 'Path to the file to read' })
  ),
  startLine: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.annotations({ description: 'Start line (1-indexed, inclusive)' })
    )
  ),
  endLine: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.annotations({ description: 'End line (1-indexed, inclusive)' })
    )
  ),
});
export type ReadFileInput = Schema.Schema.Type<typeof ReadFileInputSchema>;

/**
 * Schema for listing files
 */
export const ListFilesInputSchema = Schema.Struct({
  pattern: Schema.String.pipe(
    Schema.annotations({
      description: 'Glob pattern to match files (e.g., **/*.tsx)',
    })
  ),
  path: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Base path to search from' })
    )
  ),
});
export type ListFilesInput = Schema.Schema.Type<typeof ListFilesInputSchema>;

/**
 * Schema for searching files
 */
export const SearchFilesInputSchema = Schema.Struct({
  query: Schema.String.pipe(
    Schema.annotations({ description: 'Search query (text or regex)' })
  ),
  path: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Path to search within' })
    )
  ),
  caseSensitive: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Case sensitive search (default: true)' })
    )
  ),
  maxResults: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Maximum results to return' })
    )
  ),
});
export type SearchFilesInput = Schema.Schema.Type<typeof SearchFilesInputSchema>;

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Edit a file by replacing content
 */
export const editFileTool = tool({
  description:
    'Edit a file by finding and replacing a string. Use exact string matching for reliable edits.',
  inputSchema: jsonSchema<EditFileInput>(
    JSONSchema.make(EditFileInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: EditFileInput) => {
    const ctx = getContext();
    const result = await ctx.editFile(
      input.path,
      input.oldString,
      input.newString,
      input.replaceAll
    );

    return {
      ...result,
      path: input.path,
      operation: input.replaceAll ? 'replace_all' : 'replace_first',
    };
  },
});

/**
 * Read file content
 */
export const readFileTool = tool({
  description:
    'Read the content of a file. Can optionally read a specific line range.',
  inputSchema: jsonSchema<ReadFileInput>(
    JSONSchema.make(ReadFileInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: ReadFileInput) => {
    const ctx = getContext();
    const result = await ctx.readFile(input.path);

    if (!result.success || !result.content) {
      return result;
    }

    // Apply line range if specified
    if (input.startLine !== undefined || input.endLine !== undefined) {
      const lines = result.content.split('\n');
      const start = (input.startLine ?? 1) - 1; // Convert to 0-indexed
      const end = input.endLine ?? lines.length;
      const slicedContent = lines.slice(start, end).join('\n');

      return {
        success: true,
        content: slicedContent,
        path: input.path,
        lineRange: { start: start + 1, end },
        totalLines: lines.length,
      };
    }

    return {
      ...result,
      path: input.path,
      totalLines: result.content.split('\n').length,
    };
  },
});

/**
 * List files matching a pattern
 */
export const listFilesTool = tool({
  description:
    'List files matching a glob pattern. Returns file paths relative to the search base.',
  inputSchema: jsonSchema<ListFilesInput>(
    JSONSchema.make(ListFilesInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: ListFilesInput) => {
    const ctx = getContext();
    const files = await ctx.listFiles(input.pattern, input.path);

    return {
      pattern: input.pattern,
      path: input.path,
      files,
      count: files.length,
    };
  },
});

/**
 * Search for content in files
 */
export const searchFilesTool = tool({
  description:
    'Search for content across files. Returns matching lines with file paths and line numbers.',
  inputSchema: jsonSchema<SearchFilesInput>(
    JSONSchema.make(SearchFilesInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: SearchFilesInput) => {
    const ctx = getContext();
    const matches = await ctx.searchFiles(input.query, {
      path: input.path,
      caseSensitive: input.caseSensitive,
      maxResults: input.maxResults,
    });

    return {
      query: input.query,
      matches,
      count: matches.length,
      truncated: input.maxResults ? matches.length >= input.maxResults : false,
    };
  },
});

// =============================================================================
// Export Tool Collection
// =============================================================================

/**
 * All file tools for AI SDK integration
 */
export const fileTools = {
  edit_file: editFileTool,
  read_file: readFileTool,
  list_files: listFilesTool,
  search_files: searchFilesTool,
} as const;

export type FileToolName = keyof typeof fileTools;
