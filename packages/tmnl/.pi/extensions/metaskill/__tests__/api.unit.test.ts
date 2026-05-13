/**
 * Unit tests for metaskill codemod API.
 *
 * Each test creates an isolated temp dir with .pi/skills/ structure,
 * runs API functions against it, then cleans up.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createApi } from '../api.ts'

// ─── Test Harness ────────────────────────────────────────

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

function minimalSkill(name: string, opts?: { governed?: boolean, changelog?: boolean }) {
  const governed = opts?.governed ?? true
  const changelog = opts?.changelog ?? true
  const files: Record<string, string> = {
    'SKILL.md': [
      `# ${name}`,
      '',
      `> prereqs: none`,
      `> provides: test`,
      `> children: ${changelog ? 'CHANGELOG.md' : 'none'}`,
      governed ? `> governed-by: metaskill` : '',
    ].filter(Boolean).join('\n'),
  }
  if (changelog) {
    files['CHANGELOG.md'] = [
      `# ${name} — Changelog`,
      '',
      `> up: SKILL.md`,
      `> meta: true`,
      '',
      `## [0.1.0]`,
      '',
      `| Action | File | What changed |`,
      `|---|---|---|`,
      `| \`+\` | \`SKILL.md\` | Created. |`,
      `| \`+\` | \`CHANGELOG.md\` | Created. |`,
    ].join('\n')
  }
  writeSkill(name, files)
}

function fullSkill(name: string) {
  minimalSkill(name)
  writeSkill(name, {
    'GRAPH.md': [
      `# ${name} — Graph`,
      '',
      '> up: SKILL.md',
      '> meta: true',
      '',
      'SKILL.md',
      'CHANGELOG.md',
      'references/INDEX.md',
      'utils/INDEX.md',
      'utils/REF.md',
    ].join('\n'),
    'references/INDEX.md': [
      `# References`,
      '',
      '> up: ../SKILL.md',
      '> prereqs: none',
      '> provides: refs',
      '> children: none',
    ].join('\n'),
    'utils/INDEX.md': [
      `# Utils`,
      '',
      '> up: ../SKILL.md',
      '> prereqs: none',
      '> provides: utils',
      '> children: REF.md',
    ].join('\n'),
    'utils/REF.md': [
      `# Utils REF`,
      '',
      '> up: INDEX.md',
      '> prereqs: none',
      '> provides: utils-pattern',
      '> children: none',
    ].join('\n'),
  })
  // Update SKILL.md children + CHANGELOG
  const skillMd = join(cwd, '.pi', 'skills', name, 'SKILL.md')
  writeFileSync(skillMd, [
    `# ${name}`,
    '',
    `> prereqs: none`,
    `> provides: test`,
    `> children: CHANGELOG.md, GRAPH.md, references/INDEX.md, utils/INDEX.md`,
    `> governed-by: metaskill`,
  ].join('\n'))
  const cl = join(cwd, '.pi', 'skills', name, 'CHANGELOG.md')
  writeFileSync(cl, readFileSync(cl, 'utf-8') +
    `\n| \`+\` | \`GRAPH.md\` | Created. |\n` +
    `| \`+\` | \`references/INDEX.md\` | Created. |\n` +
    `| \`+\` | \`utils/INDEX.md\` | Created. |\n` +
    `| \`+\` | \`utils/REF.md\` | Created. |\n`)
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'ms-test-'))
  mkdirSync(join(cwd, '.pi', 'skills'), { recursive: true })
  ms = createApi(cwd)
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
})

// ─── Discovery ───────────────────────────────────────────

describe('discover', () => {
  it('returns empty for no skills', () => {
    expect(ms.discover()).toEqual([])
  })

  it('finds skills with correct metadata', () => {
    minimalSkill('alpha')
    minimalSkill('beta', { governed: false })
    const skills = ms.discover()
    expect(skills).toHaveLength(2)
    expect(skills[0].name).toBe('alpha')
    expect(skills[0].governed).toBe(true)
    expect(skills[1].name).toBe('beta')
    expect(skills[1].governed).toBe(false)
  })

  it('counts files correctly', () => {
    fullSkill('deep')
    const skill = ms.info('deep')
    expect(skill.fileCount).toBeGreaterThanOrEqual(6)
    expect(skill.hasGraph).toBe(true)
    expect(skill.hasUtils).toBe(true)
  })

  it('sorts alphabetically', () => {
    minimalSkill('zeta')
    minimalSkill('alpha')
    minimalSkill('mu')
    const names = ms.discover().map(s => s.name)
    expect(names).toEqual(['alpha', 'mu', 'zeta'])
  })
})

// ─── Inspection ──────────────────────────────────────────

describe('inspect', () => {
  it('returns not-found for missing skill', () => {
    const r = ms.inspect('nonexistent')
    expect(r.clean).toBe(false)
    expect(r.checks[0].name).toBe('exists')
  })

  it('passes all checks for a well-formed skill', () => {
    minimalSkill('good')
    const r = ms.inspect('good')
    expect(r.clean).toBe(true)
    expect(r.passed).toBe(r.total)
  })

  it('catches missing governance', () => {
    minimalSkill('ungov', { governed: false })
    const r = ms.inspect('ungov')
    const gov = r.checks.find(c => c.name === 'governance')
    expect(gov?.pass).toBe(false)
  })

  it('catches missing changelog', () => {
    minimalSkill('nocl', { changelog: false })
    const r = ms.inspect('nocl')
    const cl = r.checks.find(c => c.name === 'changelog')
    expect(cl?.pass).toBe(false)
  })

  it('catches missing frontmatter', () => {
    minimalSkill('badfm')
    // Add a file with no frontmatter
    writeSkill('badfm', { 'references/INDEX.md': '# No frontmatter here\n\nJust content.' })
    const r = ms.inspect('badfm')
    const fm = r.checks.find(c => c.name === 'frontmatter')
    expect(fm?.pass).toBe(false)
    expect(fm?.detail).toContain('INDEX.md')
  })

  it('catches orphaned files', () => {
    minimalSkill('orphan')
    writeSkill('orphan', { 'references/ghost.md': '> up: ../SKILL.md\n> provides: nothing\n' })
    const r = ms.inspect('orphan')
    const orph = r.checks.find(c => c.name === 'orphans')
    expect(orph?.pass).toBe(false)
    expect(orph?.detail).toContain('ghost.md')
  })

  it('catches dead links in frontmatter', () => {
    minimalSkill('deadlink')
    writeSkill('deadlink', {
      'references/INDEX.md': [
        '# Refs',
        '',
        '> up: ../SKILL.md',
        '> children: missing.md',
        '> provides: x',
      ].join('\n'),
    })
    const r = ms.inspect('deadlink')
    const dl = r.checks.find(c => c.name === 'dead-links')
    expect(dl?.pass).toBe(false)
    expect(dl?.detail).toContain('missing.md')
  })

  it('catches children drift', () => {
    minimalSkill('drift')
    writeSkill('drift', {
      'references/INDEX.md': [
        '> up: ../SKILL.md',
        '> children: none',
        '> provides: x',
      ].join('\n'),
      'references/extra.md': [
        '> up: INDEX.md',
        '> provides: y',
      ].join('\n'),
    })
    const r = ms.inspect('drift')
    const cs = r.checks.find(c => c.name === 'children-sync')
    expect(cs?.pass).toBe(false)
    expect(cs?.detail).toContain('extra.md')
  })

  it('summary format: N/N CLEAN or N/N — failing: x, y', () => {
    minimalSkill('sum')
    const clean = ms.inspect('sum')
    expect(clean.summary).toMatch(/\d+\/\d+ CLEAN/)

    minimalSkill('sumfail', { governed: false })
    const failing = ms.inspect('sumfail')
    expect(failing.summary).toMatch(/failing:/)
  })
})

// ─── Audit ───────────────────────────────────────────────

describe('audit', () => {
  it('returns one row per skill', () => {
    minimalSkill('a')
    minimalSkill('b')
    minimalSkill('c')
    const rows = ms.audit()
    expect(rows).toHaveLength(3)
  })

  it('reports governance and fm gaps', () => {
    minimalSkill('governed')
    minimalSkill('ungov', { governed: false })
    const rows = ms.audit()
    const gov = rows.find(r => r.name === 'governed')
    const ung = rows.find(r => r.name === 'ungov')
    expect(gov?.governed).toBe(true)
    expect(ung?.governed).toBe(false)
  })
})

// ─── Conformance ─────────────────────────────────────────

describe('conformance', () => {
  it('level -1 for missing skill', () => {
    expect(ms.conformance('nope').level).toBe(-1)
  })

  it('level 0 for ungoverned skill', () => {
    minimalSkill('ungov', { governed: false })
    expect(ms.conformance('ungov').level).toBe(0)
  })

  it('level 0 for no changelog', () => {
    minimalSkill('nocl', { changelog: false })
    expect(ms.conformance('nocl').level).toBe(0)
  })

  it('level 2 for governed clean skill without utils/graph', () => {
    minimalSkill('clean')
    const c = ms.conformance('clean')
    expect(c.level).toBe(2)
    expect(c.label).toBe('clean')
  })

  it('level 3 for fully instrumented skill', () => {
    fullSkill('full')
    const c = ms.conformance('full')
    expect(c.level).toBe(3)
    expect(c.label).toBe('instrumented')
  })

  it('conformanceAudit covers all skills', () => {
    minimalSkill('a')
    minimalSkill('b', { governed: false })
    const audit = ms.conformanceAudit()
    expect(audit).toHaveLength(2)
    expect(audit.find(r => r.name === 'a')?.level).toBeGreaterThanOrEqual(1)
    expect(audit.find(r => r.name === 'b')?.level).toBe(0)
  })
})

// ─── Frontmatter ─────────────────────────────────────────

describe('frontmatter', () => {
  it('parses all fields from all files', () => {
    minimalSkill('fm')
    const fm = ms.frontmatter('fm')
    expect(fm['SKILL.md']).toHaveProperty('prereqs')
    expect(fm['SKILL.md']).toHaveProperty('provides')
    expect(fm['SKILL.md']['governed-by']).toBe('metaskill')
  })

  it('setFrontmatter injects new field', () => {
    minimalSkill('inject')
    const path = join(cwd, '.pi', 'skills', 'inject', 'SKILL.md')
    ms.setFrontmatter(path, 'cross', 'other.md')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('> cross: other.md')
  })

  it('setFrontmatter updates existing field', () => {
    minimalSkill('update')
    const path = join(cwd, '.pi', 'skills', 'update', 'SKILL.md')
    ms.setFrontmatter(path, 'provides', 'updated-value')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('> provides: updated-value')
    expect(content).not.toContain('> provides: test')
  })
})

// ─── Mutations ───────────────────────────────────────────

describe('adopt', () => {
  it('adds governance to ungoverned skill', () => {
    minimalSkill('toadopt', { governed: false })
    const result = ms.adopt('toadopt')
    expect(result).toContain('Governance added')
    const content = readFileSync(join(cwd, '.pi', 'skills', 'toadopt', 'SKILL.md'), 'utf-8')
    expect(content).toContain('governed-by: metaskill')
  })

  it('is idempotent for already-governed skill', () => {
    minimalSkill('already')
    const result = ms.adopt('already')
    expect(result).toContain('already governed')
  })
})

describe('scaffold', () => {
  it('creates basic skill skeleton', () => {
    const files = ms.scaffold('new-skill')
    expect(files).toContain('SKILL.md')
    expect(files).toContain('CHANGELOG.md')
    expect(existsSync(join(cwd, '.pi', 'skills', 'new-skill', 'SKILL.md'))).toBe(true)
  })

  it('includes references when opts.refs', () => {
    const files = ms.scaffold('with-refs', { refs: true })
    expect(files).toContain('references/INDEX.md')
  })

  it('scaffolded skill passes governance check', () => {
    ms.scaffold('scaffolded')
    const r = ms.inspect('scaffolded')
    const gov = r.checks.find(c => c.name === 'governance')
    expect(gov?.pass).toBe(true)
  })

  it('scaffolded skill has frontmatter on all files', () => {
    ms.scaffold('scaffolded2', { refs: true })
    const r = ms.inspect('scaffolded2')
    const fm = r.checks.find(c => c.name === 'frontmatter')
    expect(fm?.pass).toBe(true)
  })
})
