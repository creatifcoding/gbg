/**
 * GeniferToolView — Seamless artifact card for genifer tool calls
 *
 * Renders the generated/refined UI tree directly inline in the chat thread.
 * Minimal chrome for traceability: status dot, element count, quality badge.
 * The tree itself renders seamlessly via genifer's Renderer.
 *
 * Registered for: genifer_generate, genifer_refine, genifer_query
 *
 * @module terminal/v3/components/ToolCallView/tools/GeniferToolView
 */

'use client'

import { memo, useMemo, useState, useCallback } from 'react'
import { HashMap } from 'effect'
import { cn } from '@/lib/utils'
import { Sparkles, RefreshCw, Database, Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import type { ToolViewProps } from '../registry'
import { Renderer, DefaultFallback } from '@/lib/genifer/react/renderer'
import { UITree, UIElement } from '@/lib/genifer/core/schemas'

// =============================================================================
// Helpers
// =============================================================================

/** Parse a UITree from the tool result details */
function parseTree(details: unknown): UITree | null {
  if (!details || typeof details !== 'object') return null
  const d = details as Record<string, unknown>
  const snapshot = d.treeSnapshot
  if (!snapshot || typeof snapshot !== 'object') return null
  try {
    // Snapshot is a serialized UITree — rebuild it
    const snap = snapshot as Record<string, unknown>
    const root = snap.root as string
    const elements = snap.elements
    if (!root || !elements) return null

    // Elements could be HashMap entries or a plain object
    if (Array.isArray(elements)) {
      // Schema.HashMap encodes as [key, value][] pairs
      const entries = elements.map(([k, v]: [string, unknown]) => [k, new UIElement(v as any)] as const)
      return new UITree({ root, elements: HashMap.fromIterable(entries) })
    }

    if (typeof elements === 'object' && !Array.isArray(elements)) {
      // Plain object { key: element }
      const entries = Object.entries(elements as Record<string, unknown>).map(
        ([k, v]) => [k, new UIElement(v as any)] as const
      )
      return new UITree({ root, elements: HashMap.fromIterable(entries) })
    }

    return null
  } catch {
    return null
  }
}

/** Extract metadata from result details */
function extractMeta(details: unknown): {
  surfaceId?: string
  elementCount?: number
  qualityScore?: number
  repairCount?: number
  durationMs?: number
  model?: string
  threadId?: string
  stage?: string
  treeId?: string | null
} {
  if (!details || typeof details !== 'object') return {}
  return details as any
}

// =============================================================================
// Tokens
// =============================================================================

const T = {
  bg: 'rgba(28, 25, 23, 0.85)',
  border: 'rgba(120, 113, 108, 0.2)',
  borderActive: 'rgba(34, 211, 238, 0.3)',
  header: 'rgba(41, 37, 36, 0.9)',
  footer: 'rgba(41, 37, 36, 0.6)',
  glow: '0 0 16px rgba(34, 211, 238, 0.08)',
} as const

// =============================================================================
// GeniferGenerateView — The Artifact Card
// =============================================================================

export const GeniferGenerateView = memo(function GeniferGenerateView({
  call,
  result,
  isPending,
  className,
}: ToolViewProps) {
  const [collapsed, setCollapsed] = useState(false)
  const prompt = (call.args as any)?.prompt ?? ''
  const details = (result as any)?.details ?? (result as any)?.result
  const meta = useMemo(() => extractMeta(details), [details])
  const tree = useMemo(() => parseTree(details), [details])
  const elementCount = meta.elementCount ?? (tree ? HashMap.size(tree.elements) : 0)
  const qualityPct = meta.qualityScore != null ? Math.round(meta.qualityScore * 100) : null
  const hasError = result?.isError

  return (
    <div
      className={cn('rounded-lg overflow-hidden my-1', className)}
      style={{
        background: T.bg,
        border: `1px solid ${isPending ? T.borderActive : T.border}`,
        boxShadow: T.glow,
      }}
      data-tool="genifer_generate"
      data-surface-id={meta.surfaceId}
    >
      {/* Scan line while streaming */}
      {isPending && (
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, rgba(34,211,238,0.6), transparent)`,
            animation: 'genifer-scan 1.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Header */}
      <div
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isPending ? (
            <Loader2 size={13} className="text-cyan-400 animate-spin flex-shrink-0" />
          ) : hasError ? (
            <XCircle size={13} className="text-red-400 flex-shrink-0" />
          ) : (
            <Sparkles size={13} className="text-cyan-400 flex-shrink-0" />
          )}
          <span
            className="font-mono text-stone-200 truncate"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {prompt.length > 72 ? prompt.slice(0, 69) + '…' : prompt}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {elementCount > 0 && (
            <span className="font-mono text-stone-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {elementCount} el
            </span>
          )}
          {qualityPct != null && !isPending && (
            <span
              className="font-mono px-1.5 py-0.5 rounded"
              style={{
                fontSize: 'var(--tmnl-text-xs, 12px)',
                background: qualityPct >= 80 ? 'rgba(34,211,238,0.12)' : 'rgba(239,68,68,0.12)',
                color: qualityPct >= 80 ? 'rgb(103,232,249)' : 'rgb(252,165,165)',
              }}
            >
              {qualityPct}%
            </span>
          )}
          <ChevronDown
            size={12}
            className="text-stone-500 transition-transform"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
        </div>
      </div>

      {/* Body — seamless tree render */}
      {!collapsed && (
        <div className="p-3" style={{ minHeight: isPending ? 64 : undefined }}>
          {tree ? (
            <Renderer
              tree={tree}
              loading={isPending}
              fallback={DefaultFallback}
              disableAnimations={isPending}
            />
          ) : isPending ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="animate-pulse rounded"
                  style={{ height: 20 + i * 8, background: 'rgba(120,113,108,0.12)' }}
                />
              ))}
            </div>
          ) : hasError ? (
            <div className="text-red-300/80 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {result?.errorMessage ?? 'Generation failed'}
            </div>
          ) : (
            <div className="text-stone-500 font-mono text-center py-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              No content
            </div>
          )}
        </div>
      )}

      {/* Footer — trace metadata */}
      {!collapsed && !isPending && meta.surfaceId && (
        <div
          className="flex items-center justify-between px-3 py-1 font-mono text-stone-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', background: T.footer, borderTop: `1px solid ${T.border}` }}
        >
          <span>{meta.model ?? '—'} · {meta.durationMs ?? 0}ms{meta.repairCount ? ` · ${meta.repairCount} repairs` : ''}</span>
          <span>{meta.surfaceId?.slice(0, 8)}{meta.treeId ? ` → ${meta.treeId.slice(0, 8)}` : ''}</span>
        </div>
      )}

      <style>{`@keyframes genifer-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  )
})

// =============================================================================
// GeniferRefineView — Refinement artifact card
// =============================================================================

export const GeniferRefineView = memo(function GeniferRefineView({
  call,
  result,
  isPending,
  className,
}: ToolViewProps) {
  const [collapsed, setCollapsed] = useState(false)
  const instruction = (call.args as any)?.instruction ?? ''
  const sourceSurfaceId = (call.args as any)?.surfaceId ?? ''
  const details = (result as any)?.details ?? (result as any)?.result
  const meta = useMemo(() => extractMeta(details), [details])
  const tree = useMemo(() => parseTree(details), [details])
  const hasError = result?.isError

  return (
    <div
      className={cn('rounded-lg overflow-hidden my-1', className)}
      style={{
        background: T.bg,
        border: `1px solid ${isPending ? T.borderActive : T.border}`,
        boxShadow: T.glow,
      }}
      data-tool="genifer_refine"
      data-surface-id={meta.surfaceId}
    >
      {isPending && (
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, rgba(34,211,238,0.6), transparent)`,
            animation: 'genifer-scan 1.8s ease-in-out infinite',
          }}
        />
      )}

      <div
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isPending ? (
            <Loader2 size={13} className="text-cyan-400 animate-spin flex-shrink-0" />
          ) : hasError ? (
            <XCircle size={13} className="text-red-400 flex-shrink-0" />
          ) : (
            <RefreshCw size={13} className="text-cyan-400 flex-shrink-0" />
          )}
          <span className="font-mono text-stone-400 flex-shrink-0" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {sourceSurfaceId.slice(0, 8)} →
          </span>
          <span
            className="font-mono text-stone-200 truncate"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {instruction.length > 60 ? instruction.slice(0, 57) + '…' : instruction}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {meta.elementCount != null && meta.elementCount > 0 && (
            <span className="font-mono text-stone-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {meta.elementCount} el
            </span>
          )}
          <ChevronDown
            size={12}
            className="text-stone-500 transition-transform"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
        </div>
      </div>

      {!collapsed && (
        <div className="p-3" style={{ minHeight: isPending ? 64 : undefined }}>
          {tree ? (
            <Renderer tree={tree} loading={isPending} fallback={DefaultFallback} disableAnimations={isPending} />
          ) : isPending ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map(i => (
                <div key={i} className="animate-pulse rounded" style={{ height: 18 + i * 6, background: 'rgba(120,113,108,0.12)' }} />
              ))}
            </div>
          ) : hasError ? (
            <div className="text-red-300/80 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {result?.errorMessage ?? 'Refinement failed'}
            </div>
          ) : null}
        </div>
      )}

      {!collapsed && !isPending && meta.surfaceId && (
        <div
          className="flex items-center justify-between px-3 py-1 font-mono text-stone-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', background: T.footer, borderTop: `1px solid ${T.border}` }}
        >
          <span>
            +{(meta as any).addedElements ?? 0} −{(meta as any).removedElements ?? 0} ~{(meta as any).modifiedElements ?? 0}
          </span>
          <span>{meta.surfaceId?.slice(0, 8)}</span>
        </div>
      )}
    </div>
  )
})

// =============================================================================
// GeniferQueryView — Lightweight data display
// =============================================================================

export const GeniferQueryView = memo(function GeniferQueryView({
  call,
  result,
  isPending,
  className,
}: ToolViewProps) {
  const [collapsed, setCollapsed] = useState(false)
  const operation = (call.args as any)?.operation ?? 'query'
  const hasError = result?.isError
  const resultText = result?.result
    ? typeof result.result === 'string'
      ? result.result
      : JSON.stringify(result.result, null, 2)
    : ''

  return (
    <div
      className={cn('rounded-lg overflow-hidden my-1', className)}
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
      }}
      data-tool="genifer_query"
    >
      <div
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          {isPending ? (
            <Loader2 size={13} className="text-blue-400 animate-spin" />
          ) : hasError ? (
            <XCircle size={13} className="text-red-400" />
          ) : (
            <Database size={13} className="text-stone-400" />
          )}
          <span className="font-mono text-stone-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            {operation}
          </span>
        </div>
        <ChevronDown
          size={12}
          className="text-stone-500 transition-transform"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        />
      </div>

      {!collapsed && !isPending && resultText && (
        <pre
          className="px-3 py-2 font-mono text-stone-400 overflow-x-auto"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: 240, overflowY: 'auto' }}
        >
          {resultText.length > 3000 ? resultText.slice(0, 3000) + '\n…' : resultText}
        </pre>
      )}
    </div>
  )
})
