/**
 * Harness adapter helpers — stateless utility functions.
 *
 * Depends on: types.ts, atoms.ts (for registry writes), logging.ts
 *
 * @module morphchat/hooks/harness-adapter/helpers
 */

import { Option } from 'effect'
import { HarnessRuntimeError } from '@/lib/harness'
import type { HarnessThinkingLevel } from '@/lib/harness/schemas'
import { morphChatRegistry } from '../../atoms/registry'
import { statusRows$, lastError$ } from './atoms'
import type { HarnessStatusRow } from './types'

// ─── Status Row Management ────────────────────────────────────────────────────

export function pushStatusRow(id: string, row: HarnessStatusRow): void {
  morphChatRegistry.update(statusRows$(id), (prev) => [row, ...prev].slice(0, 8))
  // Track last error for enrichment atoms
  if (row.tone === 'error') {
    morphChatRegistry.set(lastError$(id), {
      code: row.code ?? 'UNKNOWN',
      message: row.text,
      at: Date.now(),
      details: row.details,
    })
  }
}

// ─── Error Formatting ─────────────────────────────────────────────────────────

export function formatUnknownErrorPayload(payload: unknown): { code?: string; message: string; details: unknown } {
  const stringify = (v: unknown) => { try { return JSON.stringify(v, null, 2) } catch { return String(v) } }
  const unwrap = (v: unknown): unknown => {
    if (!v || typeof v !== 'object') return v
    const r = v as Record<string, unknown>
    if (r._tag === 'Some') return r.value
    if (r._tag === 'None') return undefined
    return v
  }

  if (payload instanceof HarnessRuntimeError) {
    return { code: payload.code, message: payload.message, details: { _tag: 'HarnessRuntimeError', code: payload.code, message: payload.message, cause: unwrap(payload.cause) } }
  }
  if (payload instanceof Error) return { code: payload.name, message: payload.message, details: payload.stack ?? `${payload.name}: ${payload.message}` }
  if (typeof payload === 'string') {
    try { const p = JSON.parse(payload); if (typeof p?.message === 'string') return { code: p.code, message: p.message, details: stringify(p) } } catch { /* noop */ }
    return { message: payload, details: payload }
  }
  if (payload && typeof payload === 'object') {
    const r = payload as Record<string, unknown>
    return { code: typeof r.code === 'string' ? r.code : undefined, message: typeof r.message === 'string' ? r.message : stringify(r), details: r }
  }
  return { message: String(payload), details: String(payload) }
}

export function runtimeErrorToStatus(id: string, op: string, err: HarnessRuntimeError): HarnessStatusRow {
  const parsed = formatUnknownErrorPayload(err)
  return { id: `status-${Date.now()}-${op}`, tone: 'error', text: `[${op}] ${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`, code: parsed.code, details: parsed.details, source: 'harness' }
}

// ─── Message Topology ─────────────────────────────────────────────────────────

export function hasMessageTopologyChanged(prev: ReadonlyArray<string>, next: ReadonlyArray<string>): boolean {
  if (prev.length !== next.length) return true
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return true
  }
  return false
}

// ─── Thinking Level Conversion ────────────────────────────────────────────────

export function toHarnessThinkingLevel(level?: unknown): Option.Option<HarnessThinkingLevel> {
  if (typeof level === 'string') {
    switch (level) {
      case 'none': return Option.some('off' as HarnessThinkingLevel)
      case 'low': return Option.some('low' as HarnessThinkingLevel)
      case 'medium': return Option.some('medium' as HarnessThinkingLevel)
      case 'high': return Option.some('high' as HarnessThinkingLevel)
      default: return Option.none()
    }
  }
  if (typeof level === 'number') {
    if (level <= 0) return Option.some('off' as HarnessThinkingLevel)
    if (level <= 1) return Option.some('low' as HarnessThinkingLevel)
    if (level <= 2) return Option.some('medium' as HarnessThinkingLevel)
    return Option.some('high' as HarnessThinkingLevel)
  }
  return Option.none()
}
