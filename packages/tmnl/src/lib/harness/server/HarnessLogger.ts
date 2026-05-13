/**
 * HarnessLogger — Structured logging for the harness WS server.
 *
 * Writes structured log lines to:
 *   1. stderr (captured by shell redirection)
 *   2. /tmp/tmnl/harness-runtime.log (append-only, survives process restarts)
 *
 * Format: logfmt-inspired structured lines.
 *   ts=<ISO> level=<LEVEL> fiber=#<N> span=<name> msg=<message> <annotations...>
 *
 * Replaces Logger.defaultLogger. Minimum level: Debug.
 */

import { Cause, FiberId, HashMap, Layer, List, Logger, LogLevel } from 'effect'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Log file setup ──────────────────────────────────────────────────────
const LOG_DIR = '/tmp/tmnl'
const LOG_FILE = path.join(LOG_DIR, 'harness-runtime.log')

const ensureLogDir = () => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
  } catch {
    // Best effort — if we can't create the dir, we still log to stderr
  }
}

// Eagerly ensure the directory exists on module load
ensureLogDir()

// Open append-mode file descriptor (or null if unavailable)
let logFd: number | null = null
try {
  logFd = fs.openSync(LOG_FILE, 'a')
} catch {
  // Fallback: stderr only
}

// ── Value formatting ────────────────────────────────────────────────────

const escapeLogfmt = (value: string): string => {
  if (value.includes(' ') || value.includes('"') || value.includes('=') || value.includes('\n')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
  }
  return value
}

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return escapeLogfmt(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return 'null'
  try {
    return escapeLogfmt(JSON.stringify(value))
  } catch {
    return escapeLogfmt(String(value))
  }
}

// ── Logger implementation ───────────────────────────────────────────────

const harnessLogger = Logger.make(({ logLevel, message, fiberId, annotations, spans, date, cause }) => {
  const parts: string[] = []

  // Timestamp
  parts.push(`ts=${date.toISOString()}`)

  // Level
  parts.push(`level=${logLevel.label}`)

  // Fiber
  parts.push(`fiber=${FiberId.threadName(fiberId)}`)

  // Span chain (innermost first from the List)
  if (List.isCons(spans)) {
    const spanNames: string[] = []
    let current: List.List<{ label: string; startTime: bigint }> = spans
    while (List.isCons(current)) {
      const span = current.head
      spanNames.push(span.label)
      current = current.tail
    }
    parts.push(`span=${escapeLogfmt(spanNames.join(' > '))}`)
  }

  // Message (may be an array)
  if (Array.isArray(message)) {
    for (const m of message) {
      parts.push(`msg=${formatValue(m)}`)
    }
  } else {
    parts.push(`msg=${formatValue(message)}`)
  }

  // Cause (if present and non-empty)
  if (cause !== undefined && cause !== null && !Cause.isEmpty(cause)) {
    parts.push(`cause=${escapeLogfmt(Cause.pretty(cause))}`)
  }

  // Annotations
  if (HashMap.size(annotations) > 0) {
    for (const [key, value] of annotations) {
      parts.push(`${key}=${formatValue(value)}`)
    }
  }

  const line = parts.join(' ')

  // Write to stderr (always available)
  globalThis.console.error(line)

  // Write to file (best effort)
  if (logFd !== null) {
    try {
      fs.writeSync(logFd, line + '\n')
    } catch {
      // If file write fails, stderr already has it
    }
  }
})

// ── Exported Layer ──────────────────────────────────────────────────────

/**
 * Replaces the default Effect logger with the harness structured logger.
 * Sets minimum log level to Debug.
 *
 * Usage:
 *   Effect.provide(HarnessLoggerLive)
 */
export const HarnessLoggerLive = Layer.mergeAll(
  Logger.replace(Logger.defaultLogger, harnessLogger),
  Logger.minimumLogLevel(LogLevel.Debug),
)
