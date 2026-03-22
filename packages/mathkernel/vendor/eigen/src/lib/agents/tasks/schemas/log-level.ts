/**
 * LogLevel — severity literal union with numeric ordering.
 *
 * Provides both the Effect Schema (for runtime validation / codec)
 * and a numeric severity map for filter comparisons
 * (e.g. "show me WARN and above").
 *
 * @module agent-task/schemas/log-level
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const LogLevel = Schema.Literal(
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL',
)

export type LogLevel = typeof LogLevel.Type

// ---------------------------------------------------------------------------
// Severity ordering (higher = more severe)
// ---------------------------------------------------------------------------

export const LOG_LEVEL_SEVERITY: Readonly<Record<LogLevel, number>> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
} as const

/** All levels ordered from least to most severe. */
export const LOG_LEVELS_ORDERED: ReadonlyArray<LogLevel> = [
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when `a` is at least as severe as `threshold`. */
export const meetsThreshold = (a: LogLevel, threshold: LogLevel): boolean =>
  LOG_LEVEL_SEVERITY[a] >= LOG_LEVEL_SEVERITY[threshold]

/** Short display label for badges — single character. */
export const LOG_LEVEL_CHAR: Readonly<Record<LogLevel, string>> = {
  DEBUG: 'D',
  INFO: 'I',
  WARN: 'W',
  ERROR: 'E',
  FATAL: 'F',
}

/** CSS-friendly data-attribute value (lowercase). */
export const logLevelDataAttr = (level: LogLevel): string =>
  level.toLowerCase()
