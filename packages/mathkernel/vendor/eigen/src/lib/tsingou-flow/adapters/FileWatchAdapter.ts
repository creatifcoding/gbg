/**
 * FileWatchAdapter — File system watcher source adapter.
 *
 * Watches filesystem paths for changes, parses new content into signals.
 * Good for testing, local data ingestion, log tailing, and CSV drops.
 *
 * Uses Node.js fs.watch (or chokidar for glob patterns in future).
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §4
 * @module tsingou-flow/adapters/FileWatchAdapter
 */

import { Effect, Schema } from 'effect'
import { Atom } from '@effect-atom/atom'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BaseAdapterConfig, type SourceAdapterShape } from './types'
import type { BaseSignal, SourceId } from '../schemas/base-signal'
import type { AdapterHealth } from '../schemas/adapter'

// =============================================================================
// Configuration
// =============================================================================

export const FileWatchAdapterConfig = Schema.extend(
  BaseAdapterConfig,
  Schema.Struct({
    kind: Schema.Literal('file-watch'),

    /** File or directory path to watch */
    watchPath: Schema.String,

    /** File patterns to include (glob-like, e.g. "*.json", "*.csv") */
    patterns: Schema.optional(Schema.Array(Schema.String)),

    /** Whether to read initial file contents on connect */
    readInitial: Schema.optional(Schema.Boolean),

    /**
     * Parser function name (built-in parsers):
     * - 'json': Parse as JSON
     * - 'csv': Parse as CSV lines
     * - 'lines': Split by newline
     * - 'raw': Raw string content
     */
    parser: Schema.optional(Schema.Literal('json', 'csv', 'lines', 'raw')),

    /** For tail mode: track last read position per file */
    tailMode: Schema.optional(Schema.Boolean),
  }),
)
export type FileWatchAdapterConfig = typeof FileWatchAdapterConfig.Type

// =============================================================================
// Built-in Parsers
// =============================================================================

const parsers: Record<string, (content: string) => unknown> = {
  json: (content) => {
    try { return JSON.parse(content) }
    catch { return content }
  },
  csv: (content) => content.split('\n').filter(Boolean).map(line => line.split(',')),
  lines: (content) => content.split('\n').filter(Boolean),
  raw: (content) => content,
}

// =============================================================================
// Adapter Implementation
// =============================================================================

/**
 * Create a FileWatchAdapter instance.
 */
export const makeFileWatchAdapter = (
  adapterId: string,
  sourceId: SourceId,
): SourceAdapterShape<FileWatchAdapterConfig> => {
  let watcher: fs.FSWatcher | null = null
  let signalCount = 0
  let errorCount = 0
  let lastSignalAt: Date | null = null
  let connected = false
  let seq = 0

  const generateId = () => `sig_fw_${adapterId}_${Date.now()}_${seq++}`

  return {
    adapterId,
    sourceId,
    kind: 'file-watch',

    connect: (config, push) =>
      Effect.gen(function* () {
        const watchPath = config.watchPath
        const parserFn = parsers[config.parser ?? 'raw'] ?? parsers.raw

        // Verify path exists
        yield* Effect.try({
          try: () => fs.statSync(watchPath),
          catch: () => ({
            _tag: 'AdapterError' as const,
            adapterId,
            sourceId,
            message: `Watch path does not exist: ${watchPath}`,
            retryable: false,
            timestamp: new Date(),
          }),
        })

        // Read initial content if configured
        if (config.readInitial) {
          yield* Effect.try({
            try: () => {
              const stat = fs.statSync(watchPath)
              if (stat.isFile()) {
                const content = fs.readFileSync(watchPath, 'utf-8')
                const parsed = parserFn(content)
                return parsed
              }
              return null
            },
            catch: () => null,
          }).pipe(
            Effect.tap((parsed) => {
              if (parsed !== null) {
                return push({
                  id: generateId() as any,
                  sourceId,
                  timestamp: new Date(),
                  version: [0, seq] as [number, number],
                  kind: 'file-watch',
                  payload: {
                    path: watchPath,
                    event: 'create' as const,
                    content: parsed,
                  },
                })
              }
              return Effect.void
            }),
          )
        }

        // Start watching
        watcher = fs.watch(watchPath, { recursive: false }, (eventType, filename) => {
          if (!filename) return
          const filePath = path.join(watchPath, filename)

          // Check patterns
          if (config.patterns && config.patterns.length > 0) {
            const matches = config.patterns.some((pattern) => {
              if (pattern.startsWith('*.')) {
                return filename.endsWith(pattern.slice(1))
              }
              return filename === pattern
            })
            if (!matches) return
          }

          try {
            const event = eventType === 'rename' ? 'create' : 'modify'
            let content: unknown = undefined

            if (event !== 'delete') {
              try {
                const raw = fs.readFileSync(filePath, 'utf-8')
                content = parserFn(raw)
              } catch {
                // File might have been deleted between event and read
              }
            }

            const signal: BaseSignal = {
              id: generateId() as any,
              sourceId,
              timestamp: new Date(),
              version: [0, seq++] as [number, number],
              kind: 'file-watch',
              payload: { path: filePath, event, content },
            }

            Effect.runSync(push(signal))
            signalCount++
            lastSignalAt = new Date()
          } catch (err) {
            errorCount++
          }
        })

        connected = true
        yield* Effect.log(`[FileWatchAdapter] Watching: ${watchPath}`)
      }),

    disconnect: Effect.sync(() => {
      if (watcher) {
        watcher.close()
        watcher = null
      }
      connected = false
    }),

    isConnected: Effect.sync(() => connected),

    health: Effect.sync(() => ({
      status: connected ? 'connected' as const : 'disconnected' as const,
      lastSignalAt: lastSignalAt ?? undefined,
      signalCount,
      errorCount,
    })),
  }
}
