#!/usr/bin/env bun
/**
 * Research Session CLI - Built with @gbg/ctl
 *
 * Demonstrates @gbg/ctl patterns:
 * - Command patterns from core module
 * - TaggedErrors from messaging module
 * - SQLite persistence from persistence module
 * - XDG paths from config module
 * - Skill references in error messages
 *
 * @skill cli/core
 */

import {
  // Core
  Args,
  Command,
  Options,
  NodeContext,
  NodeRuntime,
  // Messaging
  NotFoundError,
  InvalidInputError,
  StorageError,
  createErrorHandler,
  formatTable,
  formatSuccess,
  CTL_SKILLS,
  skillRef,
  // Persistence
  createSqliteLayer,
  ensureTable,
  SqlClient,
  XDG,
  // Services
  Effect,
  Console,
  Layer,
  Option,
  // Config
  Schema,
} from "@gbg/ctl"

// =============================================================================
// DOMAIN SCHEMAS
// =============================================================================

const ConfidenceLevel = Schema.Literal(
  "uncertain",
  "cutoff-gap",
  "inferred",
  "verified-deepwiki",
  "verified-submodule",
  "verified-codebase",
  "verified-multi"
)
type ConfidenceLevel = typeof ConfidenceLevel.Type

const ResearchStatus = Schema.Literal(
  "open",
  "in-progress",
  "verified",
  "abandoned",
  "superseded"
)
type ResearchStatus = typeof ResearchStatus.Type

const SourceType = Schema.Literal("deepwiki", "submodule", "websearch", "codebase", "other")
type SourceType = typeof SourceType.Type

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
// SKILL REFERENCES
// =============================================================================

const RS_SKILLS = {
  core: skillRef("rs/core", "research sessions", ".claude/skills/rs/core/SKILL.md"),
  grounded: skillRef("grounded-research", "grounded research protocol"),
}

// =============================================================================
// PERSISTENCE
// =============================================================================

const DB_PATH = `${XDG.data}/rs/research-sessions.db`

const SqliteLive = createSqliteLayer({ filename: DB_PATH })

const SESSIONS_TABLE = {
  name: "sessions",
  columns: `
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    confidence TEXT NOT NULL DEFAULT 'uncertain',
    finding TEXT,
    uncertainty_admission TEXT,
    tags TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_confidence ON sessions(confidence)",
  ],
}

const SOURCES_TABLE = {
  name: "sources",
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  `,
  indexes: ["CREATE INDEX IF NOT EXISTS idx_sources_session ON sources(session_id)"],
}

const initDb = Effect.gen(function* () {
  yield* ensureTable(SESSIONS_TABLE)
  yield* ensureTable(SOURCES_TABLE)
})

// =============================================================================
// REPOSITORY
// =============================================================================

const generateId = () => `rs-${Date.now()}`
const now = () => new Date().toISOString()

const findSessionById = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`SELECT * FROM sessions WHERE id = ${id}`

    if (rows.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          resource: "session",
          id,
          suggestion: "Use 'rs list' to see available sessions",
          skills: [RS_SKILLS.core],
        })
      )
    }

    return yield* Schema.decodeUnknown(SessionRow)(rows[0])
  })

const findSessionByTopic = (topic: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`
      SELECT * FROM sessions WHERE LOWER(topic) = LOWER(${topic}) LIMIT 1
    `
    return rows.length > 0
      ? Option.some(yield* Schema.decodeUnknown(SessionRow)(rows[0]))
      : Option.none()
  })

const getSourcesForSession = (sessionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`SELECT * FROM sources WHERE session_id = ${sessionId}`
    return yield* Effect.all(rows.map((r) => Schema.decodeUnknown(SourceRow)(r)))
  })

// =============================================================================
// OPTIONS
// =============================================================================

const CONFIDENCE_LEVELS = [
  "uncertain",
  "cutoff-gap",
  "inferred",
  "verified-deepwiki",
  "verified-submodule",
  "verified-codebase",
  "verified-multi",
] as const

const STATUSES = ["open", "in-progress", "verified", "abandoned", "superseded"] as const

const SOURCE_TYPES = ["deepwiki", "submodule", "websearch", "codebase", "other"] as const

const confidenceOption = Options.choice("confidence", CONFIDENCE_LEVELS).pipe(
  Options.withAlias("c"),
  Options.optional,
  Options.withDescription("Confidence level")
)

const statusOption = Options.choice("status", STATUSES).pipe(
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

// =============================================================================
// COMMANDS
// =============================================================================

const createCommand = Command.make(
  "create",
  {
    topic: Args.text({ name: "topic" }),
    confidence: confidenceOption,
    uncertainty: Options.text("uncertainty").pipe(Options.withAlias("u"), Options.optional),
    tags: Options.text("tags").pipe(Options.withAlias("t"), Options.optional),
  },
  ({ topic, confidence, uncertainty, tags }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const existing = yield* findSessionByTopic(topic)
      if (Option.isSome(existing)) {
        return yield* Effect.fail(
          new InvalidInputError({
            field: "topic",
            value: topic,
            reason: `Session already exists: ${existing.value.id}`,
            suggestion: `Use 'rs update ${existing.value.id}' to modify`,
            skills: [RS_SKILLS.core],
          })
        )
      }

      const id = generateId()
      const timestamp = now()
      const conf = Option.getOrElse(confidence, () => "uncertain" as const)
      const unc = Option.getOrUndefined(uncertainty)
      const tagStr = Option.getOrUndefined(tags)

      yield* sql`
        INSERT INTO sessions (id, topic, status, confidence, uncertainty_admission, tags, created_at, updated_at)
        VALUES (${id}, ${topic}, 'open', ${conf}, ${unc ?? null}, ${tagStr ?? null}, ${timestamp}, ${timestamp})
      `

      yield* Console.log(
        formatSuccess("SESSION_CREATED", `Research session ${id} created`, {
          id,
          topic,
          status: "open",
          confidence: conf,
        })
      )

      yield* Console.log(`
NEXT STEPS (grounded-research protocol):
  1. rs update ${id} --uncertainty "I believe X but need to verify"
  2. Query deepwiki: mcp__deepwiki__ask_question
  3. rs add-source ${id} --type deepwiki "Effect-TS/effect"
  4. rs update ${id} --finding "Verified: ..."
  5. rs update ${id} --confidence verified-multi

SKILL: ${RS_SKILLS.grounded.name}
  Trigger: "${RS_SKILLS.grounded.trigger}"
`)
    })
)

const readCommand = Command.make("read", { id: Args.text({ name: "id" }) }, ({ id }) =>
  Effect.gen(function* () {
    const session = yield* findSessionById(id)
    const sources = yield* getSourcesForSession(id)

    const sourcesDisplay =
      sources.length === 0
        ? "  (none yet - use: rs add-source)"
        : sources
            .map(
              (s) =>
                `  [${s.verified ? "x" : " "}] ${s.type}: ${s.location}${s.notes ? ` - ${s.notes}` : ""}`
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
  ${session.uncertainty_admission ?? "(not stated - be epistemically honest!)"}

SOURCES CONSULTED:
${sourcesDisplay}

FINDING:
  ${session.finding ?? "(research in progress)"}

TAGS: ${session.tags ?? "(none)"}
${"─".repeat(60)}
`)
  })
)

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

      const newStatus = Option.getOrElse(status, () => session.status as (typeof STATUSES)[number])
      const newConf = Option.getOrElse(
        confidence,
        () => session.confidence as (typeof CONFIDENCE_LEVELS)[number]
      )
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

      yield* Console.log(
        formatSuccess("SESSION_UPDATED", id, {
          status: `${session.status} -> ${newStatus}`,
          confidence: `${session.confidence} -> ${newConf}`,
          finding: newFinding ?? "(not set)",
        })
      )
    })
)

const deleteCommand = Command.make(
  "delete",
  { id: Args.text({ name: "id" }), force: forceOption },
  ({ id, force }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const session = yield* findSessionById(id)

      if (!force && (session.status === "verified" || session.status === "in-progress")) {
        return yield* Effect.fail(
          new InvalidInputError({
            field: "id",
            value: id,
            reason: `Session status '${session.status}' requires --force`,
            suggestion: "Use 'rs delete <id> --force' or change status first",
            skills: [RS_SKILLS.core],
          })
        )
      }

      yield* sql`DELETE FROM sessions WHERE id = ${id}`
      yield* Console.log(formatSuccess("SESSION_DELETED", id, { topic: session.topic }))
    })
)

const listCommand = Command.make(
  "list",
  {
    status: statusOption,
    confidence: confidenceOption,
    limit: Options.integer("limit").pipe(Options.withAlias("n"), Options.withDefault(20)),
  },
  ({ status, confidence, limit }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

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

SKILL: ${RS_SKILLS.core.name}
`)
        return
      }

      yield* Console.log(
        formatTable(
          rows.map((r) => ({
            ID: (r as { id: string }).id,
            Status: (r as { status: string }).status,
            Confidence: (r as { confidence: string }).confidence,
            Topic: (r as { topic: string }).topic.slice(0, 35),
          })),
          [
            { key: "ID", width: 16 },
            { key: "Status", width: 14 },
            { key: "Confidence", width: 20 },
            { key: "Topic", width: 35 },
          ]
        )
      )
    })
)

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
  Create new: rs create "${query}"

SKILL: ${RS_SKILLS.core.name}
`)
        return
      }

      yield* Console.log(`[SEARCH: "${query}"] ${rows.length} match(es)`)
      for (const row of rows) {
        const r = row as { id: string; topic: string; status: string }
        yield* Console.log(`  ${r.id}  [${r.status}]  ${r.topic}`)
      }
    })
)

const addSourceCommand = Command.make(
  "add-source",
  {
    sessionId: Args.text({ name: "session-id" }),
    location: Args.text({ name: "location" }),
    sourceType: Options.choice("type", SOURCE_TYPES).pipe(
      Options.withAlias("t"),
      Options.withDescription("Source type")
    ),
    verified: Options.boolean("verified").pipe(Options.withAlias("v"), Options.withDefault(false)),
    notes: Options.text("notes").pipe(Options.optional),
  },
  ({ sessionId, sourceType, location, verified, notes }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* findSessionById(sessionId)

      const timestamp = now()
      const notesVal = Option.getOrUndefined(notes)

      yield* sql`
        INSERT INTO sources (session_id, type, location, verified, notes, created_at)
        VALUES (${sessionId}, ${sourceType}, ${location}, ${verified ? 1 : 0}, ${notesVal ?? null}, ${timestamp})
      `

      yield* Console.log(
        formatSuccess("SOURCE_ADDED", `to ${sessionId}`, {
          type: sourceType,
          location,
          verified: verified ? "Yes" : "No",
        })
      )

      yield* Console.log(`
GROUNDED-RESEARCH CHECKLIST:
  [ ] Queried deepwiki with verification question
  [ ] Cross-referenced with submodules
  [ ] Checked codebase precedent
  [ ] Updated confidence level

SKILL: ${RS_SKILLS.grounded.name}
`)
    })
)

const exportCommand = Command.make("export", { format: formatOption }, ({ format }) =>
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
      yield* Console.log(`# Research Sessions Export\n\nGenerated: ${now()}\n`)
      for (const s of sessions) {
        const session = s as {
          id: string
          topic: string
          status: string
          confidence: string
          finding: string | null
        }
        yield* Console.log(`## ${session.topic}\n**ID**: ${session.id}\n**Status**: ${session.status}\n`)
      }
    }
  })
)

// =============================================================================
// MAIN COMMAND
// =============================================================================

const rsCommand = Command.make("rs", {}, () =>
  Console.log(`
Research Session CLI (Built with @gbg/ctl)
${"═".repeat(50)}

COMMANDS:
  rs create <topic>           Create session
  rs read <id>                View session
  rs update <id> [options]    Update session
  rs delete <id> [--force]    Delete session
  rs list [options]           List sessions
  rs search <query>           Search sessions
  rs add-source <id> <loc>    Add source
  rs export [--format]        Export all

CONFIDENCE LEVELS:
  1. uncertain         - Need to research
  2. cutoff-gap        - May have changed since cutoff
  3. inferred          - Based on patterns
  4. verified-deepwiki - Confirmed via deepwiki
  5. verified-submodule - Confirmed via source
  6. verified-codebase - Confirmed via local code
  7. verified-multi    - Multiple sources agree

SKILL: ${RS_SKILLS.grounded.name}
  Trigger: "${RS_SKILLS.grounded.trigger}"
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

import { FileSystem } from "@effect/platform"

const ensureDataDir = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const dir = `${XDG.data}/rs`
  yield* fs.makeDirectory(dir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void))
})

const program = Effect.gen(function* () {
  yield* ensureDataDir
  yield* initDb
  const cli = Command.run(rsCommand, { name: "rs", version: "1.0.0" })
  yield* cli(process.argv)
})

const AppLayer = Layer.mergeAll(NodeContext.layer, SqliteLive)

const errorHandler = createErrorHandler({
  verbose: false,
  skills: [RS_SKILLS.core, CTL_SKILLS.persistence],
})

program.pipe(Effect.catchAll(errorHandler), Effect.provide(AppLayer), NodeRuntime.runMain)
