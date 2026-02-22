/**
 * Shell Logger — Effect Logger → Tauri IPC → Rust journald bridge.
 *
 * Creates a custom Effect Logger that:
 * 1. Formats structured entries with fiber IDs, spans, annotations
 * 2. Batches entries (200ms window) for efficient IPC
 * 3. Sends via Tauri `invoke('shell_log_batch')` to Rust
 * 4. Rust dispatches to `log` crate → journald
 *
 * Usage:
 * ```ts
 * import { ShellLoggerLive } from '@/lib/getbyshell/logging'
 *
 * const program = myEffect.pipe(Effect.provide(ShellLoggerLive))
 * ```
 *
 * Or add to an existing runtime:
 * ```ts
 * const runtimeAtom = Atom.runtime(
 *   Layer.mergeAll(MyService.Default, ShellLoggerLive)
 * )
 * ```
 */

import { Effect, Logger, LogLevel, Layer, List, HashMap, FiberId, Cause } from 'effect'
import type { ShellLogLevel } from './types'

// =============================================================================
// IPC Bridge
// =============================================================================

/** Send a batch of log entries to Rust via Tauri IPC */
async function sendLogBatch(
  entries: Array<{
    timestamp: string
    level: ShellLogLevel
    message: string
    fiberId?: string
    spans?: string[]
    annotations?: Record<string, string>
    source?: string
    cause?: string
  }>,
) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('shell_log_batch', { entries })
  } catch {
    // Fallback: dump to console if Tauri IPC unavailable (dev/browser)
    for (const e of entries) {
      const prefix = `[${e.level.toUpperCase()}]`
      const spans = e.spans?.length ? ` [${e.spans.join(' > ')}]` : ''
      const fiber = e.fiberId ? ` (fiber:${e.fiberId})` : ''
      console.log(`${prefix}${spans}${fiber} ${e.message}`)
    }
  }
}

// =============================================================================
// Effect LogLevel → Shell LogLevel Mapping
// =============================================================================

function mapLogLevel(level: LogLevel.LogLevel): ShellLogLevel {
  switch (level._tag) {
    case 'All':
    case 'Trace':
      return 'trace'
    case 'Debug':
      return 'debug'
    case 'Info':
      return 'info'
    case 'Warning':
      return 'warn'
    case 'Error':
      return 'error'
    case 'Fatal':
      return 'fatal'
    case 'None':
    default:
      return 'debug'
  }
}

// =============================================================================
// Span Extraction
// =============================================================================

function extractSpans(spans: List.List<{ label: string }>): string[] {
  const result: string[] = []
  let current = spans
  while (current._tag === 'Cons') {
    result.push(current.head.label)
    current = current.tail
  }
  return result.reverse()
}

// =============================================================================
// Annotation Extraction
// =============================================================================

function extractAnnotations(
  annotations: HashMap.HashMap<string, unknown>,
): Record<string, string> | undefined {
  const result: Record<string, string> = {}
  let hasAny = false
  for (const [key, value] of annotations) {
    result[key] = String(value)
    hasAny = true
  }
  return hasAny ? result : undefined
}

// =============================================================================
// FiberId Extraction
// =============================================================================

function extractFiberId(fiberId: FiberId.FiberId): string | undefined {
  switch (fiberId._tag) {
    case 'None':
      return undefined
    case 'Runtime':
      return `${fiberId.id}`
    case 'Composite':
      return `${extractFiberId(fiberId.left) ?? '?'}+${extractFiberId(fiberId.right) ?? '?'}`
    default:
      return undefined
  }
}

// =============================================================================
// The Logger
// =============================================================================

/**
 * Structured Effect Logger that formats entries for Tauri IPC.
 *
 * Captures: timestamp, level, message, fiber ID, span trail,
 * annotations, and cause (if error).
 */
export const shellLogger = Logger.make<unknown, {
  timestamp: string
  level: ShellLogLevel
  message: string
  fiberId?: string
  spans?: string[]
  annotations?: Record<string, string>
  cause?: string
}>(({ logLevel, message, fiberId, spans, annotations, date, cause }) => {
  const entry = {
    timestamp: date.toISOString(),
    level: mapLogLevel(logLevel),
    message: typeof message === 'string' ? message : String(message),
    fiberId: extractFiberId(fiberId),
    spans: extractSpans(spans),
    annotations: extractAnnotations(annotations),
    cause: Cause.isEmpty(cause) ? undefined : Cause.pretty(cause),
  }

  // Clean up empty optionals
  if (!entry.fiberId) delete entry.fiberId
  if (!entry.spans?.length) delete entry.spans
  if (!entry.annotations) delete entry.annotations
  if (!entry.cause) delete entry.cause

  return entry
})

/**
 * Batched version — collects entries over 200ms windows and sends in bulk.
 * Use this in production to avoid IPC overhead per log line.
 */
export const shellLoggerBatched = shellLogger.pipe(
  Logger.batched('200 millis', (entries) =>
    Effect.promise(() => sendLogBatch(entries)),
  ),
)

/**
 * Unbatched version — sends each entry immediately.
 * Useful for debugging when you need real-time logs.
 */
export const shellLoggerImmediate = Logger.map(shellLogger, (entry) => {
  sendLogBatch([entry])
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Live layer — replaces default logger with batched shell logger.
 * Logs at Debug level minimum (captures debug + info + warn + error).
 *
 * ```ts
 * const program = myEffect.pipe(Effect.provide(ShellLoggerLive))
 * ```
 */
export const ShellLoggerLive = Layer.unwrapScoped(
  Effect.map(shellLoggerBatched, (batched) =>
    Layer.mergeAll(
      Logger.replace(Logger.defaultLogger, batched),
      Logger.minimumLogLevel(LogLevel.Debug),
    ),
  ),
)

/**
 * Debug layer — unbatched, immediate, traces everything.
 * Use for development when you need instant log output.
 */
export const ShellLoggerDebug = Layer.mergeAll(
  Logger.replace(Logger.defaultLogger, shellLoggerImmediate),
  Logger.minimumLogLevel(LogLevel.Trace),
)
