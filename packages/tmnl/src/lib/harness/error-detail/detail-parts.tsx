/**
 * Error detail compound sub-components.
 *
 * Shared parts composed by each category variant.
 * All access state via ErrorDetailContext — no prop drilling.
 *
 * @module harness/error-detail/detail-parts
 */

import { memo, useState, useCallback, type ReactNode } from 'react'
import { ChevronRight, X, Copy, Check } from 'lucide-react'
import { useErrorDetail } from './detail-context'
import type { ActionDef } from './types'

// ─── Header ──────────────────────────────────────────────────────────────────

export const DetailHeader = memo(function DetailHeader() {
  const { meta: { config }, actions } = useErrorDetail()
  const IconComponent = config.Icon

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0"
      style={{ height: 22, borderBottom: `1px solid ${config.borderTint}` }}
    >
      <IconComponent size={11} strokeWidth={1.5} style={{ color: config.accent, flexShrink: 0 }} />
      <span
        className="font-mono font-medium truncate"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: config.accent }}
      >
        {config.label}
      </span>
      <span
        className="ml-auto font-mono shrink-0"
        style={{
          fontSize: '9px',
          color: config.accent,
          border: `1px solid ${config.borderTint}`,
          borderRadius: 2,
          padding: '0 4px',
        }}
      >
        {config.severityLabel}
      </span>
      <button
        type="button"
        onClick={actions.onDismiss}
        className="shrink-0 text-neutral-600 hover:text-neutral-400 transition-colors"
        style={{ fontSize: '9px' }}
        aria-label="Dismiss"
      >
        <X size={10} strokeWidth={1.5} />
      </button>
    </div>
  )
})

// ─── Message ─────────────────────────────────────────────────────────────────

export const DetailMessage = memo(function DetailMessage() {
  const { state, meta: { config } } = useErrorDetail()

  return (
    <div
      className="px-2 py-1.5 font-mono break-words"
      style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        color: config.accent,
        borderBottom: `1px solid ${config.borderTint.replace('0.2', '0.08')}`,
      }}
    >
      {state.message}
    </div>
  )
})

// ─── Metadata grid ───────────────────────────────────────────────────────────

export interface MetadataRow {
  readonly label: string
  readonly value: string | ReactNode
  /** Highlight in accent color */
  readonly accent?: boolean
}

export const MetadataGrid = memo(function MetadataGrid({ rows }: { rows: ReadonlyArray<MetadataRow> }) {
  const { meta: { config } } = useErrorDetail()

  if (rows.length === 0) return null

  return (
    <div
      className="px-2 py-1"
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 1fr',
        gap: '2px 8px',
        fontSize: '9px',
        borderBottom: `1px solid ${config.borderTint.replace('0.2', '0.08')}`,
      }}
    >
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <span className="font-mono text-neutral-600 truncate">{row.label}</span>
          <span
            className="font-mono truncate"
            style={{ color: row.accent ? config.accent : '#737373' }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
})

// ─── Raw payload accordion ───────────────────────────────────────────────────

export const RawAccordion = memo(function RawAccordion() {
  const { state } = useErrorDetail()
  const [open, setOpen] = useState(false)

  const rawText = typeof state.details === 'string'
    ? state.details
    : JSON.stringify(state.details, null, 2)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 w-full text-left font-mono text-neutral-600 hover:text-neutral-400 transition-colors"
        style={{ fontSize: '9px' }}
      >
        <ChevronRight
          size={9}
          strokeWidth={1.5}
          className="transition-transform duration-100"
          style={{ transform: open ? 'rotate(90deg)' : undefined }}
        />
        <span>raw</span>
      </button>
      {open && (
        <pre
          className="mx-2 mb-1 max-h-[120px] overflow-auto rounded font-mono text-neutral-400"
          style={{
            fontSize: '9px',
            padding: '4px 6px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {rawText}
        </pre>
      )}
    </div>
  )
})

// ─── Inline raw cause (for defects — no accordion) ──────────────────────────

export const InlineRawCause = memo(function InlineRawCause({ cause }: { cause: string }) {
  const { meta: { config } } = useErrorDetail()

  return (
    <pre
      className="mx-2 my-1 max-h-[120px] overflow-auto rounded font-mono"
      style={{
        fontSize: '9px',
        padding: '4px 6px',
        color: '#737373',
        background: `${config.accent}08`,
        border: `1px solid ${config.accent}14`,
      }}
    >
      {cause}
    </pre>
  )
})

// ─── Action footer ───────────────────────────────────────────────────────────

export const ActionFooter = memo(function ActionFooter({ defs }: { defs: ReadonlyArray<ActionDef> }) {
  const { actions, meta: { config } } = useErrorDetail()

  const dispatch = useCallback((action: ActionDef['action']) => {
    switch (action) {
      case 'dismiss': return actions.onDismiss()
      case 'reconnect': return actions.onReconnect?.()
      case 'new-session': return actions.onNewSession?.()
      case 'copy-diagnostic': return actions.onCopyDiagnostic?.()
      case 'retry-catalog': return actions.onReconnect?.()
      case 'switch-model': return void 0 // future: open model selector
      case 'resume': return void 0 // future: resume message
    }
  }, [actions])

  // Separate primary (left-aligned) from dismiss (right-aligned)
  const primary = defs.filter((d) => d.action !== 'dismiss')
  const dismiss = defs.find((d) => d.action === 'dismiss')

  return (
    <div
      className="flex items-center gap-1 px-2 py-1"
      style={{ borderTop: `1px solid ${config.borderTint.replace('0.2', '0.06')}` }}
    >
      {primary.map((def) => (
        <ActionButton
          key={def.action}
          def={def}
          accent={def.accent ?? config.accent}
          onClick={() => dispatch(def.action)}
        />
      ))}
      <span className="flex-1" />
      {dismiss && (
        <ActionButton
          def={dismiss}
          accent="#404040"
          onClick={() => dispatch('dismiss')}
        />
      )}
    </div>
  )
})

// ─── Action button ───────────────────────────────────────────────────────────

const ActionButton = memo(function ActionButton({
  def,
  accent,
  onClick,
}: {
  def: ActionDef
  accent: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono transition-colors hover:brightness-125"
      style={{
        fontSize: '9px',
        color: accent,
        border: `1px solid ${accent}33`,
        borderRadius: 2,
        padding: '1px 6px',
      }}
    >
      {def.label}
    </button>
  )
})

// ─── Copy diagnostic button (special — shows ✓ on copy) ─────────────────────

export const CopyDiagnosticButton = memo(function CopyDiagnosticButton() {
  const { state, meta: { config } } = useErrorDetail()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const payload = JSON.stringify({
      code: state.code,
      message: state.message,
      at: state.at,
      details: state.details,
    }, null, 2)
    await navigator.clipboard.writeText(payload)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [state])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="font-mono flex items-center gap-1 transition-colors hover:brightness-125"
      style={{
        fontSize: '9px',
        color: config.accent,
        border: `1px solid ${config.accent}33`,
        borderRadius: 2,
        padding: '1px 6px',
      }}
    >
      {copied ? <Check size={9} strokeWidth={2} /> : <Copy size={9} strokeWidth={1.5} />}
      {copied ? 'Copied' : 'Copy Diagnostic'}
    </button>
  )
})

// ─── Timestamp ───────────────────────────────────────────────────────────────

export function formatTimestamp(at: number): string {
  const d = new Date(at)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
