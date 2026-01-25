/**
 * Nia Tool Handlers
 *
 * Implements the actual HTTP calls to Nia's MCP API.
 * Creates a Layer for the NiaToolkit.
 */

import { Effect, Layer, pipe } from 'effect';
import { NiaToolkit } from './tools';
import { NiaMcpClient } from './NiaMcpClient';

// ============================================================================
// Nia Response Types (from MCP)
// ============================================================================

interface NiaSearchResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface NiaGrepResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface NiaReadResult {
  content: Array<{ type: 'text'; text: string }>;
}

// ============================================================================
// Parse Helpers
// ============================================================================

/**
 * Parse Nia search response into structured results.
 * Nia returns markdown-formatted text; we extract key info.
 */
const parseSearchResponse = (
  raw: NiaSearchResult
): { results: Array<{ content: string; source: string; score: number }>; total: number } => {
  const text = raw.content?.[0]?.text ?? '';

  // Basic parsing — Nia returns formatted markdown
  // We'll structure it minimally for now
  const results = [
    {
      content: text.slice(0, 2000), // Truncate for context window
      source: 'nia-search',
      score: 1.0,
    },
  ];

  return { results, total: results.length };
};

/**
 * Parse Nia grep response into structured matches.
 */
const parseGrepResponse = (
  raw: NiaGrepResult
): { matches: Array<{ file: string; lineNumber: number; content: string; context?: string }>; total: number } => {
  const text = raw.content?.[0]?.text ?? '';

  // Parse grep output format (file:line:content)
  const lines = text.split('\n').filter((l) => l.trim());
  const matches = lines.slice(0, 20).map((line) => {
    const match = line.match(/^(.+?):(\d+):(.*)$/);
    if (match) {
      return {
        file: match[1],
        lineNumber: parseInt(match[2], 10),
        content: match[3],
      };
    }
    return {
      file: 'unknown',
      lineNumber: 0,
      content: line,
    };
  });

  return { matches, total: matches.length };
};

/**
 * Parse Nia read response into file content.
 */
const parseReadResponse = (
  raw: NiaReadResult
): { content: string; path: string; lineStart: number; lineEnd: number } => {
  const text = raw.content?.[0]?.text ?? '';

  return {
    content: text,
    path: 'extracted',
    lineStart: 1,
    lineEnd: text.split('\n').length,
  };
};

// ============================================================================
// Tool Handlers Layer
// ============================================================================

/**
 * Creates a Layer that provides NiaToolkit handlers.
 * Requires NiaMcpClient for HTTP calls.
 */
export const NiaToolHandlers = NiaToolkit.toLayer(
  Effect.gen(function* () {
    const client = yield* NiaMcpClient;

    return {
      NiaSearch: ({ query, repositories, includeDocumentation }) =>
        pipe(
          client.callTool<NiaSearchResult>('search', {
            query,
            repositories: repositories?.length ? repositories : undefined,
            data_sources: includeDocumentation ? undefined : [],
            include_sources: true,
          }),
          Effect.map(parseSearchResponse),
          Effect.catchAll((err) =>
            Effect.succeed({
              results: [{ content: `Search error: ${err.message}`, source: 'error', score: 0 }],
              total: 0,
            })
          )
        ),

      NiaGrep: ({ pattern, repository, path, caseInsensitive }) =>
        pipe(
          client.callTool<NiaGrepResult>('nia_grep', {
            source_type: 'repository',
            pattern,
            repository,
            path: path || '',
            case_sensitive: !caseInsensitive,
            output_mode: 'content',
            max_total_matches: 50,
          }),
          Effect.map(parseGrepResponse),
          Effect.catchAll((err) =>
            Effect.succeed({
              matches: [{ file: 'error', lineNumber: 0, content: `Grep error: ${err.message}` }],
              total: 0,
            })
          )
        ),

      NiaRead: ({ repository, path, lineStart, lineEnd }) =>
        pipe(
          client.callTool<NiaReadResult>('nia_read', {
            source_type: 'repository',
            source_identifier: `${repository}:${path}`,
            line_start: lineStart || 1,
            line_end: lineEnd || undefined,
          }),
          Effect.map(parseReadResponse),
          Effect.catchAll((err) =>
            Effect.succeed({
              content: `Read error: ${err.message}`,
              path,
              lineStart: 0,
              lineEnd: 0,
            })
          )
        ),
    };
  })
);

// ============================================================================
// Composed Layer (Handlers + Client)
// ============================================================================

import { NiaMcpClientLive } from './NiaMcpClient';

/**
 * Complete Nia layer with all dependencies.
 * Just `Effect.provide(NiaLive)` and tools are ready.
 */
export const NiaLive = Layer.provide(NiaToolHandlers, NiaMcpClientLive);
