/**
 * E2E tests for metaskill codemod API.
 *
 * Full workflows: create → mutate → inspect → verify.
 * Tests run against the REAL skill tree (read-only where possible).
 * Mutation tests use temp dirs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createApi } from '../api.ts'

// ─── Real tree (read-only) ──────────────────────────────

describe('e2e: real skill tree', () => {
  const realCwd = join(__dirname, '..', '..', '..', '..')  // packages/tmnl

  it('discovers real skills', () => {
    const ms = createApi(realCwd)
    const skills = ms.discover()
    expect(skills.length).toBeGreaterThan(10)
  })

  it('metaskill passes its own inspect', () => {
    const ms = createApi(realCwd)
    const r = ms.inspect('metaskill')
    expect(r.clean).toBe(true)
    expect(r.summary).toContain('CLEAN')
  })

  it('nx-workspace passes its own inspect', () => {
    const ms = createApi(realCwd)
    const r = ms.inspect('nx-workspace')
    expect(r.clean).toBe(true)
  })

  it('metaskill is conformance level 3 (instrumented)', () => {
    const ms = createApi(realCwd)
    const c = ms.conformance('metaskill')
    expect(c.level).toBe(3)
    expect(c.label).toBe('instrumented')
  })

  it('protocols list includes all CRUD operations', () => {
    const ms = createApi(realCwd)
    const protos = ms.protocols()
    expect(protos).toContain('§ skill:create')
    expect(protos).toContain('§ skill:inspect')
    expect(protos).toContain('§ skill:dogfood')
    expect(protos).toContain('§ node:create')
    expect(protos).toContain('§ util:run')
    expect(protos).toContain('§ workspace:inspect')
  })

  it('protocol body contains numbered steps', () => {
    const ms = createApi(realCwd)
    const body = ms.protocol('§ skill:create')
    expect(body).toBeTruthy()
    expect(body).toContain('1.')
  })

  it('utils list includes essential utils', () => {
    const ms = createApi(realCwd)
    const utilNames = ms.utils().map(u => u.name)
    expect(utilNames).toContain('full-health')
    expect(utilNames).toContain('audit-all')
    expect(utilNames).toContain('children-sync')
    expect(utilNames).toContain('cross-symmetry')
  })

  it('frontmatter for metaskill covers all files', () => {
    const ms = createApi(realCwd)
    const fm = ms.frontmatter('metaskill')
    const info = ms.info('metaskill')
    expect(Object.keys(fm).length).toBe(info.fileCount)
    // Every file should have at least one field
    for (const [file, fields] of Object.entries(fm)) {
      expect(Object.keys(fields).length).toBeGreaterThan(0)
    }
  })

  it('audit covers all discovered skills', () => {
    const ms = createApi(realCwd)
    const skills = ms.discover()
    const rows = ms.audit()
    expect(rows.length).toBe(skills.length)
  })
})

// ─── Workflow: scaffold → build → inspect ────────────────

describe('e2e: scaffold → build → inspect', () => {
  let cwd: string
  let ms: ReturnType<typeof createApi>

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'ms-e2e-'))
    mkdirSync(join(cwd, '.pi', 'skills'), { recursive: true })
    ms = createApi(cwd)
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it('full lifecycle: scaffold → inspect → passes', () => {
    // Scaffold
    const files = ms.scaffold('lifecycle', { refs: true })
    expect(files.length).toBeGreaterThanOrEqual(3)

    // Inspect should be clean
    const r = ms.inspect('lifecycle')
    expect(r.clean).toBe(true)

    // Conformance should be at least level 2
    const c = ms.conformance('lifecycle')
    expect(c.level).toBeGreaterThanOrEqual(2)
  })

  it('full lifecycle: scaffold → add node → inspect catches drift → fix → clean', () => {
    ms.scaffold('growing')

    // Add a node without updating INDEX
    const refDir = join(cwd, '.pi', 'skills', 'growing', 'references')
    mkdirSync(refDir, { recursive: true })
    writeFileSync(join(refDir, 'INDEX.md'), [
      '# Refs',
      '',
      '> up: ../SKILL.md',
      '> prereqs: none',
      '> provides: refs',
      '> children: none',  // ← doesn't list topic.md
    ].join('\n'))
    writeFileSync(join(refDir, 'topic.md'), [
      '# Topic',
      '',
      '> up: INDEX.md',
      '> prereqs: none',
      '> provides: topic',
      '> children: none',
    ].join('\n'))

    // Update SKILL.md to reference the new dir
    const skillPath = join(cwd, '.pi', 'skills', 'growing', 'SKILL.md')
    ms.setFrontmatter(skillPath, 'children', 'CHANGELOG.md, references/INDEX.md')

    // Also update changelog
    const clPath = join(cwd, '.pi', 'skills', 'growing', 'CHANGELOG.md')
    const cl = readFileSync(clPath, 'utf-8')
    writeFileSync(clPath, cl + '\n| `+` | `references/INDEX.md` | Created. |\n| `+` | `references/topic.md` | Created. |\n')

    // Inspect should catch the children drift
    const r1 = ms.inspect('growing')
    const cs = r1.checks.find(c => c.name === 'children-sync')
    expect(cs?.pass).toBe(false)
    expect(cs?.detail).toContain('topic.md')

    // Fix: update INDEX children
    ms.setFrontmatter(join(refDir, 'INDEX.md'), 'children', 'topic.md')

    // Re-inspect should be clean
    const r2 = ms.inspect('growing')
    expect(r2.checks.find(c => c.name === 'children-sync')?.pass).toBe(true)
  })

  it('full lifecycle: ungoverned → adopt → conformance rises', () => {
    // Create ungoverned
    const dir = join(cwd, '.pi', 'skills', 'rebel')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), '# rebel\n\n> prereqs: none\n> provides: x\n> children: CHANGELOG.md\n')
    writeFileSync(join(dir, 'CHANGELOG.md'), '# CL\n\n> up: SKILL.md\n> meta: true\n\n## [0.1.0]\n\n| Action | File | What changed |\n|---|---|---|\n| `+` | `SKILL.md` | Created. |\n| `+` | `CHANGELOG.md` | Created. |\n')

    const before = ms.conformance('rebel')
    expect(before.level).toBe(0)
    expect(before.label).toBe('exists')

    // Adopt
    ms.adopt('rebel')

    // Conformance should rise
    const after = ms.conformance('rebel')
    expect(after.level).toBeGreaterThan(0)
  })

  it('composition: inspect all → filter failing → fix → all clean', () => {
    // Create 3 skills, one broken
    ms.scaffold('good1')
    ms.scaffold('good2')
    ms.scaffold('broken')
    // Break it
    writeFileSync(join(cwd, '.pi', 'skills', 'broken', 'references', 'orphan.md'), 'no frontmatter')
    mkdirSync(join(cwd, '.pi', 'skills', 'broken', 'references'), { recursive: true })
    writeFileSync(join(cwd, '.pi', 'skills', 'broken', 'references', 'orphan.md'), 'no frontmatter')

    // Inspect all, find failing
    const results = ms.discover().map(s => ms.inspect(s.name))
    const failing = results.filter(r => !r.clean)
    expect(failing.length).toBeGreaterThanOrEqual(1)

    // Fix: remove the orphan
    rmSync(join(cwd, '.pi', 'skills', 'broken', 'references'), { recursive: true })

    // Re-inspect
    const results2 = ms.discover().map(s => ms.inspect(s.name))
    const failing2 = results2.filter(r => !r.clean)
    expect(failing2.length).toBe(0)
  })
})
