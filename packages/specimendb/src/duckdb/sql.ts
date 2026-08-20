/**
 * DuckDB SQL the specimen repo actually sends.
 * The memory binding matches these strings. VAL can swap the driver
 * without changing the statements.
 */
export const SQL = {
  createSpecimens: `
CREATE TABLE IF NOT EXISTS specimens (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  example BOOLEAN NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
)`,
  createComponents: `
CREATE TABLE IF NOT EXISTS components (
  specimen_id TEXT NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (specimen_id, name)
)`,
  createEvents: `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  payload TEXT NOT NULL
)`,
  insertSpecimen: `
INSERT INTO specimens (id, kind, status, example, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)`,
  updateSpecimen: `
UPDATE specimens
SET kind = ?, status = ?, example = ?, created_at = ?, updated_at = ?
WHERE id = ?`,
  deleteComponents: `DELETE FROM components WHERE specimen_id = ?`,
  insertComponent: `
INSERT INTO components (specimen_id, name, payload)
VALUES (?, ?, ?)`,
  insertEvent: `
INSERT INTO events (id, type, entity_id, occurred_at, payload)
VALUES (?, ?, ?, ?, ?)`,
  selectSpecimen: `SELECT id, kind, status, example, created_at, updated_at FROM specimens WHERE id = ?`,
  selectSpecimens: `SELECT id, kind, status, example, created_at, updated_at FROM specimens ORDER BY created_at DESC, id DESC`,
  selectComponents: `SELECT name, payload FROM components WHERE specimen_id = ?`,
  selectIds: `SELECT id FROM specimens`,
} as const

export type SqlStatement = (typeof SQL)[keyof typeof SQL]
