/**
 * @module test/codemode.unit
 *
 * Core tests for createCodemode() — the SDK factory.
 * Tests plugin loading, method merging, eval sandbox, and dispose.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createCodemode, type CodemodePlugin } from '../src/index.js'
import { layer as sqliteNodeLayer } from '../src/adapters/sqlite-node.js'
import { NodeFileSystemLayer } from '../src/adapters/filesystem-node.js'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// ── Helpers ──────────────────────────────────────────────────────

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'codemode-test-'))
}

function makeTestPlugin(id: string, methods: Record<string, Function>): CodemodePlugin {
  return { id, name: `Test Plugin ${id}`, methods }
}

// ── Tests ────────────────────────────────────────────────────────

describe('createCodemode', () => {
  let tmpDir: string
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates an instance with core methods', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')
    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    // Core store methods exist
    expect(codemode.api.put).toBeDefined()
    expect(codemode.api.get).toBeDefined()
    expect(codemode.api.query).toBeDefined()
    expect(codemode.api.collections).toBeDefined()

    // Core DPA methods exist
    expect(codemode.api.define).toBeDefined()
    expect(codemode.api.call).toBeDefined()
    expect(codemode.api.fn).toBeDefined()

    // Core primitives exist
    expect(codemode.api.read).toBeDefined()
    expect(codemode.api.write).toBeDefined()
    expect(codemode.api.sh).toBeDefined()
  })

  it('loads plugins and merges methods', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const plugin = makeTestPlugin('test', {
      greet: (name: string) => `Hello ${name}`,
      add: (a: number, b: number) => a + b,
    })

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      plugins: [plugin],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    expect(codemode.plugins).toContain('test')
    expect(codemode.api.greet).toBeDefined()
    expect(codemode.api.add).toBeDefined()
    // Core still there
    expect(codemode.api.put).toBeDefined()
  })

  it('eval sandbox executes code against merged API', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const plugin = makeTestPlugin('math', {
      multiply: (a: number, b: number) => a * b,
    })

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      plugins: [plugin],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    // Eval with core methods
    await codemode.eval('await cm.put("test", "key", { value: 42 })')
    const result = await codemode.eval('return await cm.get("test", "key")')
    expect(result).toEqual({ value: 42 })

    // Eval with plugin methods
    const mathResult = await codemode.eval('return cm.multiply(6, 7)')
    expect(mathResult).toBe(42)
  })

  it('detects plugin method collisions (last wins)', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const p1 = makeTestPlugin('first', { sharedMethod: () => 'from-first' })
    const p2 = makeTestPlugin('second', { sharedMethod: () => 'from-second' })

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      plugins: [p1, p2],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    // Last plugin wins
    const result = await codemode.eval('return cm.sharedMethod()')
    expect(result).toBe('from-second')
  })

  it('plugin setup receives core', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')
    let receivedCore = false

    const plugin: CodemodePlugin = {
      id: 'setup-test',
      name: 'Setup Test',
      methods: {},
      setup: (core) => {
        receivedCore = true
        expect(core.store).toBeDefined()
        expect(core.procedures).toBeDefined()
        expect(core.cwd).toBe(tmpDir)
        expect(core.read).toBeDefined()
      },
    }

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      plugins: [plugin],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    expect(receivedCore).toBe(true)
  })

  it('dispose calls plugin dispose hooks', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')
    let disposed = false

    const plugin: CodemodePlugin = {
      id: 'dispose-test',
      name: 'Dispose Test',
      methods: {},
      dispose: () => { disposed = true },
    }

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      plugins: [plugin],
      cwd: tmpDir,
    })

    await codemode.dispose()
    expect(disposed).toBe(true)
    cleanup = null // already disposed
  })

  it('core.read/write/sh work with cwd', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    // write + read (async — Effect FileSystem-backed)
    await codemode.eval('await cm.write("test.txt", "hello codemode")')
    const content = await codemode.eval('return await cm.read("test.txt")')
    expect(content).toBe('hello codemode')

    // sh (async — Effect-wrapped execSync)
    const result = await codemode.eval('return await cm.sh("echo hello")')
    expect(result).toBe('hello')
  })
})
