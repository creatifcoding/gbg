/**
 * LEANN Backend
 *
 * Effect-native implementation of RagProvider using LEANN CLI.
 * Handles nix library paths and subprocess management.
 */

import { Effect, Layer, pipe } from 'effect';
import { spawn } from 'child_process';
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
// Configuration
// ============================================================================

/**
 * Nix library paths required for LEANN
 */
const NIX_LD_LIBRARY_PATH = [
  '/nix/store/xm08aqdd7pxcdhm0ak6aqb1v7hw5q6ri-gcc-14.3.0-lib/lib',
  '/nix/store/8icpg7vrz95c6ap3mznmlmg7h0l2av1w-zlib-1.3.1/lib',
].join(':');

// ============================================================================
// Subprocess Utilities
// ============================================================================

/**
 * Run LEANN CLI command with proper environment
 */
const runLeann = (
  args: readonly string[],
  timeout = 60000
): Effect.Effect<string, RagError> =>
  Effect.async<string, RagError>((resume) => {
    const env = {
      ...process.env,
      LD_LIBRARY_PATH: NIX_LD_LIBRARY_PATH + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''),
    };

    const proc = spawn('leann', [...args], { env });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill();
      resume(Effect.fail(new RagError({ message: `LEANN timeout after ${timeout}ms`, code: 'SEARCH_ERROR' })));
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resume(Effect.succeed(stdout));
      } else {
        resume(Effect.fail(new RagError({
          message: `LEANN exited with code ${code}: ${stderr}`,
          code: 'SEARCH_ERROR',
        })));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resume(Effect.fail(new RagError({
        message: `LEANN spawn error: ${err.message}`,
        code: 'SEARCH_ERROR',
      })));
    });

    // Cleanup on fiber interrupt
    return Effect.sync(() => {
      clearTimeout(timer);
      proc.kill();
    });
  });

// ============================================================================
// Output Parsers
// ============================================================================

/**
 * Parse LEANN search output into structured results
 */
const parseSearchOutput = (output: string): SearchResult[] => {
  const results: SearchResult[] = [];
  const blocks = output.split(/\n(?=Source:)/);

  for (const block of blocks) {
    const sourceMatch = block.match(/Source:\s*(.+)/);
    const scoreMatch = block.match(/Score:\s*([\d.]+)/);
    const contentMatch = block.match(/Content:\s*```[\s\S]*?```|Content:\s*([\s\S]+?)(?=\n\nSource:|$)/);

    if (sourceMatch) {
      const content = contentMatch
        ? contentMatch[0]
            .replace(/^Content:\s*/, '')
            .replace(/^```[\w]*\n?/, '')
            .replace(/\n?```$/, '')
            .trim()
        : '';

      // Extract line numbers from source path if present (e.g., file.ts:10-20)
      const lineMatch = sourceMatch[1].match(/:(\d+)(?:-(\d+))?$/);
      const source = lineMatch
        ? sourceMatch[1].replace(/:(\d+)(?:-(\d+))?$/, '')
        : sourceMatch[1].trim();

      results.push(new SearchResult({
        source,
        score: scoreMatch ? parseFloat(scoreMatch[1]) : 0,
        content,
        lineStart: lineMatch ? parseInt(lineMatch[1], 10) : 0,
        lineEnd: lineMatch?.[2] ? parseInt(lineMatch[2], 10) : (lineMatch ? parseInt(lineMatch[1], 10) : 0),
      }));
    }
  }

  return results;
};

/**
 * Parse LEANN list output into index info
 */
const parseListOutput = (output: string): IndexInfo[] => {
  const indexes: IndexInfo[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    // Expected format: "index-name: 1396 documents, 6692 chunks"
    const match = line.match(/^([^:]+):\s*(\d+)\s*documents?,\s*(\d+)\s*chunks?/i);
    if (match) {
      indexes.push(new IndexInfo({
        name: match[1].trim(),
        documentCount: parseInt(match[2], 10),
        chunkCount: parseInt(match[3], 10),
      }));
    } else if (line.trim() && !line.startsWith('Available') && !line.startsWith('No indexes')) {
      // Fallback: just the index name
      indexes.push(new IndexInfo({
        name: line.trim(),
        documentCount: 0,
        chunkCount: 0,
      }));
    }
  }

  return indexes;
};

// ============================================================================
// Service Implementation
// ============================================================================

const makeLeannProvider = (): RagProviderShape => ({
  search: (payload) =>
    pipe(
      Effect.Do,
      Effect.bind('start', () => Effect.sync(() => Date.now())),
      Effect.bind('output', () =>
        runLeann(['search', payload.index, payload.query, '--top-k', String(payload.topK), '--non-interactive'])
      ),
      Effect.map(({ start, output }) => {
        const results = parseSearchOutput(output);
        return new SearchResponse({
          query: payload.query,
          results,
          durationMs: Date.now() - start,
        });
      })
    ),

  listIndexes: () =>
    pipe(
      runLeann(['list']),
      Effect.map((output) => {
        const indexes = parseListOutput(output);
        return new ListIndexesResponse({ indexes });
      })
    ),

  build: (payload) =>
    pipe(
      Effect.Do,
      Effect.bind('start', () => Effect.sync(() => Date.now())),
      Effect.bind('output', () => {
        const args = [
          'build',
          payload.name,
          '--docs',
          ...payload.paths,
        ];
        if (payload.fileTypes.length > 0) {
          args.push('--file-types', payload.fileTypes.join(','));
        }
        return runLeann(args, 300000); // 5 min timeout for builds
      }),
      Effect.map(({ start, output }) => {
        // Parse build output for stats
        const docMatch = output.match(/Loaded\s+(\d+)\s+documents/);
        const chunkMatch = output.match(/(\d+)\s+chunks/);

        return new BuildResponse({
          name: payload.name,
          documentCount: docMatch ? parseInt(docMatch[1], 10) : 0,
          chunkCount: chunkMatch ? parseInt(chunkMatch[1], 10) : 0,
          durationMs: Date.now() - start,
        });
      })
    ),

  ask: (payload) =>
    pipe(
      Effect.Do,
      Effect.bind('start', () => Effect.sync(() => Date.now())),
      Effect.bind('output', () =>
        runLeann(['ask', payload.index, payload.question, '--top-k', String(payload.topK)])
      ),
      Effect.map(({ start, output }) => {
        // LEANN ask returns answer with sources
        // Format varies, do best-effort parse
        const sources = parseSearchOutput(output);

        return new AskResponse({
          answer: output.trim(),
          sources,
          durationMs: Date.now() - start,
        });
      })
    ),

  hasIndex: (name) =>
    pipe(
      runLeann(['list']),
      Effect.map((output) => output.includes(name)),
      Effect.catchAll(() => Effect.succeed(false))
    ),

  formatContext: defaultFormatContext,
});

// ============================================================================
// Layer
// ============================================================================

/**
 * LEANN Backend Layer
 */
export const LeannBackendLive = Layer.succeed(RagProvider, makeLeannProvider());
