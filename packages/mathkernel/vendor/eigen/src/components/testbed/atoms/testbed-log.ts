/**
 * Effect-Based Testbed Logging Atoms
 *
 * Schema-backed logging system for testbed components.
 * Uses Effect.Schema for type-safe log entries and effect-atom for React integration.
 *
 * Pattern: withEventLogCollector approach, adapted for testbed use.
 *
 * @module testbed/atoms/testbed-log
 */

import { Schema } from "effect"
import { Atom } from "@effect-atom/atom"
import { overlayRegistry } from "@/lib/overlays/atoms"

// =============================================================================
// LOG LEVEL SCHEMA
// =============================================================================

/**
 * Log level using Schema.Literal for runtime + type safety.
 */
export const LogLevel = Schema.Literal("info", "warn", "error", "success", "debug")
export type LogLevel = typeof LogLevel.Type

// =============================================================================
// LOG ENTRY SCHEMA (TaggedClass)
// =============================================================================

/**
 * Single log entry with source, level, message, and optional data.
 * Uses Schema.TaggedClass for discriminated union support + methods.
 */
export class TestbedLogEntry extends Schema.TaggedClass<TestbedLogEntry>()(
  "TestbedLogEntry",
  {
    /** Unique ID for React keys */
    id: Schema.String,
    /** Log level */
    level: LogLevel,
    /** Component/test source */
    source: Schema.String,
    /** Human-readable message */
    message: Schema.String,
    /** Timestamp (ms since epoch) */
    timestamp: Schema.Number,
    /** Optional structured data payload */
    data: Schema.optional(Schema.Unknown),
  }
) {
  /**
   * Format timestamp for display.
   */
  get formattedTime(): string {
    return new Date(this.timestamp).toISOString().slice(11, 23)
  }

  /**
   * Format for console output.
   */
  get consoleFormat(): string {
    return `[${this.formattedTime}] [${this.level.toUpperCase()}] ${this.source}: ${this.message}`
  }
}

// =============================================================================
// STATE ATOMS
// =============================================================================

/**
 * Log entries atom — the primary state.
 * Module-level for stable reference.
 */
export const logsAtom = Atom.make<readonly TestbedLogEntry[]>([])

/**
 * Maximum log entries to retain (prevent memory bloat).
 */
const MAX_LOGS = 500

/**
 * Log count derived atom.
 */
export const logCountAtom = Atom.make((get) => get(logsAtom).length)

/**
 * Filtered logs by level.
 */
export const filteredLogsAtom = Atom.family((level: LogLevel | "all") =>
  Atom.make((get) => {
    const logs = get(logsAtom)
    if (level === "all") return logs
    return logs.filter((log) => log.level === level)
  })
)

/**
 * Logs grouped by source.
 */
export const logsBySourceAtom = Atom.make((get) => {
  const logs = get(logsAtom)
  const grouped = new Map<string, TestbedLogEntry[]>()

  for (const log of logs) {
    const existing = grouped.get(log.source) ?? []
    grouped.set(log.source, [...existing, log])
  }

  return grouped
})

// =============================================================================
// OPERATIONS
// =============================================================================

let logIdCounter = 0

/**
 * Generate unique log ID.
 */
const generateLogId = (): string => {
  logIdCounter++
  return `log-${Date.now()}-${logIdCounter}`
}

/**
 * Add a log entry.
 * Uses Atom.set directly (Atom-as-State pattern).
 */
export const appendLog = (
  level: LogLevel,
  source: string,
  message: string,
  data?: unknown
): TestbedLogEntry => {
  const entry = new TestbedLogEntry({
    id: generateLogId(),
    level,
    source,
    message,
    timestamp: Date.now(),
    data,
  })

  overlayRegistry.update(logsAtom, (prev) => {
    const updated = [...prev, entry]
    // Trim to max logs
    if (updated.length > MAX_LOGS) {
      return updated.slice(-MAX_LOGS)
    }
    return updated
  })

  return entry
}

/**
 * Clear all logs.
 */
export const clearLogs = (): void => {
  overlayRegistry.set(logsAtom, [])
}

/**
 * Clear logs for a specific source.
 */
export const clearLogsForSource = (source: string): void => {
  overlayRegistry.update(logsAtom, (prev) => prev.filter((log) => log.source !== source))
}

// =============================================================================
// LOGGER FACTORY
// =============================================================================

/**
 * Logger interface for source-scoped logging.
 */
export interface TestbedLogger {
  info: (message: string, data?: unknown) => TestbedLogEntry
  warn: (message: string, data?: unknown) => TestbedLogEntry
  error: (message: string, data?: unknown) => TestbedLogEntry
  success: (message: string, data?: unknown) => TestbedLogEntry
  debug: (message: string, data?: unknown) => TestbedLogEntry
  clear: () => void
}

/**
 * Create a source-scoped logger.
 * Returns stable object for memoization.
 */
export const createLogger = (source: string): TestbedLogger => ({
  info: (message, data) => appendLog("info", source, message, data),
  warn: (message, data) => appendLog("warn", source, message, data),
  error: (message, data) => appendLog("error", source, message, data),
  success: (message, data) => appendLog("success", source, message, data),
  debug: (message, data) => appendLog("debug", source, message, data),
  clear: () => clearLogsForSource(source),
})

// =============================================================================
// REACT HOOK
// =============================================================================

import { useMemo } from "react"
import { useAtomValue } from "@effect-atom/atom-react"

/**
 * Hook for source-scoped logging.
 * Returns a stable logger instance.
 */
export function useTestbedLogger(source: string): TestbedLogger {
  return useMemo(() => createLogger(source), [source])
}

/**
 * Hook for reading all logs.
 */
export function useTestbedLogs(): readonly TestbedLogEntry[] {
  return useAtomValue(logsAtom)
}

/**
 * Hook for log count.
 */
export function useTestbedLogCount(): number {
  return useAtomValue(logCountAtom)
}
