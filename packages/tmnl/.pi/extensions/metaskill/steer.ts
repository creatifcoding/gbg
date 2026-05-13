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

import { truncateToWidth } from '@mariozechner/pi-tui'
import type { Theme } from '@mariozechner/pi-coding-agent'

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
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    const first = data[0] as Record<string, unknown>

    // ConformanceAudit shape: { name, level, label, type }
    if ('level' in first && 'label' in first && 'name' in first) {
      const ungoverned = data.filter((r: any) => r.level <= 0)
      const governed = data.filter((r: any) => r.level >= 1)
      const clean = data.filter((r: any) => r.level >= 2)
      const complete = data.filter((r: any) => r.level >= 3)

      if (ungoverned.length > 0) {
        annotations.push({
          icon: '⚡',
          message: `${ungoverned.length} ungoverned skill${ungoverned.length > 1 ? 's' : ''}`,
          command: `ms.discover().filter(s => !s.governed).map(s => ms.adopt(s.name))`,
        })
      }

      if (governed.length > 0 && clean.length < governed.length) {
        const failing = governed.length - clean.length
        annotations.push({
          icon: '🔧',
          message: `${failing} governed but failing health checks`,
          command: `ms.discover().map(s => ms.inspect(s.name)).filter(r => !r.clean)`,
        })
      }

      if (clean.length > complete.length) {
        const gap = clean.length - complete.length
        annotations.push({
          icon: '📈',
          message: `${gap} clean but not yet complete — check type-specific requirements`,
          command: `ms.conformanceAudit().filter(r => r.level === 2).map(r => ({ name: r.name, type: r.type }))`,
        })
      }
    }

    // Audit shape: { name, governed, fileCount, fmMissing }
    if ('governed' in first && 'fmMissing' in first) {
      const ungov = data.filter((r: any) => !r.governed).length
      const fmGaps = data.filter((r: any) => r.fmMissing > 0).length
      if (ungov > 0) {
        annotations.push({
          icon: '⚡',
          message: `${ungov}/${data.length} ungoverned`,
          command: `ms.discover().filter(s => !s.governed).map(s => ms.adopt(s.name))`,
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
      data.forEach((r: any) => { if (r.type in types) types[r.type as keyof typeof types]++ })
      annotations.push({
        icon: '📊',
        message: `${types.leaf} leaf · ${types.reference} reference · ${types.operational} operational`,
      })
    }
  }

  // ── Single object ──
  if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>

    // HealthReport shape: { clean, summary, checks }
    if ('clean' in obj && 'checks' in obj) {
      if (obj.clean) {
        annotations.push({ icon: '✅', message: 'All checks pass' })
        // Suggest conformance check
        if ('skill' in obj) {
          annotations.push({
            icon: '📈',
            message: 'Check conformance level',
            command: `ms.conformance('${obj.skill}')`,
          })
        }
      } else if (Array.isArray(obj.checks)) {
        const failing = (obj.checks as any[]).filter(c => !c.pass)
        for (const f of failing.slice(0, 3)) {
          annotations.push({
            icon: '❌',
            message: `${f.name}${f.detail ? ': ' + f.detail : ''}`,
          })
        }
        if (failing.length > 3) {
          annotations.push({ icon: '…', message: `${failing.length - 3} more failures` })
        }
      }
    }

    // Conformance shape: { level, label, type, detail }
    if ('level' in obj && 'label' in obj && 'type' in obj && 'detail' in obj) {
      const level = obj.level as number
      const type = obj.type as string

      if (level < 2 && type !== 'missing') {
        annotations.push({
          icon: '🔧',
          message: 'Run inspect to see what\'s failing',
          command: code.includes("'") ? undefined : `ms.inspect('${extractSkillName(code)}')`,
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
export function renderAnnotations(annotations: Annotation[], width: number, theme: Theme): string[] {
  if (annotations.length === 0) return []

  const lines: string[] = [
    '',
    theme.fg('dim', '─'.repeat(Math.min(width, 60))),
  ]

  for (const a of annotations) {
    let line = `${a.icon} ${theme.fg('muted', a.message)}`
    if (a.command) {
      line += '  ' + theme.fg('dim', '→ ') + theme.fg('accent', a.command)
    }
    lines.push(truncateToWidth(line, width))
  }

  return lines
}

// ─── Helpers ─────────────────────────────────────────────

function extractSkillName(code: string): string {
  const match = code.match(/'([^']+)'/)
  return match?.[1] ?? '...'
}
