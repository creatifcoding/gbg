import * as fs from 'node:fs'
import * as path from 'node:path'
import { Database } from 'bun:sqlite'
import { Data, Effect, Schema } from 'effect'
import {
  AnnotationRecord,
  DiscoveryLedgerEntry,
  DiscoveryQueryFilter,
  DiscoveryQueryResult,
  DiscoveredPatternEvent,
  MergeConflictFilter,
  MergeConflictQueryResult,
  MergeConflictRecord,
  MergeDecisionRecord,
  MergeRunRecord,
  Pattern,
  PatternSearchFilter,
} from '../schema.ts'

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS pattern_registry_patterns (
    pattern_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    pattern_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS pattern_registry_discoveries (
    event_id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    note TEXT,
    payload_json TEXT,
    discovered_at TEXT NOT NULL,
    FOREIGN KEY(pattern_id) REFERENCES pattern_registry_patterns(pattern_id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS pattern_registry_annotations (
    annotation_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    pattern_id TEXT NOT NULL,
    author TEXT NOT NULL,
    status TEXT NOT NULL,
    labels_json TEXT NOT NULL,
    annotation_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY(event_id) REFERENCES pattern_registry_discoveries(event_id) ON DELETE CASCADE,
    FOREIGN KEY(pattern_id) REFERENCES pattern_registry_patterns(pattern_id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS pattern_registry_merge_runs (
    run_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    dry_run INTEGER NOT NULL,
    total_groups INTEGER NOT NULL,
    merged_count INTEGER NOT NULL,
    conflict_count INTEGER NOT NULL,
    payload_json TEXT
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS pattern_registry_merge_decisions (
    decision_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    canonical_key TEXT NOT NULL,
    winner_pattern_id TEXT NOT NULL,
    merged_pattern_id TEXT NOT NULL,
    source_rank REAL NOT NULL,
    score REAL NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    payload_json TEXT,
    FOREIGN KEY(run_id) REFERENCES pattern_registry_merge_runs(run_id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS pattern_registry_merge_conflicts (
    conflict_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    canonical_key TEXT NOT NULL,
    winner_pattern_id TEXT NOT NULL,
    contender_pattern_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    payload_json TEXT,
    FOREIGN KEY(run_id) REFERENCES pattern_registry_merge_runs(run_id) ON DELETE CASCADE
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_pattern_registry_patterns_kind ON pattern_registry_patterns(kind);`,
  `CREATE INDEX IF NOT EXISTS idx_pattern_registry_patterns_lifecycle ON pattern_registry_patterns(lifecycle);`,
  `CREATE INDEX IF NOT EXISTS idx_pattern_registry_discoveries_pattern ON pattern_registry_discoveries(pattern_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pattern_registry_discoveries_discovered_at ON pattern_registry_discoveries(discovered_at);`,
  `CREATE INDEX IF NOT EXISTS idx_pattern_registry_annotations_event ON pattern_registry_annotations(event_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pattern_registry_merge_decisions_run ON pattern_registry_merge_decisions(run_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pattern_registry_merge_conflicts_run ON pattern_registry_merge_conflicts(run_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pattern_registry_merge_conflicts_status ON pattern_registry_merge_conflicts(status);`,
]

export class PatternRegistryStoreError extends Data.TaggedError('PatternRegistryStoreError')<{
  readonly message: string
  readonly operation: string
  readonly cause?: unknown
}> {}

const defaultDbPath = (): string => {
  const envPath = process.env.PATTERN_REGISTRY_DB_PATH
  if (envPath && envPath.trim().length > 0) return envPath
  return path.resolve(process.cwd(), '.pi/extensions/pattern-registry/state/pattern-registry.sqlite')
}

const parseJson = <A>(raw: string | null | undefined, fallback: A): A => {
  if (typeof raw !== 'string' || raw.length === 0) return fallback
  try {
    return JSON.parse(raw) as A
  } catch {
    return fallback
  }
}

const tryStore = <A>(operation: string, run: () => A): Effect.Effect<A, PatternRegistryStoreError> =>
  Effect.try({
    try: run,
    catch: (cause) => new PatternRegistryStoreError({
      message: `${operation} failed`,
      operation,
      cause,
    }),
  })

const decodePattern = Schema.decodeUnknownSync(Pattern)
const encodePattern = Schema.encodeUnknownSync(Pattern)
const decodeDiscovery = Schema.decodeUnknownSync(DiscoveredPatternEvent)
const encodeDiscovery = Schema.encodeUnknownSync(DiscoveredPatternEvent)
const decodeAnnotation = Schema.decodeUnknownSync(AnnotationRecord)
const encodeAnnotation = Schema.encodeUnknownSync(AnnotationRecord)
const decodePatternSearchFilter = Schema.decodeUnknownSync(PatternSearchFilter)
const decodeDiscoveryQueryFilter = Schema.decodeUnknownSync(DiscoveryQueryFilter)
const decodeMergeRunRecord = Schema.decodeUnknownSync(MergeRunRecord)
const encodeMergeRunRecord = Schema.encodeUnknownSync(MergeRunRecord)
const decodeMergeDecisionRecord = Schema.decodeUnknownSync(MergeDecisionRecord)
const encodeMergeDecisionRecord = Schema.encodeUnknownSync(MergeDecisionRecord)
const decodeMergeConflictRecord = Schema.decodeUnknownSync(MergeConflictRecord)
const encodeMergeConflictRecord = Schema.encodeUnknownSync(MergeConflictRecord)
const decodeMergeConflictFilter = Schema.decodeUnknownSync(MergeConflictFilter)

const hasAllTags = (actual: ReadonlyArray<string>, requested: ReadonlyArray<string>): boolean =>
  requested.every((tag) => actual.includes(tag))

export interface PatternRegistryStoreApi {
  readonly migrate: Effect.Effect<void, PatternRegistryStoreError>
  readonly upsertPattern: (pattern: Pattern) => Effect.Effect<void, PatternRegistryStoreError>
  readonly getPattern: (patternId: string) => Effect.Effect<Pattern | null, PatternRegistryStoreError>
  readonly listAllPatterns: Effect.Effect<ReadonlyArray<Pattern>, PatternRegistryStoreError>
  readonly searchPatterns: (filter: PatternSearchFilter) => Effect.Effect<{
    readonly patterns: ReadonlyArray<Pattern>
    readonly total: number
    readonly limit: number
    readonly offset: number
    readonly hasMore: boolean
  }, PatternRegistryStoreError>
  readonly logDiscoveryEvent: (event: DiscoveredPatternEvent) => Effect.Effect<void, PatternRegistryStoreError>
  readonly listDiscoveryEvents: Effect.Effect<ReadonlyArray<DiscoveredPatternEvent>, PatternRegistryStoreError>
  readonly addAnnotation: (annotation: AnnotationRecord) => Effect.Effect<void, PatternRegistryStoreError>
  readonly queryDiscoveries: (filter: DiscoveryQueryFilter) => Effect.Effect<DiscoveryQueryResult, PatternRegistryStoreError>
  readonly saveMergeRun: (run: MergeRunRecord) => Effect.Effect<void, PatternRegistryStoreError>
  readonly saveMergeDecision: (decision: MergeDecisionRecord) => Effect.Effect<void, PatternRegistryStoreError>
  readonly saveMergeConflict: (conflict: MergeConflictRecord) => Effect.Effect<void, PatternRegistryStoreError>
  readonly listMergeConflicts: (filter: MergeConflictFilter) => Effect.Effect<MergeConflictQueryResult, PatternRegistryStoreError>
}

export class PatternRegistryStore extends Effect.Service<PatternRegistryStore>()(
  'pattern-registry/PatternRegistryStore',
  {
    scoped: Effect.gen(function* () {
      const dbPath = defaultDbPath()

      const db = yield* Effect.acquireRelease(
        Effect.sync(() => {
          fs.mkdirSync(path.dirname(dbPath), { recursive: true })
          const sqlite = new Database(dbPath)
          sqlite.exec('PRAGMA foreign_keys = ON;')
          return sqlite
        }),
        (sqlite) => Effect.sync(() => sqlite.close()),
      )

      const migrate = tryStore('migrate', () => {
        for (const statement of MIGRATIONS) db.exec(statement)
      })

      const upsertPattern = (pattern: Pattern) => tryStore('upsertPattern', () => {
        const decoded = decodePattern(pattern)
        const now = new Date().toISOString()
        const encoded = encodePattern(decoded)
        const tags = JSON.stringify(decoded.tags)
        const patternJson = JSON.stringify(encoded)

        const existing = db
          .prepare('SELECT created_at FROM pattern_registry_patterns WHERE pattern_id = ?')
          .get(decoded.patternId) as { created_at?: string } | undefined

        const createdAt = existing?.created_at ?? decoded.createdAt ?? now

        db.prepare(
          `
          INSERT INTO pattern_registry_patterns (
            pattern_id, kind, title, summary, lifecycle, tags_json, pattern_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(pattern_id) DO UPDATE SET
            kind = excluded.kind,
            title = excluded.title,
            summary = excluded.summary,
            lifecycle = excluded.lifecycle,
            tags_json = excluded.tags_json,
            pattern_json = excluded.pattern_json,
            updated_at = excluded.updated_at
          `,
        ).run(
          decoded.patternId,
          decoded.kind,
          decoded.title,
          decoded.summary,
          decoded.lifecycle,
          tags,
          patternJson,
          createdAt,
          now,
        )
      })

      const getPattern = (patternId: string) => tryStore('getPattern', () => {
        const row = db
          .prepare('SELECT pattern_json FROM pattern_registry_patterns WHERE pattern_id = ? LIMIT 1')
          .get(patternId) as { pattern_json?: string } | undefined

        if (!row?.pattern_json) return null
        return decodePattern(parseJson(row.pattern_json, {}))
      })

      const listAllPatterns = tryStore('listAllPatterns', () => {
        const rows = db
          .prepare('SELECT pattern_json FROM pattern_registry_patterns ORDER BY updated_at DESC')
          .all() as Array<{ pattern_json: string }>

        return rows.map((row) => decodePattern(parseJson(row.pattern_json, {})))
      })

      const searchPatterns = (filter: PatternSearchFilter) => tryStore('searchPatterns', () => {
        const f = decodePatternSearchFilter(filter)
        const where: string[] = []
        const params: Array<any> = []

        if (f.kind) {
          where.push('kind = ?')
          params.push(f.kind)
        }

        if (f.lifecycle) {
          where.push('lifecycle = ?')
          params.push(f.lifecycle)
        }

        if (f.query && f.query.trim().length > 0) {
          where.push('(title LIKE ? OR summary LIKE ? OR pattern_json LIKE ?)')
          const q = `%${f.query.trim()}%`
          params.push(q, q, q)
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
        const rows = db
          .prepare(`SELECT pattern_json, tags_json FROM pattern_registry_patterns ${whereSql} ORDER BY updated_at DESC`)
          .all(...params) as Array<{ pattern_json: string; tags_json: string }>

        let patterns = rows
          .map((row) => decodePattern(parseJson(row.pattern_json, {})))

        if (f.tags && f.tags.length > 0) {
          patterns = patterns.filter((pattern) => hasAllTags(pattern.tags, f.tags))
        }

        const total = patterns.length
        const start = Math.max(0, f.offset)
        const end = start + Math.max(0, f.limit)
        const paged = patterns.slice(start, end)

        return {
          patterns: paged,
          total,
          limit: f.limit,
          offset: f.offset,
          hasMore: end < total,
        }
      })

      const logDiscoveryEvent = (event: DiscoveredPatternEvent) => tryStore('logDiscoveryEvent', () => {
        const decoded = decodeDiscovery(event)
        const encoded = encodeDiscovery(decoded)

        db.prepare(
          `
          INSERT INTO pattern_registry_discoveries (
            event_id, pattern_id, metadata_json, tags_json, note, payload_json, discovered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(event_id) DO UPDATE SET
            pattern_id = excluded.pattern_id,
            metadata_json = excluded.metadata_json,
            tags_json = excluded.tags_json,
            note = excluded.note,
            payload_json = excluded.payload_json,
            discovered_at = excluded.discovered_at
          `,
        ).run(
          decoded.eventId,
          decoded.patternId,
          JSON.stringify(decoded.metadata),
          JSON.stringify(decoded.tags),
          decoded.note ?? null,
          decoded.payload === undefined ? null : JSON.stringify(decoded.payload),
          decoded.metadata.discoveredAt,
        )

        // keep full payload for replay fidelity
        db.prepare(
          `
          UPDATE pattern_registry_discoveries
          SET payload_json = COALESCE(payload_json, ?)
          WHERE event_id = ?
          `,
        ).run(JSON.stringify(encoded.payload ?? null), decoded.eventId)
      })

      const listDiscoveryEvents = tryStore('listDiscoveryEvents', () => {
        const rows = db
          .prepare('SELECT event_id, pattern_id, metadata_json, tags_json, note, payload_json FROM pattern_registry_discoveries ORDER BY discovered_at DESC')
          .all() as Array<{
            event_id: string
            pattern_id: string
            metadata_json: string
            tags_json: string
            note: string | null
            payload_json: string | null
          }>

        return rows.map((row) => decodeDiscovery({
          eventId: row.event_id,
          patternId: row.pattern_id,
          metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
          tags: parseJson<ReadonlyArray<string>>(row.tags_json, []),
          note: row.note ?? undefined,
          payload: parseJson<unknown>(row.payload_json, undefined),
        }))
      })

      const addAnnotation = (annotation: AnnotationRecord) => tryStore('addAnnotation', () => {
        const decoded = decodeAnnotation(annotation)
        const encoded = encodeAnnotation(decoded)

        db.prepare(
          `
          INSERT INTO pattern_registry_annotations (
            annotation_id, event_id, pattern_id, author, status, labels_json, annotation_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(annotation_id) DO UPDATE SET
            event_id = excluded.event_id,
            pattern_id = excluded.pattern_id,
            author = excluded.author,
            status = excluded.status,
            labels_json = excluded.labels_json,
            annotation_json = excluded.annotation_json,
            updated_at = excluded.updated_at
          `,
        ).run(
          decoded.annotationId,
          decoded.eventId,
          decoded.patternId,
          decoded.author,
          decoded.status,
          JSON.stringify(decoded.labels),
          JSON.stringify(encoded),
          decoded.createdAt,
          decoded.updatedAt ?? null,
        )
      })

      const queryDiscoveries = (filter: DiscoveryQueryFilter) => tryStore('queryDiscoveries', () => {
        const f = decodeDiscoveryQueryFilter(filter)

        const rows = db
          .prepare('SELECT event_id, pattern_id, metadata_json, tags_json, note, payload_json FROM pattern_registry_discoveries ORDER BY discovered_at DESC')
          .all() as Array<{
            event_id: string
            pattern_id: string
            metadata_json: string
            tags_json: string
            note: string | null
            payload_json: string | null
          }>

        const events = rows
          .map((row) => {
            const metadata = parseJson<Record<string, unknown>>(row.metadata_json, {})
            const tags = parseJson<ReadonlyArray<string>>(row.tags_json, [])
            const payload = parseJson<unknown>(row.payload_json, undefined)

            return decodeDiscovery({
              eventId: row.event_id,
              patternId: row.pattern_id,
              metadata,
              tags,
              note: row.note ?? undefined,
              payload,
            })
          })
          .filter((event) => {
            if (f.patternId && event.patternId !== f.patternId) return false
            if (f.sourceType && event.metadata.sourceType !== f.sourceType) return false
            if (f.author && event.metadata.discoveredBy !== f.author) return false
            if (f.tags && f.tags.length > 0 && !hasAllTags(event.tags, f.tags)) return false
            if (f.minConfidence !== undefined && event.metadata.confidence < f.minConfidence) return false
            if (f.maxConfidence !== undefined && event.metadata.confidence > f.maxConfidence) return false
            if (f.dateFrom && event.metadata.discoveredAt < f.dateFrom) return false
            if (f.dateTo && event.metadata.discoveredAt > f.dateTo) return false
            return true
          })

        const total = events.length
        const start = Math.max(0, f.offset)
        const end = start + Math.max(0, f.limit)

        const entries: Array<DiscoveryLedgerEntry> = events.slice(start, end).map((event) => {
          const annotationRows = db
            .prepare('SELECT annotation_json FROM pattern_registry_annotations WHERE event_id = ? ORDER BY created_at ASC')
            .all(event.eventId) as Array<{ annotation_json: string }>

          const annotations = annotationRows.map((row) => decodeAnnotation(parseJson(row.annotation_json, {})))
          return new DiscoveryLedgerEntry({
            event,
            annotations,
          })
        })

        return new DiscoveryQueryResult({
          entries,
          total,
          limit: f.limit,
          offset: f.offset,
          hasMore: end < total,
        })
      })

      const saveMergeRun = (run: MergeRunRecord) => tryStore('saveMergeRun', () => {
        const decoded = decodeMergeRunRecord(run)
        const encoded = encodeMergeRunRecord(decoded)

        db.prepare(
          `
          INSERT INTO pattern_registry_merge_runs (
            run_id, created_at, dry_run, total_groups, merged_count, conflict_count, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(run_id) DO UPDATE SET
            created_at = excluded.created_at,
            dry_run = excluded.dry_run,
            total_groups = excluded.total_groups,
            merged_count = excluded.merged_count,
            conflict_count = excluded.conflict_count,
            payload_json = excluded.payload_json
          `,
        ).run(
          decoded.runId,
          decoded.createdAt,
          decoded.dryRun ? 1 : 0,
          decoded.totalGroups,
          decoded.mergedCount,
          decoded.conflictCount,
          encoded.payload === undefined ? null : JSON.stringify(encoded.payload),
        )
      })

      const saveMergeDecision = (decision: MergeDecisionRecord) => tryStore('saveMergeDecision', () => {
        const decoded = decodeMergeDecisionRecord(decision)
        const encoded = encodeMergeDecisionRecord(decoded)

        db.prepare(
          `
          INSERT INTO pattern_registry_merge_decisions (
            decision_id, run_id, canonical_key, winner_pattern_id, merged_pattern_id, source_rank, score, reason, created_at, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(decision_id) DO UPDATE SET
            run_id = excluded.run_id,
            canonical_key = excluded.canonical_key,
            winner_pattern_id = excluded.winner_pattern_id,
            merged_pattern_id = excluded.merged_pattern_id,
            source_rank = excluded.source_rank,
            score = excluded.score,
            reason = excluded.reason,
            created_at = excluded.created_at,
            payload_json = excluded.payload_json
          `,
        ).run(
          decoded.decisionId,
          decoded.runId,
          decoded.canonicalKey,
          decoded.winnerPatternId,
          decoded.mergedPatternId,
          decoded.sourceRank,
          decoded.score,
          decoded.reason,
          decoded.createdAt,
          encoded.payload === undefined ? null : JSON.stringify(encoded.payload),
        )
      })

      const saveMergeConflict = (conflict: MergeConflictRecord) => tryStore('saveMergeConflict', () => {
        const decoded = decodeMergeConflictRecord(conflict)
        const encoded = encodeMergeConflictRecord(decoded)

        db.prepare(
          `
          INSERT INTO pattern_registry_merge_conflicts (
            conflict_id, run_id, canonical_key, winner_pattern_id, contender_pattern_id, reason, status, created_at, resolved_at, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(conflict_id) DO UPDATE SET
            run_id = excluded.run_id,
            canonical_key = excluded.canonical_key,
            winner_pattern_id = excluded.winner_pattern_id,
            contender_pattern_id = excluded.contender_pattern_id,
            reason = excluded.reason,
            status = excluded.status,
            created_at = excluded.created_at,
            resolved_at = excluded.resolved_at,
            payload_json = excluded.payload_json
          `,
        ).run(
          decoded.conflictId,
          decoded.runId,
          decoded.canonicalKey,
          decoded.winnerPatternId,
          decoded.contenderPatternId,
          decoded.reason,
          decoded.status,
          decoded.createdAt,
          decoded.resolvedAt ?? null,
          encoded.payload === undefined ? null : JSON.stringify(encoded.payload),
        )
      })

      const listMergeConflicts = (filter: MergeConflictFilter) => tryStore('listMergeConflicts', () => {
        const f = decodeMergeConflictFilter(filter)
        const rows = db
          .prepare('SELECT conflict_id, run_id, canonical_key, winner_pattern_id, contender_pattern_id, reason, status, created_at, resolved_at, payload_json FROM pattern_registry_merge_conflicts ORDER BY created_at DESC')
          .all() as Array<{
            conflict_id: string
            run_id: string
            canonical_key: string
            winner_pattern_id: string
            contender_pattern_id: string
            reason: string
            status: string
            created_at: string
            resolved_at: string | null
            payload_json: string | null
          }>

        const conflicts = rows
          .map((row) => decodeMergeConflictRecord({
            conflictId: row.conflict_id,
            runId: row.run_id,
            canonicalKey: row.canonical_key,
            winnerPatternId: row.winner_pattern_id,
            contenderPatternId: row.contender_pattern_id,
            reason: row.reason,
            status: row.status,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at ?? undefined,
            payload: parseJson<unknown>(row.payload_json, undefined),
          }))
          .filter((conflict) => {
            if (f.status && conflict.status !== f.status) return false
            if (f.runId && conflict.runId !== f.runId) return false
            if (f.canonicalKey && conflict.canonicalKey !== f.canonicalKey) return false
            return true
          })

        const total = conflicts.length
        const start = Math.max(0, f.offset)
        const end = start + Math.max(0, f.limit)

        return new MergeConflictQueryResult({
          conflicts: conflicts.slice(start, end),
          total,
          limit: f.limit,
          offset: f.offset,
          hasMore: end < total,
        })
      })

      // Ensure migration run for every scoped instantiation
      yield* migrate

      const api: PatternRegistryStoreApi = {
        migrate,
        upsertPattern,
        getPattern,
        listAllPatterns,
        searchPatterns,
        logDiscoveryEvent,
        listDiscoveryEvents,
        addAnnotation,
        queryDiscoveries,
        saveMergeRun,
        saveMergeDecision,
        saveMergeConflict,
        listMergeConflicts,
      }

      return api
    }),
  },
) {}
