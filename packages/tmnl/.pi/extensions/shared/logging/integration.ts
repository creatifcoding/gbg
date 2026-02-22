import { Effect } from 'effect'
import type { LogEntry, LogLevel } from './schemas.ts'
import { type LoggingServiceShape, makeLoggingService, type SourceLogger } from './service.ts'

export interface SharedLogStore {
  onChange: (listener: () => void) => () => void
  add: (source: string, level: LogLevel, message: string) => void
  getAll: () => ReadonlyArray<LogEntry>
  getFiltered: (levels: Set<LogLevel>, sourceFilter: string) => LogEntry[]
  getLast: (count: number) => LogEntry[]
  getSources: () => string[]
  clear: () => void
  readonly size: number
}

export interface LoggingIntegration {
  readonly service: LoggingServiceShape
  readonly store: SharedLogStore
  readonly source: (name: string) => SourceLogger
}

let singleton: LoggingIntegration | null = null

function runOr<T>(effect: Effect.Effect<T, unknown, never>, fallback: T): T {
  try {
    return Effect.runSync(effect)
  } catch {
    return fallback
  }
}

export function getLoggingIntegration(): LoggingIntegration {
  if (singleton !== null) {
    return singleton
  }

  const service = makeLoggingService({
    piDir: `${process.cwd()}/.pi`,
  })

  const store: SharedLogStore = {
    onChange: (listener) =>
      runOr(
        service.onChange(() => {
          try {
            listener()
          } catch {
            // Never let UI listeners break logging service
          }
        }),
        () => undefined,
      ),

    add: (source, level, message) => {
      runOr(service.emit({ source, level, message }), undefined)
    },

    getAll: () => runOr(service.query({ levels: ['debug', 'info', 'warn', 'error'] }), []),

    getFiltered: (levels, sourceFilter) =>
      runOr(
        service.query({
          levels: Array.from(levels),
          sourceFilter,
        }),
        [],
      ).slice(),

    getLast: (count) => runOr(service.getLast(count), []).slice(),

    getSources: () => [...runOr(service.getSources, [])],

    clear: () => {
      runOr(service.clear, undefined)
    },

    get size() {
      return runOr(service.size, 0)
    },
  }

  singleton = {
    service,
    store,
    source: (name) => service.source(name),
  }

  return singleton
}

export function getSharedLogStore(): SharedLogStore {
  return getLoggingIntegration().store
}

export function getSourceLogger(source: string): SourceLogger {
  return getLoggingIntegration().source(source)
}
