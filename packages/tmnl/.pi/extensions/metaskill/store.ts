/**
 * RLM Persistent State — node:sqlite collections
 *
 * Persistent object store for the ms REPL. Objects survive across sessions,
 * enabling the RLM pattern: store findings in one session, retrieve in another.
 *
 * Collections are created implicitly on first store(). No upfront registration.
 * All operations are synchronous (node:sqlite DatabaseSync is sync).
 *
 * Storage location: .agents/rlm/store.db (WAL mode, git-tracked)
 *
 * Uses node:sqlite (Node 22.5+, experimental in Node 24).
 * Also works under Bun via compatibility shim (bun:sqlite if node:sqlite unavailable).
 *
 * @module
 */

import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── Runtime-adaptive SQLite import ──────────────────────────
//
// Pi runs under Node 24 which has node:sqlite (experimental).
// Bun has bun:sqlite. We try node:sqlite first, fall back to bun:sqlite.
// Both have sync APIs with nearly identical signatures.

let DatabaseImpl: any

try {
  // Node 24+
  const nodeSqlite = require('node:sqlite')
  DatabaseImpl = nodeSqlite.DatabaseSync
} catch {
  try {
    // Bun runtime
    const bunSqlite = require('bun:sqlite')
    DatabaseImpl = bunSqlite.Database
  } catch {
    // Neither available — store operations will throw on first use
    DatabaseImpl = null
  }
}

// ─── Types ───────────────────────────────────────────────────

export interface StoredObject {
  key: string
  data: any
  tags: string[]
  created: string
  updated: string
}

export interface CollectionInfo {
  name: string
  count: number
  updated: string
}

export interface VarInfo {
  collection: string
  key: string
  type: string
  size: number
  tags: string[]
  preview: string
  updated: string
}

export interface StoreAPI {
  store: (collection: string, key: string, data: any, tags?: string[]) => void
  get: (collection: string, key: string) => any | null
  query: (collection: string, filter?: Record<string, any>) => StoredObject[]
  keys: (collection: string) => string[]
  delete: (collection: string, key: string) => boolean
  collections: () => CollectionInfo[]
  clear: (collection: string) => number
  vars: () => VarInfo[]
  close: () => void
}

// ─── Schema ──────────────────────────────────────────────────

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS collections (
  name     TEXT PRIMARY KEY,
  created  TEXT NOT NULL DEFAULT (datetime('now')),
  updated  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS objects (
  collection TEXT NOT NULL,
  key        TEXT NOT NULL,
  data       TEXT NOT NULL,
  tags       TEXT NOT NULL DEFAULT '[]',
  created    TEXT NOT NULL DEFAULT (datetime('now')),
  updated    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (collection, key)
);

CREATE INDEX IF NOT EXISTS idx_objects_collection
  ON objects(collection);
`

// ─── Store Factory ───────────────────────────────────────────

export function openStore(cwd: string): StoreAPI {
  if (!DatabaseImpl) {
    throw new Error(
      'No SQLite runtime available. Requires Node 22.5+ (node:sqlite) or Bun (bun:sqlite).'
    )
  }

  const rlmDir = join(cwd, '.agents', 'rlm')
  const dbPath = join(rlmDir, 'store.db')

  // Auto-create directory
  if (!existsSync(rlmDir)) {
    mkdirSync(rlmDir, { recursive: true })
  }

  const db = new DatabaseImpl(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(MIGRATIONS)

  // ── Prepared statements ──────────────────────────────────

  const stmtUpsert = db.prepare(`
    INSERT INTO objects (collection, key, data, tags, created, updated)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(collection, key) DO UPDATE SET
      data = excluded.data,
      tags = excluded.tags,
      updated = datetime('now')
  `)

  const stmtEnsureCollection = db.prepare(`
    INSERT INTO collections (name) VALUES (?)
    ON CONFLICT(name) DO UPDATE SET updated = datetime('now')
  `)

  const stmtGet = db.prepare(`
    SELECT data, tags, created, updated FROM objects
    WHERE collection = ? AND key = ?
  `)

  const stmtKeys = db.prepare(`
    SELECT key FROM objects WHERE collection = ? ORDER BY key
  `)

  const stmtDelete = db.prepare(`
    DELETE FROM objects WHERE collection = ? AND key = ?
  `)

  const stmtClear = db.prepare(`
    DELETE FROM objects WHERE collection = ?
  `)

  const stmtDeleteCollection = db.prepare(`
    DELETE FROM collections WHERE name = ?
  `)

  const stmtCollections = db.prepare(`
    SELECT c.name,
           (SELECT COUNT(*) FROM objects o WHERE o.collection = c.name) as count,
           c.updated
    FROM collections c
    ORDER BY c.name
  `)

  const stmtAll = db.prepare(`
    SELECT collection, key, data, tags, updated FROM objects
    ORDER BY collection, key
  `)

  const stmtQueryAll = db.prepare(`
    SELECT key, data, tags, created, updated FROM objects
    WHERE collection = ?
    ORDER BY key
  `)

  // ── API ─────────────────────────────────────────────────

  function store(collection: string, key: string, data: any, tags?: string[]): void {
    const jsonData = JSON.stringify(data)
    const jsonTags = JSON.stringify(tags ?? [])
    stmtEnsureCollection.run(collection)
    stmtUpsert.run(collection, key, jsonData, jsonTags)
  }

  function get(collection: string, key: string): any | null {
    const row = stmtGet.get(collection, key) as any
    if (!row) return null
    return JSON.parse(row.data)
  }

  function query(collection: string, filter?: Record<string, any>): StoredObject[] {
    // No filter → return all
    if (!filter || Object.keys(filter).length === 0) {
      const rows = stmtQueryAll.all(collection) as any[]
      return rows.map(parseRow)
    }

    // Build dynamic query
    const conditions: string[] = ['collection = ?']
    const params: any[] = [collection]

    for (const [k, v] of Object.entries(filter)) {
      if (k === 'tags') {
        // Tag query: single string or array (AND logic)
        const tags = Array.isArray(v) ? v : [v]
        for (const tag of tags) {
          conditions.push(`EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)`)
          params.push(tag)
        }
      } else {
        // JSON path query: filter.field = value
        conditions.push(`json_extract(data, '$.' || ?) = ?`)
        params.push(k, typeof v === 'string' ? v : JSON.stringify(v))
      }
    }

    const sql = `SELECT key, data, tags, created, updated FROM objects WHERE ${conditions.join(' AND ')} ORDER BY key`
    const rows = db.prepare(sql).all(...params) as any[]
    return rows.map(parseRow)
  }

  function keys(collection: string): string[] {
    const rows = stmtKeys.all(collection) as any[]
    return rows.map(r => r.key)
  }

  function del(collection: string, key: string): boolean {
    const result = stmtDelete.run(collection, key)
    return result.changes > 0
  }

  function getCollections(): CollectionInfo[] {
    return stmtCollections.all() as CollectionInfo[]
  }

  function clear(collection: string): number {
    const result = stmtClear.run(collection)
    stmtDeleteCollection.run(collection)
    return result.changes
  }

  function vars(): VarInfo[] {
    const rows = stmtAll.all() as any[]
    return rows.map(r => {
      const data = JSON.parse(r.data)
      const json = r.data as string
      return {
        collection: r.collection,
        key: r.key,
        type: typeof data === 'object' && data !== null ? (Array.isArray(data) ? 'array' : 'object') : typeof data,
        size: json.length,
        tags: JSON.parse(r.tags),
        preview: json.length > 120 ? json.slice(0, 117) + '...' : json,
        updated: r.updated,
      }
    })
  }

  function close(): void {
    db.close()
  }

  return {
    store,
    get,
    query,
    keys,
    delete: del,
    collections: getCollections,
    clear,
    vars,
    close,
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function parseRow(row: any): StoredObject {
  return {
    key: row.key,
    data: JSON.parse(row.data),
    tags: JSON.parse(row.tags),
    created: row.created,
    updated: row.updated,
  }
}
