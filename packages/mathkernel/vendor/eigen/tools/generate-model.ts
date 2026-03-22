#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * Model + DDL Generator
 *
 * Generates a Model definition and SQL CREATE TABLE from a schema name.
 *
 * Usage:
 *   bun run tools/generate-model.ts -- --schema "Conveyor"
 *   bun run tools/generate-model.ts -- --schema "Conveyor" --prefix "CVR" --dry-run
 *
 * Options:
 *   --schema     Schema name in PascalCase (required)
 *   --prefix     ID prefix (default: first 3 uppercase letters)
 *   --dry-run    Print without writing
 *
 * @module tools/generate-model
 */

import { parseArgs } from 'util'

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    schema: { type: 'string' },
    prefix: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
})

if (!values.schema) {
  console.error('Error: --schema is required')
  console.error('Usage: bun run tools/generate-model.ts -- --schema "Conveyor"')
  process.exit(1)
}

const schemaName = values.schema
const pascalName = schemaName.charAt(0).toUpperCase() + schemaName.slice(1)
const snakeName = schemaName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
const kebabName = schemaName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
const prefix = (values.prefix ?? schemaName.slice(0, 3)).toUpperCase()
const dryRun = values['dry-run'] ?? false

const BASE_DIR = new URL('../src/lib/iiot', import.meta.url).pathname

// =============================================================================
// Model Template
// =============================================================================

function generateModel(): string {
  return `/**
 * ${pascalName} Model
 *
 * Maps ${pascalName} schema to database columns via @effect/sql Model.
 *
 * @module
 */

import { Model } from '@effect/sql'
import { Schema } from 'effect'
import { ${pascalName} } from '../schemas/assets/${kebabName}'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * ${pascalName} SQL Model
 *
 * Maps domain schema fields to database column names.
 * Uses @effect/sql Model for type-safe SQL operations.
 */
export const ${pascalName}Model = Model.make(${pascalName}, {
  id: Model.field('id'),
  name: Model.field('name'),
  status: Model.field('status'),
  description: Model.field('description'),
  location: Model.fieldJson('location'),
  metadata: Model.fieldJson('metadata'),
  hierarchyPath: Model.fieldJson('hierarchy_path'),
  enterpriseId: Model.field('enterprise_id'),
  siteId: Model.field('site_id'),
  areaId: Model.field('area_id'),
  plantId: Model.field('plant_id'),
  lineId: Model.field('line_id'),
  workCellId: Model.field('work_cell_id'),
  machineId: Model.field('machine_id'),
  createdAt: Model.field('created_at'),
  updatedAt: Model.field('updated_at'),
})
`
}

// =============================================================================
// DDL Template
// =============================================================================

function generateDDL(): string {
  return `-- ${pascalName} Table DDL
-- Auto-generated from ${pascalName} schema
-- ID Format: '${prefix}-{slug}'

CREATE TABLE IF NOT EXISTS ${snakeName}s (
  -- Identity
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned', 'active', 'inactive', 'maintenance', 'decommissioned')),
  description   TEXT,

  -- ISA-95 Hierarchy
  hierarchy_path  JSONB NOT NULL,
  enterprise_id   TEXT,
  site_id         TEXT,
  area_id         TEXT,
  plant_id        TEXT,
  line_id         TEXT,
  work_cell_id    TEXT,
  machine_id      TEXT,

  -- Location & Metadata
  location        JSONB,
  metadata        JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_${snakeName}s_status ON ${snakeName}s(status);
CREATE INDEX IF NOT EXISTS idx_${snakeName}s_hierarchy ON ${snakeName}s USING GIN(hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_${snakeName}s_created ON ${snakeName}s(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_${snakeName}s_enterprise ON ${snakeName}s(enterprise_id) WHERE enterprise_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_${snakeName}s_site ON ${snakeName}s(site_id) WHERE site_id IS NOT NULL;
`
}

// =============================================================================
// Output
// =============================================================================

const modelContent = generateModel()
const ddlContent = generateDDL()

const modelPath = `${BASE_DIR}/models/${pascalName}Model.ts`
const ddlPath = `${BASE_DIR}/ddl/${snakeName}.sql`

console.log(`\n  Model + DDL Generator`)
console.log(`  =====================`)
console.log(`  Schema: ${pascalName}`)
console.log(`  Prefix: ${prefix}`)
console.log(`  Mode:   ${dryRun ? 'DRY RUN' : 'WRITE'}`)
console.log()

if (dryRun) {
  console.log(`--- Model: models/${pascalName}Model.ts ---`)
  console.log(modelContent)
  console.log(`--- DDL: ddl/${snakeName}.sql ---`)
  console.log(ddlContent)
} else {
  await Bun.spawn(['mkdir', '-p', `${BASE_DIR}/models`]).exited
  await Bun.spawn(['mkdir', '-p', `${BASE_DIR}/ddl`]).exited

  await Bun.write(modelPath, modelContent)
  console.log(`  WRITE models/${pascalName}Model.ts`)

  await Bun.write(ddlPath, ddlContent)
  console.log(`  WRITE ddl/${snakeName}.sql`)

  console.log()
  console.log(`  Next steps:`)
  console.log(`  1. Review Model field mappings against actual DB columns`)
  console.log(`  2. Run migration: bun run tools/generate-migration.ts -- --name "add-${kebabName}-table" --schema "${pascalName}"`)
  console.log()
}
