/**
 * Steering Annotations
 *
 * Inspects the result data shape and suggests next `ms.*` actions.
 * Rendered at the bottom of the grid output — human-only, not sent to LLM.
 *
 * Each annotation is a one-liner: icon + observation + suggested command.
 *
 * @module
 */

import type { RenderContext } from './render-core.ts'

export interface Annotation {
  icon: string
  message: string
  command?: string
}

/**
 * Analyze result data and return steering annotations.
 * Returns empty array if nothing actionable detected.
 */
export function steer(data: unknown, code: string): Annotation[] {
  if (data === null || data === undefined) return []

  const annotations: Annotation[] = []

  // ── Array of objects — pattern match on known shapes ──
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    const rows = data as Record<string, unknown>[]
    const first = rows[0]

    // ConformanceAudit shape: { name, level, label, type }
    if ('level' in first && 'label' in first && 'name' in first) {
      const ungoverned = rows.filter(r => Number(r.level) <= 0)
      const governed = rows.filter(r => Number(r.level) >= 1)
      const clean = rows.filter(r => Number(r.level) >= 2)
      const complete = rows.filter(r => Number(r.level) >= 3)

      if (ungoverned.length > 0) {
        annotations.push({
          icon: '⚡',
          message: `${ungoverned.length} ungoverned skill${ungoverned.length > 1 ? 's' : ''}`,
          command: `const skills = await ms.discover(); await Promise.all(skills.filter(s => !s.governed).map(s => ms.adopt(s.name)))`,
        })
      }

      if (governed.length > 0 && clean.length < governed.length) {
        const failing = governed.length - clean.length
        annotations.push({
          icon: '🔧',
          message: `${failing} governed but failing health checks`,
          command: `const skills = await ms.discover(); const reports = await Promise.all(skills.map(s => ms.inspect(s.name))); return reports.filter(r => !r.clean)`,
        })
      }

      if (clean.length > complete.length) {
        const gap = clean.length - complete.length
        annotations.push({
          icon: '📈',
          message: `${gap} clean but not yet complete — check type-specific requirements`,
          command: `return (await ms.conformanceAudit()).filter(r => r.level === 2).map(r => ({ name: r.name, type: r.type }))`,
        })
      }
    }

    // Audit shape: { name, governed, fileCount, fmMissing }
    if ('governed' in first && 'fmMissing' in first) {
      const ungov = rows.filter(r => !r.governed).length
      const fmGaps = rows.filter(r => Number(r.fmMissing) > 0).length
      if (ungov > 0) {
        annotations.push({
          icon: '⚡',
          message: `${ungov}/${rows.length} ungoverned`,
          command: `const skills = await ms.discover(); await Promise.all(skills.filter(s => !s.governed).map(s => ms.adopt(s.name)))`,
        })
      }
      if (fmGaps > 0) {
        annotations.push({
          icon: '📋',
          message: `${fmGaps} skills missing frontmatter`,
        })
      }
    }

    // SkillInfo shape: { name, type, governed }
    if ('type' in first && 'governed' in first && !('fmMissing' in first)) {
      const types = { leaf: 0, reference: 0, operational: 0 }
      for (const r of rows) {
        const t = r.type
        if (t === 'leaf' || t === 'reference' || t === 'operational') types[t]++
      }
      annotations.push({
        icon: '📊',
        message: `${types.leaf} leaf · ${types.reference} reference · ${types.operational} operational`,
      })
    }
  }

  // ── Single object ──
  if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>

    // Profile shape: { name, health, level, label, type, stale, pending, clean }
    if ('name' in obj && 'health' in obj && 'level' in obj && 'label' in obj && 'type' in obj && 'stale' in obj && 'pending' in obj && 'clean' in obj) {
      const name = String(obj.name)
      const level = Number(obj.level)
      const stale = Number(obj.stale)
      const pending = Number(obj.pending)
      const clean = Boolean(obj.clean)

      if (!clean) {
        annotations.push({
          icon: '🔧',
          message: 'Inspect failing health checks',
          command: `await ms.inspect(${JSON.stringify(name)})`,
        })
      }
      if (level < 3) {
        annotations.push({
          icon: '📈',
          message: 'Check conformance upgrade path',
          command: `await ms.conformance(${JSON.stringify(name)})`,
        })
      }
      if (stale > 0 || pending > 0) {
        annotations.push({
          icon: '🔄',
          message: `${stale} stale · ${pending} pending update-policy item${stale + pending === 1 ? '' : 's'}`,
          command: `await ms.freshness(${JSON.stringify(name)})`,
        })
      }
      if (clean && level >= 3 && stale === 0 && pending === 0) {
        annotations.push({ icon: '✅', message: 'Skill is clean, complete, fresh' })
      }
    }

    // FreshnessAll shape: { total, current, stale, pending, untracked }
    if ('total' in obj && 'current' in obj && 'stale' in obj && 'pending' in obj && 'untracked' in obj && !('skill' in obj)) {
      const total = Number(obj.total)
      const stale = Number(obj.stale)
      const pending = Number(obj.pending)
      const untracked = Number(obj.untracked)

      if (stale > 0) {
        annotations.push({
          icon: '🔄',
          message: `${stale} stale update-policy document${stale === 1 ? '' : 's'}`,
          command: 'await ms.staleAll()',
        })
      }
      if (pending > 0) {
        annotations.push({ icon: '⏳', message: `${pending} pending update-policy review${pending === 1 ? '' : 's'}` })
      }
      if (untracked > 0) {
        annotations.push({ icon: '📋', message: `${untracked} untracked file${untracked === 1 ? '' : 's'} may need update-policy frontmatter` })
      }
      if (total > 0 && stale === 0 && pending === 0) {
        annotations.push({ icon: '✅', message: 'All tracked update-policy docs are current' })
      }
    }

    // FreshnessReport shape: { skill, total, current, stale, pending, policies }
    if ('skill' in obj && 'total' in obj && 'current' in obj && 'stale' in obj && 'pending' in obj && 'policies' in obj) {
      const stale = Number(obj.stale)
      const pending = Number(obj.pending)
      const total = Number(obj.total)

      if (stale > 0) {
        annotations.push({ icon: '🔄', message: `${stale} stale update-policy document${stale === 1 ? '' : 's'}` })
      }
      if (pending > 0) {
        annotations.push({ icon: '⏳', message: `${pending} pending update-policy review${pending === 1 ? '' : 's'}` })
      }
      if (total > 0 && stale === 0 && pending === 0) {
        annotations.push({ icon: '✅', message: 'All update-policy documents are current' })
      }
    }

    // HealthReport shape: { clean, summary, checks }
    if ('clean' in obj && 'checks' in obj) {
      if (obj.clean) {
        annotations.push({ icon: '✅', message: 'All checks pass' })
        if ('skill' in obj) {
          annotations.push({
            icon: '📈',
            message: 'Check conformance level',
            command: `await ms.conformance(${JSON.stringify(String(obj.skill))})`,
          })
        }
      } else if (Array.isArray(obj.checks)) {
        const failing = obj.checks.filter(
          (c): c is Record<string, unknown> =>
            typeof c === 'object' && c !== null && !('pass' in c && (c as Record<string, unknown>).pass),
        )
        for (const f of failing.slice(0, 3)) {
          const name = typeof f.name === 'string' ? f.name : String(f.name ?? '')
          const detail = typeof f.detail === 'string' ? f.detail : undefined
          annotations.push({
            icon: '❌',
            message: `${name}${detail ? ': ' + detail : ''}`,
          })
        }
        if (failing.length > 3) {
          annotations.push({ icon: '…', message: `${failing.length - 3} more failures` })
        }
      }
    }

    // Conformance shape: { level, label, type, detail }
    if ('level' in obj && 'label' in obj && 'type' in obj && 'detail' in obj) {
      const level = Number(obj.level)
      const type = String(obj.type)

      if (level < 2 && type !== 'missing') {
        annotations.push({
          icon: '🔧',
          message: "Run inspect to see what's failing",
          command: `await ms.inspect(${JSON.stringify(extractSkillName(code))})`,
        })
      }
      if (level === 2 && type === 'reference') {
        annotations.push({
          icon: '📈',
          message: 'Add GRAPH.md to reach level 3 (complete)',
        })
      }
      if (level === 2 && type === 'operational') {
        annotations.push({
          icon: '📈',
          message: 'Add utils/ and GRAPH.md to reach level 3 (complete)',
        })
      }
    }
  }

  return annotations
}

/**
 * Render annotations as styled lines.
 */
export function renderAnnotations(annotations: Annotation[], width: number, ctx: RenderContext): string[] {
  if (annotations.length === 0) return []

  const lines: string[] = [
    '',
    ctx.theme.fg('dim', '─'.repeat(Math.min(width, 60))),
  ]

  for (const a of annotations) {
    let line = `${a.icon} ${ctx.theme.fg('muted', a.message)}`
    if (a.command) {
      line += '  ' + ctx.theme.fg('dim', '→ ') + ctx.theme.fg('accent', a.command)
    }
    lines.push(ctx.text.truncateToWidth(line, width))
  }

  return lines
}

// ─── Helpers ─────────────────────────────────────────────

function extractSkillName(code: string): string {
  const match = code.match(/'([^']+)'/)
  return match?.[1] ?? '...'
}
