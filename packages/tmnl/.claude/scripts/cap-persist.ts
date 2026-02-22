#!/usr/bin/env bun
/**
 * CAP Persist CLI - Conceptual Alignment Protocol Persistence
 *
 * Persists Conceptual Alignment Protocol sessions to JSONL and Markdown.
 * Built with @gbg/ctl patterns.
 *
 * Usage:
 *   echo "ALIGNED MODEL: ..." | bun run cap-persist.ts --topic "name" --round 2 --session "id" --confirmed
 *
 * @skill cap/persist
 */

import {
  // Core
  Command,
  Options,
  NodeContext,
  NodeRuntime,
  // Messaging
  InvalidInputError,
  StorageError,
  createErrorHandler,
  formatSuccess,
  skillRef,
  // Services
  Effect,
  Console,
  Layer,
  FileSystem,
  Path,
} from "@gbg/ctl"
import { Schema } from "effect"
import { execSync } from "child_process"

// =============================================================================
// CONSTANTS
// =============================================================================

const PROJECT_ROOT = "/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl"
const ALIGNMENTS_DIR = `${PROJECT_ROOT}/thoughts/shared/alignments`

// =============================================================================
// SKILL REFERENCES
// =============================================================================

const CAP_SKILLS = {
  persist: skillRef("cap/persist", "CAP persistence", ".claude/skills/cap/persist/SKILL.md"),
  alignment: skillRef(
    "conceptual-alignment",
    "Conceptual Alignment Protocol",
    ".claude/skills/conceptual-alignment/SKILL.md"
  ),
}

// =============================================================================
// DOMAIN SCHEMAS (Effect Schema - no raw interfaces)
// =============================================================================

/**
 * Dimensions of an aligned model
 */
const AlignmentDimensions = Schema.Struct({
  shape: Schema.String,
  composition: Schema.String,
  api: Schema.String,
  scope: Schema.String,
})
type AlignmentDimensions = typeof AlignmentDimensions.Type

/**
 * Raw Q&A from the alignment session
 */
const AlignmentRaw = Schema.Struct({
  questionsAsked: Schema.Array(Schema.String),
  userAnswers: Schema.Record({ key: Schema.String, value: Schema.String }),
})
type AlignmentRaw = typeof AlignmentRaw.Type

/**
 * Full alignment record for JSONL persistence
 */
const AlignmentRecord = Schema.Struct({
  round: Schema.Number,
  timestamp: Schema.String, // ISO format
  topic: Schema.String,
  sessionId: Schema.String,
  gitCommit: Schema.String,
  dimensions: AlignmentDimensions,
  raw: AlignmentRaw,
  corrections: Schema.NullOr(Schema.Array(Schema.String)),
  confirmed: Schema.Boolean,
})
type AlignmentRecord = typeof AlignmentRecord.Type

// =============================================================================
// UTILITIES
// =============================================================================

const getGitCommit = (): Effect.Effect<string, never, never> =>
  Effect.try({
    try: () => execSync("git rev-parse HEAD", { encoding: "utf-8", cwd: PROJECT_ROOT }).trim(),
    catch: () => "unknown",
  }).pipe(Effect.catchAll(() => Effect.succeed("unknown")))

const getToday = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const sanitizeFilename = (topic: string): string => {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
}

// =============================================================================
// STDIN PARSING
// =============================================================================

/**
 * Parse ALIGNED MODEL from stdin text.
 * Expected format:
 *
 * ALIGNED MODEL:
 * - Shape: some description
 * - Composition: some description
 * - API: some description
 * - Scope: some description
 *
 * Optionally followed by:
 * QUESTIONS ASKED:
 * 1. Question one?
 * 2. Question two?
 *
 * USER ANSWERS:
 * Q1: Answer to question one
 * Q2: Answer to question two
 *
 * CORRECTIONS:
 * - Correction one
 * - Correction two
 */
const parseAlignedModel = (
  input: string
): Effect.Effect<
  {
    dimensions: AlignmentDimensions
    raw: AlignmentRaw
    corrections: string[] | null
  },
  InvalidInputError
> =>
  Effect.gen(function* () {
    // Parse dimensions
    const extractDimension = (key: string): string => {
      const pattern = new RegExp(`^\\s*-?\\s*${key}:\\s*(.+)$`, "im")
      const match = input.match(pattern)
      return match ? match[1].trim() : ""
    }

    const shape = extractDimension("Shape")
    const composition = extractDimension("Composition")
    const api = extractDimension("API")
    const scope = extractDimension("Scope")

    if (!shape && !composition && !api && !scope) {
      return yield* Effect.fail(
        new InvalidInputError({
          field: "stdin",
          value: input.slice(0, 100) + "...",
          expected: "ALIGNED MODEL with Shape, Composition, API, Scope dimensions",
          examples: [
            "ALIGNED MODEL:",
            "- Shape: Plain object with render function",
            "- Composition: Merge via Object.assign",
            "- API: useX() -> keyed config",
            "- Scope: Provider-scoped",
          ],
          skill: CAP_SKILLS.alignment,
        })
      )
    }

    // Parse questions asked
    const questionsAsked: string[] = []
    const questionsMatch = input.match(/QUESTIONS ASKED:([\s\S]*?)(?:USER ANSWERS:|CORRECTIONS:|$)/i)
    if (questionsMatch) {
      const questionsBlock = questionsMatch[1]
      const questionLines = questionsBlock.match(/^\s*\d+\.\s*(.+)$/gm) || []
      questionLines.forEach((line) => {
        const match = line.match(/^\s*\d+\.\s*(.+)$/)
        if (match) questionsAsked.push(match[1].trim())
      })
    }

    // Parse user answers
    const userAnswers: Record<string, string> = {}
    const answersMatch = input.match(/USER ANSWERS:([\s\S]*?)(?:CORRECTIONS:|$)/i)
    if (answersMatch) {
      const answersBlock = answersMatch[1]
      const answerLines = answersBlock.match(/^\s*Q\d+:\s*(.+)$/gm) || []
      answerLines.forEach((line, idx) => {
        const match = line.match(/^\s*Q\d+:\s*(.+)$/)
        if (match) userAnswers[`Q${idx + 1}`] = match[1].trim()
      })
    }

    // Parse corrections
    let corrections: string[] | null = null
    const correctionsMatch = input.match(/CORRECTIONS:([\s\S]*)$/i)
    if (correctionsMatch) {
      const correctionsBlock = correctionsMatch[1]
      const correctionLines = correctionsBlock.match(/^\s*-\s*(.+)$/gm) || []
      if (correctionLines.length > 0) {
        corrections = correctionLines.map((line: string) => {
          const match = line.match(/^\s*-\s*(.+)$/)
          return match ? match[1].trim() : line.trim()
        })
      }
    }

    return {
      dimensions: { shape, composition, api, scope },
      raw: { questionsAsked, userAnswers },
      corrections,
    }
  })

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Read existing JSONL records from file
 */
const readJsonlRecords = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const exists = yield* fs.exists(path)
    if (!exists) {
      return []
    }

    const content = yield* fs.readFileString(path).pipe(
      Effect.mapError(
        (e) =>
          new StorageError({
            operation: "read JSONL",
            path,
            cause: e.message,
            skill: CAP_SKILLS.persist,
          })
      )
    )

    const lines = content.split("\n").filter((l: string) => l.trim())

    const records = yield* Effect.forEach(lines, (line: string) =>
      Effect.try({
        try: () => JSON.parse(line),
        catch: () => null as unknown,
      }).pipe(
        Effect.flatMap((parsed) =>
          parsed === null
            ? Effect.succeed(null)
            : Schema.decodeUnknown(AlignmentRecord)(parsed).pipe(
                Effect.catchAll(() => Effect.succeed(null))
              )
        )
      )
    ).pipe(Effect.map((results) => results.filter((r): r is AlignmentRecord => r !== null)))

    return records
  })

/**
 * Append a record to JSONL file
 */
const appendJsonl = (path: string, record: AlignmentRecord) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathSvc = yield* Path.Path

    // Ensure directory exists
    const dir = pathSvc.dirname(path)
    yield* fs.makeDirectory(dir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void))

    // Read existing content
    const existingContent = yield* fs.readFileString(path).pipe(Effect.catchAll(() => Effect.succeed("")))

    // Append new record
    const newLine = JSON.stringify(record)
    const newContent = existingContent.trim() ? `${existingContent.trim()}\n${newLine}\n` : `${newLine}\n`

    yield* fs.writeFileString(path, newContent).pipe(
      Effect.mapError(
        (e) =>
          new StorageError({
            operation: "write JSONL",
            path,
            cause: String(e),
            skill: CAP_SKILLS.persist,
          })
      )
    )
  })

/**
 * Generate markdown from JSONL records
 */
const generateMarkdown = (topic: string, records: AlignmentRecord[]): string => {
  const lines: string[] = []

  lines.push(`# Conceptual Alignment: ${topic}`)
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Rounds: ${records.length}`)
  lines.push("")

  // Latest confirmed alignment
  const confirmed = records.filter((r) => r.confirmed)
  if (confirmed.length > 0) {
    const latest = confirmed[confirmed.length - 1]
    lines.push("## Current Aligned Model")
    lines.push("")
    lines.push("| Dimension | Value |")
    lines.push("|-----------|-------|")
    lines.push(`| Shape | ${latest.dimensions.shape} |`)
    lines.push(`| Composition | ${latest.dimensions.composition} |`)
    lines.push(`| API | ${latest.dimensions.api} |`)
    lines.push(`| Scope | ${latest.dimensions.scope} |`)
    lines.push("")
    lines.push(`*Confirmed in round ${latest.round} at ${latest.timestamp}*`)
    lines.push("")
  }

  // History
  lines.push("## Alignment History")
  lines.push("")

  for (const record of records.slice().reverse()) {
    lines.push(`### Round ${record.round}`)
    lines.push("")
    lines.push(`- **Timestamp:** ${record.timestamp}`)
    lines.push(`- **Session:** ${record.sessionId}`)
    lines.push(`- **Git:** \`${record.gitCommit.slice(0, 8)}\``)
    lines.push(`- **Confirmed:** ${record.confirmed ? "Yes" : "No"}`)
    lines.push("")
    lines.push("**Dimensions:**")
    lines.push(`- Shape: ${record.dimensions.shape}`)
    lines.push(`- Composition: ${record.dimensions.composition}`)
    lines.push(`- API: ${record.dimensions.api}`)
    lines.push(`- Scope: ${record.dimensions.scope}`)
    lines.push("")

    if (record.raw.questionsAsked.length > 0) {
      lines.push("**Questions Asked:**")
      record.raw.questionsAsked.forEach((q, i) => {
        lines.push(`${i + 1}. ${q}`)
      })
      lines.push("")
    }

    if (Object.keys(record.raw.userAnswers).length > 0) {
      lines.push("**User Answers:**")
      for (const [key, value] of Object.entries(record.raw.userAnswers)) {
        lines.push(`- ${key}: ${value}`)
      }
      lines.push("")
    }

    if (record.corrections && record.corrections.length > 0) {
      lines.push("**Corrections:**")
      record.corrections.forEach((c) => {
        lines.push(`- ${c}`)
      })
      lines.push("")
    }

    lines.push("---")
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Write markdown file
 */
const writeMarkdown = (path: string, content: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathSvc = yield* Path.Path

    const dir = pathSvc.dirname(path)
    yield* fs.makeDirectory(dir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void))

    yield* fs.writeFileString(path, content).pipe(
      Effect.mapError(
        (e) =>
          new StorageError({
            operation: "write markdown",
            path,
            cause: String(e),
            skill: CAP_SKILLS.persist,
          })
      )
    )
  })

// =============================================================================
// STDIN READER
// =============================================================================

const readStdin = (): Effect.Effect<string, InvalidInputError> =>
  Effect.async((resume) => {
    let data = ""
    const timeout = setTimeout(() => {
      if (!data.trim()) {
        resume(
          Effect.fail(
            new InvalidInputError({
              field: "stdin",
              value: "(empty)",
              expected: "ALIGNED MODEL block piped via stdin",
              examples: ['echo "ALIGNED MODEL:\\n- Shape: ..." | bun run cap-persist.ts --topic "name"'],
              skill: CAP_SKILLS.alignment,
            })
          )
        )
      }
    }, 100) // Short timeout - if no data after 100ms, fail

    process.stdin.setEncoding("utf-8")
    process.stdin.on("data", (chunk) => {
      clearTimeout(timeout)
      data += chunk
    })
    process.stdin.on("end", () => {
      clearTimeout(timeout)
      if (data.trim()) {
        resume(Effect.succeed(data))
      } else {
        resume(
          Effect.fail(
            new InvalidInputError({
              field: "stdin",
              value: "(empty)",
              expected: "ALIGNED MODEL block piped via stdin",
              examples: ['echo "ALIGNED MODEL:\\n- Shape: ..." | bun run cap-persist.ts --topic "name"'],
              skill: CAP_SKILLS.alignment,
            })
          )
        )
      }
    })
    process.stdin.on("error", (err) => {
      clearTimeout(timeout)
      resume(
        Effect.fail(
          new InvalidInputError({
            field: "stdin",
            value: err.message,
            expected: "readable stdin",
            examples: ['echo "..." | bun run cap-persist.ts'],
            skill: CAP_SKILLS.persist,
          })
        )
      )
    })

    // Resume stdin if paused
    process.stdin.resume()
  })

// =============================================================================
// OPTIONS
// =============================================================================

const topicOption = Options.text("topic").pipe(
  Options.withAlias("t"),
  Options.withDescription("Topic name for the alignment session")
)

const roundOption = Options.integer("round").pipe(
  Options.withAlias("r"),
  Options.withDefault(1),
  Options.withDescription("Round number (default: 1)")
)

const sessionOption = Options.text("session").pipe(
  Options.withAlias("s"),
  Options.withDefault(`cap-${Date.now()}`),
  Options.withDescription("Session identifier")
)

const confirmedOption = Options.boolean("confirmed").pipe(
  Options.withAlias("c"),
  Options.withDefault(false),
  Options.withDescription("Mark this alignment as confirmed")
)

const questionsOption = Options.text("questions").pipe(
  Options.withAlias("q"),
  Options.optional,
  Options.withDescription("Comma-separated list of questions asked")
)

const answersOption = Options.text("answers").pipe(
  Options.withAlias("a"),
  Options.optional,
  Options.withDescription("Comma-separated list of Q1:answer,Q2:answer pairs")
)

const correctionsOption = Options.text("corrections").pipe(
  Options.optional,
  Options.withDescription("Comma-separated list of corrections made")
)

// =============================================================================
// MAIN COMMAND
// =============================================================================

const capPersistCommand = Command.make(
  "cap-persist",
  {
    topic: topicOption,
    round: roundOption,
    session: sessionOption,
    confirmed: confirmedOption,
    questions: questionsOption,
    answers: answersOption,
    corrections: correctionsOption,
  },
  ({ topic, round, session, confirmed, questions, answers, corrections }) =>
    Effect.gen(function* () {
      // Read and parse stdin
      const stdinContent = yield* readStdin()
      const parsed = yield* parseAlignedModel(stdinContent)

      // Merge CLI options with parsed content
      const finalQuestions =
        questions._tag === "Some"
          ? questions.value.split(",").map((q) => q.trim())
          : parsed.raw.questionsAsked

      const finalAnswers: Record<string, string> =
        answers._tag === "Some"
          ? Object.fromEntries(
              answers.value.split(",").map((pair) => {
                const [key, ...rest] = pair.split(":")
                return [key.trim(), rest.join(":").trim()]
              })
            )
          : parsed.raw.userAnswers

      const finalCorrections =
        corrections._tag === "Some"
          ? corrections.value.split(",").map((c) => c.trim())
          : parsed.corrections

      // Build record
      const gitCommit = yield* getGitCommit()
      const record: AlignmentRecord = {
        round,
        timestamp: new Date().toISOString(),
        topic,
        sessionId: session,
        gitCommit,
        dimensions: parsed.dimensions,
        raw: {
          questionsAsked: finalQuestions,
          userAnswers: finalAnswers,
        },
        corrections: finalCorrections,
        confirmed,
      }

      // Generate file paths
      const date = getToday()
      const sanitizedTopic = sanitizeFilename(topic)
      const jsonlPath = `${ALIGNMENTS_DIR}/${date}-${sanitizedTopic}.jsonl`
      const mdPath = `${ALIGNMENTS_DIR}/${date}-${sanitizedTopic}.md`

      // Append to JSONL
      yield* appendJsonl(jsonlPath, record)

      // Read all records and regenerate markdown
      const allRecords = yield* readJsonlRecords(jsonlPath)
      const markdown = generateMarkdown(topic, allRecords)
      yield* writeMarkdown(mdPath, markdown)

      // Output success
      yield* Console.log(
        formatSuccess(`Alignment round ${round} saved`, {
          topic,
          round: String(round),
          confirmed: confirmed ? "Yes" : "No",
          jsonl: jsonlPath,
          markdown: mdPath,
        })
      )

      yield* Console.log(`
ALIGNMENT DIMENSIONS:
  Shape:       ${parsed.dimensions.shape || "(not specified)"}
  Composition: ${parsed.dimensions.composition || "(not specified)"}
  API:         ${parsed.dimensions.api || "(not specified)"}
  Scope:       ${parsed.dimensions.scope || "(not specified)"}

NEXT STEPS:
  1. Review: cat ${mdPath}
  2. Next round: bun run cap-persist.ts --topic "${topic}" --round ${round + 1}
  3. Confirm: bun run cap-persist.ts --topic "${topic}" --round ${round} --confirmed

SKILL: ${CAP_SKILLS.alignment.name}
`)
    })
)

// =============================================================================
// RUN
// =============================================================================

const program = Effect.gen(function* () {
  const cli = Command.run(capPersistCommand, { name: "cap-persist", version: "1.0.0" })
  yield* cli(process.argv)
})

const AppLayer = Layer.mergeAll(NodeContext.layer)

const errorHandler = createErrorHandler({})

program.pipe(Effect.catchAll(errorHandler), Effect.provide(AppLayer), NodeRuntime.runMain)
