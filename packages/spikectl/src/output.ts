/**
 * Spikectl output helpers
 *
 * Domain-specific output formatting built on @gbg/ctl messaging.
 *
 * @skill spikectl/core
 */

import { Console, Effect } from "effect"
import {
  formatTable,
  formatSuccess,
  createErrorHandler,
  StorageError,
  type ColumnDef,
} from "@gbg/ctl"

// =============================================================================
// CONSTANTS
// =============================================================================

const SEPARATOR = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

// =============================================================================
// OUTPUT MODE
// =============================================================================

export type OutputMode = "console" | "agent"

// =============================================================================
// SECTION HELPERS
// =============================================================================

/**
 * Print a section header with emoji and title
 */
export const section = (emoji: string, title: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Console.log(``)
    yield* Console.log(SEPARATOR)
    yield* Console.log(`${emoji} ${title}`)
    yield* Console.log(SEPARATOR)
  })

/**
 * Print a section end separator
 */
export const sectionEnd = (): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Console.log(``)
    yield* Console.log(SEPARATOR)
  })

/**
 * Print a sub-section header (no box, just emoji + title)
 */
export const subSection = (emoji: string, title: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Console.log(``)
    yield* Console.log(`${emoji} ${title}:`)
  })

// =============================================================================
// SUCCESS/WARNING HELPERS
// =============================================================================

/**
 * Print a success message with details and optional next steps
 */
export const spikeSuccess = (
  action: string,
  details: Record<string, string>,
  nextSteps?: readonly string[]
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Console.log(``)
    yield* Console.log(formatSuccess(action, details, nextSteps))
  })

/**
 * Print a warning message with optional suggestion
 */
export const spikeWarning = (
  message: string,
  suggestion?: string
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Console.log(``)
    yield* Console.log(`[WARNING] ${message}`)
    if (suggestion) {
      yield* Console.log(`  ${suggestion}`)
    }
  })

/**
 * Print an info message
 */
export const spikeInfo = (message: string): Effect.Effect<void> =>
  Console.log(`   ${message}`)

// =============================================================================
// AGENT STEERING
// =============================================================================

export interface AgentSteering {
  readonly action: string
  readonly suggestedName?: string
  readonly file?: string
  readonly patternMatch?: string | null
  readonly hypotheses?: readonly { id: string; claim: string }[]
  readonly nextCommand?: string
  readonly skills?: readonly string[]
}

/**
 * Emit steering message for agent consumption
 *
 * In console mode: HTML comment with JSON
 * In agent mode: Raw JSON output
 */
export const emitSteering = (
  command: string,
  payload: AgentSteering,
  mode: OutputMode
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const output = { ...payload, source: command }

    if (mode === "agent") {
      yield* Console.log(JSON.stringify(output, null, 2))
    } else {
      yield* Console.log(``)
      yield* Console.log(`<!-- SPIKE_STEERING`)
      yield* Console.log(JSON.stringify(output))
      yield* Console.log(`-->`)
    }
  })

// =============================================================================
// TABLE HELPERS
// =============================================================================

/**
 * Print a formatted table
 */
export const patternTable = <T extends Record<string, unknown>>(
  items: readonly T[],
  columns: readonly ColumnDef<T>[]
): Effect.Effect<void> =>
  Console.log(formatTable(items, columns))

/**
 * Print a simple list with indentation
 */
export const printList = (
  items: readonly string[],
  indent = "   "
): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (const item of items) {
      yield* Console.log(`${indent}- ${item}`)
    }
  })

/**
 * Print a key-value pair with indentation
 */
export const printKv = (
  key: string,
  value: string,
  indent = "   "
): Effect.Effect<void> =>
  Console.log(`${indent}${key}: ${value}`)

// =============================================================================
// ERROR HANDLER
// =============================================================================

/**
 * Spike-specific error handler with domain context
 */
export const spikeErrorHandler = createErrorHandler({
  onStorage: (e: StorageError) =>
    Effect.gen(function* () {
      yield* Console.error(``)
      yield* Console.error(`[DATABASE_ERROR] ${e.operation} failed`)
      yield* Console.error(``)
      yield* Console.error(`  Path: ${e.path}`)
      yield* Console.error(`  Details: ${e.cause}`)
      yield* Console.error(``)
      yield* Console.error(`RECOVERY:`)
      yield* Console.error(`  1. Check database exists: ls ${e.path}`)
      yield* Console.error(`  2. Verify permissions: ls -la ${e.path}`)
      yield* Console.error(`  3. Re-run a learn command to initialize`)
    }),
})

// =============================================================================
// NEXT STEPS PATTERNS
// =============================================================================

export const NextSteps = {
  afterSpikePass: (file: string) => [
    "Extract successful patterns to production code",
    "Document learning in .edin/ if significant",
    "Delete spike file if no longer needed",
  ],
  afterSpikeFail: (file: string) => [
    "IDENTIFY - Find FIRST failing hypothesis (that's the bug layer)",
    "ANALYZE - Check actual values vs expected in output above",
    "ROOT CAUSE - The difference reveals the bug",
    "FIX - Apply fix to production code",
    `RE-RUN - spikectl run ${file} --verbose`,
  ],
  afterConfigCreate: (filename: string) => [
    "EDIT CONFIG - Customize hypotheses for your issue:",
    "   - Update metadata.topic with specific issue description",
    "   - Update metadata.issueRef if you have a beads issue",
    "   - Update metadata.relatedFiles with files to investigate",
    "   - Rewrite hypotheses[].claim with falsifiable statements",
    "   - Add specific acceptanceCriteria for each hypothesis",
    "",
    `GENERATE SPIKE: spikectl new --config ${filename}`,
    "",
    "Config will be auto-cleaned after spike generation.",
  ],
  afterSpikeCreate: (filename: string) => [
    `EDIT SPIKE - Replace placeholders in ${filename}`,
    `RUN: spikectl run ${filename} --verbose`,
  ],
  afterLearnNoFix: (file: string) => [
    `spikectl learn ${file} --fix "description of what fixed it"`,
    "",
    "ADVANCED OPTIONS:",
    '   --cause "root cause"        # What caused the issue',
    '   --error "regex pattern"     # Error signature for matching',
    '   --tags "tag1,tag2"          # Searchable tags',
  ],
  noPatterns: () => [
    "Run a spike: spikectl run <file>",
    'Record learning: spikectl learn <file> --fix "description"',
  ],
} as const

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { formatTable, formatSuccess, StorageError }
export type { ColumnDef }
