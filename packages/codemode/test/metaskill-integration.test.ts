/**
 * @module test/metaskill-integration
 *
 * Integration test — metaskillPlugin (now CodemodeOverlay) loaded into createCodemode.
 * Verifies the full overlay lifecycle: load, method merge, eval access, dispose.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createCodemode } from '../src/index.js'
import { metaskillPlugin } from '../src/plugins/metaskill.js'
import { layer as sqliteNodeLayer } from '../src/adapters/sqlite-node.js'
import { NodeFileSystemLayer } from './_node-fs-layer.js'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'codemode-ms-int-'))
  const skillDir = join(dir, '.pi', 'skills', 'test-skill')
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'SKILL.md'), '---\ngoverned-by: metaskill\n---\n# test-skill\n')
  return dir
}

describe('createCodemode + metaskillPlugin (overlay)', () => {
  let tmpDir: string
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  })

  it('loads metaskill overlay and merges methods', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      overlays: [metaskillPlugin(tmpDir, NodeFileSystemLayer)],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    // Core methods present
    expect(codemode.api.put).toBeDefined()
    expect(codemode.api.get).toBeDefined()
    expect(codemode.api.define).toBeDefined()

    // Domain methods merged from metaskill overlay
    expect(codemode.api.discover).toBeDefined()
    expect(codemode.api.inspect).toBeDefined()
    expect(codemode.api.audit).toBeDefined()
    expect(codemode.api.conformance).toBeDefined()
    expect(codemode.api.profile).toBeDefined()

    // Overlay listed
    expect(codemode.plugins).toContain('metaskill')
  })

  it('domain methods accessible via eval sandbox', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      overlays: [metaskillPlugin(tmpDir, NodeFileSystemLayer)],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    // discover() returns array via Effect runtime
    const result = await codemode.eval('return await cm.discover()')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('core store + domain overlay coexist without collision', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      overlays: [metaskillPlugin(tmpDir, NodeFileSystemLayer)],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    // Store operation
    await codemode.eval('await cm.put("test", "k1", { value: 1 })')
    const storeResult = await codemode.eval('return await cm.get("test", "k1")')
    expect(storeResult).toEqual({ value: 1 })

    // Domain operation (in same sandbox)
    const skills = await codemode.eval('return await cm.discover()')
    expect(Array.isArray(skills)).toBe(true)

    // Both work without interfering
    const storeStillWorks = await codemode.eval('return await cm.get("test", "k1")')
    expect(storeStillWorks).toEqual({ value: 1 })
  })

  it('api method count = core + domain + overlay ops', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      overlays: [metaskillPlugin(tmpDir, NodeFileSystemLayer)],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    const allMethods = Object.keys(codemode.api)
    // Core ~37 + metaskill 21 + overlay ops 5 → ~63 total
    expect(allMethods.length).toBeGreaterThanOrEqual(40)

    // Overlay management methods exist
    expect(codemode.api.loadOverlay).toBeDefined()
    expect(codemode.api.unloadOverlay).toBeDefined()
    expect(codemode.api.switchOverlay).toBeDefined()
    expect(codemode.api.overlays).toBeDefined()
    expect(codemode.api.hasOverlay).toBeDefined()
  })

  it('overlays manager is exposed', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      overlays: [metaskillPlugin(tmpDir, NodeFileSystemLayer)],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    expect(codemode.overlays).toBeDefined()
    expect(codemode.overlays.has('metaskill')).toBe(true)
    expect(codemode.overlays.size).toBe(1)
    expect(codemode.overlays.active()).toEqual([
      { id: 'metaskill', name: 'Skill Governance', version: undefined },
    ])
  })

  it('legacy plugins: [] still works (backward compat)', async () => {
    tmpDir = makeTmpDir()
    const dbPath = join(tmpDir, 'test.db')

    // Use legacy plugins: [] — should auto-wrap to overlays
    const codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      fsLayer: NodeFileSystemLayer,
      plugins: [metaskillPlugin(tmpDir, NodeFileSystemLayer) as any],
      cwd: tmpDir,
    })
    cleanup = codemode.dispose

    expect(codemode.api.discover).toBeDefined()
    expect(codemode.overlays.has('metaskill')).toBe(true)
  })
})
