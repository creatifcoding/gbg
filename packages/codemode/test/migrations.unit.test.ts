/**
 * @module test/migrations.unit
 *
 * Tests for the Migrator.fromRecord integration.
 * Validates migration tracking, idempotency, and sentinel dependency.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createStoreApi } from '../src/store/api.js'
import { layer as sqliteNodeLayer } from '../src/adapters/sqlite-node.js'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'migration-test-'))
}

describe('Migrator.fromRecord', () => {
  let tmpDir: string
  let api: Awaited<ReturnType<typeof createStoreApi>> | null = null

  afterEach(async () => {
    if (api) await api.dispose()
    api = null
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates tables on fresh database', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')
    api = createStoreApi(sqliteNodeLayer({ filename: dbPath }))

    // If migrations didn't run, this would throw "no such table"
    await api.put('test', 'key1', { value: 1 })
    const result = await api.get('test', 'key1')
    expect(result).toEqual({ value: 1 })
  })

  it('tracks migrations in rlm_migrations table', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')
    api = createStoreApi(sqliteNodeLayer({ filename: dbPath }))

    // Trigger migration by doing any operation
    await api.put('test', 'k', { v: 1 })

    // Query the migrations table directly via exec + get
    // The table should have our 4 migrations recorded
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(dbPath)
    const rows = db.prepare('SELECT * FROM rlm_migrations ORDER BY migration_id').all() as any[]
    db.close()

    expect(rows.length).toBe(4)
    expect(rows[0].name).toBe('objects_table')
    expect(rows[1].name).toBe('objects_indexes')
    expect(rows[2].name).toBe('fts5_virtual_table')
    expect(rows[3].name).toBe('fts5_triggers')
  })

  it('is idempotent — second startup skips existing migrations', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    // First startup — creates tables
    const api1 = createStoreApi(sqliteNodeLayer({ filename: dbPath }))
    await api1.put('test', 'k1', { v: 1 })
    await api1.dispose()

    // Second startup — should not fail (migrations already applied)
    const api2 = createStoreApi(sqliteNodeLayer({ filename: dbPath }))
    await api2.put('test', 'k2', { v: 2 })

    // Both values should be there
    expect(await api2.get('test', 'k1')).toEqual({ v: 1 })
    expect(await api2.get('test', 'k2')).toEqual({ v: 2 })

    await api2.dispose()
    api = null // already cleaned up
  })

  it('FTS5 triggers work after migration', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')
    api = createStoreApi(sqliteNodeLayer({ filename: dbPath }))

    // Put with _meta.summary — should be indexed in FTS5
    await api.put('test', 'hello', {
      _meta: { summary: 'greeting object' },
      message: 'hello world',
    })

    // Search should find it via FTS5 fallback at minimum
    const results = await api.search('greeting')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].key).toBe('hello')
  })

  it('search works via FlexSearch after migration + rebuild', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')
    api = createStoreApi(sqliteNodeLayer({ filename: dbPath }))

    await api.put('research', 'paper-1', {
      _meta: { summary: 'quantum entanglement study' },
      title: 'Bell state preparation',
    }, ['physics', 'quantum'])

    // Search should find it
    const results = await api.search('quantum')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].collection).toBe('research')
  })
})
