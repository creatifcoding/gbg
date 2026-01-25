#!/usr/bin/env bun
/**
 * Research Session CLI
 *
 * CRUD operations for research sessions using @effect/cli + @effect/sql-sqlite-bun.
 * Tracks grounded research with uncertainty markers and source verification.
 *
 * Storage: ~/.tmnl/research-sessions.db (SQLite)
 *
 * Commands:
 *   rs create <topic> [--confidence <level>]
 *   rs read <id>
 *   rs update <id> [--status <status>] [--finding <text>] [--confidence <level>]
 *   rs delete <id> [--force]
 *   rs list [--status <status>] [--confidence <level>]
 *   rs search <query>
 *   rs export [--format json|md]
 *   rs add-source <id> <type> <location> [--verified]
 *
 * Error messages are designed to guide agents toward correct usage.
 */

import { Args, Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { FileSystem } from "@effect/platform"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { SqlClient } from "@effect/sql"
import {
  Console,
  Data,
  Effect,
  Layer,
  Option,
  pipe,
  Schema,
} from "effect"

// =============================================================================
// DOMAIN SCHEMAS (Effect Schema)
// =============================================================================

export const ConfidenceLevel = Schema.Literal(
  "uncertain",
  "cutoff-gap",
  "inferred",
  "verified-deepwiki",
  "verified-submodule",
  "verified-codebase",
  "verified-multi"
)
export type ConfidenceLevel = typeof ConfidenceLevel.Type

export const ResearchStatus = Schema.Literal(
  "open",
  "in-progress",
  "verified",
  "abandoned",
  "superseded"
)
export type ResearchStatus = typeof ResearchStatus.Type

export const SourceType = Schema.Literal(
  "deepwiki",
  "submodule",
  "websearch",
  "codebase",
  "other"
)
export type SourceType = typeof SourceType.Type

// Database row schemas
const SessionRow = Schema.Struct({
  id: Schema.String,
  topic: Schema.String,
  status: Schema.String,
  confidence: Schema.String,
  finding: Schema.NullOr(Schema.String),
  uncertainty_admission: Schema.NullOr(Schema.String),
  tags: Schema.NullOr(Schema.String),
  created_at: Schema.String,
  updated_at: Schema.String,
})

const SourceRow = Schema.Struct({
  id: Schema.Number,
  session_id: Schema.String,
  type: Schema.String,
  location: Schema.String,
  verified: Schema.Number,
  notes: Schema.NullOr(Schema.String),
  created_at: Schema.String,
})

// =============================================================================
// AGENT-GUIDING ERRORS
// =============================================================================

export class SessionNotFoundError extends Data.TaggedError("SessionNotFoundError")<{
  readonly id: string
  readonly suggestion: string
}> {
  override get message() {
    return `[SESSION_NOT_FOUND] Session '${this.id}' does not exist.

AGENT GUIDANCE:
  ${this.suggestion}

RECOVERY OPTIONS:
  1. List available sessions: rs list
  2. Search by topic: rs search "<keyword>"
  3. Create new session: rs create "<topic>"
`
  }
}

export class InvalidConfidenceError extends Data.TaggedError("InvalidConfidenceError")<{
  readonly provided: string
  readonly validLevels: readonly string[]
}> {
  override get message() {
    return `[INVALID_CONFIDENCE] '${this.provided}' is not a valid confidence level.

AGENT GUIDANCE:
  Use the grounded-research protocol confidence ladder:

  VALID LEVELS (ascending confidence):
    ${this.validLevels.map((l, i) => `${i + 1}. ${l}`).join("\n    ")}

EXAMPLE:
  rs create "Effect.Match API" --confidence uncertain
  rs update rs-123 --confidence verified-deepwiki
`
  }
}

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly operation: string
  readonly cause: unknown
}> {
  override get message() {
    return `[STORAGE_ERROR] Database operation '${this.operation}' failed.

AGENT GUIDANCE:
  CHECK:
    1. Database exists: ~/.tmnl/research-sessions.db
    2. Directory writable: ~/.tmnl/
    3. SQLite available in environment

RECOVERY:
  The CLI auto-initializes the database on first run.
  If issues persist, delete ~/.tmnl/research-sessions.db and retry.

CAUSE: ${String(this.cause)}
`
  }
}

export class DuplicateTopicError extends Data.TaggedError("DuplicateTopicError")<{
  readonly topic: string
  readonly existingId: string
}> {
  override get message() {
    return `[DUPLICATE_TOPIC] A session for '${this.topic}' already exists.

AGENT GUIDANCE:
  EXISTING SESSION: ${this.existingId}

OPTIONS:
  1. Update existing: rs update ${this.existingId} --finding "new info"
  2. View existing: rs read ${this.existingId}
  3. Create anyway with different topic wording
  4. Mark existing as superseded: rs update ${this.existingId} --status superseded
`
  }
}

export class DeletionRequiresForceError extends Data.TaggedError("DeletionRequiresForceError")<{
  readonly id: string
  readonly status: string
}> {
  override get message() {
    return `[DELETION_BLOCKED] Cannot delete session '${this.id}' (status: ${this.status}).

AGENT GUIDANCE:
  Sessions with status 'verified' or 'in-progress' require --force flag.
  This prevents accidental deletion of valuable research.

OPTIONS:
  1. Force delete: rs delete ${this.id} --force
  2. Mark as abandoned: rs update ${this.id} --status abandoned
  3. Export first: rs export --format md > backup.md
`
  }
}

// =============================================================================
// DATABASE LAYER
// =============================================================================

const DB_PATH = `${process.env.HOME ?? "~"}/.tmnl/research-sessions.db`

const SqliteLive = SqliteClient.layer({
  filename: DB_PATH,
})

const ensureDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const dir = `${process.env.HOME ?? "~"}/.tmnl`
  yield* fs.makeDirectory(dir, { recursive: true }).pipe(
    Effect.catchAll(() => Effect.void)
  )
})

const initializeSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Sessions table
  yield* sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      confidence TEXT NOT NULL DEFAULT 'uncertain',
      finding TEXT,
      uncertainty_admission TEXT,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `

  // Sources table
  yield* sql`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `

  // Indexes for common queries
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sessions_confidence ON sessions(confidence)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sources_session ON sources(session_id)`
})

// =============================================================================
// REPOSITORY FUNCTIONS
// =============================================================================

const generateId = () => `rs-${Date.now()}`
const now = () => new Date().toISOString()

const findSessionById = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`SELECT * FROM sessions WHERE id = ${id}`

    if (rows.length === 0) {
      return yield* Effect.fail(
        new SessionNotFoundError({ id, suggestion: "Try: rs list" })
      )
    }

    return yield* Schema.decodeUnknown(SessionRow)(rows[0])
  })

const findSessionByTopic = (topic: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`
      SELECT * FROM sessions
      WHERE LOWER(topic) = LOWER(${topic})
      LIMIT 1
    `
    return rows.length > 0
      ? Option.some(yield* Schema.decodeUnknown(SessionRow)(rows[0]))
      : Option.none()
  })

const getSourcesForSession = (sessionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`
      SELECT * FROM sources WHERE session_id = ${sessionId}
    `
    return yield* Effect.all(
      rows.map((r) => Schema.decodeUnknown(SourceRow)(r))
    )
  })

// =============================================================================
// CLI OPTIONS & ARGS
// =============================================================================

const VALID_CONFIDENCE_LEVELS = [
  "uncertain",
  "cutoff-gap",
  "inferred",
  "verified-deepwiki",
  "verified-submodule",
  "verified-codebase",
  "verified-multi",
] as const

const VALID_STATUSES = [
  "open",
  "in-progress",
  "verified",
  "abandoned",
  "superseded",
] as const

const VALID_SOURCE_TYPES = [
  "deepwiki",
  "submodule",
  "websearch",
  "codebase",
  "other",
] as const

const confidenceOption = Options.choice("confidence", VALID_CONFIDENCE_LEVELS).pipe(
  Options.withAlias("c"),
  Options.optional,
  Options.withDescription("Confidence level (grounded-research protocol)")
)

const statusOption = Options.choice("status", VALID_STATUSES).pipe(
  Options.withAlias("s"),
  Options.optional,
  Options.withDescription("Session status")
)

const forceOption = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDefault(false),
  Options.withDescription("Force operation")
)

const formatOption = Options.choice("format", ["json", "md"] as const).pipe(
  Options.withDefault("json" as const),
  Options.withDescription("Export format")
)

const verifiedOption = Options.boolean("verified").pipe(
  Options.withAlias("v"),
  Options.withDefault(false),
  Options.withDescription("Mark source as verified")
)

// =============================================================================
// COMMANDS
// =============================================================================

// --- CREATE ---
const createCommand = Command.make(
  "create",
  {
    topic: Args.text({ name: "topic" }),
    confidence: confidenceOption,
    uncertainty: Options.text("uncertainty").pipe(
      Options.withAlias("u"),
      Options.optional
    ),
    tags: Options.text("tags").pipe(Options.withAlias("t"), Options.optional),
  },
  ({ topic, confidence, uncertainty, tags }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      // Check duplicate
      const existing = yield* findSessionByTopic(topic)
      if (Option.isSome(existing)) {
        return yield* Effect.fail(
          new DuplicateTopicError({ topic, existingId: existing.value.id })
        )
      }

      const id = generateId()
      const timestamp = now()
      const conf = Option.getOrElse(confidence, () => "uncertain" as const)
      const unc = Option.getOrUndefined(uncertainty)
      const tagStr = Option.map(tags, (t) => t).pipe(Option.getOrUndefined)

      yield* sql`
        INSERT INTO sessions (id, topic, status, confidence, uncertainty_admission, tags, created_at, updated_at)
        VALUES (${id}, ${topic}, 'open', ${conf}, ${unc ?? null}, ${tagStr ?? null}, ${timestamp}, ${timestamp})
      `

      yield* Console.log(`
[SESSION_CREATED] Research session created.

  ID:         ${id}
  Topic:      ${topic}
  Status:     open
  Confidence: ${conf}

NEXT STEPS (grounded-research protocol):
  1. Admit uncertainty: rs update ${id} --uncertainty "I believe X but need to verify"
  2. Query deepwiki: mcp__deepwiki__ask_question
  3. Add source: rs add-source ${id} deepwiki "Effect-TS/effect"
  4. Record finding: rs update ${id} --finding "Verified: ..."
  5. Set confidence: rs update ${id} --confidence verified-multi
`)
    })
)

// --- READ ---
const readCommand = Command.make(
  "read",
  { id: Args.text({ name: "id" }) },
  ({ id }) =>
    Effect.gen(function* () {
      const session = yield* findSessionById(id)
      const sources = yield* getSourcesForSession(id)

      const sourcesDisplay =
        sources.length === 0
          ? "  (none yet — use: rs add-source)"
          : sources
              .map(
                (s) =>
                  `  [${s.verified ? "x" : " "}] ${s.type}: ${s.location}${s.notes ? ` — ${s.notes}` : ""}`
              )
              .join("\n")

      yield* Console.log(`
[SESSION: ${session.id}]
${"─".repeat(60)}

  Topic:        ${session.topic}
  Status:       ${session.status}
  Confidence:   ${session.confidence}
  Created:      ${session.created_at}
  Updated:      ${session.updated_at}

UNCERTAINTY ADMISSION:
  ${session.uncertainty_admission ?? "(not stated — be epistemically honest!)"}

SOURCES CONSULTED:
${sourcesDisplay}

FINDING:
  ${session.finding ?? "(research in progress)"}

TAGS: ${session.tags ?? "(none)"}
${"─".repeat(60)}
`)
    })
)

// --- UPDATE ---
const updateCommand = Command.make(
  "update",
  {
    id: Args.text({ name: "id" }),
    status: statusOption,
    confidence: confidenceOption,
    finding: Options.text("finding").pipe(Options.optional),
    uncertainty: Options.text("uncertainty").pipe(Options.optional),
  },
  ({ id, status, confidence, finding, uncertainty }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const session = yield* findSessionById(id)
      const timestamp = now()

      const newStatus = Option.getOrElse(status, () => session.status as typeof VALID_STATUSES[number])
      const newConf = Option.getOrElse(confidence, () => session.confidence as typeof VALID_CONFIDENCE_LEVELS[number])
      const newFinding = Option.getOrElse(finding, () => session.finding)
      const newUncertainty = Option.getOrElse(uncertainty, () => session.uncertainty_admission)

      yield* sql`
        UPDATE sessions
        SET status = ${newStatus},
            confidence = ${newConf},
            finding = ${newFinding ?? null},
            uncertainty_admission = ${newUncertainty ?? null},
            updated_at = ${timestamp}
        WHERE id = ${id}
      `

      yield* Console.log(`
[SESSION_UPDATED] ${id}

  Status:     ${session.status} → ${newStatus}
  Confidence: ${session.confidence} → ${newConf}
  Finding:    ${newFinding ?? "(not set)"}

${
  newStatus === "verified"
    ? `RESEARCH COMPLETE!
  Export: rs export --format md`
    : `CONTINUE RESEARCH:
  Add source: rs add-source ${id} deepwiki "Effect-TS/effect"
  Set finding: rs update ${id} --finding "..."`
}
`)
    })
)

// --- DELETE ---
const deleteCommand = Command.make(
  "delete",
  {
    id: Args.text({ name: "id" }),
    force: forceOption,
  },
  ({ id, force }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const session = yield* findSessionById(id)

      if (!force && (session.status === "verified" || session.status === "in-progress")) {
        return yield* Effect.fail(
          new DeletionRequiresForceError({ id, status: session.status })
        )
      }

      yield* sql`DELETE FROM sessions WHERE id = ${id}`

      yield* Console.log(`
[SESSION_DELETED] ${id}

  Topic:  ${session.topic}
  Status: ${session.status} (was)

Deleted permanently from database.
`)
    })
)

// --- LIST ---
const listCommand = Command.make(
  "list",
  {
    status: statusOption,
    confidence: confidenceOption,
    limit: Options.integer("limit").pipe(
      Options.withAlias("n"),
      Options.withDefault(20)
    ),
  },
  ({ status, confidence, limit }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      // Build query dynamically
      const statusFilter = Option.isSome(status) ? status.value : null
      const confFilter = Option.isSome(confidence) ? confidence.value : null

      const rows = yield* sql`
        SELECT id, topic, status, confidence, created_at
        FROM sessions
        WHERE (${statusFilter} IS NULL OR status = ${statusFilter})
          AND (${confFilter} IS NULL OR confidence = ${confFilter})
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `

      if (rows.length === 0) {
        yield* Console.log(`
[NO_SESSIONS] No research sessions found.

AGENT GUIDANCE:
  Create: rs create "<topic>" --confidence uncertain
  List all: rs list
`)
        return
      }

      yield* Console.log(`
[RESEARCH_SESSIONS] ${rows.length} session(s)
${"─".repeat(90)}
  ${"ID".padEnd(16)} ${"STATUS".padEnd(14)} ${"CONFIDENCE".padEnd(20)} TOPIC
${"─".repeat(90)}`)

      for (const row of rows) {
        const r = row as { id: string; topic: string; status: string; confidence: string }
        yield* Console.log(
          `  ${r.id.padEnd(16)} ${r.status.padEnd(14)} ${r.confidence.padEnd(20)} ${r.topic.slice(0, 35)}${r.topic.length > 35 ? "..." : ""}`
        )
      }

      yield* Console.log(`${"─".repeat(90)}
  View: rs read <id>    Update: rs update <id>    Filter: rs list --status open
`)
    })
)

// --- SEARCH ---
const searchCommand = Command.make(
  "search",
  { query: Args.text({ name: "query" }) },
  ({ query }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const pattern = `%${query}%`

      const rows = yield* sql`
        SELECT id, topic, status, confidence
        FROM sessions
        WHERE topic LIKE ${pattern} OR finding LIKE ${pattern} OR tags LIKE ${pattern}
        ORDER BY updated_at DESC
        LIMIT 20
      `

      if (rows.length === 0) {
        yield* Console.log(`
[NO_MATCHES] No sessions match '${query}'.

AGENT GUIDANCE:
  Broader search: rs search "<keyword>"
  List all: rs list
  Create new: rs create "${query}"
`)
        return
      }

      yield* Console.log(`
[SEARCH: "${query}"] ${rows.length} match(es)
${"─".repeat(70)}`)

      for (const row of rows) {
        const r = row as { id: string; topic: string; status: string; confidence: string }
        yield* Console.log(`  ${r.id}  [${r.status}]  ${r.topic}`)
      }

      yield* Console.log(`${"─".repeat(70)}
  View details: rs read <id>
`)
    })
)

// --- ADD-SOURCE ---
const sourceTypeOption = Options.choice("type", VALID_SOURCE_TYPES).pipe(
  Options.withAlias("t"),
  Options.withDescription("Source type: deepwiki, submodule, websearch, codebase, other")
)

const addSourceCommand = Command.make(
  "add-source",
  {
    sessionId: Args.text({ name: "session-id" }),
    location: Args.text({ name: "location" }),
    sourceType: sourceTypeOption,
    verified: verifiedOption,
    notes: Options.text("notes").pipe(Options.optional),
  },
  ({ sessionId, sourceType, location, verified, notes }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      // Verify session exists
      yield* findSessionById(sessionId)

      const timestamp = now()
      const notesVal = Option.getOrUndefined(notes)

      yield* sql`
        INSERT INTO sources (session_id, type, location, verified, notes, created_at)
        VALUES (${sessionId}, ${sourceType}, ${location}, ${verified ? 1 : 0}, ${notesVal ?? null}, ${timestamp})
      `

      yield* Console.log(`
[SOURCE_ADDED] to ${sessionId}

  Type:     ${sourceType}
  Location: ${location}
  Verified: ${verified ? "Yes" : "No (use --verified to mark)"}
  Notes:    ${notesVal ?? "(none)"}

GROUNDED-RESEARCH CHECKLIST:
  [ ] Queried deepwiki with verification question
  [ ] Cross-referenced with submodules
  [ ] Checked codebase precedent
  [ ] Updated confidence level

Mark verified: rs add-source ${sessionId} ${sourceType} "${location}" --verified
Update confidence: rs update ${sessionId} --confidence verified-${sourceType === "deepwiki" ? "deepwiki" : sourceType === "submodule" ? "submodule" : "codebase"}
`)
    })
)

// --- EXPORT ---
const exportCommand = Command.make(
  "export",
  { format: formatOption },
  ({ format }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const sessions = yield* sql`SELECT * FROM sessions ORDER BY created_at DESC`

      if (format === "json") {
        const fullSessions = yield* Effect.all(
          sessions.map((s) =>
            Effect.gen(function* () {
              const sources = yield* sql`SELECT * FROM sources WHERE session_id = ${(s as { id: string }).id}`
              return { ...s, sources }
            })
          )
        )
        yield* Console.log(JSON.stringify(fullSessions, null, 2))
      } else {
        // Markdown
        yield* Console.log(`# Research Sessions Export

Generated: ${now()}
Total: ${sessions.length} sessions

---
`)
        for (const s of sessions) {
          const session = s as {
            id: string
            topic: string
            status: string
            confidence: string
            finding: string | null
            uncertainty_admission: string | null
            created_at: string
          }
          const sources = yield* sql`SELECT * FROM sources WHERE session_id = ${session.id}`

          yield* Console.log(`## ${session.topic}

**ID**: \`${session.id}\`
**Status**: ${session.status}
**Confidence**: ${session.confidence}
**Created**: ${session.created_at}

### Uncertainty Admission
${session.uncertainty_admission ?? "_Not stated_"}

### Sources Consulted
${sources.length === 0 ? "_None_" : sources.map((src) => {
  const source = src as { type: string; location: string; verified: number; notes: string | null }
  return `- [${source.verified ? "x" : " "}] **${source.type}**: ${source.location}${source.notes ? ` — ${source.notes}` : ""}`
}).join("\n")}

### Finding
${session.finding ?? "_Research in progress_"}

---
`)
        }
      }
    })
)

// =============================================================================
// MAIN COMMAND
// =============================================================================

const mainCommand = Command.make("rs", {}, () =>
  Console.log(`
Research Session CLI (SQLite-backed)
${"═".repeat(50)}

COMMANDS:
  rs create <topic>                    Create session
  rs read <id>                         View session
  rs update <id> [options]             Update session
  rs delete <id> [--force]             Delete session
  rs list [--status X] [--confidence Y] List sessions
  rs search <query>                    Search sessions
  rs add-source <id> <type> <loc>      Add research source
  rs export [--format json|md]         Export all

SOURCE TYPES: deepwiki, submodule, websearch, codebase, other

CONFIDENCE LEVELS (ascending):
  1. uncertain        — Need to research
  2. cutoff-gap       — May have changed since knowledge cutoff
  3. inferred         — Based on patterns, unverified
  4. verified-deepwiki — Confirmed via deepwiki
  5. verified-submodule — Confirmed via canonical source
  6. verified-codebase — Confirmed via local precedent
  7. verified-multi   — Multiple sources agree

EXAMPLES:
  rs create "Effect.Match API" --confidence cutoff-gap
  rs add-source rs-123 deepwiki "Effect-TS/effect" --verified
  rs update rs-123 --finding "Match.type().pipe(...)" --confidence verified-multi
  rs list --status open
  rs export --format md > research-log.md

DATABASE: ~/.tmnl/research-sessions.db
`)
).pipe(
  Command.withSubcommands([
    createCommand,
    readCommand,
    updateCommand,
    deleteCommand,
    listCommand,
    searchCommand,
    addSourceCommand,
    exportCommand,
  ])
)

// =============================================================================
// RUN
// =============================================================================

const program = Effect.gen(function* () {
  yield* ensureDirectory
  yield* initializeSchema

  const args = process.argv.slice(2)
  const cli = Command.run(mainCommand, { name: "rs", version: "1.0.0" })
  yield* cli(["rs", ...args])
})

const AppLayer = Layer.mergeAll(
  NodeContext.layer,
  SqliteLive
)

const handleError = (e: unknown): Effect.Effect<void> => {
  const msg = e instanceof Error ? e.message : String(e)
  return Console.error(msg)
}

pipe(
  program,
  Effect.catchAll(handleError),
  Effect.provide(AppLayer),
  NodeRuntime.runMain
)
