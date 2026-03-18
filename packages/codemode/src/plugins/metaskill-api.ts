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

export type SkillType = 'leaf' | 'reference' | 'operational'

export interface SkillInfo {
  name: string
  path: string
  type: SkillType
  governed: boolean
  fileCount: number
  files: string[]
  hasChangelog: boolean
  hasGraph: boolean
  hasUtils: boolean
  hasRefs: boolean
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

export type UpdateStatus = 'current' | 'stale' | 'pending'

export interface UpdatePolicy {
  file: string
  strategy: string          // freetext: how/when to update
  trigger: string           // observable event: what makes it stale
  status: UpdateStatus      // current | stale | pending
}

export interface FreshnessReport {
  skill: string
  total: number            // files with update-strategy
  current: number
  stale: number
  pending: number
  policies: UpdatePolicy[]
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
    const rels = files.map(f => relative(dir, f))
    const head = readHead(join(dir, 'SKILL.md'))
    const hasUtils = existsSync(join(dir, 'utils'))
    const hasRefs = rels.some(f => f.startsWith('references/'))
    return {
      name,
      path: dir,
      type: classifySkill(files.length, hasUtils, hasRefs),
      governed: head.includes('governed-by: metaskill'),
      fileCount: files.length,
      files: rels,
      hasChangelog: existsSync(join(dir, 'CHANGELOG.md')),
      hasGraph: existsSync(join(dir, 'GRAPH.md')),
      hasUtils,
      hasRefs,
      hasTemplate: existsSync(join(dir, 'TEMPLATE.md')),
    }
  }

  /** Classify skill by shape:
   *  - operational: has utils/ (protocols, mutations, tooling)
   *  - reference: has references/ but no utils/ (knowledge-heavy, read-only)
   *  - leaf: everything else (1-2 files, self-contained)
   */
  function classifySkill(fileCount: number, hasUtils: boolean, hasRefs: boolean): SkillType {
    if (hasUtils) return 'operational'
    if (hasRefs) return 'reference'
    return 'leaf'
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

    // Update freshness — files with update-strategy must not be stale
    const staleDocs = findStaleDocs(dir, files)
    // No-op if no files declare update-strategy (check passes trivially)
    checks.push(check('update-freshness',
      staleDocs.length === 0,
      staleDocs.length > 0 ? `Stale: ${staleDocs.join(', ')}` : undefined))

    // Pi registration — YAML frontmatter with name + description
    const reg = hasPiRegistration(dir)
    const regDetail = !reg.hasYaml ? 'No YAML frontmatter (--- fence)'
      : !reg.hasName ? 'Missing name: in YAML frontmatter'
      : !reg.hasDescription ? 'Missing description: in YAML frontmatter'
      : reg.descriptionPlaceholder ? 'Description is a placeholder (TODO) — write a real one'
      : undefined
    checks.push(check('pi-registration', reg.registered, regDetail))

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
  function scaffold(name: string, opts?: { refs?: boolean, description?: string }): string[] {
    const dir = join(skillsDir, name)
    const created: string[] = []
    const write = (rel: string, content: string) => {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content)
      created.push(rel)
    }

    write('SKILL.md', [
      `---`,
      `name: ${name}`,
      `description: ${opts?.description ?? 'TODO — describe what this skill does and when to use it.'}`,
      `---`,
      '',
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

    const clLines = [
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
    ]
    if (opts?.refs) {
      clLines.push(`| \`+\` | \`references/INDEX.md\` | Created. |`)
    }
    write('CHANGELOG.md', clLines.join('\n'))

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

  // ── Conformance ─────────────────────────────────────────

  /**
   * Type-aware conformance levels. What "mature" means depends on the skill type:
   *
   *   leaf:        0 exists → 1 governed → 2 clean                (ceiling)
   *   reference:   0 exists → 1 governed → 2 clean → 3 complete   (has GRAPH.md)
   *   operational:  0 exists → 1 governed → 2 clean → 3 instrumented (has utils/ AND GRAPH.md)
   *
   * Level meanings:
   *  -1  missing      No SKILL.md
   *   0  exists       Has SKILL.md but not governed/no changelog/fm gaps
   *   1  governed     Governed + changelog + frontmatter on all files
   *   2  clean        Passes full inspect (all health checks)
   *   3  complete     Type-specific maturity ceiling reached
   */
  function conformance(name: string): { level: number, label: string, type: SkillType, detail: string[] } {
    const dir = join(skillsDir, name)
    const detail: string[] = []

    // Level -1: missing
    if (!existsSync(join(dir, 'SKILL.md'))) {
      return { level: -1, label: 'missing', type: 'leaf', detail: ['No SKILL.md'] }
    }

    const skillInfo = info(name)
    const skillType = skillInfo.type
    detail.push(`type: ${skillType}`)
    detail.push('✓ SKILL.md exists')

    // Level 0 → 1: governed
    const head = readHead(join(dir, 'SKILL.md'))
    const governed = head.includes('governed-by: metaskill')
    const hasCl = existsSync(join(dir, 'CHANGELOG.md'))
    const files = findMd(dir)
    const fmGaps = files.filter(f => !hasFrontmatter(f))

    if (!governed) detail.push('✗ No governance')
    else detail.push('✓ Governed')
    if (!hasCl) detail.push('✗ No CHANGELOG')
    else detail.push('✓ CHANGELOG')
    if (fmGaps.length > 0) detail.push(`✗ ${fmGaps.length} files missing frontmatter`)
    else detail.push(`✓ Frontmatter (${files.length} files)`)

    if (!governed || !hasCl || fmGaps.length > 0) {
      return { level: 0, label: 'exists', type: skillType, detail }
    }

    // Level 1 → 2: clean (full inspect pass)
    const rpt = inspect(name)
    if (!rpt.clean) {
      const failing = rpt.checks.filter(c => !c.pass).map(c => `✗ ${c.name}`)
      detail.push(...failing)
      return { level: 1, label: 'governed', type: skillType, detail }
    }
    detail.push('✓ All health checks pass')

    // Level 2 → 3: type-specific maturity
    if (skillType === 'leaf') {
      // Leaf skills max out at level 2 — they don't need utils or GRAPH
      detail.push('✓ Leaf skill — fully mature at level 2')
      return { level: 2, label: 'complete', type: skillType, detail }
    }

    const hasGraph = existsSync(join(dir, 'GRAPH.md'))
    if (!hasGraph) detail.push('✗ No GRAPH.md')
    else detail.push('✓ Has GRAPH.md')

    if (skillType === 'reference') {
      // Reference skills need GRAPH.md to be level 3 — utils not expected
      if (hasGraph) {
        detail.push('✓ Reference skill — fully mature at level 3')
        return { level: 3, label: 'complete', type: skillType, detail }
      }
      return { level: 2, label: 'clean', type: skillType, detail }
    }

    // Operational: needs both utils/ AND GRAPH.md
    const hasUtils = existsSync(join(dir, 'utils'))
    if (!hasUtils) detail.push('✗ No utils/')
    else detail.push('✓ Has utils/')

    if (hasUtils && hasGraph) {
      detail.push('✓ Operational skill — fully mature at level 3')
      return { level: 3, label: 'complete', type: skillType, detail }
    }
    return { level: 2, label: 'clean', type: skillType, detail }
  }

  // ── Update Freshness ─────────────────────────────────────

  /** Report update-policy status for a skill. Returns all docs with update-strategy. */
  function freshness(name: string): FreshnessReport {
    const dir = join(skillsDir, name)
    const files = findMd(dir)
    const policies: UpdatePolicy[] = []
    for (const f of files) {
      const head = readHead(f)
      const strategy = head.match(/^> update-strategy: (.+)/m)
      if (!strategy) continue // no-op: file doesn't declare an update policy
      const trigger = head.match(/^> update-trigger: (.+)/m)
      const status = head.match(/^> update-status: (.+)/m)
      policies.push({
        file: relative(dir, f),
        strategy: strategy[1].trim(),
        trigger: trigger?.[1]?.trim() ?? 'manual',
        status: (status?.[1]?.trim() as UpdateStatus) ?? 'current',
      })
    }
    return {
      skill: name,
      total: policies.length,
      current: policies.filter(p => p.status === 'current').length,
      stale: policies.filter(p => p.status === 'stale').length,
      pending: policies.filter(p => p.status === 'pending').length,
      policies,
    }
  }

  /** Mark a doc's update-status. Flips the switch. */
  function setUpdateStatus(filePath: string, status: UpdateStatus): void {
    setFrontmatter(filePath, 'update-status', status)
  }

  /** Conformance summary for all skills */
  function conformanceAudit(): { name: string, level: number, label: string, type: SkillType }[] {
    return discover().map(s => {
      const c = conformance(s.name)
      return { name: s.name, level: c.level, label: c.label, type: c.type }
    })
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

  // ── Composed Helpers (eval discipline) ──────────────────

  /**
   * Full profile of a skill: health + conformance + freshness in one call.
   * Eliminates the 3-call pattern agents repeat everywhere.
   */
  function profile(name: string) {
    const h = inspect(name)
    const c = conformance(name)
    const f = freshness(name)
    return {
      name,
      health: h.summary,
      level: c.level,
      label: c.label,
      type: c.type,
      policies: f.total,
      stale: f.stale,
      pending: f.pending,
      clean: h.clean,
      checks: h.total,
    }
  }

  /**
   * Map a function over all discovered skills. Replaces the
   * `ms.discover().map(s => ...)` pattern that bloats every eval.
   *
   * Usage: ms.each(s => s.name)           → string[]
   *        ms.each(s => ms.profile(s.name)) → profile[]
   */
  function each<T>(fn: (s: SkillInfo) => T): T[] {
    return discover().map(fn)
  }

  /**
   * Filter + map over all skills. Replaces the
   * `ms.discover().filter(...).map(...)` chain.
   *
   * Usage: ms.where(s => !s.governed, s => s.name) → ungoverned names
   */
  function where<T>(pred: (s: SkillInfo) => boolean, fn: (s: SkillInfo) => T): T[] {
    return discover().filter(pred).map(fn)
  }

  /**
   * All stale docs across all skills. One call, no loops.
   */
  function staleAll(): UpdatePolicy[] {
    return discover().flatMap(s =>
      freshness(s.name).policies.filter(p => p.status === 'stale')
    )
  }

  /**
   * Workspace-wide freshness summary. One number per bucket.
   */
  function freshnessAll(): { total: number, current: number, stale: number, pending: number, untracked: number } {
    const all = discover()
    let total = 0, current = 0, stale = 0, pending = 0, fileCount = 0
    for (const s of all) {
      fileCount += s.fileCount
      const f = freshness(s.name)
      total += f.total
      current += f.current
      stale += f.stale
      pending += f.pending
    }
    return { total, current, stale, pending, untracked: fileCount - total }
  }

  return {
    // Discovery
    discover, info,
    // Inspection
    inspect, audit,
    // Conformance
    conformance, conformanceAudit,
    // Freshness
    freshness, setUpdateStatus,
    // Composed
    profile, each, where, staleAll, freshnessAll,
    // Frontmatter
    frontmatter, setFrontmatter,
    // Protocols
    protocol, protocols,
    // Utils
    utils, runUtil,
    // Mutations
    adopt, scaffold,
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

/** Read lines from a file, returns [] on error */
function readLines(path: string): string[] {
  try { return readFileSync(path, 'utf-8').split('\n') } catch { return [] }
}

/** Skip past YAML frontmatter (--- ... ---), returns index after closing fence */
function skipYaml(lines: string[], from: number = 0): number {
  if (lines[from] !== '---') return from
  let i = from + 1
  while (i < lines.length && lines[i] !== '---') i++
  return i < lines.length ? i + 1 : i
}

/** Scan through heading, empty, and blockquote lines — returns index of first content line */
function scanMeta(lines: string[], from: number = 0): number {
  let i = from
  while (i < lines.length) {
    const t = lines[i].trim()
    if (t === '' || t.startsWith('#') || t.startsWith('>')) i++
    else break
  }
  return i
}

/** Read the head of a skill doc: YAML frontmatter + heading + blockquote metadata */
function readHead(path: string): string {
  const lines = readLines(path)
  if (lines.length === 0) return ''
  const afterYaml = skipYaml(lines)
  const afterMeta = scanMeta(lines, afterYaml)
  return lines.slice(0, afterMeta).join('\n')
}

function hasFrontmatter(path: string): boolean {
  return /> (up|prereqs|provides|governed-by|meta|children|cross):/.test(readHead(path))
}

/** Check if SKILL.md has YAML frontmatter (--- fenced) with name + real description for pi registration */
function hasPiRegistration(skillDir: string): { registered: boolean, hasYaml: boolean, hasName: boolean, hasDescription: boolean, descriptionPlaceholder: boolean } {
  const skillMd = join(skillDir, 'SKILL.md')
  if (!existsSync(skillMd)) return { registered: false, hasYaml: false, hasName: false, hasDescription: false, descriptionPlaceholder: false }
  const content = readFileSync(skillMd, 'utf-8')
  const hasYaml = content.startsWith('---\n')
  if (!hasYaml) return { registered: false, hasYaml: false, hasName: false, hasDescription: false, descriptionPlaceholder: false }
  const endIdx = content.indexOf('\n---', 4)
  if (endIdx === -1) return { registered: false, hasYaml: true, hasName: false, hasDescription: false, descriptionPlaceholder: false }
  const yaml = content.slice(4, endIdx)
  const hasName = /^name:\s*.+/m.test(yaml)
  const descMatch = yaml.match(/^description:\s*(.+)/m)
  const hasDescription = !!descMatch
  const descValue = descMatch?.[1]?.trim() ?? ''
  const descriptionPlaceholder = /^TODO\b/i.test(descValue) || descValue === '' || descValue === '""' || descValue === "''"
  return { registered: hasName && hasDescription && !descriptionPlaceholder, hasYaml, hasName, hasDescription, descriptionPlaceholder }
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
    // Only scan actual frontmatter block (contiguous > lines at top of file)
    const lines = readHead(f).split('\n')
    for (const line of lines) {
      // Stop at first non-frontmatter line (not starting with > and not blank/heading)
      if (!line.startsWith('>') && !line.startsWith('#') && line.trim() !== '') break
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

function findStaleDocs(dir: string, files: string[]): string[] {
  const stale: string[] = []
  for (const f of files) {
    const head = readHead(f)
    // Only check files that declare update-strategy — no-op otherwise
    if (!head.match(/^> update-strategy: /m)) continue
    const statusMatch = head.match(/^> update-status: (.+)/m)
    const status = statusMatch?.[1]?.trim() ?? 'current'
    if (status === 'stale') stale.push(basename(f))
  }
  return stale
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
