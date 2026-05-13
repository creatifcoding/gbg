/**
 * Property-based tests for metaskill codemod API.
 *
 * Invariants that must hold regardless of skill shape.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createApi } from '../api.ts'

let cwd: string
let ms: ReturnType<typeof createApi>

function writeSkill(name: string, files: Record<string, string>) {
  const dir = join(cwd, '.pi', 'skills', name)
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
}

function minSkill(name: string, governed = true) {
  writeSkill(name, {
    'SKILL.md': `# ${name}\n\n> prereqs: none\n> provides: x\n> children: CHANGELOG.md\n${governed ? '> governed-by: metaskill\n' : ''}`,
    'CHANGELOG.md': `# CL\n\n> up: SKILL.md\n> meta: true\n\n## [0.1.0]\n\n| Action | File | What changed |\n|---|---|---|\n| \`+\` | \`SKILL.md\` | Created. |\n| \`+\` | \`CHANGELOG.md\` | Created. |\n`,
  })
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'ms-prop-'))
  mkdirSync(join(cwd, '.pi', 'skills'), { recursive: true })
  ms = createApi(cwd)
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
})

// ─── Structural Invariants ───────────────────────────────

describe('structural invariants', () => {
  it('discover().length === audit().length', () => {
    minSkill('a')
    minSkill('b')
    minSkill('c')
    expect(ms.discover().length).toBe(ms.audit().length)
  })

  it('inspect total always equals checks array length', () => {
    minSkill('x')
    const r = ms.inspect('x')
    expect(r.total).toBe(r.checks.length)
    expect(r.passed).toBeLessThanOrEqual(r.total)
  })

  it('inspect passed + failing === total', () => {
    minSkill('pf', false)
    const r = ms.inspect('pf')
    const failing = r.checks.filter(c => !c.pass).length
    expect(r.passed + failing).toBe(r.total)
  })

  it('clean === true iff passed === total', () => {
    minSkill('cl')
    const r = ms.inspect('cl')
    expect(r.clean).toBe(r.passed === r.total)
  })

  it('info().files length matches info().fileCount', () => {
    minSkill('fc')
    const i = ms.info('fc')
    expect(i.files.length).toBe(i.fileCount)
  })

  it('frontmatter() keys match info().files', () => {
    minSkill('fmk')
    const i = ms.info('fmk')
    const fm = ms.frontmatter('fmk')
    expect(Object.keys(fm).sort()).toEqual(i.files.sort())
  })
})

// ─── Idempotency ─────────────────────────────────────────

describe('idempotency', () => {
  it('inspect returns same result on repeated calls', () => {
    minSkill('idem')
    const r1 = ms.inspect('idem')
    const r2 = ms.inspect('idem')
    expect(r1.summary).toBe(r2.summary)
    expect(r1.passed).toBe(r2.passed)
  })

  it('adopt is idempotent', () => {
    minSkill('aidm', false)
    ms.adopt('aidm')
    ms.adopt('aidm')
    const i = ms.info('aidm')
    expect(i.governed).toBe(true)
  })

  it('discover returns same order on repeated calls', () => {
    minSkill('z')
    minSkill('a')
    minSkill('m')
    const d1 = ms.discover().map(s => s.name)
    const d2 = ms.discover().map(s => s.name)
    expect(d1).toEqual(d2)
  })
})

// ─── Conformance Monotonicity ────────────────────────────

describe('conformance monotonicity', () => {
  it('scaffold produces level >= 1', () => {
    ms.scaffold('fresh')
    expect(ms.conformance('fresh').level).toBeGreaterThanOrEqual(1)
  })

  it('adopt raises level for ungoverned skill', () => {
    minSkill('toraise', false)
    const before = ms.conformance('toraise').level
    ms.adopt('toraise')
    const after = ms.conformance('toraise').level
    expect(after).toBeGreaterThan(before)
  })

  it('conformance level is non-negative for existing skills', () => {
    minSkill('nonneg')
    expect(ms.conformance('nonneg').level).toBeGreaterThanOrEqual(0)
  })

  it('conformance is -1 for nonexistent skill', () => {
    expect(ms.conformance('nope').level).toBe(-1)
  })

  it('conformanceAudit covers every discovered skill', () => {
    minSkill('a')
    minSkill('b')
    const auditNames = ms.conformanceAudit().map(r => r.name).sort()
    const discoverNames = ms.discover().map(s => s.name).sort()
    expect(auditNames).toEqual(discoverNames)
  })
})

// ─── Composition Properties ──────────────────────────────

describe('composition', () => {
  it('discover + inspect: every skill is inspectable', () => {
    minSkill('i1')
    minSkill('i2')
    const results = ms.discover().map(s => ms.inspect(s.name))
    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(r.total).toBeGreaterThan(0)
    }
  })

  it('discover + conformance: levels are bounded [−1, 3]', () => {
    minSkill('bound')
    const levels = ms.discover().map(s => ms.conformance(s.name).level)
    for (const l of levels) {
      expect(l).toBeGreaterThanOrEqual(-1)
      expect(l).toBeLessThanOrEqual(3)
    }
  })

  it('scaffold + inspect: scaffolded skill is at least governed', () => {
    ms.scaffold('composed', { refs: true })
    const r = ms.inspect('composed')
    const gov = r.checks.find(c => c.name === 'governance')
    const cl = r.checks.find(c => c.name === 'changelog')
    const fm = r.checks.find(c => c.name === 'frontmatter')
    expect(gov?.pass).toBe(true)
    expect(cl?.pass).toBe(true)
    expect(fm?.pass).toBe(true)
  })
})
