/**
 * Metaskill Codemod API
 *
 * Pure functions for skill governance. No pi/TUI deps.
 * Consumed by: TUI overlay, LLM tool (via eval), bash utils (documented equivalents).
 *
 * Usage (in tool REPL):
 *   const skills = ms.discover()
 *   const report = ms.inspect('nx-workspace')
 *   const failing = report.checks.filter(c => !c.pass)
 *   ms.runUtil('full-health', 'metaskill')
 *   ms.protocol('§ skill:dogfood')
 *
 * @module
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, dirname, basename } from 'node:path'
import { execSync } from 'node:child_process'

// ─── Types ───────────────────────────────────────────────────

export interface SkillInfo {
  name: string
  path: string
  governed: boolean
  fileCount: number
  files: string[]
  hasChangelog: boolean
  hasGraph: boolean
  hasUtils: boolean
  hasTemplate: boolean
}

export interface HealthCheck {
  name: string
  pass: boolean
  detail?: string
}

export interface HealthReport {
  skill: string
  path: string
  checks: HealthCheck[]
  passed: number
  total: number
  clean: boolean
  summary: string
}

export interface UtilInfo {
  name: string
  file: string
  description: string
}

export interface UtilResult {
  util: string
  skill: string
  output: string
  exitCode: number
}

export interface WorkspaceRow {
  name: string
  governed: boolean
  fileCount: number
  hasChangelog: boolean
  fmMissing: number
}

export interface FrontmatterMap {
  [file: string]: Record<string, string>
}

// ─── API Factory ─────────────────────────────────────────────

export function createApi(cwd: string) {
  const skillsDir = join(cwd, '.pi', 'skills')
  const metaskillDir = join(skillsDir, 'metaskill')

  // ── Discovery ──────────────────────────────────────────

  /** List all skills with metadata */
  function discover(): SkillInfo[] {
    if (!existsSync(skillsDir)) return []
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => info(d.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Get one skill's metadata */
  function info(name: string): SkillInfo {
    const dir = join(skillsDir, name)
    const files = findMd(dir)
    const head = readHead(join(dir, 'SKILL.md'))
    return {
      name,
      path: dir,
      governed: head.includes('governed-by: metaskill'),
      fileCount: files.length,
      files: files.map(f => relative(dir, f)),
      hasChangelog: existsSync(join(dir, 'CHANGELOG.md')),
      hasGraph: existsSync(join(dir, 'GRAPH.md')),
      hasUtils: existsSync(join(dir, 'utils')),
      hasTemplate: existsSync(join(dir, 'TEMPLATE.md')),
    }
  }

  // ── Inspection ─────────────────────────────────────────

  /** Full health check — returns structured report */
  function inspect(name: string): HealthReport {
    const dir = join(skillsDir, name)
    const checks: HealthCheck[] = []

    if (!existsSync(dir)) {
      return report(name, dir, [{ name: 'exists', pass: false, detail: 'Not found' }])
    }

    const files = findMd(dir)
    const rels = files.map(f => relative(dir, f))

    // Governance
    checks.push(check('governance',
      readHead(join(dir, 'SKILL.md')).includes('governed-by: metaskill'),
      'Missing governed-by: metaskill'))

    // Changelog
    checks.push(check('changelog', existsSync(join(dir, 'CHANGELOG.md'))))

    // Frontmatter
    const fmGaps = files.filter(f => !hasFrontmatter(f)).map(f => relative(dir, f))
    checks.push(check('frontmatter', fmGaps.length === 0,
      fmGaps.length > 0 ? `Missing: ${fmGaps.join(', ')}` : undefined))

    // Orphans
    const orphans = findOrphans(dir, files)
    checks.push(check('orphans', orphans.length === 0,
      orphans.length > 0 ? orphans.join(', ') : undefined))

    // Dead links
    const dead = findDeadLinks(dir, files)
    checks.push(check('dead-links', dead.length === 0,
      dead.length > 0 ? dead.join('; ') : undefined))

    // Children sync
    const drift = findChildrenDrift(dir, files)
    checks.push(check('children-sync', drift.length === 0,
      drift.length > 0 ? drift.join('; ') : undefined))

    // Cross symmetry
    const xIssues = findCrossIssues(dir, files)
    checks.push(check('cross-symmetry', xIssues.length === 0,
      xIssues.length > 0 ? xIssues.join('; ') : undefined))

    // Graph sync (optional)
    if (existsSync(join(dir, 'GRAPH.md'))) {
      const graph = readFileSync(join(dir, 'GRAPH.md'), 'utf-8')
      const notInGraph = rels.filter(r => {
        const b = basename(r)
        return b !== 'GRAPH.md' && b !== 'CHANGELOG.md' && !graph.includes(b)
      })
      checks.push(check('graph-sync', notInGraph.length === 0,
        notInGraph.length > 0 ? notInGraph.join(', ') : undefined))
    }

    // Changelog coverage (optional)
    if (existsSync(join(dir, 'CHANGELOG.md'))) {
      const cl = readFileSync(join(dir, 'CHANGELOG.md'), 'utf-8')
      const notLogged = rels.filter(r => basename(r) !== 'CHANGELOG.md' && !cl.includes(basename(r)))
      checks.push(check('changelog-coverage', notLogged.length === 0,
        notLogged.length > 0 ? notLogged.join(', ') : undefined))
    }

    return report(name, dir, checks)
  }

  /** Bulk audit — one row per skill */
  function audit(): WorkspaceRow[] {
    return discover().map(s => {
      const files = findMd(s.path)
      const fmMissing = files.filter(f => !hasFrontmatter(f)).length
      return { name: s.name, governed: s.governed, fileCount: s.fileCount, hasChangelog: s.hasChangelog, fmMissing }
    })
  }

  // ── Frontmatter ────────────────────────────────────────

  /** Parse all frontmatter for a skill — returns { "relative/path.md": { up: "...", prereqs: "..." } } */
  function frontmatter(name: string): FrontmatterMap {
    const dir = join(skillsDir, name)
    const result: FrontmatterMap = {}
    for (const f of findMd(dir)) {
      const head = readFileSync(f, 'utf-8').slice(0, 600)
      const fields: Record<string, string> = {}
      for (const line of head.split('\n')) {
        const m = line.match(/^> (\w[\w-]*): (.+)/)
        if (m) fields[m[1]] = m[2]
      }
      result[relative(dir, f)] = fields
    }
    return result
  }

  /** Inject or update a frontmatter field on a file */
  function setFrontmatter(filePath: string, field: string, value: string): void {
    const abs = filePath.startsWith('/') ? filePath : join(cwd, filePath)
    const content = readFileSync(abs, 'utf-8')
    const regex = new RegExp(`^> ${field}: .+$`, 'm')
    const newLine = `> ${field}: ${value}`
    if (regex.test(content)) {
      writeFileSync(abs, content.replace(regex, newLine))
    } else {
      // Insert after last frontmatter line
      const lines = content.split('\n')
      let lastFm = -1
      for (let i = 0; i < Math.min(lines.length, 12); i++) {
        if (lines[i].startsWith('> ')) lastFm = i
      }
      if (lastFm >= 0) {
        lines.splice(lastFm + 1, 0, newLine)
      } else {
        lines.splice(1, 0, '', newLine)
      }
      writeFileSync(abs, lines.join('\n'))
    }
  }

  // ── Protocols ──────────────────────────────────────────

  /** Get a protocol by key (e.g. "§ skill:inspect") */
  function protocol(key: string): string | null {
    const skillMd = join(metaskillDir, 'SKILL.md')
    if (!existsSync(skillMd)) return null
    const content = readFileSync(skillMd, 'utf-8')
    const marker = `## ${key}`
    const idx = content.indexOf(marker)
    if (idx === -1) return null
    const nextH2 = content.indexOf('\n## ', idx + marker.length + 1)
    return content.slice(idx, nextH2 !== -1 ? nextH2 : content.length).trim()
  }

  /** List all protocol keys */
  function protocols(): string[] {
    const skillMd = join(metaskillDir, 'SKILL.md')
    if (!existsSync(skillMd)) return []
    const content = readFileSync(skillMd, 'utf-8')
    return (content.match(/## § \w+:\w+/g) ?? []).map(m => m.replace('## ', ''))
  }

  // ── Utils ──────────────────────────────────────────────

  /** List available utils */
  function utils(): UtilInfo[] {
    const dir = join(metaskillDir, 'utils')
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter(f => f.endsWith('.md') && f !== 'INDEX.md' && f !== 'REF.md')
      .map(f => {
        const content = readFileSync(join(dir, f), 'utf-8')
        const lines = content.split('\n')
        const descLine = lines.find((l, i) => i > 0 && !l.startsWith('>') && l.trim() !== '' && !l.startsWith('#'))
        return { name: f.replace('.md', ''), file: f, description: descLine?.trim() ?? '' }
      })
  }

  /** Run a util against a skill — executes the bash block with substitution */
  function runUtil(utilName: string, skillName: string): UtilResult {
    const utilFile = join(metaskillDir, 'utils', `${utilName}.md`)
    if (!existsSync(utilFile)) {
      return { util: utilName, skill: skillName, output: `Not found: ${utilName}`, exitCode: 1 }
    }
    const content = readFileSync(utilFile, 'utf-8')
    const bashMatch = content.match(/```bash\n([\s\S]*?)```/)
    if (!bashMatch) {
      return { util: utilName, skill: skillName, output: 'No bash block', exitCode: 1 }
    }
    const script = bashMatch[1].replace(/<name>/g, skillName)
    try {
      const output = execSync(script, { cwd, encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] })
      return { util: utilName, skill: skillName, output: output.trim(), exitCode: 0 }
    } catch (err: any) {
      return { util: utilName, skill: skillName, output: ((err.stdout ?? '') + (err.stderr ?? '')).trim(), exitCode: err.status ?? 1 }
    }
  }

  // ── Mutations ──────────────────────────────────────────

  /** Add governance to a skill */
  function adopt(name: string): string {
    const skillMd = join(skillsDir, name, 'SKILL.md')
    if (!existsSync(skillMd)) return `SKILL.md not found for ${name}`
    const content = readFileSync(skillMd, 'utf-8')
    if (content.includes('governed-by: metaskill')) return `${name} already governed`
    setFrontmatter(skillMd, 'governed-by', 'metaskill')
    return `Governance added to ${name}`
  }

  /** Scaffold a new skill directory */
  function scaffold(name: string, opts?: { refs?: boolean }): string[] {
    const dir = join(skillsDir, name)
    const created: string[] = []
    const write = (rel: string, content: string) => {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content)
      created.push(rel)
    }

    write('SKILL.md', [
      `# ${name}`,
      '',
      `> prereqs: none`,
      `> provides: `,
      `> children: CHANGELOG.md${opts?.refs ? ', references/INDEX.md' : ''}`,
      `> governed-by: metaskill`,
      '',
      `## When to Load`,
      '',
      `- `,
      '',
      `## Router`,
      '',
      '```',
      'What are you doing?',
      '│',
      '└─ ...',
      '```',
    ].join('\n'))

    write('CHANGELOG.md', [
      `# ${name} — Changelog`,
      '',
      `> up: SKILL.md`,
      `> meta: true`,
      '',
      `## [0.1.0] — ${new Date().toISOString().slice(0, 10)}`,
      '',
      `Bootstrap.`,
      '',
      '| Action | File | What changed |',
      '|---|---|---|',
      `| \`+\` | \`SKILL.md\` | Created. |`,
      `| \`+\` | \`CHANGELOG.md\` | Created. |`,
    ].join('\n'))

    if (opts?.refs) {
      write('references/INDEX.md', [
        `# ${name} — References`,
        '',
        `> up: ../SKILL.md`,
        `> prereqs: none`,
        `> provides: `,
        `> children: none`,
      ].join('\n'))
    }

    return created
  }

  /** Read a file relative to cwd */
  function read(path: string): string {
    const abs = path.startsWith('/') ? path : join(cwd, path)
    return readFileSync(abs, 'utf-8')
  }

  /** Write a file relative to cwd */
  function write(path: string, content: string): void {
    const abs = path.startsWith('/') ? path : join(cwd, path)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  /** Run a shell command */
  function sh(cmd: string): string {
    try {
      return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 15000 }).trim()
    } catch (err: any) {
      return ((err.stdout ?? '') + (err.stderr ?? '')).trim()
    }
  }

  // ── Internals ──────────────────────────────────────────

  function check(name: string, pass: boolean, detail?: string): HealthCheck {
    return { name, pass, detail: pass ? undefined : detail }
  }

  function report(skill: string, path: string, checks: HealthCheck[]): HealthReport {
    const passed = checks.filter(c => c.pass).length
    const total = checks.length
    const failing = checks.filter(c => !c.pass).map(c => c.name)
    const summary = passed === total
      ? `${passed}/${total} CLEAN`
      : `${passed}/${total} — failing: ${failing.join(', ')}`
    return { skill, path, checks, passed, total, clean: passed === total, summary }
  }

  return {
    // Discovery
    discover, info,
    // Inspection
    inspect, audit,
    // Frontmatter
    frontmatter, setFrontmatter,
    // Protocols
    protocol, protocols,
    // Utils
    utils, runUtil,
    // Mutations
    adopt, scaffold,
    // Primitives
    read, write, sh,
  }
}

// ─── File helpers (module-level) ─────────────────────────────

function findMd(dir: string): string[] {
  const results: string[] = []
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory()) results.push(...findMd(full))
      else if (e.name.endsWith('.md')) results.push(full)
    }
  } catch { /* */ }
  return results.sort()
}

function readHead(path: string): string {
  try { return readFileSync(path, 'utf-8').slice(0, 600) } catch { return '' }
}

function hasFrontmatter(path: string): boolean {
  return /> (up|prereqs|provides|governed-by|meta|children|cross):/.test(readHead(path))
}

function findOrphans(dir: string, files: string[]): string[] {
  const orphans: string[] = []
  for (const f of files) {
    const b = basename(f)
    if (b === 'SKILL.md') continue
    let found = false
    const searchDirs = ['SKILL.md', 'references', 'utils']
    for (const sub of searchDirs) {
      const target = join(dir, sub)
      if (!existsSync(target)) continue
      try {
        const searchFiles = existsSync(target) && require('fs').statSync(target).isDirectory()
          ? findMd(target)
          : [target]
        for (const sf of searchFiles) {
          if (readFileSync(sf, 'utf-8').includes(b)) { found = true; break }
        }
      } catch { /* */ }
      if (found) break
    }
    if (!found) orphans.push(b)
  }
  return orphans
}

function findDeadLinks(dir: string, files: string[]): string[] {
  const dead: string[] = []
  for (const f of files) {
    const d = dirname(f)
    const head = readHead(f)
    for (const line of head.split('\n')) {
      const m = line.match(/^> (prereqs|children): (.+)/)
      if (!m) continue
      for (const ref of m[2].split(',').map(r => r.trim())) {
        if (ref === 'none' || ref.length === 0) continue
        if (!existsSync(join(d, ref))) dead.push(`${basename(f)} → ${ref}`)
      }
    }
  }
  return dead
}

function findChildrenDrift(dir: string, files: string[]): string[] {
  const drift: string[] = []
  for (const f of files.filter(f => f.endsWith('/INDEX.md'))) {
    const d = dirname(f)
    const head = readHead(f)
    const m = head.match(/^> children: (.+)/m)
    if (!m) continue
    const declared = m[1].split(',').map(r => r.trim())
    const actual = readdirSync(d).filter(n => n.endsWith('.md') && n !== 'INDEX.md')
    for (const a of actual) {
      if (!declared.includes(a)) drift.push(`${a} undeclared in ${relative(dir, f)}`)
    }
  }
  return drift
}

function findCrossIssues(dir: string, files: string[]): string[] {
  const issues: string[] = []
  for (const f of files) {
    const d = dirname(f)
    const head = readHead(f)
    const m = head.match(/^> cross: (.+)/m)
    if (!m) continue
    const b = basename(f)
    for (const ref of m[1].split(',').map(r => r.trim())) {
      if (ref === 'none') continue
      const target = join(d, ref)
      if (!existsSync(target)) { issues.push(`${b} cross: ${ref} — missing`); continue }
      if (!readHead(target).includes(b)) issues.push(`${b} → ${ref} — not reciprocal`)
    }
  }
  return issues
}
