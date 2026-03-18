/**
 * Steering Annotations
 *
 * Inspects the result data shape and suggests next `cm.*` actions.
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
  /** Priority tier — lower = more important. Used for context-aware suppression.
   *  1: critical (errors, governance failures)
   *  2: actionable (specific suggestions with commands)
   *  3: informational (stats, nudges)
   *  4: cosmetic (formatting nudges like "wrap in TUI primitive")
   */
  priority?: number
}

/** Context usage info for suppression calculus */
export interface SteerContext {
  /** Estimated tokens used, or null if unknown */
  tokens: number | null
  /** Model context window size */
  contextWindow: number
  /** Usage as percentage of context window, or null if unknown */
  percent: number | null
}

// ── Cadence state (module-level, survives across tool calls) ──

/**
 * Per-nudge-type tracking: how many times it has fired, and when the
 * agent last "acted on it" (e.g., used a _v primitive after getting the nudge).
 */
interface NudgeTracker {
  /** Total times this nudge has been generated (before cadence filter) */
  seen: number
  /** Total times this nudge has been emitted (after cadence filter) */
  emitted: number
  /** Call index of last emission */
  lastEmittedAt: number
}

const _nudgeState = new Map<string, NudgeTracker>()
let _callIndex = 0

/** Derive a stable key for a nudge type */
function nudgeKey(a: Annotation): string {
  return `${a.icon}:${a.message.slice(0, 40)}`
}

function getTracker(key: string): NudgeTracker {
  let t = _nudgeState.get(key)
  if (!t) {
    t = { seen: 0, emitted: 0, lastEmittedAt: -Infinity }
    _nudgeState.set(key, t)
  }
  return t
}

/**
 * Compute the nudge interval for a given priority tier and context pressure.
 *
 * The interval is how many tool calls to skip between repeats of the same nudge.
 * Lower priority + higher context pressure → wider interval.
 *
 * Formula:
 *   interval = baseCadence(priority) × pressureMultiplier(contextPercent)
 *
 * Base cadence by priority:
 *   1 (critical):      1 — always fires
 *   2 (actionable):    1 — always fires (these have specific commands)
 *   3 (informational): 2 — every other call
 *   4 (cosmetic):      3 — every 3rd call
 *
 * Pressure multiplier by context %:
 *   0-30%:   1.0× — no pressure
 *  30-60%:   1.5× — light pressure
 *  60-80%:   2.0× — moderate pressure
 *  80%+:     3.0× — heavy pressure
 *
 * Examples:
 *   cosmetic @ 10%  → interval 3 (every 3rd call)
 *   cosmetic @ 50%  → interval 4.5 → 4 (every 4th)
 *   cosmetic @ 75%  → interval 6 (every 6th)
 *   cosmetic @ 90%  → interval 9 (every 9th)
 *   critical @ 90%  → interval 3 (every 3rd — still frequent)
 */
function nudgeInterval(priority: number, ctx?: SteerContext): number {
  // Base cadence by priority tier
  const baseCadence = priority <= 2 ? 1 : priority === 3 ? 2 : 3

  // Pressure multiplier from context usage
  let pressure = 1.0
  if (ctx?.percent !== null && ctx?.percent !== undefined) {
    if (ctx.percent >= 80) pressure = 3.0
    else if (ctx.percent >= 60) pressure = 2.0
    else if (ctx.percent >= 30) pressure = 1.5
  }

  return Math.floor(baseCadence * pressure)
}

/**
 * Should this nudge fire on this call?
 * Uses the interval to space out repeated nudges.
 */
function shouldEmit(key: string, priority: number, ctx?: SteerContext): boolean {
  const tracker = getTracker(key)
  const interval = nudgeInterval(priority, ctx)

  // Always emit on first sighting
  if (tracker.emitted === 0) return true

  // Check if enough calls have passed since last emission
  return (_callIndex - tracker.lastEmittedAt) >= interval
}

/** Record that a nudge was emitted */
function recordEmission(key: string): void {
  const tracker = getTracker(key)
  tracker.emitted++
  tracker.lastEmittedAt = _callIndex
}

/** Record that a nudge was seen (generated, may or may not be emitted) */
function recordSeen(key: string): void {
  getTracker(key).seen++
}

/**
 * Signal that the agent acted on a nudge type — reset its tracker.
 * Called when we detect the agent used a _v primitive (for the cosmetic nudge).
 */
export function _acknowledgeNudge(icon: string): void {
  for (const [key, tracker] of _nudgeState) {
    if (key.startsWith(`${icon}:`)) {
      tracker.seen = 0
      tracker.emitted = 0
      tracker.lastEmittedAt = -Infinity
    }
  }
}

/** Reset all cadence state — for testing */
export function _resetDebounce(): void {
  _nudgeState.clear()
  _callIndex = 0
}

/**
 * Analyze result data and return steering annotations.
 * Returns empty array if nothing actionable detected.
 *
 * @param data - The result from ms tool execution
 * @param code - The code that was executed
 * @param context - Optional context usage for suppression calculus
 */
export function steer(data: unknown, code: string, context?: SteerContext): Annotation[] {
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
          command: `cm.discover().filter(s => !s.governed).map(s => cm.adopt(s.name))`,
          priority: 1,
        })
      }

      if (governed.length > 0 && clean.length < governed.length) {
        const failing = governed.length - clean.length
        annotations.push({
          icon: '🔧',
          message: `${failing} governed but failing health checks`,
          command: `cm.discover().map(s => cm.inspect(s.name)).filter(r => !r.clean)`,
          priority: 1,
        })
      }

      if (clean.length > complete.length) {
        const gap = clean.length - complete.length
        annotations.push({
          icon: '📈',
          message: `${gap} clean but not yet complete — check type-specific requirements`,
          command: `cm.conformanceAudit().filter(r => r.level === 2).map(r => ({ name: r.name, type: r.type }))`,
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
          command: `cm.discover().filter(s => !s.governed).map(s => cm.adopt(s.name))`,
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

    // freshnessAll shape: { total, current, stale, pending, untracked } — no 'policies' key
    if ('untracked' in obj && 'current' in obj && !('policies' in obj)) {
      const s = obj.stale as number
      const u = obj.untracked as number
      if (s > 0) annotations.push({ icon: '🔄', message: `${s} stale doc${s > 1 ? 's' : ''} workspace-wide`, command: 'cm.staleAll()' })
      if (u > 0) annotations.push({ icon: '📋', message: `${u} files without update-policy` })
      if (s === 0 && (obj.total as number) > 0) annotations.push({ icon: '✅', message: 'All tracked docs current' })
    }

    // FreshnessReport shape: { skill, total, stale, pending, policies }
    if ('stale' in obj && 'pending' in obj && 'policies' in obj) {
      const staleCount = obj.stale as number
      const pendingCount = obj.pending as number
      if (staleCount > 0) {
        annotations.push({
          icon: '🔄',
          message: `${staleCount} stale doc${staleCount > 1 ? 's' : ''} — update-strategy triggered`,
          command: `cm.freshness('${extractSkillName(code)}').policies.filter(p => p.status === 'stale')`,
        })
      }
      if (pendingCount > 0) {
        annotations.push({
          icon: '⏳',
          message: `${pendingCount} pending update${pendingCount > 1 ? 's' : ''}`,
        })
      }
      if (staleCount === 0 && pendingCount === 0 && (obj.total as number) > 0) {
        annotations.push({ icon: '✅', message: 'All update policies current' })
      }
    }

    // Profile shape: { name, health, level, label, type, policies, stale, clean }
    if ('health' in obj && 'level' in obj && 'label' in obj && 'policies' in obj) {
      const level = obj.level as number
      const staleCount = obj.stale as number
      if (!obj.clean) {
        annotations.push({ icon: '🔧', message: `Health: ${obj.health}`, command: `cm.inspect('${obj.name}')` })
      }
      if (level < 3) {
        annotations.push({ icon: '📈', message: `Level ${level} (${obj.label}) → inspect for upgrade path`, command: `cm.conformance('${obj.name}')` })
      }
      if (staleCount > 0) {
        annotations.push({ icon: '🔄', message: `${staleCount} stale doc${staleCount > 1 ? 's' : ''}`, command: `cm.freshness('${obj.name}')` })
      }
      if (obj.clean && level === 3 && staleCount === 0) {
        annotations.push({ icon: '✅', message: `${obj.name}: clean, complete, fresh` })
      }
    }

    // HealthReport shape: { clean, summary, checks }
    if ('clean' in obj && 'checks' in obj) {
      if (obj.clean) {
        annotations.push({ icon: '✅', message: 'All checks pass' })
        // Suggest conformance check
        if ('skill' in obj) {
          annotations.push({
            icon: '📈',
            message: 'Check conformance level',
            command: `cm.conformance('${obj.skill}')`,
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
          command: code.includes("'") ? undefined : `cm.inspect('${extractSkillName(code)}')`,
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

  // ── RLM: Store operations (put or store) ──
  const putMatch = code.match(/(?:cm|ms)\.(?:store|put)\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/)
  if (putMatch) {
    annotations.push({
      icon: '📦',
      message: `Stored ${putMatch[2]} in ${putMatch[1]}`,
      command: `await cm.get('${putMatch[1]}', '${putMatch[2]}')`,
      priority: 3,
    })
  }

  // ── RLM: Empty query/search results ──
  if (Array.isArray(data) && data.length === 0 && (code.includes('cm.query(') || code.includes('cm.search('))) {
    annotations.push({
      icon: '🔍',
      message: 'No matches — try broader terms or check await cm.collections()',
      command: 'await cm.collections()',
    })
  }

  // ── RLM: Search results — suggest viewing top hit ──
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    const first = data[0] as Record<string, unknown>
    if ('score' in first && 'matchedFields' in first && 'collection' in first && 'key' in first) {
      annotations.push({
        icon: '🔎',
        message: `Top hit: ${first.collection}:${first.key} (score ${first.score})`,
        command: `await cm.get('${first.collection}', '${first.key}')`,
      })
    }
  }

  // ── RLM: Collection stats ──
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    const first = data[0] as Record<string, unknown>

    // CollectionInfo shape: { name, count, updated }
    if ('count' in first && 'updated' in first && 'name' in first && !('level' in first) && !('governed' in first)) {
      const totalObjects = data.reduce((sum: number, c: any) => sum + (c.count ?? 0), 0)
      if (totalObjects === 0) {
        annotations.push({
          icon: '💡',
          message: 'No stored objects yet — use cm.store() to persist findings',
        })
      } else if (totalObjects > 50) {
        const largest = data.reduce((a: any, b: any) => (a.count > b.count ? a : b)) as any
        annotations.push({
          icon: '📊',
          message: `${totalObjects} objects across ${data.length} collections — largest: ${largest.name} (${largest.count})`,
        })
      }
    }

    // VarInfo shape: { collection, key, type, size, tags, preview, updated }
    if ('collection' in first && 'preview' in first && 'size' in first) {
      const totalSize = data.reduce((sum: number, v: any) => sum + (v.size ?? 0), 0)
      if (totalSize > 100_000) {
        annotations.push({
          icon: '📊',
          message: `${(totalSize / 1024).toFixed(1)}KB total stored data`,
        })
      }
    }
  }

  // ── RLM: Sub-LM calls ──
  if (code.includes('cm.llm(') || code.includes('cm.llm_batch(')) {
    annotations.push({
      icon: '🤖',
      message: 'Sub-LM call — consider cm.store() to persist results',
      priority: 3,
    })
  }

  // ── Primitive nudge: raw objects/arrays returned without _v tag ──
  // Priority 4 (cosmetic) — suppressed when context is filling up or repeated too often
  if (data !== null && data !== undefined && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (!('_v' in obj)) {
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        annotations.push({
          icon: '🎨',
          message: 'Wrap array results in { _v: "tbl", d: [...] } for rich TUI rendering',
          priority: 4,
        })
      } else if (!Array.isArray(data)) {
        annotations.push({
          icon: '🎨',
          message: 'Wrap object results in { _v: "kv", d: {...} } for rich TUI rendering',
          priority: 4,
        })
      }
    }
  }

  // ── Cadence filter ──
  // Advance the call counter
  _callIndex++

  // If the result has _v, the agent acted on the primitive nudge — acknowledge it
  if (data && typeof data === 'object' && '_v' in (data as Record<string, unknown>)) {
    _acknowledgeNudge('🎨')
  }

  // Apply cadence: for each annotation, check if it should fire on this call
  const filtered = annotations.filter(a => {
    const key = nudgeKey(a)
    const priority = a.priority ?? 2
    recordSeen(key)

    if (shouldEmit(key, priority, context)) {
      recordEmission(key)
      return true
    }
    return false
  })

  return filtered
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
