/**
 * JSONL Codec — parse/serialize AgentTaskLogEntry lines.
 *
 * - parseLine:      string → Effect<AgentTaskLogEntry, JsonlParseError>
 * - serializeLine:  AgentTaskLogEntry → string
 * - parseLines:     string (multi-line) → Effect<Array<AgentTaskLogEntry>, never>
 *                   (skips invalid lines, collects successes)
 *
 * Uses Schema.decodeUnknown internally for full validation.
 *
 * @module agent-task/codec/jsonl-codec
 */

import { Effect, Schema, Array as Arr } from 'effect'
import { AgentTaskLogEntry } from '../schemas/log-entry'

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class JsonlParseError {
  readonly _tag = 'JsonlParseError'
  constructor(
    readonly line: string,
    readonly reason: string,
  ) {}
}

// ---------------------------------------------------------------------------
// Decoder (cached)
// ---------------------------------------------------------------------------

const decodeEntry = Schema.decodeUnknown(AgentTaskLogEntry)

// ---------------------------------------------------------------------------
// Single line
// ---------------------------------------------------------------------------

/**
 * Parse a single JSONL line into an AgentTaskLogEntry.
 *
 * Fails with JsonlParseError if the line is not valid JSON
 * or doesn't match the schema.
 */
export const parseLine = (
  raw: string,
): Effect.Effect<AgentTaskLogEntry, JsonlParseError> =>
  Effect.gen(function* () {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      return yield* Effect.fail(new JsonlParseError(raw, 'Empty line'))
    }

    // Step 1: JSON.parse
    const json = yield* Effect.try({
      try: () => JSON.parse(trimmed) as unknown,
      catch: (e) =>
        new JsonlParseError(
          raw,
          `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
        ),
    })

    // Step 2: Schema decode
    const entry = yield* decodeEntry(json).pipe(
      Effect.mapError(
        (e) => new JsonlParseError(raw, `Schema validation failed: ${String(e)}`),
      ),
    )

    return entry
  })

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

const encodeEntry = Schema.encodeSync(AgentTaskLogEntry)

/**
 * Serialize an AgentTaskLogEntry to a single JSONL line.
 */
export const serializeLine = (entry: AgentTaskLogEntry): string =>
  JSON.stringify(encodeEntry(entry))

// ---------------------------------------------------------------------------
// Batch parse (lenient — skips bad lines)
// ---------------------------------------------------------------------------

/**
 * Parse a multi-line JSONL string. Invalid lines are silently skipped.
 * Returns successfully parsed entries in order.
 */
export const parseLines = (
  content: string,
): Effect.Effect<Array<AgentTaskLogEntry>> =>
  Effect.gen(function* () {
    const lines = content.split('\n').filter((l) => l.trim().length > 0)
    const results = yield* Effect.forEach(lines, (line) =>
      parseLine(line).pipe(Effect.option),
    )
    return Arr.getSomes(results)
  })

// ---------------------------------------------------------------------------
// Batch serialize
// ---------------------------------------------------------------------------

/**
 * Serialize an array of entries to a JSONL string (newline-delimited).
 */
export const serializeLines = (
  entries: ReadonlyArray<AgentTaskLogEntry>,
): string => entries.map(serializeLine).join('\n')
