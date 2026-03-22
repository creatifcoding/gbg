#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * SQL Migration Generator
 *
 * Generates timestamped SQL migration files with UP/DOWN sections.
 *
 * Usage:
 *   bun run tools/generate-migration.ts -- --name "add-conveyor-table"
 *   bun run tools/generate-migration.ts -- --name "add-conveyor-table" --dry-run
 *   bun run tools/generate-migration.ts -- --name "add-conveyor-table" --schema "Conveyor"
 *
 * Options:
 *   --name       Migration name in kebab-case (required)
 *   --schema     Entity schema name to generate CREATE TABLE for (optional)
 *   --prefix     ID prefix for the entity (optional, used with --schema)
 *   --dry-run    Print without writing
 *
 * @module tools/generate-migration
 */

import { parseArgs } from 'util'

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    name: { type: 'string' },
    schema: { type: 'string' },
    prefix: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
})

if (!values.name) {
  console.error('Error: --name is required')
  console.error('Usage: bun run tools/generate-migration.ts -- --name "add-conveyor-table"')
  process.exit(1)
}

const migrationName = values.name.replace(/\s+/g, '-').toLowerCase()
const schemaName = values.schema
const dryRun = values['dry-run'] ?? false

// Timestamp: YYYYMMDD_HHMMSS
const now = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

const fileName = `${timestamp}_${migrationName.replace(/-/g, '_')}.sql`
const BASE_DIR = new URL('../migrations', import.meta.url).pathname

// =============================================================================
// Migration Template
// =============================================================================

function generateMigration(): string {
  if (schemaName) {
    const tableName = schemaName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
    const prefix = (values.prefix ?? schemaName.slice(0, 3)).toUpperCase()

    return `-- Migration: ${migrationName}
-- Generated: ${now.toISOString()}
-- Entity: ${schemaName}

-- =============================================================================
-- UP
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${tableName}s (
  id          TEXT PRIMARY KEY,  -- Format: '${prefix}-{slug}'
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned', 'active', 'inactive', 'maintenance', 'decommissioned')),
  description TEXT,

  -- Hierarchy
  hierarchy_path  TEXT NOT NULL,
  enterprise_id   TEXT REFERENCES enterprises(id),
  site_id         TEXT REFERENCES sites(id),
  area_id         TEXT REFERENCES areas(id),
  plant_id        TEXT REFERENCES plants(id),
  line_id         TEXT REFERENCES lines(id),
  work_cell_id    TEXT REFERENCES work_cells(id),
  machine_id      TEXT REFERENCES machines(id),

  -- Location (JSON)
  location    JSONB,

  -- Metadata (extensible JSONB)
  metadata    JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_${tableName}s_status ON ${tableName}s(status);
CREATE INDEX IF NOT EXISTS idx_${tableName}s_hierarchy ON ${tableName}s(hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_${tableName}s_created ON ${tableName}s(created_at DESC);

-- =============================================================================
-- DOWN
-- =============================================================================

-- DROP INDEX IF EXISTS idx_${tableName}s_created;
-- DROP INDEX IF EXISTS idx_${tableName}s_hierarchy;
-- DROP INDEX IF EXISTS idx_${tableName}s_status;
-- DROP TABLE IF EXISTS ${tableName}s;
`
  }

  return `-- Migration: ${migrationName}
-- Generated: ${now.toISOString()}

-- =============================================================================
-- UP
-- =============================================================================

-- TODO: Add migration SQL here

-- =============================================================================
-- DOWN
-- =============================================================================

-- TODO: Add rollback SQL here
`
}

// =============================================================================
// Output
// =============================================================================

const content = generateMigration()
const filePath = `${BASE_DIR}/${fileName}`

console.log(`\n  Migration Generator`)
console.log(`  ===================`)
console.log(`  Name:   ${migrationName}`)
console.log(`  File:   migrations/${fileName}`)
if (schemaName) console.log(`  Schema: ${schemaName}`)
console.log(`  Mode:   ${dryRun ? 'DRY RUN' : 'WRITE'}`)
console.log()

if (dryRun) {
  console.log(content)
} else {
  await Bun.spawn(['mkdir', '-p', BASE_DIR]).exited
  await Bun.write(filePath, content)
  console.log(`  WRITE migrations/${fileName}`)
  console.log()
}
