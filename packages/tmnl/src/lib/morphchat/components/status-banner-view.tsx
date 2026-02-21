/**
 * Status Banner View — interruption banners + inline recovery + local error modal.
 *
 * Sources:
 * - adapter.statusRows$ (preferred)
 * - adapter.connection$ fallback when no status rows are provided
 *
 * Error rows are printed raw (no opinionated summarization), truncated inline,
 * and expandable to full details in a chat-local modal.
 *
 * @module morphchat/components/status-banner-view
 */

import * as React from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Ban, Info, Maximize2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatErrorDetailsModal } from '@/lib/chat/status'
import { useMorphChatContext } from './surface-context'

// =============================================================================
// Local row shape (adapter-agnostic)
// =============================================================================

type BannerTone = 'info' | 'warn' | 'error'

interface StatusRowLike {
  readonly id: string
  readonly tone: BannerTone
  readonly text: string
  readonly code?: string
  readonly details?: unknown
  readonly source?: 'mock' | 'harness' | 'surface'
}

const EMPTY_ROWS = Atom.make<ReadonlyArray<StatusRowLike>>([])
const STATUS_ROW_MAX = 180

function truncateStatus(text: string): string {
  if (text.length <= STATUS_ROW_MAX) return text
  return `${text.slice(0, STATUS_ROW_MAX - 1)}…`
}

function parseErrorPayload(raw: unknown): { code?: string; summary: string; details: string } {
  if (typeof raw === 'string') {
    // Pattern: [code] message
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

    // Try structured string payload
    try {
      const parsed = JSON.parse(raw) as { code?: string; message?: string }
      if (typeof parsed?.message === 'string') {
        return {
          code: typeof parsed.code === 'string' ? parsed.code : undefined,
          summary: `${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`,
          details: JSON.stringify(parsed, null, 2),
        }
      }
    } catch {
      // plain string
    }

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

  return {
    summary: String(raw),
    details: String(raw),
  }
}

// =============================================================================
// Tone styling
// =============================================================================

const TONE_STYLES: Record<BannerTone, {
  container: string
  icon: string
  IconComponent: typeof Info
}> = {
  info: {
    container: 'border-neutral-800/50 text-neutral-400',
    icon: 'text-neutral-500',
    IconComponent: Info,
  },
  warn: {
    container: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
    icon: 'text-amber-500',
    IconComponent: AlertTriangle,
  },
  error: {
    container: 'border-red-500/20 bg-red-500/5 text-red-300',
    icon: 'text-red-500',
    IconComponent: XCircle,
  },
}

// =============================================================================
// Error code → tone mapping
// =============================================================================

const ERROR_SEVERITY: Record<string, BannerTone> = {
  // Hard errors — red
  'pi-ai-stream-init-failed': 'error',
  'pi-ai-stream-failed': 'error',
  'stream-timeout': 'error',
  'stream-result-timeout': 'error',
  'pi-ai-stream-result-failed': 'error',
  'session-missing': 'error',
  'stream-error': 'error',
  // Warnings — amber
  'tool-round-limit-exceeded': 'warn',
  'tool-use-without-calls': 'warn',
  'model-catalog-failed': 'warn',
}

function toneForCode(code: string): BannerTone {
  return ERROR_SEVERITY[code] ?? 'error'
}

// =============================================================================
// Status Banner View
// =============================================================================

const EMPTY_LAST_ERROR = Atom.make<{ code: string; message: string; at: number } | null>(null)
const EMPTY_CANCELLED_AT = Atom.make<number | null>(null)

export function StatusBannerView() {
  const { adapter } = useMorphChatContext()

  const connection = useAtomValue(adapter.connection$)
  const statusRowsAtom = (adapter.statusRows$ as typeof EMPTY_ROWS | undefined) ?? EMPTY_ROWS
  const adapterRows = useAtomValue(statusRowsAtom)

  // Subscribe to lastError$ if the adapter exposes it (harness adapter does).
  const lastErrorAtom = ((adapter as any).lastError$ as typeof EMPTY_LAST_ERROR | undefined) ?? EMPTY_LAST_ERROR
  const lastError = useAtomValue(lastErrorAtom)

  // Subscribe to cancelledAt$ for fading cancelled badge.
  const cancelledAtAtom = ((adapter as any).cancelledAt$ as typeof EMPTY_CANCELLED_AT | undefined) ?? EMPTY_CANCELLED_AT
  const cancelledAt = useAtomValue(cancelledAtAtom)

  const [activeRow, setActiveRow] = React.useState<StatusRowLike | null>(null)

  const rows = React.useMemo<ReadonlyArray<StatusRowLike>>(() => {
    // Prefer adapter-provided rows (already parsed from harness/runtime errors).
    if (adapterRows.length > 0) return adapterRows

    const out: StatusRowLike[] = []

    // Operational errors from lastError$ atom (harness adapter).
    if (lastError) {
      const tone = toneForCode(lastError.code)
      out.push({
        id: `last-error-${lastError.code}-${lastError.at}`,
        tone,
        text: `[${lastError.code}] ${lastError.message}`,
        code: lastError.code,
        details: lastError,
        source: 'harness',
      })
    }

    // Fallback rows from connection atom when adapter doesn't expose statusRows$.
    if (connection.phase === 'error') {
      const parsed = parseErrorPayload((connection as any).error ?? 'stream error')
      out.push({
        id: `conn-error-${parsed.code ?? 'unknown'}-${parsed.summary}`,
        tone: 'error',
        text: `HARNESS ${parsed.summary}`,
        code: parsed.code,
        details: parsed.details,
        source: 'harness',
      })
    }

    if (connection.phase === 'reconnecting') {
      out.push({
        id: `conn-reconnecting-${connection.reconnectAttempt ?? 0}`,
        tone: 'warn',
        text: `HARNESS reconnecting${connection.reconnectAttempt ? ` (attempt ${connection.reconnectAttempt})` : ''}`,
        source: 'harness',
      })
    }

    return out
  }, [adapterRows, connection.phase, connection.reconnectAttempt, (connection as any).error, lastError])

  const showCancelled = cancelledAt != null
  const hasBanners = rows.length > 0 || showCancelled

  if (!hasBanners) return null

  const showRecoveryActions = connection.phase === 'error' || connection.phase === 'reconnecting'

  return (
    <>
      <div className="flex flex-col gap-0.5 px-4 py-1.5" data-slot="morphchat-status-banners">
        <AnimatePresence mode="popLayout">
          {showCancelled && <CancelledToast key={`cancelled-${cancelledAt}`} />}
          {rows.map((row) => {
            const tone = TONE_STYLES[row.tone] ?? TONE_STYLES.info
            const Icon = tone.IconComponent
            const displayText = truncateStatus(row.text)
            const canExpand = !!row.details || row.text.length > STATUS_ROW_MAX

            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded border font-mono min-w-0',
                  tone.container,
                )}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <Icon size={13} strokeWidth={1.5} className={cn('shrink-0', tone.icon)} />
                <span className="truncate flex-1 min-w-0">{displayText}</span>

                {canExpand && (
                  <BannerAction onClick={() => setActiveRow(row)} title="View full error payload">
                    <Maximize2 size={11} strokeWidth={1.5} />
                  </BannerAction>
                )}

                {/* Inline recovery actions */}
                {row.source === 'harness' && showRecoveryActions && (
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <BannerAction onClick={() => Effect.runPromise(adapter.reconnect()).catch(() => {})}>
                      Reconnect
                    </BannerAction>
                    <BannerAction onClick={() => Effect.runPromise(adapter.cancel()).catch(() => {})}>
                      Cancel
                    </BannerAction>
                    <BannerAction onClick={() => Effect.runPromise(adapter.clear()).catch(() => {})}>
                      Clear
                    </BannerAction>
                  </div>
                )}

                {/* Session-missing: targeted reconnect action */}
                {row.code === 'session-missing' && !showRecoveryActions && (
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <BannerAction onClick={() => Effect.runPromise(adapter.reconnect()).catch(() => {})}>
                      Reconnect
                    </BannerAction>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <ChatErrorDetailsModal
        open={activeRow != null}
        onOpenChange={(open) => {
          if (!open) setActiveRow(null)
        }}
        title={activeRow?.code ? `Harness Error [${activeRow.code}]` : 'Harness Error'}
        summary={activeRow?.text ?? ''}
        details={activeRow?.details ?? activeRow?.text ?? ''}
        severity={(activeRow?.tone ?? 'error') as 'info' | 'warn' | 'error'}
        viewVariant="surface"
        adapterVariant={activeRow?.source === 'mock' ? 'mock' : activeRow?.source === 'harness' ? 'harness' : 'generic'}
        onReconnect={() => Effect.runPromise(adapter.reconnect()).catch(() => {})}
        onCancel={() => Effect.runPromise(adapter.cancel()).catch(() => {})}
        onClear={() => Effect.runPromise(adapter.clear()).catch(() => {})}
      />
    </>
  )
}

StatusBannerView.displayName = 'MorphChat.StatusBannerView'

/**
 * Fading "Cancelled" toast — appears on abort, fades after 3s.
 * Self-contained: the exit animation is driven by AnimatePresence + useEffect auto-removal.
 */
function CancelledToast() {
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded border font-mono',
        'border-neutral-700/50 bg-neutral-800/30 text-neutral-400',
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <Ban size={13} strokeWidth={1.5} className="shrink-0 text-neutral-500" />
      <span>Cancelled</span>
    </motion.div>
  )
}

function BannerAction({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-800/80',
        'text-neutral-300 hover:text-neutral-100 hover:border-neutral-700',
        'transition-all duration-150 active:scale-[0.97]',
        'font-mono',
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </button>
  )
}
