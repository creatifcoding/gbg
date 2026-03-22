---
title: "CLI Tool Reference"
date: 2026-02-09
status: Active
source: tools/generate-entity.ts, tools/generate-model.ts, tools/generate-migration.ts, tools/validate-schema.ts
---

# CLI Tool Reference

Four generator CLIs in `tools/` support the IIoT entity development workflow. All are Bun scripts using `parseArgs` from `util`.

## generate-entity

Generates a complete IIoT entity from a name. Creates 5 files following canonical patterns.

```bash
bun run tools/generate-entity.ts -- --name "Conveyor" --level 2
bun run tools/generate-entity.ts -- --name "Conveyor" --level 2 --dry-run
bun run tools/generate-entity.ts -- --name "Conveyor" --level 2 --prefix "CVR"
```

### Options

| Flag | Required | Default | Description |
|------|:--------:|---------|-------------|
| `--name` | Yes | -- | Entity name in PascalCase (e.g., "Conveyor") |
| `--level` | No | `1` | ISA-95 automation level (0-4) |
| `--prefix` | No | First 3 uppercase letters | ID prefix (e.g., "CVR") |
| `--dry-run` | No | `false` | Print generated code without writing files |
| `--force` | No | `false` | Overwrite existing files |

### Generated Files

| File | Location | Purpose |
|------|----------|---------|
| `schema.ts` | `schemas/assets/{kebab-name}/` | Effect Schema TaggedClass with branded ID |
| `index.ts` | `schemas/assets/{kebab-name}/` | Barrel export |
| `{Name}Entity.ts` | `entity/` | Effect Cluster Entity with RPC handlers |
| `{Name}State.ts` | `state/` | In-memory State service (Ref-based) |
| `{Name}Rpcs.ts` | `rpc/` | RPC definitions for the entity |

### Name Derivation

From input `--name "Conveyor" --prefix "CVR"`:

| Derived Name | Value | Used In |
|-------------|-------|---------|
| `pascalName` | `Conveyor` | Class names, exports |
| `camelName` | `conveyor` | Variable names |
| `snakeName` | `conveyor` | SQL table names |
| `kebabName` | `conveyor` | Directory names |
| `upperPrefix` | `CVR` | ID format: `CVR-{slug}` |

---

## generate-model

Generates a Model definition and SQL CREATE TABLE DDL from a schema name.

```bash
bun run tools/generate-model.ts -- --schema "Conveyor"
bun run tools/generate-model.ts -- --schema "Conveyor" --prefix "CVR" --dry-run
```

### Options

| Flag | Required | Default | Description |
|------|:--------:|---------|-------------|
| `--schema` | Yes | -- | Schema name in PascalCase |
| `--prefix` | No | First 3 uppercase letters | ID prefix |
| `--dry-run` | No | `false` | Print without writing |

### Generated Files

| File | Location | Purpose |
|------|----------|---------|
| `{Name}Model.ts` | `models/assets/` | `@effect/sql` Model mapping domain fields to columns |
| `{Name}Model.ddl.ts` | `models/assets/` | Effect-wrapped SQL CREATE TABLE statement |

### Model Field Mappings

The generator maps domain schema fields to SQL columns:

| Domain Field | SQL Column | Type |
|-------------|-----------|------|
| `id` | `id` | `TEXT PRIMARY KEY` |
| `name` | `name` | `TEXT NOT NULL` |
| `status` | `status` | `TEXT NOT NULL` with CHECK constraint |
| `location` | `location` | `JSONB` |
| `metadata` | `metadata` | `JSONB NOT NULL DEFAULT '{}'` |
| `hierarchyPath` | `hierarchy_path` | `TEXT NOT NULL` |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ` |

---

## generate-migration

Generates timestamped SQL migration files with UP/DOWN sections.

```bash
bun run tools/generate-migration.ts -- --name "add-conveyor-table"
bun run tools/generate-migration.ts -- --name "add-conveyor-table" --schema "Conveyor"
bun run tools/generate-migration.ts -- --name "add-conveyor-table" --dry-run
```

### Options

| Flag | Required | Default | Description |
|------|:--------:|---------|-------------|
| `--name` | Yes | -- | Migration name in kebab-case |
| `--schema` | No | -- | Entity schema name for CREATE TABLE generation |
| `--prefix` | No | First 3 uppercase letters | ID prefix (used with `--schema`) |
| `--dry-run` | No | `false` | Print without writing |

### Output

File name format: `{YYYYMMDD_HHMMSS}_{migration_name}.sql`

Example: `20260209_143022_add_conveyor_table.sql`

Output directory: `migrations/`

### Template Features

When `--schema` is provided, the migration includes:
- `CREATE TABLE` with standard asset columns
- `CHECK` constraint for valid status values
- Foreign key references to parent entity tables
- Indexes on `status` and hierarchy path
- `DOWN` section with `DROP TABLE IF EXISTS`

When `--schema` is omitted, a blank UP/DOWN template is generated.

---

## validate-schema

Validates all IIoT asset schemas by attempting decode/encode roundtrips.

```bash
bun run tools/validate-schema.ts
bun run tools/validate-schema.ts -- --verbose
bun run tools/validate-schema.ts -- --schema site
```

### Options

| Flag | Required | Default | Description |
|------|:--------:|---------|-------------|
| `--verbose` | No | `false` | Show detailed output for each schema |
| `--schema` | No | -- | Validate only a specific schema (by folder name) |

### What It Validates

1. **Discovery** -- Scans `src/lib/iiot/schemas/assets/*/schema.ts` using Bun's `Glob`
2. **Import** -- Dynamically imports each schema module
3. **Export analysis** -- Identifies Schema-like exports (checking for `_tag`, `pipe`, TaggedClass prototype)
4. **Roundtrip** -- Attempts encode/decode roundtrip on the main entity class

### Output

```
  Schema Validator
  ================
  Base: src/lib/iiot/schemas/assets/
  Found: 9 schemas

  ✅ area        — 4 schema exports
  ✅ device      — 5 schema exports
  ✅ enterprise  — 3 schema exports
  ...
```

---

## Common Patterns

### Dry-Run First

All generators support `--dry-run`. Use it to preview generated code before writing:

```bash
bun run tools/generate-entity.ts -- --name "Conveyor" --level 2 --dry-run | less
```

### Workflow

Typical entity creation workflow:

```bash
# 1. Generate entity scaffolding
bun run tools/generate-entity.ts -- --name "Conveyor" --level 2

# 2. Generate persistence model + DDL
bun run tools/generate-model.ts -- --schema "Conveyor"

# 3. Generate migration
bun run tools/generate-migration.ts -- --name "add-conveyor-table" --schema "Conveyor"

# 4. Validate all schemas
bun run tools/validate-schema.ts -- --verbose
```

## Related Documents

- [Entity System Specification](../specifications/entity-system.md)
- [ADR-004: Entity System Architecture](../decisions/adr-004-entity-system-architecture.md)
- [ISA-95 Equipment Hierarchy](../references/isa95-hierarchy.md)
- Source: `tools/generate-entity.ts` (843 lines)
- Source: `tools/generate-model.ts`
- Source: `tools/generate-migration.ts`
- Source: `tools/validate-schema.ts`
