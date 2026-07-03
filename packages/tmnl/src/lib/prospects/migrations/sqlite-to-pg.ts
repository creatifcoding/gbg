/**
 * SQLite → PostgreSQL Migration
 *
 * Reads all records from the dev SQLite database and inserts them
 * into PostgreSQL via direct SQL. Not through cluster RPCs — this is
 * a bulk data migration, not a workflow. Provenance is tracked for
 * every company field.
 *
 * Usage:
 *   bun run src/lib/prospects/migrations/sqlite-to-pg.ts
 *
 * @module prospects/migrations/sqlite-to-pg
 */

import { Database } from 'bun:sqlite'
import { Effect, Layer } from 'effect'
import { SqlClient } from '@effect/sql'
import { BunRuntime } from '@effect/platform-bun'
import { ProspectPgLayer } from '../models/pg-layer'

const SQLITE_PATH = new URL('../data/prospects.db', import.meta.url).pathname

const migrate = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const db = new Database(SQLITE_PATH, { readonly: true })

  // ─── Companies ────────────────────────────────────────────────────
  const companies = db.query('SELECT * FROM companies').all() as any[]
  yield* Effect.logInfo(`[Migration] ${companies.length} companies to migrate`)

  let coCreated = 0, coSkipped = 0
  for (const c of companies) {
    const exists = yield* sql`SELECT 1 FROM prospects.companies WHERE slug = ${c.slug} LIMIT 1`
    if (exists.length > 0) { coSkipped++; continue }

    yield* sql`
      INSERT INTO prospects.companies (
        id, name, slug, industry, sub_industry, location_json, size,
        headcount_json, revenue_json, website, linkedin_url, description,
        capabilities_json, harvest_source, harvest_date, harvest_batch_id,
        pipeline_stage, tags_json, notes, created_at, updated_at
      ) VALUES (
        ${c.id}, ${c.name}, ${c.slug}, ${c.industry}, ${c.sub_industry},
        ${c.location_json}, ${c.size ?? 'unknown'},
        ${c.headcount_json}, ${c.revenue_json},
        ${c.website}, ${c.linkedin_url}, ${c.description},
        ${c.capabilities_json}, ${c.harvest_source},
        ${c.harvest_date ?? new Date().toISOString()},
        ${c.harvest_batch_id}, ${c.pipeline_stage ?? 'harvested'},
        ${c.tags_json}, ${c.notes},
        ${c.created_at ?? new Date().toISOString()},
        ${c.updated_at ?? new Date().toISOString()}
      )
    `

    // Provenance for key fields
    const now = new Date().toISOString()
    const src = JSON.stringify({ connector: c.harvest_source, migration: 'sqlite-to-pg' })
    for (const [field, value, conf] of [
      ['name', c.name, 1.0],
      ['industry', c.industry, 0.5],
      ['size', c.size, 0.4],
    ] as const) {
      if (!value) continue
      yield* sql`
        INSERT INTO prospects.field_provenance (
          entity_type, entity_id, field_name, value,
          source_json, confidence, first_seen_at, last_updated_at
        ) VALUES (
          'company', ${c.id}, ${field}, ${value},
          ${src}, ${conf}, ${now}, ${now}
        ) ON CONFLICT (entity_type, entity_id, field_name) DO NOTHING
      `
    }
    coCreated++
  }
  yield* Effect.logInfo(`[Migration] Companies: ${coCreated} created, ${coSkipped} skipped (dupes)`)

  // ─── Signals ──────────────────────────────────────────────────────
  const signals = db.query('SELECT * FROM signals').all() as any[]
  yield* Effect.logInfo(`[Migration] ${signals.length} signals to migrate`)

  let sigCreated = 0, sigSkipped = 0
  for (const s of signals) {
    const exists = yield* sql`SELECT 1 FROM prospects.signals WHERE id = ${s.id} LIMIT 1`
    if (exists.length > 0) { sigSkipped++; continue }

    // Verify company exists in PG
    const coExists = yield* sql`SELECT 1 FROM prospects.companies WHERE id = ${s.company_id} LIMIT 1`
    if (coExists.length === 0) { sigSkipped++; continue }

    yield* sql`
      INSERT INTO prospects.signals (
        id, company_id, decision_maker_id, signal_type, title,
        description, source_url, weight, detected_at, expires_at,
        raw, created_at
      ) VALUES (
        ${s.id}, ${s.company_id}, ${s.decision_maker_id},
        ${s.signal_type}, ${s.title}, ${s.description},
        ${s.source_url}, ${s.weight ?? 1},
        ${s.detected_at ?? new Date().toISOString()},
        ${s.expires_at},
        ${s.raw}, ${s.created_at ?? new Date().toISOString()}
      )
    `
    sigCreated++
  }
  yield* Effect.logInfo(`[Migration] Signals: ${sigCreated} created, ${sigSkipped} skipped`)

  // ─── Decision Makers ──────────────────────────────────────────────
  const dms = db.query('SELECT * FROM decision_makers').all() as any[]
  yield* Effect.logInfo(`[Migration] ${dms.length} decision makers to migrate`)

  let dmCreated = 0, dmSkipped = 0
  for (const d of dms) {
    const exists = yield* sql`SELECT 1 FROM prospects.decision_makers WHERE id = ${d.id} LIMIT 1`
    if (exists.length > 0) { dmSkipped++; continue }

    const coExists = yield* sql`SELECT 1 FROM prospects.companies WHERE id = ${d.company_id} LIMIT 1`
    if (coExists.length === 0) { dmSkipped++; continue }

    yield* sql`
      INSERT INTO prospects.decision_makers (
        id, name, title, title_level, company_id,
        contacts_json, tenure_json, contract_estimate_json,
        cip_capital, cip_interest, cip_power, cip_composite,
        pipeline_stage, notes, created_at, updated_at
      ) VALUES (
        ${d.id}, ${d.name}, ${d.title}, ${d.title_level ?? 'unknown'},
        ${d.company_id}, ${d.contacts_json}, ${d.tenure_json},
        ${d.contract_estimate_json},
        ${d.cip_capital ?? 0}, ${d.cip_interest ?? 0},
        ${d.cip_power ?? 0}, ${d.cip_composite ?? 0},
        ${d.pipeline_stage ?? 'harvested'}, ${d.notes},
        ${d.created_at ?? new Date().toISOString()},
        ${d.updated_at ?? new Date().toISOString()}
      )
    `

    // Provenance for DM data fields
    const now = new Date().toISOString()
    const src = JSON.stringify({ connector: 'manual', migration: 'sqlite-to-pg' })
    for (const [field, value] of [['name', d.name], ['title', d.title]] as const) {
      if (!value) continue
      yield* sql`
        INSERT INTO prospects.field_provenance (
          entity_type, entity_id, field_name, value,
          source_json, confidence, first_seen_at, last_updated_at
        ) VALUES (
          'decision_maker', ${d.id}, ${field}, ${value},
          ${src}, 0.9, ${now}, ${now}
        ) ON CONFLICT (entity_type, entity_id, field_name) DO NOTHING
      `
    }
    dmCreated++
  }
  yield* Effect.logInfo(`[Migration] Decision Makers: ${dmCreated} created, ${dmSkipped} skipped`)

  // ─── Final counts ─────────────────────────────────────────────────
  const counts = yield* Effect.all({
    co: sql`SELECT COUNT(*) as n FROM prospects.companies`,
    sig: sql`SELECT COUNT(*) as n FROM prospects.signals`,
    dm: sql`SELECT COUNT(*) as n FROM prospects.decision_makers`,
    prov: sql`SELECT COUNT(*) as n FROM prospects.field_provenance`,
  })

  yield* Effect.logInfo(
    `[Migration] Complete — PG totals: ` +
    `${(counts.co[0] as any).n} companies, ` +
    `${(counts.sig[0] as any).n} signals, ` +
    `${(counts.dm[0] as any).n} DMs, ` +
    `${(counts.prov[0] as any).n} provenance entries`
  )

  db.close()
})

migrate.pipe(
  Effect.provide(ProspectPgLayer()),
  Effect.tapErrorCause(Effect.logError),
  BunRuntime.runMain,
)
