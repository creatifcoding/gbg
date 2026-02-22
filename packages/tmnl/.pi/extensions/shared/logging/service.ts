import { Registry } from '@effect-atom/atom-react'
import { Context, Effect, Layer, Schema } from 'effect'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  LOG_LEVELS,
  LogInputSchema,
  LogQuerySchema,
  type LogEntry,
  type LogLevel,
} from './schemas.ts'
import { entriesAtom, maxEntriesAtom, sourcesAtom } from './state.ts'

const DEFAULT_MAX_ENTRIES = 500
const DEFAULT_MAX_FILE_SIZE = 512_000

export interface SourceLogger {
  emit: (level: LogLevel, message: string) => void
  debug: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

export interface LoggingServiceShape {
  readonly emit: (input: unknown) => Effect.Effect<LogEntry, Error>
  readonly query: (input?: unknown) => Effect.Effect<ReadonlyArray<LogEntry>, Error>
  readonly clear: Effect.Effect<void>
  readonly onChange: (
    listener: (_entries: ReadonlyArray<LogEntry>) => void,
    options?: { readonly immediate?: boolean },
  ) => Effect.Effect<() => void>
  readonly getLast: (count: number) => Effect.Effect<ReadonlyArray<LogEntry>>
  readonly getSources: Effect.Effect<ReadonlyArray<string>>
  readonly size: Effect.Effect<number>
  readonly source: (source: string) => SourceLogger
}

export class LoggingService extends Context.Tag('pi/extensions/logging/LoggingService')<
  LoggingService,
  LoggingServiceShape
>() {}

const decodeLogInput = Schema.decodeUnknownSync(LogInputSchema)
const decodeQuery = Schema.decodeUnknownSync(LogQuerySchema)

function parseLevel(raw: string | undefined): LogLevel {
  const normalized = (raw ?? '').toLowerCase()
  if (normalized === 'error') return 'error'
  if (normalized === 'warn' || normalized === 'warning') return 'warn'
  if (normalized === 'debug') return 'debug'
  return 'info'
}

function clampMaxEntries(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_ENTRIES
  return Math.floor(value)
}

export interface LoggingServiceConfig {
  readonly piDir: string
  readonly logPath?: string
  readonly maxEntries?: number
  readonly maxFileSize?: number
}

export function makeLoggingService(config: LoggingServiceConfig): LoggingServiceShape {
  const piDir = config.piDir
  const logPath = config.logPath ?? path.join(piDir, 'extensions.log')
  const maxFileSize = config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE

  const registry = Registry.make()
  registry.mount(entriesAtom as never)
  registry.mount(sourcesAtom)
  registry.set(maxEntriesAtom as never, clampMaxEntries(config.maxEntries ?? DEFAULT_MAX_ENTRIES) as never)

  const rotateIfNeeded = () => {
    try {
      if (!fs.existsSync(logPath)) return
      const stat = fs.statSync(logPath)
      if (stat.size > maxFileSize) {
        fs.writeFileSync(logPath, '')
      }
    } catch {
      // best effort
    }
  }

  const appendFileSink = (entry: LogEntry) => {
    const line = `${entry.timestamp} [${entry.source}] ${entry.level.toUpperCase()}: ${entry.message}\n`
    try {
      rotateIfNeeded()
      fs.appendFileSync(logPath, line)
    } catch {
      // best effort
    }
  }

  const appendEntry = (
    entry: LogEntry,
    options?: { readonly writeSink?: boolean },
  ) => {
    registry.update(entriesAtom as never, (current) => {
      const next = [...(current as ReadonlyArray<LogEntry>), entry]
      const maxEntries = clampMaxEntries(registry.get(maxEntriesAtom as never) as number)
      if (next.length <= maxEntries) {
        return next as never
      }
      return next.slice(next.length - maxEntries) as never
    })

    if (options?.writeSink !== false) {
      appendFileSink(entry)
    }
  }

  const emitUnsafe = (input: unknown): LogEntry => {
    const payload = decodeLogInput(input)
    const entry: LogEntry = {
      timestamp: payload.timestamp ?? new Date().toISOString(),
      source: payload.source,
      level: payload.level,
      message: payload.message,
      origin: payload.origin ?? 'service',
    }

    appendEntry(entry)
    return entry
  }

  const service: LoggingServiceShape = {
    emit: (input) =>
      Effect.sync(() => {
        try {
          return emitUnsafe(input)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(`Invalid log input: ${message}`)
        }
      }),

    query: (input) =>
      Effect.sync(() => {
        const decoded = input === undefined ? { sourceFilter: undefined, levels: undefined, limit: undefined } : decodeQuery(input)
        const sourceFilter = (decoded.sourceFilter ?? '').trim()
        const levels = new Set<LogLevel>((decoded.levels ?? [...LOG_LEVELS]).map(parseLevel))
        const limit = decoded.limit && decoded.limit > 0 ? Math.floor(decoded.limit) : undefined

        let filtered = (registry.get(entriesAtom as never) as ReadonlyArray<LogEntry>).filter((entry) => {
          if (!levels.has(entry.level)) return false
          if (sourceFilter.length > 0 && !entry.source.includes(sourceFilter)) return false
          return true
        })

        if (limit !== undefined) {
          filtered = filtered.slice(Math.max(0, filtered.length - limit))
        }

        return filtered
      }),

    clear: Effect.sync(() => {
      registry.set(entriesAtom as never, [] as never)
      try {
        fs.writeFileSync(logPath, '')
      } catch {
        // ignore
      }
    }),

    onChange: (listener, options) =>
      Effect.sync(() =>
        registry.subscribe(
          entriesAtom as never,
          () => listener(registry.get(entriesAtom as never) as ReadonlyArray<LogEntry>),
          options,
        )
      ),

    getLast: (count) =>
      Effect.sync(() => {
        const safeCount = Math.max(0, Math.floor(count))
        if (safeCount === 0) return []
        const entries = registry.get(entriesAtom as never) as ReadonlyArray<LogEntry>
        return entries.slice(Math.max(0, entries.length - safeCount))
      }),

    getSources: Effect.sync(() => registry.get(sourcesAtom)),

    size: Effect.sync(() => (registry.get(entriesAtom as never) as ReadonlyArray<LogEntry>).length),

    source: (source) => {
      const safeSource = source.trim().length > 0 ? source.trim() : 'unknown'

      const emit = (level: LogLevel, message: string) => {
        try {
          Effect.runSync(service.emit({ source: safeSource, level, message }))
        } catch {
          // Never fail callers because logger had validation/sink errors
        }
      }

      return {
        emit,
        debug: (message) => emit('debug', message),
        info: (message) => emit('info', message),
        warn: (message) => emit('warn', message),
        error: (message) => emit('error', message),
      }
    },
  }

  return service
}

export const LoggingServiceLive = (config: LoggingServiceConfig) =>
  Layer.succeed(LoggingService, makeLoggingService(config))
