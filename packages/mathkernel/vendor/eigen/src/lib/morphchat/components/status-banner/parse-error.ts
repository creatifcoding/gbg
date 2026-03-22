/**
 * Error payload parsing and text truncation.
 *
 * @module morphchat/components/status-banner/parse-error
 */

import { STATUS_ROW_MAX } from './constants'

export function truncateStatus(text: string): string {
  if (text.length <= STATUS_ROW_MAX) return text
  return `${text.slice(0, STATUS_ROW_MAX - 1)}…`
}

export function parseErrorPayload(raw: unknown): { code?: string; summary: string; details: string } {
  if (typeof raw === 'string') {
    const bracket = raw.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
    if (bracket) {
      const code = bracket[1]?.trim()
      const message = bracket[2]?.trim() ?? ''
      return {
        code: code || undefined,
        summary: `${code ? `[${code}] ` : ''}${message}`.trim(),
        details: raw,
      }
    }
    try {
      const parsed = JSON.parse(raw) as { code?: string; message?: string }
      if (typeof parsed?.message === 'string') {
        return {
          code: typeof parsed.code === 'string' ? parsed.code : undefined,
          summary: `${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`,
          details: JSON.stringify(parsed, null, 2),
        }
      }
    } catch { /* plain string */ }
    return { summary: raw, details: raw }
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>
    const code = typeof rec.code === 'string' ? rec.code : undefined
    const message = typeof rec.message === 'string' ? rec.message : JSON.stringify(rec)
    return {
      code,
      summary: `${code ? `[${code}] ` : ''}${message}`,
      details: JSON.stringify(rec, null, 2),
    }
  }
  return { summary: String(raw), details: String(raw) }
}
