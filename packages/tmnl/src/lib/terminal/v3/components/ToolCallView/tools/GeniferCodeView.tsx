/**
 * GeniferCodeView — Terminal-style renderer for genifer_code tool
 *
 * Extrapolates from BashToolRenderer/TerminalOutput pattern:
 *   - Monospace code display with syntax indication
 *   - Execution status (spinner → success/error)
 *   - Result output in terminal aesthetic
 *   - Expose badges for registered outputs (asRpc, asTool, asAtom, asEvent)
 *   - Audit trail (collapsed by default)
 *
 * Also provides lightweight renderers for the meta-tools:
 *   - genifer_define_rpc / genifer_define_event / genifer_define_tool
 *   - genifer_export_extension
 *
 * @module terminal/v3/components/ToolCallView/tools/GeniferCodeView
 */

'use client'

import { memo, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Code2,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Zap,
  Radio,
  Wrench,
  Package,
  AtSign,
  Timer,
} from 'lucide-react'
import type { ToolViewProps } from '../registry'

// =============================================================================
// Design Tokens — TMNL terminal aesthetic
// =============================================================================

const T = {
  bg: 'rgba(10, 10, 10, 0.95)',
  bgHeader: 'rgba(23, 23, 23, 0.95)',
  bgFooter: 'rgba(23, 23, 23, 0.7)',
  border: 'rgba(64, 64, 64, 0.5)',
  borderActive: 'rgba(34, 211, 238, 0.4)',
  cyan: 'rgb(34, 211, 238)',
  green: 'rgb(34, 197, 94)',
  red: 'rgb(239, 68, 68)',
  amber: 'rgb(245, 158, 11)',
  violet: 'rgb(139, 92, 246)',
  stone400: 'rgb(168, 162, 158)',
  stone500: 'rgb(120, 113, 108)',
  stone600: 'rgb(87, 83, 78)',
} as const

// =============================================================================
// Helpers
// =============================================================================

function parseDetails(result: unknown): {
  mode?: string
  success?: boolean
  result?: unknown
  exposed?: { asRpc?: string; asTool?: string; asAtom?: string; asEvent?: string }
  durationMs?: number
  error?: string
  auditLog?: Array<{ op: string; detail: string }>
} {
  if (!result || typeof result !== 'object') return {}
  const r = result as any
  const details = r.details ?? r.result ?? r
  return {
    mode: details.mode,
    success: details.success,
    result: details.result,
    exposed: details.exposed,
    durationMs: details.durationMs,
    error: details.error,
    auditLog: details.auditLog,
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function formatResult(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  execute: { label: 'EXEC', color: T.cyan },
  define: { label: 'DEFN', color: T.violet },
  pipe: { label: 'PIPE', color: T.amber },
}

// =============================================================================
// GeniferCodeView — The main code mode renderer
// =============================================================================

export const GeniferCodeView = memo(function GeniferCodeView({
  call,
  result,
  isPending,
  className,
}: ToolViewProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showAudit, setShowAudit] = useState(false)

  const code = (call.args as any)?.code ?? ''
  const mode = (call.args as any)?.mode ?? 'execute'
  const details = useMemo(() => parseDetails(result), [result])
  const hasError = result?.isError || details.success === false
  const resultText = formatResult(details.result)
  const modeInfo = MODE_LABELS[mode] ?? { label: mode.toUpperCase(), color: T.stone400 }

  // Exposed outputs
  const exposedEntries = useMemo(() => {
    if (!details.exposed) return []
    const entries: Array<{ label: string; value: string; icon: typeof Zap }> = []
    if (details.exposed.asRpc) entries.push({ label: 'RPC', value: details.exposed.asRpc, icon: Zap })
    if (details.exposed.asTool) entries.push({ label: 'Tool', value: details.exposed.asTool, icon: Wrench })
    if (details.exposed.asAtom) entries.push({ label: 'Atom', value: details.exposed.asAtom, icon: AtSign })
    if (details.exposed.asEvent) entries.push({ label: 'Event', value: details.exposed.asEvent, icon: Radio })
    return entries
  }, [details.exposed])

  return (
    <div
      className={cn('rounded-lg overflow-hidden my-1', className)}
      style={{
        background: T.bg,
        border: `1px solid ${isPending ? T.borderActive : T.border}`,
      }}
      data-tool="genifer_code"
      data-mode={mode}
    >
      {/* Scan line while executing */}
      {isPending && (
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${T.cyan}99, transparent)`,
            animation: 'genifer-code-scan 1.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Header */}
      <div
        style={{ background: T.bgHeader, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isPending ? (
            <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: T.cyan }} />
          ) : hasError ? (
            <XCircle size={13} className="flex-shrink-0" style={{ color: T.red }} />
          ) : (
            <Code2 size={13} className="flex-shrink-0" style={{ color: T.cyan }} />
          )}

          {/* Mode badge */}
          <span
            className="font-mono px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              fontSize: 'var(--tmnl-text-xs, 12px)',
              background: `${modeInfo.color}15`,
              color: modeInfo.color,
              border: `1px solid ${modeInfo.color}30`,
            }}
          >
            {modeInfo.label}
          </span>

          {/* Code preview */}
          <code
            className="font-mono truncate"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: T.stone400 }}
          >
            {truncate(code.split('\n')[0].trim(), 60)}
          </code>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {details.durationMs != null && !isPending && (
            <span
              className="font-mono flex items-center gap-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: T.stone600 }}
            >
              <Timer size={10} />
              {details.durationMs}ms
            </span>
          )}
          {details.success && !isPending && (
            <CheckCircle2 size={12} style={{ color: T.green }} />
          )}
          <ChevronDown
            size={12}
            style={{ color: T.stone500 }}
            className="transition-transform"
            aria-hidden
          />
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="space-y-0">
          {/* Code block */}
          <div className="px-3 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${T.border}` }}>
            <pre
              className="font-mono whitespace-pre-wrap"
              style={{
                fontSize: 'var(--tmnl-text-xs, 12px)',
                color: 'rgb(163, 163, 163)',
                maxHeight: 200,
                overflowY: 'auto',
                lineHeight: 1.6,
              }}
            >
              {code.length > 2000 ? code.slice(0, 2000) + '\n…' : code}
            </pre>
          </div>

          {/* Exposed outputs — badges */}
          {exposedEntries.length > 0 && (
            <div
              className="px-3 py-1.5 flex items-center gap-2 flex-wrap"
              style={{ borderBottom: `1px solid ${T.border}`, background: 'rgba(23,23,23,0.5)' }}
            >
              <span
                className="font-mono"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: T.stone600 }}
              >
                exposed:
              </span>
              {exposedEntries.map(({ label, value, icon: Icon }) => (
                <span
                  key={label}
                  className="font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                  style={{
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    background: `${T.violet}12`,
                    color: T.violet,
                    border: `1px solid ${T.violet}25`,
                  }}
                >
                  <Icon size={10} />
                  {label}: {value}
                </span>
              ))}
            </div>
          )}

          {/* Result / Error output */}
          {(resultText || details.error) && (
            <div className="px-3 py-2">
              {details.error ? (
                <pre
                  className="font-mono whitespace-pre-wrap"
                  style={{
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    color: 'rgb(252, 165, 165)',
                    maxHeight: 160,
                    overflowY: 'auto',
                  }}
                >
                  {details.error}
                </pre>
              ) : resultText ? (
                <div>
                  <span
                    className="font-mono block mb-1"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: T.stone600 }}
                  >
                    → result
                  </span>
                  <pre
                    className="font-mono whitespace-pre-wrap"
                    style={{
                      fontSize: 'var(--tmnl-text-xs, 12px)',
                      color: T.green,
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {resultText.length > 3000 ? resultText.slice(0, 3000) + '\n…' : resultText}
                  </pre>
                </div>
              ) : null}
            </div>
          )}

          {/* Loading skeleton */}
          {isPending && !resultText && !details.error && (
            <div className="px-3 py-2 flex flex-col gap-1.5">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded"
                  style={{ height: 14 + i * 4, background: 'rgba(120,113,108,0.12)', width: `${60 + i * 20}%` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes genifer-code-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  )
})

// =============================================================================
// Meta-Tool Views — define_rpc, define_event, define_tool
// =============================================================================

/** Compact registration confirmation card */
const MetaToolView = memo(function MetaToolView({
  call,
  result,
  isPending,
  className,
  icon: Icon,
  label,
  toolName,
  accentColor,
}: ToolViewProps & {
  icon: typeof Zap
  label: string
  toolName: string
  accentColor: string
}) {
  const params = call.args as Record<string, unknown>
  const name = (params.tag ?? params.name ?? params.eventTag ?? '—') as string
  const details = (result as any)?.details ?? {}
  const registered = details.registered !== false
  const hasError = result?.isError || !registered

  return (
    <div
      className={cn('rounded-lg overflow-hidden my-1', className)}
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
      }}
      data-tool={toolName}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ background: T.bgHeader }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isPending ? (
            <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: accentColor }} />
          ) : hasError ? (
            <XCircle size={13} className="flex-shrink-0" style={{ color: T.red }} />
          ) : (
            <Icon size={13} className="flex-shrink-0" style={{ color: accentColor }} />
          )}
          <span
            className="font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: T.stone500 }}
          >
            {label}
          </span>
          <code
            className="font-mono truncate"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)', color: accentColor }}
          >
            {name}
          </code>
        </div>
        {!isPending && (
          <span className="flex-shrink-0">
            {registered ? (
              <CheckCircle2 size={13} style={{ color: T.green }} />
            ) : (
              <XCircle size={13} style={{ color: T.red }} />
            )}
          </span>
        )}
      </div>
    </div>
  )
})

export const GeniferDefineRpcView = memo(function GeniferDefineRpcView(props: ToolViewProps) {
  return <MetaToolView {...props} icon={Zap} label="register rpc" toolName="genifer_define_rpc" accentColor={T.cyan} />
})

export const GeniferDefineEventView = memo(function GeniferDefineEventView(props: ToolViewProps) {
  return <MetaToolView {...props} icon={Radio} label="register event" toolName="genifer_define_event" accentColor={T.amber} />
})

export const GeniferDefineToolView = memo(function GeniferDefineToolView(props: ToolViewProps) {
  return <MetaToolView {...props} icon={Wrench} label="register tool" toolName="genifer_define_tool" accentColor={T.violet} />
})

// =============================================================================
// Export Extension View
// =============================================================================

export const GeniferExportExtensionView = memo(function GeniferExportExtensionView({
  call,
  result,
  isPending,
  className,
}: ToolViewProps) {
  const [collapsed, setCollapsed] = useState(true)
  const surfaceId = (call.args as any)?.surfaceId ?? ''
  const details = (result as any)?.details ?? {}
  const exportName = details.extensionName ?? details.name ?? surfaceId.slice(0, 12)
  const hasError = result?.isError
  const manifest = details.manifest
    ? JSON.stringify(details.manifest, null, 2)
    : null

  return (
    <div
      className={cn('rounded-lg overflow-hidden my-1', className)}
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
      }}
      data-tool="genifer_export_extension"
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        style={{ background: T.bgHeader }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isPending ? (
            <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: T.cyan }} />
          ) : hasError ? (
            <XCircle size={13} className="flex-shrink-0" style={{ color: T.red }} />
          ) : (
            <Package size={13} className="flex-shrink-0" style={{ color: T.green }} />
          )}
          <span
            className="font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: T.stone500 }}
          >
            export
          </span>
          <code
            className="font-mono truncate"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)', color: T.green }}
          >
            {exportName}
          </code>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {!isPending && !hasError && (
            <CheckCircle2 size={12} style={{ color: T.green }} />
          )}
          <ChevronDown
            size={12}
            style={{ color: T.stone500 }}
            className="transition-transform"
          />
        </div>
      </div>

      {!collapsed && manifest && (
        <pre
          className="px-3 py-2 font-mono overflow-x-auto"
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: T.stone400,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {manifest.length > 5000 ? manifest.slice(0, 5000) + '\n…' : manifest}
        </pre>
      )}
    </div>
  )
})
